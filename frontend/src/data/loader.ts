/**
 * §5.1.2 .floorplan.json インポート 8 ステップの統合ローダー。
 *
 * 1. JSON.parse
 * 2. version を raw string として読む (SchemaVersion 型に絞らない)
 * 3. chooseLoadMode でモード決定 (normal / readonly)
 * 4. migrate (readonly では呼ばない)
 * 5. stripDisallowedForPhase (readonly では呼ばない)
 * 5a. ensureEdgeIds (normal / readonly どちらでも実行)
 * 6. Zod 検証 (normal=FloorplanSchema / readonly=TolerantFloorplanSchema)
 * 7. 整合性チェックは M2 で §5.2 に従って実装 (このローダーでは loader 自身の責務外)
 * 8. ストア反映は呼び出し側
 *
 * 戻り値で「件数 N の strip / N の edgeId 補完が発生した」等を返し、ER5 トーストへ。
 */

import { z } from 'zod'

import type { CurrentPhase, Floorplan } from '@/types'
import { CURRENT_PHASE } from '@/types'
import {
  chooseLoadMode,
  CURRENT_SCHEMA_VERSION,
  ensureEdgeIds,
  migrate,
  stripDisallowedForPhase,
  type LoadMode,
} from './migrate'
import { FloorplanSchema, TolerantFloorplanSchema } from './schemas'

// ============================================================================
// 結果型
// ============================================================================

/**
 * §9.9.6 ER 系。ローダーはどの段階で失敗したかを明示し、UI 側がモーダル / トーストに分岐できるようにする。
 */
export type ImportError =
  | { code: 'ER2_JSON'; message: string }
  | { code: 'ER3_SCHEMA'; message: string; issues?: z.core.$ZodIssue[]; fileVersion?: string }
  | { code: 'ER4_MIGRATE'; message: string; fromVersion: string }
  | { code: 'ER_OVERSIZE'; message: string; bytes: number }

export type ImportSuccess = {
  ok: true
  mode: LoadMode
  /** Phase 不変条件で剥がれた件数 (§3.7.1 サニタイズ件数) */
  stripped: number
  /** ensureEdgeIds で新規発行した EdgeId の件数 */
  generatedEdgeIds: number
  /**
   * normal モードでは完全に検証済の Floorplan。
   * readonly モードでは Tolerant 検証だけを通った raw 値(描画段では SafeFloorplanSchema で別途要素検証)。
   */
  data: Floorplan | unknown
  /** 元ファイルの version (raw string) */
  fileVersion: string
}

export type ImportResult = ImportSuccess | (ImportError & { ok: false })

// ============================================================================
// 制限値 (§3.7.2)
// ============================================================================

/** §3.7.2 .floorplan.json インポート上限 10MB */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024

// ============================================================================
// importFloorplan
// ============================================================================

/**
 * ファイル本文 (string) を受けて Floorplan を組み立てる。
 *
 * 失敗時は `ok: false` の `ImportError` を返す (例外を投げない)。
 * UI は code に応じて §9.9.6 のモーダル/トーストを出し分ける。
 */
export function importFloorplan(text: string): ImportResult {
  // §3.7.2 サイズ上限
  const bytes = new Blob([text]).size
  if (bytes > IMPORT_MAX_BYTES) {
    return {
      ok: false,
      code: 'ER_OVERSIZE',
      message: `ファイルサイズが上限 (${IMPORT_MAX_BYTES} bytes) を超えています`,
      bytes,
    }
  }

  // 手順 1: JSON.parse
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return {
      ok: false,
      code: 'ER2_JSON',
      message: e instanceof Error ? e.message : 'JSON 構文エラー',
    }
  }

  // 手順 2: version を raw string として読む
  const fileVersion = readVersionString(raw)
  if (fileVersion == null) {
    return {
      ok: false,
      code: 'ER3_SCHEMA',
      message: 'version フィールドが見つからないか文字列ではありません',
    }
  }

  // 手順 3: モード決定
  const mode = chooseLoadMode(fileVersion)
  const phase: CurrentPhase = CURRENT_PHASE

  if (mode === 'readonly') {
    // 手順 4: migrate スキップ
    // 手順 5: strip スキップ
    // 手順 5a: ensureEdgeIds は実行
    const { data: data1, generated } = ensureEdgeIds(raw)
    // 手順 6: TolerantFloorplanSchema で検証
    const parsed = TolerantFloorplanSchema.safeParse(data1)
    if (!parsed.success) {
      return {
        ok: false,
        code: 'ER3_SCHEMA',
        message: 'readonly モードでも構造が壊れているためファイルを開けません',
        issues: parsed.error.issues,
        fileVersion,
      }
    }
    return {
      ok: true,
      mode,
      stripped: 0,
      generatedEdgeIds: generated,
      data: parsed.data,
      fileVersion,
    }
  }

  // normal モード
  // 手順 4: migrate
  let migrated: unknown
  try {
    migrated = migrate(raw, fileVersion)
  } catch (e) {
    return {
      ok: false,
      code: 'ER4_MIGRATE',
      message: e instanceof Error ? e.message : 'マイグレーション失敗',
      fromVersion: fileVersion,
    }
  }

  // 手順 5: stripDisallowedForPhase
  const { data: stripped, stripped: strippedCount } = stripDisallowedForPhase(migrated, phase)

  // 手順 5a: ensureEdgeIds
  const { data: withEdgeIds, generated } = ensureEdgeIds(stripped)

  // version を保存時 CURRENT_SCHEMA_VERSION に上げる (§5.1.2 「保存時に現行版を書き込む」)
  // ただし読み込み時点での raw 値を保つために、ここでは検証用のクローンに対してのみ上げる選択もある。
  // 設計書の方針通り、開いた時点で current に揃える:
  if (
    withEdgeIds &&
    typeof withEdgeIds === 'object' &&
    typeof (withEdgeIds as Record<string, unknown>).version === 'string'
  ) {
    ;(withEdgeIds as Record<string, unknown>).version = CURRENT_SCHEMA_VERSION
  }

  // 手順 6: Zod
  const parsed = FloorplanSchema.safeParse(withEdgeIds)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'ER3_SCHEMA',
      message: 'スキーマ検証に失敗しました',
      issues: parsed.error.issues,
      fileVersion,
    }
  }

  return {
    ok: true,
    mode,
    stripped: strippedCount,
    generatedEdgeIds: generated,
    data: parsed.data as Floorplan,
    fileVersion,
  }
}

function readVersionString(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const v = (raw as Record<string, unknown>).version
  return typeof v === 'string' ? v : null
}

// ============================================================================
// エクスポート (シリアライズ)
// ============================================================================

/**
 * §5.1 .floorplan.json 形式 (UTF-8 / LF / 2 スペースインデント) で書き出す。
 * 出力時に CURRENT_SCHEMA_VERSION を書き込む。
 */
export function exportFloorplanJson(plan: Floorplan): string {
  const toWrite: Floorplan = { ...plan, version: CURRENT_SCHEMA_VERSION }
  return JSON.stringify(toWrite, null, 2)
}
