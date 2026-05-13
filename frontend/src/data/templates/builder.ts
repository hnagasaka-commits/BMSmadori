/**
 * テンプレ Floorplan を組み立てるための共通ヘルパー。
 *
 * 各テンプレファイルは部屋の配列を宣言し、ここで walls / Floor / Floorplan に組み上げる。
 * 自動ドアを共有壁に配置する処理は §6.2 と整合 (recomputeFloor は使わず、buildFloorplan に閉じる)。
 */

import type {
  BuildingType,
  Floor,
  Floorplan,
  FurnitureInstance,
  FurnitureMount,
  Room,
  Shape,
  UsageMode,
} from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'
import { regenerateWallsFromRooms } from '@/core/walls'
import { autoPlaceDoors } from '@/core/doors'

export type RoomSeed = {
  id: string
  presetId: string
  /** rect 部屋の (x, y, w, h) */
  rect: { x: number; y: number; w: number; h: number }
  rotation?: number
  /** §M136 v0.31: BMS テンプレ向け - 部屋ごとの表示名上書き (例: 「サーバー室」など preset.displayName とずらしたい場合) */
  customName?: string
}

/**
 * §M136 v0.31: テンプレートに事前配置する家具・設備の種。
 * BMS テンプレ (オフィス / 病院 / 工場 等) では 137 種の設備マスター ID を catalogId に入れる。
 * mountTo は spec.placement と揃えてここで明示する (テンプレ生成は equipmentMaster が未ロードでも動くように)。
 */
export type FurnitureSeed = {
  catalogId: string
  position: readonly [number, number]
  rotation?: number
  mountTo?: FurnitureMount
}

export type TemplateOptions = {
  templateId: string
  templateVersion: string
  buildingType: BuildingType
  name: string
  gridSize?: number
  /** §M136 v0.31: 用途モード (BMS テンプレは 'bms')。未指定は 'residential' */
  usageMode?: UsageMode
  /** §M136 v0.31: 構造種別 (BMS は通常 'rc')。未指定は 'wood' */
  structureType?: 'wood' | 'steel' | 'rc' | 'src'
  /** §M136 v0.31: 既存建物フラグ。BMS は通常 true */
  isExistingBuilding?: boolean
  /** §M136 v0.31: 天井高 (mm)。BMS は通常 2700 / 商業 3000、未指定は 2400 */
  ceilingHeight?: number
}

function shapeOf(seed: RoomSeed): Shape {
  return {
    kind: 'rect',
    x: seed.rect.x,
    y: seed.rect.y,
    w: seed.rect.w,
    h: seed.rect.h,
    edgeIds: [
      `${seed.id}-e0`,
      `${seed.id}-e1`,
      `${seed.id}-e2`,
      `${seed.id}-e3`,
    ],
  }
}

export function buildTemplateFloorplan(
  rooms: readonly RoomSeed[],
  options: TemplateOptions,
  furniture: readonly FurnitureSeed[] = [],
): Floorplan {
  const roomsBuilt: Room[] = rooms.map((s) => ({
    id: s.id,
    presetId: s.presetId,
    ...(s.customName != null && { customName: s.customName }),
    shape: shapeOf(s),
    rotation: s.rotation ?? 0,
  }))

  const walls = regenerateWallsFromRooms(roomsBuilt)
  // 共有壁に自動ドアを配置 (玄関側を除外したい場合は将来 shouldPlaceOn で制御)
  const doors = autoPlaceDoors({
    walls,
    doors: [],
    rooms: roomsBuilt,
    tombstones: [],
  })

  // §M136 v0.31: 事前配置の家具/設備を FurnitureInstance に変換 (id を発行)
  const furnitureBuilt: FurnitureInstance[] = furniture.map((seed) => ({
    id: crypto.randomUUID(),
    catalogId: seed.catalogId,
    position: [Math.round(seed.position[0]), Math.round(seed.position[1])],
    rotation: seed.rotation ?? 0,
    ...(seed.mountTo != null && { mountTo: seed.mountTo }),
  }))

  const now = new Date().toISOString()
  const floor: Floor = {
    id: `${options.templateId}-floor-1`,
    level: 1,
    name: '1F',
    ceilingHeight: options.ceilingHeight ?? 2400,
    rooms: roomsBuilt,
    walls,
    doors,
    windows: [],
    columns: [],
    pipeSpaces: [],
    furniture: furnitureBuilt,
    humanModels: [],
    voids: [],
    roomFinishes: [],
    wallFinishes: [],
    windowDecorations: [],
    doorDecorations: [],
    suppressedAutoDoors: [],
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      name: options.name,
      buildingType: options.buildingType,
      unit: 'mm',
      gridSize: options.gridSize ?? 910,
      orientation: 0,
      createdAt: now,
      updatedAt: now,
      ...(options.usageMode != null && { usageMode: options.usageMode }),
      templateOrigin: {
        templateId: options.templateId,
        templateVersion: options.templateVersion,
      },
    },
    floors: [floor],
    building: {
      structureType: options.structureType ?? 'wood',
      isExistingBuilding: options.isExistingBuilding ?? false,
    },
  }
}
