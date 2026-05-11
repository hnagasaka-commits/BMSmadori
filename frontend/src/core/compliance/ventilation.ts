/**
 * §C.2 換気 (建築基準法第28条第2項)。
 *
 * 居室 (preset.minVentilationRatio) を対象に、床面積 × 比率 と換気有効面積を比較。
 * 換気では FIX 窓を算入しない (§6.6.0 openableRatio)。
 */

import type { ComplianceWarning, Floor } from '@/types'
import { getPreset } from '@/data/roomPresets'
import { VENTILATION_MIN_1OVER20, makeWarningId } from '@/data/legalRules'
import { roomFloorArea, sumVentilationArea } from './areas'

export function checkVentilation(floor: Floor): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  for (const room of floor.rooms) {
    const preset = getPreset(room.presetId)
    if (preset == null) continue
    if (preset.minVentilationRatio == null) continue

    const floorArea = roomFloorArea(room)
    if (floorArea <= 0) continue
    const required = floorArea * preset.minVentilationRatio
    const actual = sumVentilationArea(room, floor.windows, floor.walls)

    if (actual < required - 1e-6) {
      warnings.push({
        id: makeWarningId(VENTILATION_MIN_1OVER20, [room.id]),
        severity: VENTILATION_MIN_1OVER20.severity,
        category: 'ventilation',
        affectedRoomIds: [room.id],
        message: `${preset.displayName}の換気面積が床面積の 1/${Math.round(1 / preset.minVentilationRatio)} 未満です (${actual.toFixed(2)} / 要 ${required.toFixed(2)} m²)`,
        suggestion: '開閉できる窓 (引違い・片開き等) を追加してください。FIX 窓は換気に算入できません',
        rule: VENTILATION_MIN_1OVER20.ruleCitation,
      })
    }
  }
  return warnings
}
