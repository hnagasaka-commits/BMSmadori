/**
 * §7.1 同梱テンプレ一覧 (Phase 1 MVP: 平屋 3 種)。
 *
 * 残りの §7.1 17 種は順次追加する。商用 12 種・2 階建以上の一軒家 5 種は Phase 3 で同梱開始。
 */

import type { Floorplan } from '@/types'
import { CURRENT_PHASE } from '@/types'
import { buildTemplateFloorplan } from './builder'

export type TemplateCard = {
  id: string
  displayName: string
  description: string
  /** 同梱開始 Phase。currentPhase < startPhase なら UI に表示しない */
  startPhase: '1' | '1.5' | '2' | '3'
  area: number
  bedrooms: number
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
  {
    id: 'house-flat-1ldk-20',
    displayName: '平屋 1LDK 20 坪',
    description: 'シニア・終の棲家向け、66㎡',
    startPhase: '1',
    area: 66,
    bedrooms: 1,
    build: houseFlat1LDK20,
  },
  {
    id: 'house-flat-2ldk-25',
    displayName: '平屋 2LDK 25 坪',
    description: '夫婦・リタイア向け、83㎡',
    startPhase: '1',
    area: 83,
    bedrooms: 2,
    build: houseFlat2LDK25,
  },
  {
    id: 'house-flat-3ldk-30',
    displayName: '平屋 3LDK 30 坪 別荘風',
    description: '週末住宅・郊外向け、99㎡',
    startPhase: '1',
    area: 99,
    bedrooms: 3,
    build: houseFlat3LDK30,
  },
]

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
