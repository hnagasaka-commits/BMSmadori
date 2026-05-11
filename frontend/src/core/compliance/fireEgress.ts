/**
 * §C.4 寝室の避難経路 (推奨される設計原則)。
 *
 * 寝室 (bedroom / kids-room) から玄関 (entrance) まで、ドアを経由するグラフ探索で
 * 到達可能性を判定する。到達できない寝室があれば warning。
 *
 * グラフ:
 *  - 頂点 = 部屋
 *  - 辺 = ドアが存在する共有壁 (Wall.sharedBy.length === 2 で Door.wallId が指している)
 */

import type { ComplianceWarning, Floor } from '@/types'
import { FIRE_EGRESS_BEDROOM_TO_ENTRANCE, makeWarningId } from '@/data/legalRules'
import { getPreset } from '@/data/roomPresets'

const BEDROOM_PRESET_IDS = new Set(['bedroom', 'kids-room'])
const ENTRANCE_PRESET_IDS = new Set(['entrance'])

export function checkFireEgress(floor: Floor): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  const wallById = new Map(floor.walls.map((w) => [w.id, w]))

  // 部屋隣接グラフ (ドアが存在する共有壁のみ辺を張る)
  const adjacency = new Map<string, Set<string>>()
  function addEdge(a: string, b: string) {
    const aSet = adjacency.get(a) ?? new Set<string>()
    aSet.add(b)
    adjacency.set(a, aSet)
    const bSet = adjacency.get(b) ?? new Set<string>()
    bSet.add(a)
    adjacency.set(b, bSet)
  }

  for (const door of floor.doors) {
    const wall = wallById.get(door.wallId)
    if (wall == null) continue
    if (wall.sharedBy.length !== 2) continue
    const a = wall.sharedBy[0]!
    const b = wall.sharedBy[1]!
    addEdge(a, b)
  }

  const entranceIds = new Set(
    floor.rooms.filter((r) => ENTRANCE_PRESET_IDS.has(r.presetId)).map((r) => r.id),
  )

  // 玄関が無い間取りはチェック対象外 (まだ作成中とみなす)
  if (entranceIds.size === 0) return warnings

  for (const bedroom of floor.rooms) {
    if (!BEDROOM_PRESET_IDS.has(bedroom.presetId)) continue
    if (!hasPath(bedroom.id, entranceIds, adjacency)) {
      const preset = getPreset(bedroom.presetId)
      warnings.push({
        id: makeWarningId(FIRE_EGRESS_BEDROOM_TO_ENTRANCE, [bedroom.id]),
        severity: FIRE_EGRESS_BEDROOM_TO_ENTRANCE.severity,
        category: 'fire-egress',
        affectedRoomIds: [bedroom.id],
        message: `${preset?.displayName ?? bedroom.presetId}から玄関までドアを経由した経路がありません`,
        suggestion: '寝室と隣室 (廊下や LDK) を結ぶドアを配置してください',
        rule: FIRE_EGRESS_BEDROOM_TO_ENTRANCE.ruleCitation,
      })
    }
  }
  return warnings
}

function hasPath(
  start: string,
  goals: ReadonlySet<string>,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  if (goals.has(start)) return true
  const visited = new Set<string>([start])
  const queue: string[] = [start]
  while (queue.length > 0) {
    const node = queue.shift()!
    const neighbors = adjacency.get(node)
    if (neighbors == null) continue
    for (const n of neighbors) {
      if (visited.has(n)) continue
      if (goals.has(n)) return true
      visited.add(n)
      queue.push(n)
    }
  }
  return false
}
