/**
 * テンプレ Floorplan を組み立てるための共通ヘルパー。
 *
 * 各テンプレファイルは部屋の配列を宣言し、ここで walls / Floor / Floorplan に組み上げる。
 * 自動ドアを共有壁に配置する処理は §6.2 と整合 (recomputeFloor は使わず、buildFloorplan に閉じる)。
 */

import type { BuildingType, Floor, Floorplan, Room, Shape } from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'
import { regenerateWallsFromRooms } from '@/core/walls'
import { autoPlaceDoors } from '@/core/doors'

export type RoomSeed = {
  id: string
  presetId: string
  /** rect 部屋の (x, y, w, h) */
  rect: { x: number; y: number; w: number; h: number }
  rotation?: number
}

export type TemplateOptions = {
  templateId: string
  templateVersion: string
  buildingType: BuildingType
  name: string
  gridSize?: number
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
): Floorplan {
  const roomsBuilt: Room[] = rooms.map((s) => ({
    id: s.id,
    presetId: s.presetId,
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

  const now = new Date().toISOString()
  const floor: Floor = {
    id: `${options.templateId}-floor-1`,
    level: 1,
    name: '1F',
    ceilingHeight: 2400,
    rooms: roomsBuilt,
    walls,
    doors,
    windows: [],
    columns: [],
    pipeSpaces: [],
    furniture: [],
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
      templateOrigin: {
        templateId: options.templateId,
        templateVersion: options.templateVersion,
      },
    },
    floors: [floor],
    building: {
      structureType: 'wood',
      isExistingBuilding: false,
    },
  }
}
