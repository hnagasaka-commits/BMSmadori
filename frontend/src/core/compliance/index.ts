/**
 * §6.6 法規チェック集約。
 *
 * 各カテゴリの check 関数を呼び出して結果を 1 つの ComplianceWarning[] にまとめる。
 *
 * Phase ごとに有効化される check:
 *  - Phase 1   : lighting / ventilation / circulation / fire-egress
 *  - Phase 1.5 : 上記 + structure / equipment
 *  - Phase 3   : 上記 + 全階対応 + column alignment (通し柱整合 / cross-floor)
 *
 * §M19 以降は floors[0] 固定ではなく全階を走らせる。
 * cross-floor チェックは floorplan 全体を渡す checkColumnAlignment のような形で別途呼ぶ。
 */

import type { ComplianceWarning, Floorplan } from '@/types'
import { CURRENT_PHASE } from '@/types'
import { checkLighting } from './lighting'
import { checkVentilation } from './ventilation'
import { checkCirculation } from './circulation'
import { checkFireEgress } from './fireEgress'
import { checkStructure } from './structure'
import { checkEquipment } from './equipment'
import { checkColumnAlignment } from './columnAlignment'
import { checkSeismic } from './seismic'

export function runLegalChecks(floorplan: Floorplan): ComplianceWarning[] {
  const result: ComplianceWarning[] = []

  // 各階ごとに個別チェック (§M19)
  for (const floor of floorplan.floors) {
    result.push(...checkLighting(floor))
    result.push(...checkVentilation(floor))
    result.push(...checkCirculation(floor))
    result.push(...checkFireEgress(floor))

    if (CURRENT_PHASE !== '1') {
      result.push(...checkStructure(floor, floorplan.metadata))
      result.push(...checkEquipment(floor))
    }
  }

  // §M20 / §M21 Phase 3 から: cross-floor (建物全体を見る) チェック
  if (CURRENT_PHASE === '3') {
    result.push(...checkColumnAlignment(floorplan))
    result.push(...checkSeismic(floorplan))
  }

  return result
}

export {
  checkLighting,
  checkVentilation,
  checkCirculation,
  checkFireEgress,
  checkStructure,
  checkEquipment,
  checkColumnAlignment,
  checkSeismic,
}
