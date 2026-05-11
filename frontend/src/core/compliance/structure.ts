/**
 * §6.4.2 構造整合性チェック (Phase 1.5 から有効)。
 *
 * Phase 1.5 で扱うのは一軒家の柱関連のみ (severity: info)。
 *  - 柱間隔 (梁スパン) > 1820mm
 *  - 柱が 910mm グリッドから外れている
 *
 * 通し柱整合 (Phase 3) と耐力壁削除阻止 (UI 側で阻止系として実装) はここでは扱わない。
 */

import type { ComplianceWarning, Floor, FloorplanMetadata } from '@/types'
import {
  STRUCTURE_COLUMN_OFF_GRID,
  STRUCTURE_COLUMN_SPAN_1820,
  makeWarningId,
} from '@/data/legalRules'

const MAX_COLUMN_SPAN_MM = 1820
const GRID_MM = 910

export function checkStructure(floor: Floor, metadata: FloorplanMetadata): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []
  // 一軒家のみ対象 (マンション/アパートの柱は躯体由来で 910 グリッドに従わなくてよい)
  if (metadata.buildingType !== 'single-family') return warnings
  // §M17 復旧プレビューで Tolerant スキーマ経由のデータが渡る場合に備えて防御
  if (!Array.isArray(floor.columns)) return warnings

  for (const c of floor.columns) {
    const [x, y] = c.position
    if (x % GRID_MM !== 0 || y % GRID_MM !== 0) {
      warnings.push({
        id: makeWarningId(STRUCTURE_COLUMN_OFF_GRID, [c.id]),
        severity: STRUCTURE_COLUMN_OFF_GRID.severity,
        category: 'structure',
        message: `柱 ${c.id.slice(0, 8)} が ${GRID_MM}mm グリッドから外れています (${x}, ${y})`,
        rule: STRUCTURE_COLUMN_OFF_GRID.ruleCitation,
      })
    }
  }

  // 柱間隔: 同じ行 (y) または同じ列 (x) で隣接する柱の距離が 1820mm を超えると info
  const cols = floor.columns ?? []
  for (let i = 0; i < cols.length; i++) {
    const a = cols[i]!
    let nearestX: number | null = null
    let nearestY: number | null = null
    for (let j = 0; j < cols.length; j++) {
      if (i === j) continue
      const b = cols[j]!
      if (a.position[1] === b.position[1] && b.position[0] > a.position[0]) {
        const d = b.position[0] - a.position[0]
        if (nearestX == null || d < nearestX) nearestX = d
      }
      if (a.position[0] === b.position[0] && b.position[1] > a.position[1]) {
        const d = b.position[1] - a.position[1]
        if (nearestY == null || d < nearestY) nearestY = d
      }
    }
    if (nearestX != null && nearestX > MAX_COLUMN_SPAN_MM) {
      warnings.push({
        id: makeWarningId(STRUCTURE_COLUMN_SPAN_1820, [a.id, `x${nearestX}`]),
        severity: STRUCTURE_COLUMN_SPAN_1820.severity,
        category: 'structure',
        message: `柱 ${a.id.slice(0, 8)} の右隣まで ${nearestX}mm (上限 ${MAX_COLUMN_SPAN_MM}mm)`,
        rule: STRUCTURE_COLUMN_SPAN_1820.ruleCitation,
      })
    }
    if (nearestY != null && nearestY > MAX_COLUMN_SPAN_MM) {
      warnings.push({
        id: makeWarningId(STRUCTURE_COLUMN_SPAN_1820, [a.id, `y${nearestY}`]),
        severity: STRUCTURE_COLUMN_SPAN_1820.severity,
        category: 'structure',
        message: `柱 ${a.id.slice(0, 8)} の下隣まで ${nearestY}mm (上限 ${MAX_COLUMN_SPAN_MM}mm)`,
        rule: STRUCTURE_COLUMN_SPAN_1820.ruleCitation,
      })
    }
  }
  return warnings
}
