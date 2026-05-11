/**
 * §6.2 ドア自動配置と tombstone 判定。
 *
 * 自動ドアは共有壁 (sharedBy.length === 2) にのみ生成する。
 * tombstone (Floor.suppressedAutoDoors) のキーは EdgeKey で持つ (§6.2)。
 */

import type {
  AutoDoorSuppression,
  Door,
  EdgeKey,
  Room,
  Wall,
} from '@/types'
import {
  edgeKeyOf,
  edgeKeyEquals,
} from './edgeKey'

/** §6.2 自動ドアの既定寸法 / 既定位置比率 */
export const AUTO_DOOR_DEFAULT_WIDTH = 800
export const AUTO_DOOR_DEFAULT_POSITION_RATIO = 0.5

// ============================================================================
// 抑止判定
// ============================================================================

/**
 * 指定の壁が tombstone に登録されているか。
 * 共有壁でない (sharedBy.length !== 2) なら自動ドア対象外なので false。
 */
export function isAutoDoorSuppressed(
  wall: Wall,
  rooms: readonly Room[],
  tombstones: readonly AutoDoorSuppression[],
): boolean {
  const key = edgeKeyOf(wall, rooms)
  if (key == null) return false
  if (key.length !== 2) return false
  for (const tomb of tombstones) {
    if (edgeKeyEquals(key, tomb.edgeKey)) return true
  }
  return false
}

// ============================================================================
// 自動配置
// ============================================================================

export type AutoDoorPlacementOptions = {
  /** Door.id 発行戦略 */
  newId?: () => string
  /** 自動ドアを置く壁の種類 (既定: 共有壁のみ) */
  shouldPlaceOn?: (wall: Wall) => boolean
}

/**
 * 共有壁にドアが無ければ自動ドアを生成する。
 *
 * - tombstone にマッチする共有壁はスキップ
 * - 既にその wallId にドアが 1 つでもあれば追加しない
 * - 玄関側の判定は preset 連動で別途行う (このレイヤでは責務外、§9.5.8 で entrance preset を除外)
 */
export function autoPlaceDoors(args: {
  walls: readonly Wall[]
  doors: readonly Door[]
  rooms: readonly Room[]
  tombstones: readonly AutoDoorSuppression[]
  options?: AutoDoorPlacementOptions
}): Door[] {
  const newId = args.options?.newId ?? (() => crypto.randomUUID())
  const shouldPlace =
    args.options?.shouldPlaceOn ?? ((w: Wall) => w.sharedBy.length === 2)

  const existing = new Set(args.doors.map((d) => d.wallId))
  const additions: Door[] = []

  for (const w of args.walls) {
    if (!shouldPlace(w)) continue
    if (existing.has(w.id)) continue
    if (isAutoDoorSuppressed(w, args.rooms, args.tombstones)) continue
    additions.push({
      id: newId(),
      wallId: w.id,
      positionRatio: AUTO_DOOR_DEFAULT_POSITION_RATIO,
      width: AUTO_DOOR_DEFAULT_WIDTH,
      type: 'single-swing',
    })
  }
  return [...args.doors, ...additions]
}

// ============================================================================
// tombstone 操作
// ============================================================================

/**
 * §6.2 ドア削除時に呼ぶ。削除直前の壁の EdgeKey を tombstone に追加する。
 * 既に同一 EdgeKey の tombstone があれば追加しない。
 */
export function addAutoDoorSuppression(args: {
  wall: Wall
  rooms: readonly Room[]
  existing: readonly AutoDoorSuppression[]
  /** 既定: 現在時刻 ISO */
  now?: () => string
}): readonly AutoDoorSuppression[] {
  const key = edgeKeyOf(args.wall, args.rooms)
  if (key == null || key.length !== 2) return args.existing
  const dup = args.existing.some((t) => edgeKeyEquals(t.edgeKey, key))
  if (dup) return args.existing
  return [
    ...args.existing,
    {
      edgeKey: key as EdgeKey & { length: 2 },
      removedAt: (args.now ?? (() => new Date().toISOString()))(),
    },
  ]
}

/**
 * §6.2 Room が削除された / Shape の辺が削除されたら、参照を含む tombstone を整理する。
 */
export function pruneAutoDoorSuppressions(args: {
  tombstones: readonly AutoDoorSuppression[]
  livingRoomIds: ReadonlySet<string>
  /** 各 roomId に対する有効な EdgeId 集合 (削除済み edgeId は含めない) */
  livingEdgeIdsByRoom: ReadonlyMap<string, ReadonlySet<string>>
}): AutoDoorSuppression[] {
  return args.tombstones.filter((t) => {
    for (const ref of t.edgeKey) {
      if (!args.livingRoomIds.has(ref.roomId)) return false
      const edges = args.livingEdgeIdsByRoom.get(ref.roomId)
      if (edges == null || !edges.has(ref.edgeId)) return false
    }
    return true
  })
}
