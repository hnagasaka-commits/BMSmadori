/**
 * §C.1 採光 (建築基準法第28条第1項)。
 *
 * 居室 (preset.minLightingRatio が定義された部屋) を対象に、床面積 × 比率 と
 * 採光有効面積を比較する。
 */

import type { ComplianceWarning, Floor } from '@/types'
import { getPreset } from '@/data/roomPresets'
import { LIGHTING_MIN_1OVER7, makeWarningId } from '@/data/legalRules'
import { roomFloorArea, sumLightingArea } from './areas'

export function checkLighting(floor: Floor): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  for (const room of floor.rooms) {
    const preset = getPreset(room.presetId)
    if (preset == null) continue
    if (preset.minLightingRatio == null) continue

    const floorArea = roomFloorArea(room)
    if (floorArea <= 0) continue
    const required = floorArea * preset.minLightingRatio
    const actual = sumLightingArea(room, floor.windows, floor.walls)

    if (actual < required - 1e-6) {
      warnings.push({
        id: makeWarningId(LIGHTING_MIN_1OVER7, [room.id]),
        severity: LIGHTING_MIN_1OVER7.severity,
        category: 'lighting',
        affectedRoomIds: [room.id],
        message: `${preset.displayName}の採光面積が床面積の 1/${Math.round(1 / preset.minLightingRatio)} 未満です (${actual.toFixed(2)} / 要 ${required.toFixed(2)} m²)`,
        suggestion: '外周壁に窓を追加するか、窓を大きくしてください',
        rule: LIGHTING_MIN_1OVER7.ruleCitation,
      })
    }
  }
  return warnings
}
