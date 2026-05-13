/**
 * §M136 v0.31: ビルメンテナンス用 10 施設タイプのテンプレート。
 *
 * 各テンプレは典型的な部屋構成 + 必要最低限の点検設備 (照明・感知器・誘導灯・
 * 消火栓・分電盤など) を事前配置する。ユーザーは取り込み後に部屋寸法 / 設備位置
 * を編集して実建物に合わせる。
 *
 * 構造方針:
 *  - 各テンプレは `usageMode='bms'`、`buildingType` は施設タイプに応じて選択
 *    (office-building → 'office', hospital → 'office' (medical)、commercial → 'retail'、
 *    hotel → 'hotel'、mixed → 'mixed' 等)
 *  - `structureType='rc'`, `isExistingBuilding=true` (BMS は既設点検が前提)
 *  - 天井高 2700mm 既定 (商業/データセンターは 3000)
 *  - 設備の mountTo は spec の placement に揃えて明示
 *
 * 設備配置のヘルパー:
 *  - `gridLights(rect, cols, rows, id)`  : 部屋内に格子状に天井照明
 *  - `roomCenter(rect, id)`              : 部屋中央に 1 個 (ACカセット / 大型照明)
 *  - `wallMount(rect, side, id, t)`      : 壁面に設備 (側面 N/S/E/W、t は 0..1 位置)
 *  - `outdoorAt(x, y, id)`               : 屋外配置 (送水口・桝など)
 *  - `detectors(rect, count, id)`        : 感知器を等間隔で天井に
 */

import type { FurnitureMount } from '@/types'
import { buildTemplateFloorplan, type FurnitureSeed, type RoomSeed } from './builder'

type Rect = { x: number; y: number; w: number; h: number }

/**
 * §M122 v0.29 + §M136 v0.31: equipment-master の id → placement を予め持っておく
 * (テンプレ build 時に equipment-master が未ロードでも mountTo を正しく入れるため)。
 * id は public/equipment-master.json と一致させる。
 */
const PLACEMENT: Record<string, FurnitureMount> = {
  // 天井 (照明)
  'E-001': 'ceiling',
  'E-002': 'ceiling',
  'E-003': 'ceiling',
  'E-005': 'ceiling',
  'E-006': 'ceiling',
  'E-007': 'ceiling',
  // 天井 (感知器・スピーカ・誘導灯)
  'K-001': 'ceiling',
  'K-002': 'ceiling',
  'K-005': 'ceiling',
  'K-008': 'ceiling',
  'K-017': 'ceiling',
  'K-018': 'ceiling',
  // §M144 v0.33: 新規 K-019 (定温式スポット感知器 防爆型・P型)
  'K-019': 'ceiling',
  // 天井 (空調・換気)
  'A-001': 'ceiling',
  'A-002': 'ceiling',
  'A-003': 'ceiling',
  // 天井 (スプリンクラー / ダンパ)
  'S-001': 'ceiling',
  'S-003': 'ceiling',
  'K-013': 'ceiling',
  'K-014': 'ceiling',
  // 床 (盤類 / 受信機 / 空調 / 消火器)
  'E-101': 'floor',
  'E-102': 'floor',
  'E-103': 'floor',
  // §M144 v0.33: E-105 → K-104 (自家発電設備), P-111 → A-111, P-113 → A-110, P-114 → A-109
  'K-104': 'floor',
  'A-101': 'floor',
  'A-104': 'floor',
  'A-109': 'floor',
  'A-110': 'floor',
  'A-111': 'floor',
  'K-101': 'floor',
  'K-103': 'floor',
  'P-101': 'floor',
  'P-106': 'floor',
  'P-107': 'floor',
  'S-101': 'floor',
  'S-105': 'floor',
  'S-106': 'floor',
  'G-101': 'floor',
  // §M144 v0.33: 新規追加
  'A-107': 'floor',
  'A-108': 'floor',
  'A-112': 'floor',
  'A-113': 'floor',
  'S-108': 'floor',
  // 壁 (消火栓・誘導灯・発信機・分電盤など)
  'E-201': 'wall',
  // §M144 v0.33: E-208 → K-216 (単相コンセント、火災報知系へ移動)
  'K-216': 'wall',
  'P-201': 'wall',
  'S-201': 'wall',
  'S-202': 'wall',
  'K-202': 'wall',
  'K-203': 'wall',
  'K-204': 'wall',
  'K-210': 'wall',
  'K-211': 'wall',
  'K-212': 'wall',
  // §M144 v0.33: 新規 K-217 (避難口誘導灯 K-避難口誘導灯型)
  'K-217': 'wall',
  'B-201': 'wall',
  'B-202': 'wall',
  // 屋上
  'P-301': 'roof',
  'E-302': 'roof',
  'K-301': 'roof',
  // 屋外
  'S-401': 'outdoor',
  'S-402': 'outdoor',
  'P-401': 'outdoor',
  'P-402': 'outdoor',
}

function eq(catalogId: string, x: number, y: number, rotation = 0): FurnitureSeed {
  return {
    catalogId,
    position: [x, y],
    rotation,
    ...(PLACEMENT[catalogId] != null && { mountTo: PLACEMENT[catalogId] }),
  }
}

/** 部屋内に格子状に天井照明 (cols × rows 個、余白あり) */
function gridLights(rect: Rect, cols: number, rows: number, id: string): FurnitureSeed[] {
  const out: FurnitureSeed[] = []
  const padX = rect.w / (cols * 2)
  const padY = rect.h / (rows * 2)
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = rect.x + padX + (rect.w - padX * 2) * (i / Math.max(1, cols - 1) || 0)
      const y = rect.y + padY + (rect.h - padY * 2) * (j / Math.max(1, rows - 1) || 0)
      out.push(eq(id, x, y))
    }
  }
  return out
}

/** 部屋中央に 1 つ (AC カセット / 大型シーリングなど) */
function roomCenter(rect: Rect, id: string): FurnitureSeed {
  return eq(id, rect.x + rect.w / 2, rect.y + rect.h / 2)
}

/** 壁面の任意位置 (side: 部屋から見て N/S/E/W、t は 0..1 で側面上の位置) */
function wallMount(rect: Rect, side: 'N' | 'S' | 'E' | 'W', id: string, t = 0.5): FurnitureSeed {
  // 壁面の少し内側 (= 部屋側) に置く (depth 100mm 想定)
  const offset = 100
  let x: number
  let y: number
  let rotation = 0
  switch (side) {
    case 'N':
      x = rect.x + rect.w * t
      y = rect.y + offset
      rotation = 0
      break
    case 'S':
      x = rect.x + rect.w * t
      y = rect.y + rect.h - offset
      rotation = Math.PI
      break
    case 'E':
      x = rect.x + rect.w - offset
      y = rect.y + rect.h * t
      rotation = Math.PI / 2
      break
    case 'W':
      x = rect.x + offset
      y = rect.y + rect.h * t
      rotation = -Math.PI / 2
      break
  }
  return eq(id, x, y, rotation)
}

/** 部屋天井に感知器を等間隔配置 (count 個を long-side に沿って) */
function detectors(rect: Rect, count: number, id: string): FurnitureSeed[] {
  const out: FurnitureSeed[] = []
  const horizontal = rect.w >= rect.h
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const x = horizontal ? rect.x + rect.w * (0.15 + 0.7 * t) : rect.x + rect.w / 2
    const y = horizontal ? rect.y + rect.h / 2 : rect.y + rect.h * (0.15 + 0.7 * t)
    out.push(eq(id, x, y))
  }
  return out
}

/** 部屋全体を覆うスプリンクラー格子 (1 ヘッド ≒ 4×4m 担当) */
function sprinklerGrid(rect: Rect, id: string = 'S-001'): FurnitureSeed[] {
  const SPACING = 3500
  const cols = Math.max(1, Math.round(rect.w / SPACING))
  const rows = Math.max(1, Math.round(rect.h / SPACING))
  return gridLights(rect, cols, rows, id)
}

// ============================================================================
// テンプレ 10 種
// ============================================================================

// 1. オフィスビル (中規模 1 フロア、約 18m × 14m)
export function buildOfficeBuildingTemplate() {
  // 配置: lobby (4×6) + office-A (6×6) + office-B (6×6) + conference (5×4) +
  //       corridor (右側 縦 2×14) + restroom-public (3×3) + machine-room (3×3) + electric (3×3)
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', rect: { x: 0, y: 0, w: 5000, h: 6000 } },
    { id: 'office-a', presetId: 'office', rect: { x: 5000, y: 0, w: 7000, h: 6000 } },
    { id: 'office-b', presetId: 'office', rect: { x: 0, y: 6000, w: 6000, h: 5000 } },
    {
      id: 'conf',
      presetId: 'conference-room',
      rect: { x: 6000, y: 6000, w: 6000, h: 5000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 12000, y: 0, w: 2000, h: 11000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 14000, y: 0, w: 3000, h: 3500 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 14000, y: 3500, w: 3000, h: 4000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 14000, y: 7500, w: 3000, h: 3500 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // ロビー: 天井照明 + ダウンライト
    ...gridLights({ x: 500, y: 500, w: 4000, h: 5000 }, 2, 2, 'E-006'),
    eq('K-005', 2500, 3000),
    eq('K-018', 2500, 1500),
    wallMount({ x: 0, y: 0, w: 5000, h: 6000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 5000, h: 6000 }, 'N', 'K-203', 0.6),
    wallMount({ x: 0, y: 0, w: 5000, h: 6000 }, 'N', 'K-210', 0.8),
    // 執務室 A
    ...gridLights({ x: 5500, y: 500, w: 6000, h: 5000 }, 3, 2, 'E-006'),
    ...detectors({ x: 5500, y: 500, w: 6000, h: 5000 }, 4, 'K-005'),
    roomCenter({ x: 5500, y: 500, w: 6000, h: 5000 }, 'A-001'),
    wallMount({ x: 5000, y: 0, w: 7000, h: 6000 }, 'W', 'E-201'),
    // 執務室 B
    ...gridLights({ x: 500, y: 6500, w: 5000, h: 4000 }, 3, 2, 'E-006'),
    ...detectors({ x: 500, y: 6500, w: 5000, h: 4000 }, 3, 'K-005'),
    // 会議室
    roomCenter({ x: 6500, y: 6500, w: 5000, h: 4000 }, 'E-006'),
    eq('K-002', 8500, 8500),
    eq('K-018', 8500, 7000),
    // 廊下: 天井照明 + 誘導灯
    ...detectors({ x: 12000, y: 0, w: 2000, h: 11000 }, 4, 'E-007'),
    eq('K-017', 13000, 5500),
    wallMount({ x: 12000, y: 0, w: 2000, h: 11000 }, 'W', 'S-201', 0.5),
    wallMount({ x: 12000, y: 0, w: 2000, h: 11000 }, 'W', 'K-210', 0.1),
    wallMount({ x: 12000, y: 0, w: 2000, h: 11000 }, 'W', 'K-210', 0.9),
    // 公衆トイレ
    roomCenter({ x: 14000, y: 0, w: 3000, h: 3500 }, 'E-006'),
    eq('A-001', 15500, 1750),
    // 機械室: AC ユニット + 配電盤 + 消火器
    eq('A-101', 15500, 5500),
    eq('A-104', 15500, 4000),
    eq('S-106', 14500, 7000),
    // 電気室: 配電盤 + 主幹盤 + 受信機
    eq('E-101', 14500, 9000),
    eq('E-102', 16000, 9000),
    eq('K-101', 14500, 10500),
    // 屋外
    eq('S-401', 8500, -1200),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-office-building',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: 'オフィスビル (中規模1フロア)',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 2700,
  }, furniture)
}

// 2. 商業施設 (ショッピングモール簡易版、約 28m × 18m)
export function buildCommercialTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', rect: { x: 0, y: 0, w: 8000, h: 8000 } },
    {
      id: 'store-a',
      presetId: 'office',
      customName: '店舗A',
      rect: { x: 8000, y: 0, w: 10000, h: 8000 },
    },
    {
      id: 'store-b',
      presetId: 'office',
      customName: '店舗B',
      rect: { x: 18000, y: 0, w: 10000, h: 8000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 8000, w: 28000, h: 2000 },
    },
    {
      id: 'restroom-1',
      presetId: 'restroom-public',
      rect: { x: 0, y: 10000, w: 4000, h: 4000 },
    },
    {
      id: 'restroom-2',
      presetId: 'restroom-public',
      rect: { x: 4000, y: 10000, w: 4000, h: 4000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 8000, y: 10000, w: 6000, h: 4000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 14000, y: 10000, w: 7000, h: 4000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 21000, y: 10000, w: 7000, h: 4000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // 大空間ロビー
    ...gridLights({ x: 500, y: 500, w: 7000, h: 7000 }, 3, 3, 'E-006'),
    ...sprinklerGrid({ x: 500, y: 500, w: 7000, h: 7000 }),
    ...detectors({ x: 500, y: 500, w: 7000, h: 7000 }, 6, 'K-005'),
    eq('K-018', 4000, 2500),
    eq('K-018', 4000, 5500),
    wallMount({ x: 0, y: 0, w: 8000, h: 8000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 8000, h: 8000 }, 'N', 'K-210', 0.8),
    // 店舗 A
    ...gridLights({ x: 8500, y: 500, w: 9000, h: 7000 }, 4, 3, 'E-006'),
    ...sprinklerGrid({ x: 8500, y: 500, w: 9000, h: 7000 }),
    ...detectors({ x: 8500, y: 500, w: 9000, h: 7000 }, 6, 'K-005'),
    eq('A-101', 13000, 1500),
    wallMount({ x: 8000, y: 0, w: 10000, h: 8000 }, 'W', 'E-201'),
    // 店舗 B
    ...gridLights({ x: 18500, y: 500, w: 9000, h: 7000 }, 4, 3, 'E-006'),
    ...sprinklerGrid({ x: 18500, y: 500, w: 9000, h: 7000 }),
    eq('A-101', 23000, 1500),
    // 共用廊下
    ...detectors({ x: 0, y: 8000, w: 28000, h: 2000 }, 7, 'E-007'),
    eq('K-017', 5000, 9000),
    eq('K-017', 14000, 9000),
    eq('K-017', 22000, 9000),
    wallMount({ x: 0, y: 8000, w: 28000, h: 2000 }, 'S', 'S-201', 0.3),
    wallMount({ x: 0, y: 8000, w: 28000, h: 2000 }, 'S', 'S-201', 0.7),
    wallMount({ x: 0, y: 8000, w: 28000, h: 2000 }, 'S', 'K-210', 0.1),
    wallMount({ x: 0, y: 8000, w: 28000, h: 2000 }, 'S', 'K-210', 0.9),
    // トイレ × 2
    roomCenter({ x: 0, y: 10000, w: 4000, h: 4000 }, 'E-006'),
    roomCenter({ x: 4000, y: 10000, w: 4000, h: 4000 }, 'E-006'),
    // 倉庫
    ...gridLights({ x: 8000, y: 10000, w: 6000, h: 4000 }, 2, 1, 'E-006'),
    // 機械室
    eq('A-101', 16000, 11500),
    eq('A-101', 19000, 11500),
    eq('A-104', 17500, 13000),
    eq('S-106', 15000, 13000),
    // 電気室
    eq('E-101', 22000, 11000),
    eq('E-102', 24000, 11000),
    eq('K-101', 26000, 11000),
    eq('K-103', 26000, 13000),
    // 屋外 (送水口 + 消防水利)
    eq('S-401', 14000, -1500),
    eq('S-401', 20000, -1500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-commercial',
    templateVersion: '1.0.0',
    buildingType: 'retail',
    name: '商業施設 (ショッピングモール)',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 3000,
  }, furniture)
}

// 3. 病院・医療施設 (中規模クリニック、約 20m × 14m)
export function buildHospitalTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', rect: { x: 0, y: 0, w: 6000, h: 6000 } },
    {
      id: 'reception',
      presetId: 'office',
      customName: '受付・待合',
      rect: { x: 6000, y: 0, w: 6000, h: 6000 },
    },
    {
      id: 'exam-1',
      presetId: 'office',
      customName: '診察室1',
      rect: { x: 12000, y: 0, w: 4000, h: 4000 },
    },
    {
      id: 'exam-2',
      presetId: 'office',
      customName: '診察室2',
      rect: { x: 16000, y: 0, w: 4000, h: 4000 },
    },
    {
      id: 'exam-3',
      presetId: 'office',
      customName: '処置室',
      rect: { x: 12000, y: 4000, w: 8000, h: 4000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 6000, w: 12000, h: 2000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 0, y: 8000, w: 4000, h: 4000 },
    },
    {
      id: 'kitchenette',
      presetId: 'kitchenette',
      rect: { x: 4000, y: 8000, w: 3000, h: 4000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 7000, y: 8000, w: 5000, h: 4000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 12000, y: 8000, w: 4000, h: 4000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 16000, y: 8000, w: 4000, h: 4000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // ロビー・受付
    ...gridLights({ x: 500, y: 500, w: 5000, h: 5000 }, 2, 2, 'E-006'),
    ...gridLights({ x: 6500, y: 500, w: 5000, h: 5000 }, 3, 2, 'E-006'),
    eq('K-005', 2500, 3000),
    eq('K-005', 8500, 3000),
    eq('K-018', 6000, 3000),
    wallMount({ x: 0, y: 0, w: 6000, h: 6000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 6000, h: 6000 }, 'N', 'K-203', 0.6),
    wallMount({ x: 0, y: 0, w: 6000, h: 6000 }, 'N', 'K-210', 0.85),
    // 診察室 1 / 2 / 処置室
    ...gridLights({ x: 12500, y: 500, w: 3000, h: 3000 }, 2, 2, 'E-006'),
    eq('K-002', 14000, 2000),
    ...gridLights({ x: 16500, y: 500, w: 3000, h: 3000 }, 2, 2, 'E-006'),
    eq('K-002', 18000, 2000),
    ...gridLights({ x: 12500, y: 4500, w: 7000, h: 3000 }, 3, 2, 'E-006'),
    ...detectors({ x: 12500, y: 4500, w: 7000, h: 3000 }, 3, 'K-002'),
    eq('A-001', 16000, 6000),
    // 廊下
    ...detectors({ x: 0, y: 6000, w: 12000, h: 2000 }, 4, 'E-007'),
    eq('K-017', 6000, 7000),
    wallMount({ x: 0, y: 6000, w: 12000, h: 2000 }, 'S', 'S-201', 0.4),
    wallMount({ x: 0, y: 6000, w: 12000, h: 2000 }, 'S', 'K-210', 0.05),
    wallMount({ x: 0, y: 6000, w: 12000, h: 2000 }, 'S', 'K-210', 0.95),
    // トイレ / 給湯室
    roomCenter({ x: 0, y: 8000, w: 4000, h: 4000 }, 'E-006'),
    eq('A-001', 5500, 10000),
    eq('P-201', 4200, 9000),
    // 機械室・電気室・倉庫
    eq('A-101', 9500, 10000),
    eq('S-106', 8500, 11500),
    eq('E-101', 13000, 10000),
    eq('K-101', 15000, 10000),
    ...gridLights({ x: 16000, y: 8000, w: 4000, h: 4000 }, 2, 1, 'E-006'),
    // 屋外
    eq('S-401', 10000, -1500),
    eq('P-401', 18000, -1500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-hospital',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: '病院・医療施設 (クリニック)',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 2700,
  }, furniture)
}

// 4. ホテル (小規模、約 22m × 16m)
export function buildHotelTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', rect: { x: 0, y: 0, w: 8000, h: 6000 } },
    {
      id: 'restaurant',
      presetId: 'office',
      customName: 'レストラン',
      rect: { x: 8000, y: 0, w: 8000, h: 6000 },
    },
    {
      id: 'guest-1',
      presetId: 'office',
      customName: '客室101',
      rect: { x: 16000, y: 0, w: 6000, h: 5000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 6000, w: 22000, h: 2000 },
    },
    {
      id: 'guest-2',
      presetId: 'office',
      customName: '客室102',
      rect: { x: 0, y: 8000, w: 5500, h: 5000 },
    },
    {
      id: 'guest-3',
      presetId: 'office',
      customName: '客室103',
      rect: { x: 5500, y: 8000, w: 5500, h: 5000 },
    },
    {
      id: 'guest-4',
      presetId: 'office',
      customName: '客室104',
      rect: { x: 11000, y: 8000, w: 5500, h: 5000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 16000, y: 5000, w: 3000, h: 3000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 16500, y: 8000, w: 2750, h: 5000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 19250, y: 8000, w: 2750, h: 5000 },
    },
    {
      id: 'kitchenette',
      presetId: 'kitchenette',
      rect: { x: 19000, y: 5000, w: 3000, h: 3000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // ロビー
    ...gridLights({ x: 500, y: 500, w: 7000, h: 5000 }, 3, 2, 'E-006'),
    ...detectors({ x: 0, y: 0, w: 8000, h: 6000 }, 4, 'K-005'),
    ...sprinklerGrid({ x: 0, y: 0, w: 8000, h: 6000 }),
    eq('K-018', 4000, 3000),
    wallMount({ x: 0, y: 0, w: 8000, h: 6000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 8000, h: 6000 }, 'N', 'K-210', 0.85),
    // レストラン
    ...gridLights({ x: 8500, y: 500, w: 7000, h: 5000 }, 3, 2, 'E-006'),
    ...detectors({ x: 8000, y: 0, w: 8000, h: 6000 }, 4, 'K-002'),
    eq('A-001', 12000, 3000),
    // 各客室 (簡易: 中央照明 + 感知器 + 誘導灯)
    eq('E-001', 19000, 2500),
    eq('K-002', 19000, 1500),
    eq('S-001', 19000, 3500),
    eq('E-001', 2750, 10500),
    eq('K-002', 2750, 9500),
    eq('S-001', 2750, 11500),
    eq('E-001', 8250, 10500),
    eq('K-002', 8250, 9500),
    eq('S-001', 8250, 11500),
    eq('E-001', 13750, 10500),
    eq('K-002', 13750, 9500),
    eq('S-001', 13750, 11500),
    // 廊下
    ...detectors({ x: 0, y: 6000, w: 22000, h: 2000 }, 6, 'E-007'),
    eq('K-017', 5500, 7000),
    eq('K-017', 16500, 7000),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'N', 'S-201', 0.25),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'N', 'S-201', 0.75),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'N', 'K-210', 0.05),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'N', 'K-210', 0.95),
    // トイレ / 給湯室
    roomCenter({ x: 16000, y: 5000, w: 3000, h: 3000 }, 'E-006'),
    eq('P-201', 20500, 6500),
    // 機械室・電気室
    eq('A-101', 17800, 10500),
    eq('S-106', 17800, 12000),
    eq('E-101', 20500, 10500),
    eq('K-101', 20500, 12000),
    // 屋上 (高置水槽 + 排煙機)
    eq('P-301', 11000, -2500),
    eq('K-301', 5000, -2500),
    // 屋外
    eq('S-401', 15000, -1500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-hotel',
    templateVersion: '1.0.0',
    buildingType: 'hotel',
    name: 'ホテル・宿泊施設',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 2700,
  }, furniture)
}

// 5. 学校・教育施設 (1 階フロア、約 28m × 16m)
export function buildSchoolTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', customName: '昇降口', rect: { x: 0, y: 0, w: 5000, h: 5000 } },
    {
      id: 'office',
      presetId: 'office',
      customName: '職員室',
      rect: { x: 5000, y: 0, w: 7000, h: 5000 },
    },
    {
      id: 'class-1',
      presetId: 'conference-room',
      customName: '教室1',
      rect: { x: 12000, y: 0, w: 8000, h: 7000 },
    },
    {
      id: 'class-2',
      presetId: 'conference-room',
      customName: '教室2',
      rect: { x: 20000, y: 0, w: 8000, h: 7000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 7000, w: 28000, h: 2000 },
    },
    {
      id: 'class-3',
      presetId: 'conference-room',
      customName: '教室3',
      rect: { x: 12000, y: 9000, w: 8000, h: 6000 },
    },
    {
      id: 'class-4',
      presetId: 'conference-room',
      customName: '教室4',
      rect: { x: 20000, y: 9000, w: 8000, h: 6000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 0, y: 9000, w: 5000, h: 3000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 0, y: 12000, w: 5000, h: 3000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 5000, y: 9000, w: 4000, h: 6000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 9000, y: 9000, w: 3000, h: 6000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // 昇降口 / 職員室
    ...gridLights({ x: 500, y: 500, w: 4000, h: 4000 }, 2, 2, 'E-006'),
    wallMount({ x: 0, y: 0, w: 5000, h: 5000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 5000, h: 5000 }, 'N', 'K-210', 0.8),
    ...gridLights({ x: 5500, y: 500, w: 6000, h: 4000 }, 3, 2, 'E-006'),
    eq('K-005', 8500, 2500),
    eq('K-101', 6000, 4000),
    // 教室 × 4 (照明 + 感知器 + 誘導灯)
    ...gridLights({ x: 12500, y: 500, w: 7000, h: 6000 }, 3, 3, 'E-006'),
    ...detectors({ x: 12000, y: 0, w: 8000, h: 7000 }, 4, 'K-005'),
    eq('K-018', 16000, 3500),
    ...gridLights({ x: 20500, y: 500, w: 7000, h: 6000 }, 3, 3, 'E-006'),
    ...detectors({ x: 20000, y: 0, w: 8000, h: 7000 }, 4, 'K-005'),
    eq('K-018', 24000, 3500),
    ...gridLights({ x: 12500, y: 9500, w: 7000, h: 5000 }, 3, 3, 'E-006'),
    ...detectors({ x: 12000, y: 9000, w: 8000, h: 6000 }, 4, 'K-005'),
    ...gridLights({ x: 20500, y: 9500, w: 7000, h: 5000 }, 3, 3, 'E-006'),
    ...detectors({ x: 20000, y: 9000, w: 8000, h: 6000 }, 4, 'K-005'),
    // 廊下
    ...detectors({ x: 0, y: 7000, w: 28000, h: 2000 }, 7, 'E-007'),
    eq('K-017', 5500, 8000),
    eq('K-017', 16000, 8000),
    eq('K-017', 24000, 8000),
    wallMount({ x: 0, y: 7000, w: 28000, h: 2000 }, 'S', 'S-201', 0.3),
    wallMount({ x: 0, y: 7000, w: 28000, h: 2000 }, 'S', 'S-201', 0.7),
    wallMount({ x: 0, y: 7000, w: 28000, h: 2000 }, 'S', 'K-210', 0.05),
    wallMount({ x: 0, y: 7000, w: 28000, h: 2000 }, 'S', 'K-210', 0.95),
    // 設備諸室
    roomCenter({ x: 0, y: 9000, w: 5000, h: 3000 }, 'E-006'),
    eq('A-101', 7000, 11000),
    eq('S-106', 7000, 13500),
    eq('E-101', 10500, 11000),
    // 屋外
    eq('S-401', 13000, -1500),
    eq('S-402', 22000, -2500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-school',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: '学校・教育施設',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 3000,
  }, furniture)
}

// 6. 工場・倉庫 (約 32m × 22m)
export function buildFactoryTemplate() {
  const rooms: RoomSeed[] = [
    {
      id: 'warehouse',
      presetId: 'storage-warehouse',
      customName: '工場・倉庫',
      rect: { x: 0, y: 0, w: 22000, h: 16000 },
    },
    {
      id: 'office',
      presetId: 'office',
      customName: '管理事務所',
      rect: { x: 22000, y: 0, w: 6000, h: 6000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 22000, y: 6000, w: 6000, h: 4000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 22000, y: 10000, w: 6000, h: 6000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 0, y: 16000, w: 6000, h: 4000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 6000, y: 16000, w: 22000, h: 2000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // 工場・倉庫 (高天井: 大型蛍光灯 + スプリンクラー格子)
    ...gridLights({ x: 1000, y: 1000, w: 20000, h: 14000 }, 5, 4, 'E-007'),
    ...sprinklerGrid({ x: 0, y: 0, w: 22000, h: 16000 }),
    ...detectors({ x: 0, y: 0, w: 22000, h: 16000 }, 8, 'K-002'),
    eq('K-018', 11000, 5000),
    eq('K-018', 11000, 11000),
    wallMount({ x: 0, y: 0, w: 22000, h: 16000 }, 'W', 'S-201', 0.3),
    wallMount({ x: 0, y: 0, w: 22000, h: 16000 }, 'W', 'S-201', 0.7),
    wallMount({ x: 0, y: 0, w: 22000, h: 16000 }, 'W', 'K-202', 0.5),
    wallMount({ x: 0, y: 0, w: 22000, h: 16000 }, 'W', 'K-210', 0.1),
    wallMount({ x: 0, y: 0, w: 22000, h: 16000 }, 'W', 'K-210', 0.9),
    eq('S-106', 1500, 1500),
    eq('S-106', 20500, 1500),
    eq('S-106', 1500, 14500),
    eq('S-106', 20500, 14500),
    // 管理事務所
    ...gridLights({ x: 22500, y: 500, w: 5000, h: 5000 }, 2, 2, 'E-006'),
    eq('K-005', 25000, 3000),
    eq('K-101', 25000, 5000),
    // トイレ
    roomCenter({ x: 22000, y: 6000, w: 6000, h: 4000 }, 'E-006'),
    // 機械室
    eq('A-101', 24000, 12000),
    eq('A-101', 26000, 12000),
    eq('A-104', 25000, 14500),
    eq('G-101', 23000, 14000),
    // 電気室
    eq('E-101', 1500, 18000),
    eq('E-102', 3000, 18000),
    eq('K-104', 4500, 18500),
    // 廊下
    ...detectors({ x: 6000, y: 16000, w: 22000, h: 2000 }, 5, 'E-007'),
    // 屋外 (送水口 + 防火水槽)
    eq('S-401', 11000, -1500),
    eq('S-402', 16000, -3000),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-factory',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: '工場・倉庫',
    usageMode: 'bms',
    structureType: 'steel',
    isExistingBuilding: true,
    ceilingHeight: 6000,
  }, furniture)
}

// 7. マンション・集合住宅 (共用部 + 一部住戸、約 22m × 16m)
export function buildApartmentTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', customName: 'エントランス', rect: { x: 0, y: 0, w: 5000, h: 6000 } },
    {
      id: 'mailroom',
      presetId: 'office',
      customName: '集合郵便室',
      rect: { x: 5000, y: 0, w: 3000, h: 3000 },
    },
    {
      id: 'mgmt',
      presetId: 'office',
      customName: '管理人室',
      rect: { x: 5000, y: 3000, w: 3000, h: 3000 },
    },
    {
      id: 'unit-a',
      presetId: 'office',
      customName: '住戸A',
      rect: { x: 8000, y: 0, w: 7000, h: 6000 },
    },
    {
      id: 'unit-b',
      presetId: 'office',
      customName: '住戸B',
      rect: { x: 15000, y: 0, w: 7000, h: 6000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 6000, w: 22000, h: 2000 },
    },
    {
      id: 'unit-c',
      presetId: 'office',
      customName: '住戸C',
      rect: { x: 0, y: 8000, w: 7000, h: 6000 },
    },
    {
      id: 'unit-d',
      presetId: 'office',
      customName: '住戸D',
      rect: { x: 7000, y: 8000, w: 7000, h: 6000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 14000, y: 8000, w: 4000, h: 6000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 18000, y: 8000, w: 4000, h: 6000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // エントランス
    ...gridLights({ x: 500, y: 500, w: 4000, h: 5000 }, 2, 2, 'E-006'),
    eq('K-005', 2500, 3000),
    wallMount({ x: 0, y: 0, w: 5000, h: 6000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 5000, h: 6000 }, 'N', 'K-210', 0.85),
    // 各住戸
    eq('E-001', 11500, 3000),
    eq('K-002', 11500, 2000),
    eq('S-001', 11500, 4000),
    eq('E-001', 18500, 3000),
    eq('K-002', 18500, 2000),
    eq('S-001', 18500, 4000),
    eq('E-001', 3500, 11000),
    eq('K-002', 3500, 10000),
    eq('S-001', 3500, 12000),
    eq('E-001', 10500, 11000),
    eq('K-002', 10500, 10000),
    eq('S-001', 10500, 12000),
    // 共用廊下
    ...detectors({ x: 0, y: 6000, w: 22000, h: 2000 }, 5, 'E-007'),
    eq('K-017', 5500, 7000),
    eq('K-017', 16000, 7000),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'S', 'S-201', 0.4),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'S', 'K-210', 0.05),
    wallMount({ x: 0, y: 6000, w: 22000, h: 2000 }, 'S', 'K-210', 0.95),
    // 機械室 / 電気室
    eq('A-101', 16000, 11000),
    eq('P-106', 15000, 13000),
    eq('E-101', 19000, 10000),
    eq('K-101', 21000, 10000),
    // 屋上 (高置水槽)
    eq('P-301', 11000, -2500),
    // 屋外
    eq('S-401', 11000, -1500),
    eq('P-401', 5000, -1200),
    eq('P-402', 17000, -1200),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-apartment',
    templateVersion: '1.0.0',
    buildingType: 'apartment-unit',
    name: 'マンション・集合住宅',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 2700,
  }, furniture)
}

// 8. 公共施設 (市役所、約 25m × 18m)
export function buildPublicTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', customName: '市民ロビー', rect: { x: 0, y: 0, w: 8000, h: 7000 } },
    {
      id: 'counter',
      presetId: 'office',
      customName: '受付カウンター',
      rect: { x: 8000, y: 0, w: 9000, h: 4000 },
    },
    {
      id: 'office',
      presetId: 'office',
      customName: '執務室',
      rect: { x: 8000, y: 4000, w: 9000, h: 6000 },
    },
    {
      id: 'conf',
      presetId: 'conference-room',
      customName: '会議室',
      rect: { x: 17000, y: 0, w: 8000, h: 6000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 7000, w: 8000, h: 2000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 0, y: 9000, w: 4000, h: 4000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 4000, y: 9000, w: 4000, h: 4000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 8000, y: 10000, w: 9000, h: 4000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 17000, y: 6000, w: 8000, h: 4000 },
    },
    {
      id: 'kitchenette',
      presetId: 'kitchenette',
      rect: { x: 17000, y: 10000, w: 8000, h: 3000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // ロビー
    ...gridLights({ x: 500, y: 500, w: 7000, h: 6000 }, 3, 3, 'E-006'),
    ...sprinklerGrid({ x: 0, y: 0, w: 8000, h: 7000 }),
    eq('K-018', 4000, 3500),
    wallMount({ x: 0, y: 0, w: 8000, h: 7000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 8000, h: 7000 }, 'N', 'K-210', 0.85),
    // 受付カウンター
    ...gridLights({ x: 8500, y: 500, w: 8000, h: 3000 }, 4, 2, 'E-006'),
    eq('K-005', 12500, 2000),
    // 執務室
    ...gridLights({ x: 8500, y: 4500, w: 8000, h: 5000 }, 4, 3, 'E-006'),
    ...detectors({ x: 8000, y: 4000, w: 9000, h: 6000 }, 4, 'K-005'),
    eq('A-001', 12500, 7000),
    // 会議室
    ...gridLights({ x: 17500, y: 500, w: 7000, h: 5000 }, 3, 2, 'E-006'),
    eq('K-002', 21000, 3000),
    eq('K-018', 21000, 5000),
    // 廊下
    ...detectors({ x: 0, y: 7000, w: 8000, h: 2000 }, 3, 'E-007'),
    eq('K-017', 4000, 8000),
    wallMount({ x: 0, y: 7000, w: 8000, h: 2000 }, 'S', 'S-201', 0.5),
    wallMount({ x: 0, y: 7000, w: 8000, h: 2000 }, 'S', 'K-210', 0.1),
    // トイレ / 倉庫 / 給湯室
    roomCenter({ x: 0, y: 9000, w: 4000, h: 4000 }, 'E-006'),
    ...gridLights({ x: 4000, y: 9000, w: 4000, h: 4000 }, 2, 1, 'E-006'),
    eq('P-201', 21000, 11500),
    // 機械室 / 電気室
    eq('A-101', 10000, 12000),
    eq('A-101', 13000, 12000),
    eq('A-104', 16000, 12000),
    eq('E-101', 19000, 8000),
    eq('E-102', 21000, 8000),
    eq('K-101', 23000, 8000),
    // 屋外
    eq('S-401', 12000, -1500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-public',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: '公共施設 (市役所)',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 2700,
  }, furniture)
}

// 9. データセンター (約 22m × 16m)
export function buildDataCenterTemplate() {
  const rooms: RoomSeed[] = [
    { id: 'lobby', presetId: 'lobby', customName: '入退室管理', rect: { x: 0, y: 0, w: 4000, h: 5000 } },
    {
      id: 'monitor',
      presetId: 'office',
      customName: '監視室',
      rect: { x: 4000, y: 0, w: 5000, h: 5000 },
    },
    {
      id: 'server',
      presetId: 'machine-room',
      customName: 'サーバー室',
      rect: { x: 9000, y: 0, w: 13000, h: 11000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 5000, w: 9000, h: 2000 },
    },
    {
      id: 'restroom',
      presetId: 'restroom-public',
      rect: { x: 0, y: 7000, w: 4000, h: 4000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 4000, y: 7000, w: 5000, h: 4000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 0, y: 11000, w: 11000, h: 5000 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      customName: '空調機械室',
      rect: { x: 11000, y: 11000, w: 11000, h: 5000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // 入退室管理 / 監視室
    ...gridLights({ x: 500, y: 500, w: 3000, h: 4000 }, 2, 2, 'E-006'),
    eq('K-005', 2000, 2500),
    wallMount({ x: 0, y: 0, w: 4000, h: 5000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 4000, h: 5000 }, 'N', 'K-210', 0.85),
    ...gridLights({ x: 4500, y: 500, w: 4000, h: 4000 }, 2, 2, 'E-006'),
    eq('K-005', 6500, 2500),
    eq('K-101', 5500, 4500),
    eq('K-103', 7500, 4500),
    // サーバー室 (高密度 AC + スプリンクラー / 消火ガス + アナログ感知器)
    ...gridLights({ x: 9500, y: 500, w: 12000, h: 10000 }, 4, 3, 'E-007'),
    ...sprinklerGrid({ x: 9000, y: 0, w: 13000, h: 11000 }),
    ...detectors({ x: 9000, y: 0, w: 13000, h: 11000 }, 9, 'K-008'),
    eq('A-101', 11000, 1000),
    eq('A-101', 14000, 1000),
    eq('A-101', 17000, 1000),
    eq('A-101', 20000, 1000),
    eq('A-101', 11000, 10000),
    eq('A-101', 14000, 10000),
    eq('A-101', 17000, 10000),
    eq('A-101', 20000, 10000),
    eq('G-101', 9500, 5500),
    eq('G-101', 10500, 5500),
    eq('G-101', 11500, 5500),
    wallMount({ x: 9000, y: 0, w: 13000, h: 11000 }, 'N', 'K-202'),
    wallMount({ x: 9000, y: 0, w: 13000, h: 11000 }, 'N', 'K-210', 0.95),
    wallMount({ x: 9000, y: 0, w: 13000, h: 11000 }, 'S', 'K-210', 0.05),
    // 廊下
    ...detectors({ x: 0, y: 5000, w: 9000, h: 2000 }, 3, 'E-007'),
    eq('K-017', 4500, 6000),
    wallMount({ x: 0, y: 5000, w: 9000, h: 2000 }, 'S', 'S-201', 0.5),
    // トイレ / 倉庫
    roomCenter({ x: 0, y: 7000, w: 4000, h: 4000 }, 'E-006'),
    ...gridLights({ x: 4000, y: 7000, w: 5000, h: 4000 }, 2, 1, 'E-006'),
    // 電気室 (受配電 + UPS)
    eq('E-101', 2000, 13000),
    eq('E-102', 4000, 13000),
    eq('K-104', 7000, 13500),
    eq('E-103', 9000, 13000),
    // 空調機械室
    eq('A-101', 13000, 13000),
    eq('A-101', 16000, 13000),
    eq('A-101', 19000, 13000),
    eq('A-104', 21000, 14500),
    // 屋外 (送水口 + 防火水槽)
    eq('S-401', 11000, -1500),
    eq('S-402', 18000, -3000),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-datacenter',
    templateVersion: '1.0.0',
    buildingType: 'office',
    name: 'データセンター',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 3000,
  }, furniture)
}

// 10. 複合施設 (オフィス+商業+ホテル混在、約 30m × 20m)
export function buildMixedUseTemplate() {
  const rooms: RoomSeed[] = [
    {
      id: 'lobby',
      presetId: 'lobby',
      customName: 'メインロビー',
      rect: { x: 0, y: 0, w: 8000, h: 8000 },
    },
    {
      id: 'commercial-a',
      presetId: 'office',
      customName: '商業A',
      rect: { x: 8000, y: 0, w: 8000, h: 8000 },
    },
    {
      id: 'commercial-b',
      presetId: 'office',
      customName: '商業B',
      rect: { x: 16000, y: 0, w: 7000, h: 8000 },
    },
    {
      id: 'office',
      presetId: 'office',
      customName: 'オフィス区画',
      rect: { x: 23000, y: 0, w: 7000, h: 8000 },
    },
    {
      id: 'corridor',
      presetId: 'corridor-bms',
      rect: { x: 0, y: 8000, w: 30000, h: 2000 },
    },
    {
      id: 'hotel-1',
      presetId: 'office',
      customName: 'ホテル区画1',
      rect: { x: 0, y: 10000, w: 7000, h: 7000 },
    },
    {
      id: 'hotel-2',
      presetId: 'office',
      customName: 'ホテル区画2',
      rect: { x: 7000, y: 10000, w: 7000, h: 7000 },
    },
    {
      id: 'restroom-1',
      presetId: 'restroom-public',
      rect: { x: 14000, y: 10000, w: 4000, h: 3500 },
    },
    {
      id: 'restroom-2',
      presetId: 'restroom-public',
      rect: { x: 14000, y: 13500, w: 4000, h: 3500 },
    },
    {
      id: 'machine',
      presetId: 'machine-room',
      rect: { x: 18000, y: 10000, w: 6000, h: 7000 },
    },
    {
      id: 'electric',
      presetId: 'electric-room',
      rect: { x: 24000, y: 10000, w: 6000, h: 4000 },
    },
    {
      id: 'storage',
      presetId: 'storage-warehouse',
      rect: { x: 24000, y: 14000, w: 6000, h: 3000 },
    },
  ]
  const furniture: FurnitureSeed[] = [
    // ロビー
    ...gridLights({ x: 500, y: 500, w: 7000, h: 7000 }, 3, 3, 'E-006'),
    ...sprinklerGrid({ x: 0, y: 0, w: 8000, h: 8000 }),
    eq('K-018', 4000, 4000),
    wallMount({ x: 0, y: 0, w: 8000, h: 8000 }, 'N', 'K-202'),
    wallMount({ x: 0, y: 0, w: 8000, h: 8000 }, 'N', 'K-210', 0.85),
    // 商業 A / B
    ...gridLights({ x: 8500, y: 500, w: 7000, h: 7000 }, 3, 3, 'E-006'),
    ...sprinklerGrid({ x: 8000, y: 0, w: 8000, h: 8000 }),
    eq('A-101', 12000, 1500),
    ...gridLights({ x: 16500, y: 500, w: 6000, h: 7000 }, 3, 3, 'E-006'),
    ...sprinklerGrid({ x: 16000, y: 0, w: 7000, h: 8000 }),
    eq('A-101', 19500, 1500),
    // オフィス
    ...gridLights({ x: 23500, y: 500, w: 6000, h: 7000 }, 3, 3, 'E-006'),
    ...detectors({ x: 23000, y: 0, w: 7000, h: 8000 }, 4, 'K-005'),
    eq('A-001', 26500, 4000),
    // 廊下
    ...detectors({ x: 0, y: 8000, w: 30000, h: 2000 }, 7, 'E-007'),
    eq('K-017', 5000, 9000),
    eq('K-017', 15000, 9000),
    eq('K-017', 25000, 9000),
    wallMount({ x: 0, y: 8000, w: 30000, h: 2000 }, 'S', 'S-201', 0.2),
    wallMount({ x: 0, y: 8000, w: 30000, h: 2000 }, 'S', 'S-201', 0.5),
    wallMount({ x: 0, y: 8000, w: 30000, h: 2000 }, 'S', 'S-201', 0.8),
    wallMount({ x: 0, y: 8000, w: 30000, h: 2000 }, 'S', 'K-210', 0.05),
    wallMount({ x: 0, y: 8000, w: 30000, h: 2000 }, 'S', 'K-210', 0.95),
    // ホテル区画 (1, 2)
    ...gridLights({ x: 500, y: 10500, w: 6000, h: 6000 }, 3, 2, 'E-006'),
    ...detectors({ x: 0, y: 10000, w: 7000, h: 7000 }, 4, 'K-002'),
    ...gridLights({ x: 7500, y: 10500, w: 6000, h: 6000 }, 3, 2, 'E-006'),
    ...detectors({ x: 7000, y: 10000, w: 7000, h: 7000 }, 4, 'K-002'),
    // トイレ × 2
    roomCenter({ x: 14000, y: 10000, w: 4000, h: 3500 }, 'E-006'),
    roomCenter({ x: 14000, y: 13500, w: 4000, h: 3500 }, 'E-006'),
    // 機械室
    eq('A-101', 20000, 12000),
    eq('A-101', 22000, 12000),
    eq('A-104', 21000, 15000),
    eq('S-106', 19000, 16000),
    // 電気室
    eq('E-101', 25000, 11000),
    eq('E-102', 27000, 11000),
    eq('K-101', 29000, 11000),
    eq('K-104', 26000, 13000),
    // 倉庫
    ...gridLights({ x: 24000, y: 14000, w: 6000, h: 3000 }, 2, 1, 'E-006'),
    // 屋外 / 屋上
    eq('S-401', 15000, -1500),
    eq('P-301', 8000, -2500),
    eq('K-301', 22000, -2500),
  ]
  return buildTemplateFloorplan(rooms, {
    templateId: 'bms-mixed-use',
    templateVersion: '1.0.0',
    buildingType: 'mixed',
    name: '複合施設 (オフィス+商業+ホテル)',
    usageMode: 'bms',
    structureType: 'rc',
    isExistingBuilding: true,
    ceilingHeight: 3000,
  }, furniture)
}
