/**
 * §C.3 廊下幅。本アプリは住戸単位スコープなので、共用廊下 (1200mm) はスコープ外で、
 * 住戸内廊下の推奨幅 780mm 未満を info 警告として出す。
 *
 * Phase 1 は rect の廊下のみ対応。最小幅は min(w, h) で十分 (回転は変わらない)。
 */

import type { ComplianceWarning, Floor } from '@/types'
import { getPreset } from '@/data/roomPresets'
import { CIRCULATION_IN_UNIT_780, makeWarningId } from '@/data/legalRules'
import { shapeAabb } from '@/core/geometry'

const IN_UNIT_MIN_WIDTH_MM = 780

export function checkCirculation(floor: Floor): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  for (const room of floor.rooms) {
    const preset = getPreset(room.presetId)
    if (preset == null) continue
    if (preset.id !== 'hallway') continue
    if (room.shape.kind !== 'rect' && room.shape.kind !== 'polygon') continue

    // §11 Phase 2 / M16: polygon の場合、廊下幅は AABB の短辺で近似する。
    // 真の最小幅 (くびれ部) は Phase 3 で polygon の内部極小幅解析を入れた時点で更新する。
    const aabb = shapeAabb(room.shape, room.rotation)
    const minWidth = Math.min(aabb.maxX - aabb.minX, aabb.maxY - aabb.minY)
    if (minWidth < IN_UNIT_MIN_WIDTH_MM) {
      warnings.push({
        id: makeWarningId(CIRCULATION_IN_UNIT_780, [room.id]),
        severity: CIRCULATION_IN_UNIT_780.severity,
        category: 'circulation',
        affectedRoomIds: [room.id],
        message: `住戸内廊下幅が ${IN_UNIT_MIN_WIDTH_MM}mm 未満です (${minWidth}mm)`,
        suggestion: `廊下幅を ${IN_UNIT_MIN_WIDTH_MM}mm 以上にすると通行が楽になります`,
        rule: CIRCULATION_IN_UNIT_780.ruleCitation,
      })
    }
  }
  return warnings
}
