/**
 * §5.2 / §6.2 「shape 更新 → 壁再生成 → 再バインド → 自動ドア → tombstone 整理」を 1 関数で行う。
 *
 * shape を変更する全てのアクション (move / resize / rotate / addRoom / removeRoom) はここを通す。
 */

import type { Floor, Room } from '@/types'
import { regenerateWallsFromRooms } from './walls'
import {
  buildWallIdMap,
  indexPrevWalls,
  rebindReferences,
  rebindWalls,
} from './rebind'
import { autoPlaceDoors, pruneAutoDoorSuppressions } from './doors'

/**
 * `nextRooms` を採用したフロアを返す (副作用なし)。
 * `prevFloor` の壁 / ドア / 窓 / 仕上げ / tombstone をすべて整合させる。
 */
export function recomputeFloor(prevFloor: Floor, nextRooms: Room[]): Floor {
  const prevIndex = indexPrevWalls(prevFloor.walls, prevFloor.rooms)
  const regenerated = regenerateWallsFromRooms(nextRooms)
  const rebindReport = rebindWalls(regenerated, nextRooms, prevIndex)
  const { wallIdMap, invalidatedWallIds } = buildWallIdMap(prevIndex, rebindReport)

  const entityReport = rebindReferences({
    doors: prevFloor.doors,
    windows: prevFloor.windows,
    wallFinishes: prevFloor.wallFinishes,
    wallIdMap,
    invalidatedWallIds,
  })

  const withAutoDoors = autoPlaceDoors({
    walls: rebindReport.walls,
    doors: entityReport.doors,
    rooms: nextRooms,
    tombstones: prevFloor.suppressedAutoDoors,
  })

  const livingRoomIds = new Set(nextRooms.map((r) => r.id))
  const livingEdgeIdsByRoom = new Map<string, ReadonlySet<string>>()
  for (const r of nextRooms) {
    livingEdgeIdsByRoom.set(r.id, new Set(r.shape.edgeIds))
  }
  const prunedTombstones = pruneAutoDoorSuppressions({
    tombstones: prevFloor.suppressedAutoDoors,
    livingRoomIds,
    livingEdgeIdsByRoom,
  })

  return {
    ...prevFloor,
    rooms: nextRooms,
    walls: rebindReport.walls,
    doors: withAutoDoors,
    windows: entityReport.windows,
    wallFinishes: entityReport.wallFinishes,
    suppressedAutoDoors: prunedTombstones,
  }
}
