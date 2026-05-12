/**
 * §5.2 「Room.shape が正本、Floor.walls は派生」の核となる再生成ロジック。
 *
 * Phase 1 は rect + 90° 回転のみ運用なので、ここでも rect 部屋だけを処理する。
 * polygon は Phase 2 で `worldEdges` が対応した後で自動的に動くようにする (worldEdges 経由)。
 */

import type { Room, Wall, WallType } from '@/types'
import { canonicalSegmentKey, type Segment } from './geometry'
import { worldEdges } from './edgeKey'

/** rect 部屋の各辺に当たる Wall を生成。`isLocked: false` / `wallType: "partition"` を既定とする */
const DEFAULT_WALL_TYPE: WallType = 'partition'

/**
 * §M66 v0.11: 「壁を生成しない」プリセット。
 * 庭 (garden) は屋外の地面相当で、囲い壁が不要というユーザー要望に応える。
 * バルコニーは手摺壁を将来追加するため、ここでは含めない。
 */
const WALL_LESS_PRESET_IDS: ReadonlySet<string> = new Set(['garden'])

export function isWalllessPreset(presetId: string): boolean {
  return WALL_LESS_PRESET_IDS.has(presetId)
}

const DEFAULT_THICKNESS_BY_TYPE: Record<WallType, number> = {
  exterior: 150,
  'load-bearing': 180,
  shared: 180,
  partition: 100,
  'non-bearing': 100,
}

// ============================================================================
// 再生成
// ============================================================================

export type RegenerateOptions = {
  /** Wall.id 発行戦略。デフォルトは crypto.randomUUID */
  newId?: () => string
}

/**
 * 部屋配列から壁集合を再計算する。
 *
 * 1. 各部屋の Shape からワールド座標の辺を展開
 * 2. canonicalSegmentKey で同一辺をグループ化
 * 3. 1 グループに 1 つの Wall を発行、sharedBy に登場 roomId を入れる
 *
 * 共有壁の判定は線分の完全一致 (1mm) で行う (§5.3 壁芯座標規約)。
 * 重複部屋 IDは無視する (健全な入力前提)。
 */
export function regenerateWallsFromRooms(
  rooms: readonly Room[],
  options: RegenerateOptions = {},
): Wall[] {
  const newId = options.newId ?? (() => crypto.randomUUID())

  // canonicalKey -> { segment, roomIds[] }
  const groups = new Map<string, { seg: Segment; roomIds: string[] }>()

  for (const room of rooms) {
    // §M66 v0.11: 庭 (garden) は壁を生成しない。Room.shape は床プレート用に保持される
    if (isWalllessPreset(room.presetId)) continue
    const segs = worldEdges(room.shape, room.rotation)
    if (segs == null) continue
    for (const seg of segs) {
      const key = canonicalSegmentKey(seg)
      const g = groups.get(key)
      if (g == null) {
        groups.set(key, { seg, roomIds: [room.id] })
      } else {
        // 既に同じ辺が登録されていれば共有壁。roomId 重複は除く
        if (!g.roomIds.includes(room.id)) g.roomIds.push(room.id)
      }
    }
  }

  const walls: Wall[] = []
  for (const { seg, roomIds } of groups.values()) {
    // Wall.sharedBy は最大 2 (§5.3)。3 つ以上は健全な入力ではない → 先頭 2 つだけ採用
    const sharedBy = roomIds.slice(0, 2)
    walls.push({
      id: newId(),
      from: seg.from,
      to: seg.to,
      thickness: DEFAULT_THICKNESS_BY_TYPE[DEFAULT_WALL_TYPE],
      wallType: DEFAULT_WALL_TYPE,
      isLocked: false,
      sharedBy,
    })
  }
  return walls
}
