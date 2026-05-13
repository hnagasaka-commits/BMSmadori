/**
 * §7.1 同梱テンプレ一覧 (Phase 1 MVP: 平屋 3 種)。
 *
 * 残りの §7.1 17 種は順次追加する。商用 12 種・2 階建以上の一軒家 5 種は Phase 3 で同梱開始。
 */

import type { Floorplan, UsageMode } from '@/types'
import { CURRENT_PHASE } from '@/types'
import { buildTemplateFloorplan } from './builder'
import {
  buildApartmentTemplate,
  buildCommercialTemplate,
  buildDataCenterTemplate,
  buildFactoryTemplate,
  buildHospitalTemplate,
  buildHotelTemplate,
  buildMixedUseTemplate,
  buildOfficeBuildingTemplate,
  buildPublicTemplate,
  buildSchoolTemplate,
} from './bms'

export type TemplateCard = {
  id: string
  displayName: string
  description: string
  /** 同梱開始 Phase。currentPhase < startPhase なら UI に表示しない */
  startPhase: '1' | '1.5' | '2' | '3'
  area: number
  bedrooms: number
  /** §M136 v0.31: テンプレが対象とする用途モード (Home ピッカーで filter)。
   * 未指定は 'residential' 扱い */
  usageMode?: UsageMode
  /** プラン本体を生成する factory (毎回新規 ID で作るためにも関数化) */
  build: () => Floorplan
}

// ---------------------------------------------------------------------------
// Phase 1 MVP テンプレ群
// ---------------------------------------------------------------------------

function houseFlat1LDK20(): Floorplan {
  return buildTemplateFloorplan(
    [
      { id: 'r-entrance', presetId: 'entrance', rect: { x: 0, y: 0, w: 1820, h: 1820 } },
      { id: 'r-hallway', presetId: 'hallway', rect: { x: 1820, y: 0, w: 910, h: 1820 } },
      { id: 'r-living', presetId: 'living', rect: { x: 2730, y: 0, w: 4550, h: 3640 } },
      { id: 'r-kitchen', presetId: 'kitchen', rect: { x: 0, y: 1820, w: 2730, h: 1820 } },
      { id: 'r-bedroom', presetId: 'bedroom', rect: { x: 0, y: 3640, w: 3640, h: 3640 } },
      { id: 'r-bathroom', presetId: 'bathroom', rect: { x: 3640, y: 3640, w: 1820, h: 1820 } },
      { id: 'r-toilet', presetId: 'toilet', rect: { x: 3640, y: 5460, w: 910, h: 1820 } },
      { id: 'r-washroom', presetId: 'washroom', rect: { x: 4550, y: 5460, w: 1820, h: 1820 } },
    ],
    {
      templateId: 'house-flat-1ldk-20',
      templateVersion: '1.0.0',
      buildingType: 'single-family',
      name: '平屋 1LDK 20 坪',
    },
  )
}

function houseFlat2LDK25(): Floorplan {
  return buildTemplateFloorplan(
    [
      { id: 'r-entrance', presetId: 'entrance', rect: { x: 0, y: 0, w: 1820, h: 1820 } },
      { id: 'r-hallway', presetId: 'hallway', rect: { x: 1820, y: 0, w: 910, h: 3640 } },
      { id: 'r-living', presetId: 'living', rect: { x: 2730, y: 0, w: 4550, h: 3640 } },
      { id: 'r-kitchen', presetId: 'kitchen', rect: { x: 0, y: 1820, w: 1820, h: 1820 } },
      { id: 'r-bedroom1', presetId: 'bedroom', rect: { x: 0, y: 3640, w: 3640, h: 3640 } },
      { id: 'r-bedroom2', presetId: 'bedroom', rect: { x: 3640, y: 3640, w: 3640, h: 3640 } },
      { id: 'r-bathroom', presetId: 'bathroom', rect: { x: 7280, y: 0, w: 1820, h: 1820 } },
      { id: 'r-washroom', presetId: 'washroom', rect: { x: 7280, y: 1820, w: 1820, h: 1820 } },
    ],
    {
      templateId: 'house-flat-2ldk-25',
      templateVersion: '1.0.0',
      buildingType: 'single-family',
      name: '平屋 2LDK 25 坪',
    },
  )
}

function houseFlat3LDK30(): Floorplan {
  return buildTemplateFloorplan(
    [
      { id: 'r-entrance', presetId: 'entrance', rect: { x: 0, y: 0, w: 1820, h: 1820 } },
      { id: 'r-hallway', presetId: 'hallway', rect: { x: 1820, y: 0, w: 910, h: 5460 } },
      { id: 'r-living', presetId: 'living', rect: { x: 2730, y: 0, w: 5460, h: 4550 } },
      { id: 'r-kitchen', presetId: 'kitchen', rect: { x: 0, y: 1820, w: 1820, h: 2730 } },
      { id: 'r-bedroom1', presetId: 'bedroom', rect: { x: 0, y: 4550, w: 3640, h: 3640 } },
      { id: 'r-bedroom2', presetId: 'bedroom', rect: { x: 3640, y: 4550, w: 3640, h: 3640 } },
      { id: 'r-kids', presetId: 'kids-room', rect: { x: 7280, y: 4550, w: 2730, h: 3640 } },
      { id: 'r-bathroom', presetId: 'bathroom', rect: { x: 8190, y: 0, w: 1820, h: 1820 } },
      { id: 'r-washroom', presetId: 'washroom', rect: { x: 8190, y: 1820, w: 1820, h: 1820 } },
      { id: 'r-toilet', presetId: 'toilet', rect: { x: 8190, y: 3640, w: 910, h: 910 } },
    ],
    {
      templateId: 'house-flat-3ldk-30',
      templateVersion: '1.0.0',
      buildingType: 'single-family',
      name: '平屋 3LDK 30 坪 別荘風',
    },
  )
}

// ---------------------------------------------------------------------------
// 公開リスト
// ---------------------------------------------------------------------------

export const TEMPLATE_CARDS: readonly TemplateCard[] = [
  // ---- 住宅向け ----
  {
    id: 'house-flat-1ldk-20',
    displayName: '平屋 1LDK 20 坪',
    description: 'シニア・終の棲家向け、66㎡',
    startPhase: '1',
    area: 66,
    bedrooms: 1,
    usageMode: 'residential',
    build: houseFlat1LDK20,
  },
  {
    id: 'house-flat-2ldk-25',
    displayName: '平屋 2LDK 25 坪',
    description: '夫婦・リタイア向け、83㎡',
    startPhase: '1',
    area: 83,
    bedrooms: 2,
    usageMode: 'residential',
    build: houseFlat2LDK25,
  },
  {
    id: 'house-flat-3ldk-30',
    displayName: '平屋 3LDK 30 坪 別荘風',
    description: '週末住宅・郊外向け、99㎡',
    startPhase: '1',
    area: 99,
    bedrooms: 3,
    usageMode: 'residential',
    build: houseFlat3LDK30,
  },
  // §M136 v0.31: ---- ビルメンテナンス向け 10 種 ----
  // 各テンプレは部屋構成 + 典型的な点検設備 (照明・感知器・誘導灯・消火栓・分電盤等) を
  // 事前配置済。area は概算延床 (㎡)。bedrooms は意味なし (0)。
  {
    id: 'bms-office-building',
    displayName: 'オフィスビル',
    description: '会社・事務所・テナントビル (中規模 1 フロア)',
    startPhase: '3',
    area: 240,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildOfficeBuildingTemplate,
  },
  {
    id: 'bms-commercial',
    displayName: '商業施設',
    description: 'ショッピングモール・百貨店・スーパー',
    startPhase: '3',
    area: 390,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildCommercialTemplate,
  },
  {
    id: 'bms-hospital',
    displayName: '病院・医療施設',
    description: '病院・クリニック・介護施設',
    startPhase: '3',
    area: 240,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildHospitalTemplate,
  },
  {
    id: 'bms-hotel',
    displayName: 'ホテル・宿泊施設',
    description: 'ホテル・旅館 (客室 4 部屋 + 共用)',
    startPhase: '3',
    area: 290,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildHotelTemplate,
  },
  {
    id: 'bms-school',
    displayName: '学校・教育施設',
    description: '小中学校・大学・専門学校 (教室 4)',
    startPhase: '3',
    area: 420,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildSchoolTemplate,
  },
  {
    id: 'bms-factory',
    displayName: '工場・倉庫',
    description: '製造工場・物流倉庫 (大空間)',
    startPhase: '3',
    area: 520,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildFactoryTemplate,
  },
  {
    id: 'bms-apartment',
    displayName: 'マンション・集合住宅',
    description: '分譲・賃貸マンション (共用部 + 4 住戸)',
    startPhase: '3',
    area: 320,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildApartmentTemplate,
  },
  {
    id: 'bms-public',
    displayName: '公共施設',
    description: '市役所・図書館・体育館・公民館',
    startPhase: '3',
    area: 380,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildPublicTemplate,
  },
  {
    id: 'bms-datacenter',
    displayName: 'データセンター',
    description: 'サーバー施設 (高密度 AC + 消火ガス)',
    startPhase: '3',
    area: 330,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildDataCenterTemplate,
  },
  {
    id: 'bms-mixed-use',
    displayName: '複合施設',
    description: 'オフィス+商業+ホテル混在ビル',
    startPhase: '3',
    area: 580,
    bedrooms: 0,
    usageMode: 'bms',
    build: buildMixedUseTemplate,
  },
]

/**
 * §M136 v0.31: 用途モードでフィルタしたテンプレ一覧 (Home ピッカー用)。
 * usageMode を持たないテンプレは 'residential' 扱い。
 */
export function listTemplatesForUsage(
  usage: UsageMode,
): readonly TemplateCard[] {
  return TEMPLATE_CARDS.filter((t) => (t.usageMode ?? 'residential') === usage)
}

/**
 * §9.8.2 currentPhase で絞り込んだテンプレリストを返す。
 * Phase 順序: '1' < '1.5' < '2' < '3'
 */
const PHASE_ORDER: Record<TemplateCard['startPhase'], number> = {
  '1': 1,
  '1.5': 2,
  '2': 3,
  '3': 4,
}

export function listTemplatesForPhase(currentPhase: TemplateCard['startPhase'] = CURRENT_PHASE as TemplateCard['startPhase']): readonly TemplateCard[] {
  const cur = PHASE_ORDER[currentPhase]
  return TEMPLATE_CARDS.filter((t) => PHASE_ORDER[t.startPhase] <= cur)
}

export function getTemplateById(id: string): TemplateCard | undefined {
  return TEMPLATE_CARDS.find((t) => t.id === id)
}
