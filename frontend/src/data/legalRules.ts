/**
 * §C 法規参照。Phase 1 で同梱するルールセット。
 *
 * 実装時に lawVersion / lastVerifiedAt を更新する。`appRuleVersion` はロジック側の世代。
 * 詳細は §C.0 LegalRule のデータモデル参照。
 */

import type { LegalRule } from '@/types'

const E_GOV_KENCHIKU = 'https://laws.e-gov.go.jp/law/325AC0000000201' // 建築基準法
// 施行令の URL は Phase 3 で階段ルール (§C.5) を入れるときに使う
// const E_GOV_KENCHIKU_SHIKO = 'https://laws.e-gov.go.jp/law/325CO0000000338'

/** 採光: 建築基準法第28条第1項 (住宅は床面積の 1/7 以上) */
export const LIGHTING_MIN_1OVER7: LegalRule = {
  id: 'lighting-min-1over7',
  category: 'lighting',
  title: '居室の採光面積 (住宅)',
  ruleCitation: '建築基準法第28条第1項',
  sourceUrl: E_GOV_KENCHIKU,
  lawVersion: 'TBD',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/** 換気: 建築基準法第28条第2項 (1/20 以上) */
export const VENTILATION_MIN_1OVER20: LegalRule = {
  id: 'ventilation-min-1over20',
  category: 'ventilation',
  title: '居室の換気面積',
  ruleCitation: '建築基準法第28条第2項',
  sourceUrl: E_GOV_KENCHIKU,
  lawVersion: 'TBD',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/** 住戸内廊下幅: 実務推奨 780mm 以上 (法令ではない、info) */
export const CIRCULATION_IN_UNIT_780: LegalRule = {
  id: 'circulation-corridor-in-unit-780',
  category: 'circulation',
  title: '住戸内廊下幅 (推奨)',
  ruleCitation: '実務推奨 (法定義務ではない)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'info',
}

/** 寝室の避難経路: 寝室から玄関までドアを経由した経路 */
export const FIRE_EGRESS_BEDROOM_TO_ENTRANCE: LegalRule = {
  id: 'fire-egress-bedroom-to-entrance',
  category: 'fire-egress',
  title: '寝室から玄関への避難経路',
  ruleCitation: '安全要件 (推奨される設計原則)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/** 構造: 一軒家の柱間隔 > 1820mm を info で警告 (§6.4.2) */
export const STRUCTURE_COLUMN_SPAN_1820: LegalRule = {
  id: 'structure-column-span-1820',
  category: 'structure',
  title: '一軒家の柱間隔 (梁スパン推奨上限)',
  ruleCitation: '実務推奨 (L3 アプリでは warning 相当、本アプリは info)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'info',
}

/** 構造: 柱位置が 910mm グリッドから外れている (info、§6.4.2) */
export const STRUCTURE_COLUMN_OFF_GRID: LegalRule = {
  id: 'structure-column-off-grid',
  category: 'structure',
  title: '柱が 910mm グリッドから外れている',
  ruleCitation: '実務推奨 (任意配置は許容、情報として提示)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'info',
}

/**
 * 構造 (Phase 3): 壁量不足。
 *
 * §6.4.4 簡易壁量計算 (建築基準法施行令 第 46 条 / 平成 12 年建設省告示 第 1100 号 系):
 *  - 必要壁量 = 階の床面積 × 必要壁量係数 (cm/m²)
 *  - 実壁量 = 各壁の長さ [cm] × 壁倍率 を X/Y 方向別に合計
 *  - X か Y のどちらかでも 実 < 必要 なら warning
 *
 * severity: warning。木造で耐震上の必須項目だが、本アプリは確定診断ツールではなく
 * 設計初期検討用 (§1.6) なので「黄色」相当。
 */
export const SEISMIC_WALL_QUANTITY: LegalRule = {
  id: 'seismic-wall-quantity',
  category: 'structure',
  title: '耐震壁量が不足している (簡易壁量計算)',
  ruleCitation: '建築基準法施行令 第 46 条 / 平成 12 年建設省告示 第 1100 号 (簡略実装)',
  sourceUrl: 'n/a',
  lawVersion: '令和 6 年版 (近似)',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/**
 * 構造 (Phase 3): 上階の耐力柱に対応する下階の柱が無い (= 通し柱不整合)。
 *
 * §6.4.3 通し柱整合:
 *  - 木造 2 階建てでは、2F の耐力柱位置に 1F の柱が直上下対応していると耐震性が大きく上がる。
 *  - 完全な「通し柱」(梁を貫通する 1 本柱) でなくても、上下に柱があれば荷重伝達は成立する。
 *  - 本アプリでは「上階の loadBearing=true な柱に対して、下階に同 (x, y) ±100mm の柱が無い」を
 *    warning として出す。完全一致 (0mm) を求めると実務で厳しすぎるので公差 100mm を設ける。
 *  - severity: warning。"絶対 NG" ではなく "見直し推奨" 相当 (info より重く error より軽い)
 */
export const STRUCTURE_COLUMN_THROUGH: LegalRule = {
  id: 'structure-column-through',
  category: 'structure',
  title: '上階の耐力柱に対応する下階の柱がない (通し柱不整合)',
  ruleCitation: '実務 (耐震上の推奨。木造 2 階建ては通し柱を多用)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/** 設備: 必要系統を持つ PS が見つからない (warning、§6.5) */
export const EQUIPMENT_PS_NOT_FOUND: LegalRule = {
  id: 'equipment-ps-not-found',
  category: 'equipment',
  title: '水回り部屋に対応する PS が無い',
  ruleCitation: '実務 (配管不能)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'warning',
}

/** 設備: 水回り部屋から PS までの距離 > 8m (info、§6.5) */
export const EQUIPMENT_PS_DISTANCE_8M: LegalRule = {
  id: 'equipment-ps-distance-8m',
  category: 'equipment',
  title: '水回り部屋と PS の配管距離が長い',
  ruleCitation: '実務推奨 (排水勾配、施工で吸収可)',
  sourceUrl: 'n/a',
  lawVersion: 'n/a',
  lastVerifiedAt: '2026-05-11',
  appRuleVersion: 1,
  severity: 'info',
}

export const LEGAL_RULES: readonly LegalRule[] = [
  LIGHTING_MIN_1OVER7,
  VENTILATION_MIN_1OVER20,
  CIRCULATION_IN_UNIT_780,
  FIRE_EGRESS_BEDROOM_TO_ENTRANCE,
  STRUCTURE_COLUMN_SPAN_1820,
  STRUCTURE_COLUMN_OFF_GRID,
  STRUCTURE_COLUMN_THROUGH,
  SEISMIC_WALL_QUANTITY,
  EQUIPMENT_PS_NOT_FOUND,
  EQUIPMENT_PS_DISTANCE_8M,
]

export function getLegalRule(id: string): LegalRule | undefined {
  return LEGAL_RULES.find((r) => r.id === id)
}

/**
 * §C.0 ID 生成式: `${rule.id}@v${rule.appRuleVersion}:${affectedRoomIds.join(",")}`
 * affectedRoomIds が空の場合は末尾の ":" を省略する。
 */
export function makeWarningId(rule: LegalRule, affectedRoomIds: readonly string[] = []): string {
  const tail = affectedRoomIds.length > 0 ? `:${affectedRoomIds.slice().sort().join(',')}` : ''
  return `${rule.id}@v${rule.appRuleVersion}${tail}`
}
