/**
 * §6.4.4 耐震壁量チェック (Phase 3 / M21)。
 *
 * core/seismic の `computeBuildingSeismic` を呼んで、各階の X/Y のうち
 * 実壁量 < 必要壁量 になっている階を ComplianceWarning として返す。
 *
 * 木造のみ対象 (RC / steel は別表)。
 */

import type { ComplianceWarning, Floorplan } from '@/types'
import { SEISMIC_WALL_QUANTITY, makeWarningId } from '@/data/legalRules'
import { computeBuildingSeismic } from '@/core/seismic'

export function checkSeismic(plan: Floorplan): ComplianceWarning[] {
  if (plan.building.structureType !== 'wood') return []
  const warnings: ComplianceWarning[] = []
  const reports = computeBuildingSeismic(plan)
  for (let i = 0; i < reports.length; i++) {
    const r = reports[i]!
    const floor = plan.floors[i]!
    // 床面積 0 の階はチェックしない (部屋がまだ無いだけ)
    if (r.floorAreaM2 <= 0) continue
    const shortfalls: string[] = []
    if (!r.passX) {
      shortfalls.push(
        `X 方向 ${r.actualXCm.toFixed(0)}cm / 必要 ${r.requiredCm.toFixed(0)}cm`,
      )
    }
    if (!r.passY) {
      shortfalls.push(
        `Y 方向 ${r.actualYCm.toFixed(0)}cm / 必要 ${r.requiredCm.toFixed(0)}cm`,
      )
    }
    if (shortfalls.length === 0) continue
    warnings.push({
      id: makeWarningId(SEISMIC_WALL_QUANTITY, [floor.id]),
      severity: SEISMIC_WALL_QUANTITY.severity,
      category: 'structure',
      message: `${floor.name} の耐震壁量が不足: ${shortfalls.join(' / ')}`,
      suggestion:
        '耐力壁 (筋交いを含む load-bearing 壁) を増やすか、間取りを見直して壁を直交方向に追加してください',
      rule: SEISMIC_WALL_QUANTITY.ruleCitation,
    })
  }
  return warnings
}
