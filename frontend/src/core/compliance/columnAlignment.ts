/**
 * §6.4.3 通し柱整合 (Phase 3 / M20)。
 *
 * 設計の意図:
 *  - 木造 2 階建ての耐震性は、2F の耐力柱位置が 1F の柱と直上下に揃っているかに大きく依存する。
 *  - "完全な通し柱" を毎回求めるのは実務で厳しすぎるので、本アプリでは「同 (x, y) ± 100mm に
 *    下階の柱があれば OK」と緩めて判定する。
 *  - 階の level 順で昇順ソートして、各上階の loadBearing=true な柱について「level がちょうど 1 下」の階に
 *    対応する柱が無ければ warning。
 *  - 木造以外 (rc / steel) はこのチェックを行わない (柱配置の自由度が高いため)。
 */

import type { ComplianceWarning, Floor, Floorplan } from '@/types'
import { STRUCTURE_COLUMN_THROUGH, makeWarningId } from '@/data/legalRules'

const TOLERANCE_MM = 100

export function checkColumnAlignment(plan: Floorplan): ComplianceWarning[] {
  // 木造のみ判定 (§6.4.3)
  if (plan.building.structureType !== 'wood') return []
  // 1 階建てなら通し柱はそもそも存在しない
  if (plan.floors.length < 2) return []

  const warnings: ComplianceWarning[] = []
  // level 昇順
  const byLevel = [...plan.floors].sort((a, b) => a.level - b.level)
  // level → Floor の引き
  const floorByLevel = new Map<number, Floor>()
  for (const f of byLevel) floorByLevel.set(f.level, f)

  for (const upperFloor of byLevel) {
    const lowerFloor = floorByLevel.get(upperFloor.level - 1)
    if (lowerFloor == null) continue // 1F は対象外 (下が無い)
    if (!Array.isArray(upperFloor.columns) || !Array.isArray(lowerFloor.columns)) continue

    for (const col of upperFloor.columns) {
      if (!col.loadBearing) continue // 耐力柱だけ通し柱整合の対象
      const [ux, uy] = col.position
      const hasMatch = lowerFloor.columns.some((c) => {
        const [lx, ly] = c.position
        return Math.abs(lx - ux) <= TOLERANCE_MM && Math.abs(ly - uy) <= TOLERANCE_MM
      })
      if (hasMatch) continue
      warnings.push({
        id: makeWarningId(STRUCTURE_COLUMN_THROUGH, [
          upperFloor.id,
          col.id,
        ]),
        severity: STRUCTURE_COLUMN_THROUGH.severity,
        category: 'structure',
        message: `${upperFloor.name} の耐力柱 ${col.id.slice(0, 8)} (${ux}, ${uy}) に対応する ${lowerFloor.name} の柱がありません`,
        suggestion: `${lowerFloor.name} の同じ位置に柱を追加するか、上下方向の耐力分配を見直してください (公差 ${TOLERANCE_MM}mm)`,
        rule: STRUCTURE_COLUMN_THROUGH.ruleCitation,
      })
    }
  }
  return warnings
}
