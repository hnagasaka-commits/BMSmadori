/**
 * §6.5 設備系統チェック (Phase 1.5 から有効)。
 *
 * §7 RoomPreset.utilityRequirements を見て、必要系統を持つ PS が見つからない / 遠い場合に警告。
 * Phase 1.5 では「最近 PS の中心 → 部屋中心の直線距離」で配管距離を近似する。
 * Phase 2 で実際の配管経路に置き換える。
 */

import type { ComplianceWarning, Floor, PipeSpace, Room } from '@/types'
import { getPreset } from '@/data/roomPresets'
import {
  EQUIPMENT_PS_DISTANCE_8M,
  EQUIPMENT_PS_NOT_FOUND,
  makeWarningId,
} from '@/data/legalRules'
import { shapeCenter } from '@/core/geometry'

const MAX_DISTANCE_MM = 8000

export function checkEquipment(floor: Floor): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  // §M17 復旧プレビューで Tolerant スキーマ経由のデータが渡る場合に備えて防御
  if (!Array.isArray(floor.rooms) || !Array.isArray(floor.pipeSpaces)) return warnings

  for (const room of floor.rooms) {
    const preset = getPreset(room.presetId)
    if (preset == null) continue
    if (!preset.requiresPipeSpace) continue
    const required = preset.utilityRequirements ?? []
    if (required.length === 0) continue

    const eligible = floor.pipeSpaces.filter((ps) =>
      required.every((sys) => ps.systems.includes(sys)),
    )
    const nearest = nearestPipeSpace(room, eligible)
    if (nearest == null) {
      warnings.push({
        id: makeWarningId(EQUIPMENT_PS_NOT_FOUND, [room.id]),
        severity: EQUIPMENT_PS_NOT_FOUND.severity,
        category: 'equipment',
        affectedRoomIds: [room.id],
        message: `${preset.displayName} が必要とする系統 (${required.join(', ')}) を持つ PS が見つかりません`,
        suggestion: 'PS を追加するか、近くの PS の系統を増やしてください',
        rule: EQUIPMENT_PS_NOT_FOUND.ruleCitation,
      })
      continue
    }
    if (nearest.distance > MAX_DISTANCE_MM) {
      warnings.push({
        id: makeWarningId(EQUIPMENT_PS_DISTANCE_8M, [room.id]),
        severity: EQUIPMENT_PS_DISTANCE_8M.severity,
        category: 'equipment',
        affectedRoomIds: [room.id],
        message: `${preset.displayName} から PS まで ${(nearest.distance / 1000).toFixed(1)}m あり、配管が困難です`,
        suggestion: 'PS を近づけるか、別の PS を追加してください',
        rule: EQUIPMENT_PS_DISTANCE_8M.ruleCitation,
      })
    }
  }
  return warnings
}

function nearestPipeSpace(
  room: Room,
  candidates: readonly PipeSpace[],
): { ps: PipeSpace; distance: number } | null {
  if (candidates.length === 0) return null
  if (room.shape.kind !== 'rect' && room.shape.kind !== 'polygon') return null
  // §11 Phase 2 / M16: 中心は AABB 中心。polygon でも統一して扱える
  const [cx, cy] = shapeCenter(room.shape, room.rotation)
  let best: { ps: PipeSpace; distance: number } | null = null
  for (const ps of candidates) {
    const d = Math.hypot(ps.position[0] - cx, ps.position[1] - cy)
    if (best == null || d < best.distance) best = { ps, distance: d }
  }
  return best
}
