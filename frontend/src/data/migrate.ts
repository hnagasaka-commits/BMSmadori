/**
 * §5.1.2 マイグレーション + Zod 前サニタイザー群。
 *
 * すべて `unknown` を受けて防御的に振る舞う(信頼境界の外側からの入力を前提)。
 * Zod 検証より前に走るので、TypeError を投げず、剥がした件数を返して ER5 トーストに加算する。
 */

import type { CurrentPhase, SchemaVersion } from '@/types'
import { CURRENT_PHASE } from '@/types'

// ============================================================================
// SchemaVersion 比較
// ============================================================================

/**
 * "1.2.0" や "1.10" を受けても順序を間違えない最小限の比較関数。
 * parseFloat だと "1.10" < "1.2" を誤判定するため使わない。
 * patch 以降は無視(本仕様では minor 互換のみを使うため)。
 */
export function compareSchemaVersion(a: string, b: string): number {
  const parse = (v: string): [number, number] => {
    const parts = v.split('.')
    const maj = parseInt(parts[0] ?? '0', 10) || 0
    const min = parseInt(parts[1] ?? '0', 10) || 0
    return [maj, min]
  }
  const [aMaj, aMin] = parse(a)
  const [bMaj, bMin] = parse(b)
  return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin
}

/**
 * §5.1.2 アプリが書き込む現行スキーマ版。
 * Phase ごとに進める: Phase 1 = "1.0" / Phase 1.5 = "1.1" / Phase 3 = "1.2"。
 */
export const CURRENT_SCHEMA_VERSION: SchemaVersion =
  CURRENT_PHASE === '1' ? '1.0' : CURRENT_PHASE === '3' ? '1.2' : '1.1'

export type LoadMode = 'normal' | 'readonly'

/**
 * §5.1.2 手順 3: ファイルの version からモードを決める。
 * 将来 version は readonly モードに逃がして TolerantFloorplanSchema で扱う。
 *
 * 引数は raw string(SchemaVersion 型に絞らない、手順 2 と整合)。
 */
export function chooseLoadMode(fileVersion: string): LoadMode {
  return compareSchemaVersion(fileVersion, CURRENT_SCHEMA_VERSION) > 0 ? 'readonly' : 'normal'
}

// ============================================================================
// migrate
// ============================================================================

export type Migrator = (data: unknown, from: string) => unknown

/**
 * バージョン間 migrator のテーブル。breaking change のたびに追加する。
 *
 * Phase 1.0 → 1.1 や 1.1 → 1.2 は minor 互換なので migrator 不要 (Zod 検証で通る)。
 * Major 更新 (1.x → 2.0) のみここに登録する。
 */
export const migrators: Record<string, Migrator> = {
  // "0.9": migrateFrom0_9, // 将来の旧版マイグレーション例
}

/**
 * 現状は minor 互換更新のみ想定なので素通し。
 * Major 更新を導入したら migrators[fromVersion] を経由してチェーンする。
 */
export function migrate(data: unknown, fromVersion: string): unknown {
  let current = data
  let v = fromVersion
  let guard = 0
  while (v !== CURRENT_SCHEMA_VERSION && migrators[v] && guard < 20) {
    current = migrators[v]!(current, v)
    // 次のバージョンを引く方法は migrator 側で決める想定(本仕様では呼ばれない)
    v = CURRENT_SCHEMA_VERSION
    guard++
  }
  return current
}

// ============================================================================
// stripDisallowedForPhase
// ============================================================================

const PHASE_FORBIDDEN: Record<CurrentPhase, readonly string[]> = {
  '1': ['columns', 'pipeSpaces', 'furniture', 'humanModels', 'voids'],
  '1.5': ['furniture', 'humanModels', 'voids'],
  '2': ['voids'],
  '3': [],
}

/**
 * §5.1.2 手順 5: Phase 別の禁止フィールドを除去する shallow sanitizer。
 *
 * 信頼境界の外側を想定し、`unknown` を受けて `Array.isArray` で守りながら、
 * 配列フィールドだけを潰す。形が崩れていても TypeError を投げない。
 *
 * 配列でない不正値(オブジェクトや数値が入っている等)も空配列に正規化する。
 *
 * 戻り値の `stripped` は剥がした件数(配列要素の合計)。ER5 トーストに加算する。
 */
export function stripDisallowedForPhase(
  raw: unknown,
  phase: CurrentPhase,
): { data: unknown; stripped: number } {
  const forbidden = PHASE_FORBIDDEN[phase]
  if (forbidden.length === 0) return { data: raw, stripped: 0 }
  if (!raw || typeof raw !== 'object') return { data: raw, stripped: 0 }
  const plan = raw as Record<string, unknown>
  const floors = plan.floors
  if (!Array.isArray(floors)) return { data: raw, stripped: 0 }

  let stripped = 0
  for (const f of floors) {
    if (!f || typeof f !== 'object') continue
    const floor = f as Record<string, unknown>
    for (const k of forbidden) {
      const arr = floor[k]
      if (Array.isArray(arr)) {
        if (arr.length > 0) {
          stripped += arr.length
          floor[k] = []
        }
      } else if (arr !== undefined) {
        // 配列でない不正値は Zod に渡さず空配列に正規化
        floor[k] = []
      }
    }
  }
  return { data: raw, stripped }
}

// ============================================================================
// ensureEdgeIds
// ============================================================================

/**
 * §5.1.2 手順 5a: Shape.edgeIds の欠落を補完。
 *
 * Wall.id と EdgeId は別の名前空間に保つ(混ぜると Door.wallId の意味がぶれる)。
 * このサニタイザーは形状側の補完だけを担い、Wall.id ↔ EdgeId の対応は §5.2 の
 * 再バインド規約 (整合性チェック段階) が担う。
 *
 * 既存 edgeIds が部分的に揃っている場合(配列だが要素数が足りない / 非 string が混在)、
 * 揃っている要素は保持し、足りない/不正な要素のみ新発行する。
 */
export function ensureEdgeIds(raw: unknown): { data: unknown; generated: number } {
  if (!raw || typeof raw !== 'object') return { data: raw, generated: 0 }
  const plan = raw as Record<string, unknown>
  const floors = plan.floors
  if (!Array.isArray(floors)) return { data: raw, generated: 0 }

  let generated = 0

  for (const f of floors) {
    if (!f || typeof f !== 'object') continue
    const rooms = (f as Record<string, unknown>).rooms
    if (!Array.isArray(rooms)) continue

    for (const r of rooms) {
      if (!r || typeof r !== 'object') continue
      const shape = (r as Record<string, unknown>).shape
      if (!shape || typeof shape !== 'object') continue
      const s = shape as Record<string, unknown>

      const expected = expectedEdgeCount(s)
      if (expected === 0) continue

      const existing = Array.isArray(s.edgeIds) ? (s.edgeIds as unknown[]) : []
      const next: string[] = []
      for (let i = 0; i < expected; i++) {
        const e = existing[i]
        if (typeof e === 'string' && e.length > 0) {
          next.push(e)
        } else {
          next.push(crypto.randomUUID())
          generated++
        }
      }
      s.edgeIds = next
    }
  }

  return { data: raw, generated }
}

function expectedEdgeCount(shape: Record<string, unknown>): number {
  if (shape.kind === 'rect') return 4
  if (shape.kind === 'polygon') {
    const points = shape.points
    return Array.isArray(points) ? points.length : 0
  }
  return 0
}
