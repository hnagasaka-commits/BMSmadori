/**
 * テスト用 fixture ビルダー。
 * Phase 1 不変条件を満たす最小の Floorplan を組み立てる。
 *
 * 各テストは `makeFloorplan({ rooms: [...] })` のように部分上書きで使う。
 */

import type {
  Floor,
  Floorplan,
  FloorplanMetadata,
  Room,
  Shape,
  Wall,
} from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'

let _nextId = 0
function uid(prefix: string): string {
  _nextId++
  return `${prefix}-${_nextId.toString(36)}`
}

export function makeRectShape(
  partial: Partial<Extract<Shape, { kind: 'rect' }>> = {},
): Extract<Shape, { kind: 'rect' }> {
  return {
    kind: 'rect',
    x: 0,
    y: 0,
    w: 3640,
    h: 2730,
    edgeIds: [uid('e'), uid('e'), uid('e'), uid('e')],
    ...partial,
  }
}

export function makeRoom(partial: Partial<Room> = {}): Room {
  return {
    id: uid('r'),
    presetId: 'living',
    shape: makeRectShape(),
    rotation: 0,
    ...partial,
  }
}

export function makeWall(partial: Partial<Wall> = {}): Wall {
  return {
    id: uid('w'),
    from: [0, 0],
    to: [3640, 0],
    thickness: 100,
    wallType: 'partition',
    isLocked: false,
    sharedBy: [],
    ...partial,
  }
}

export function makeFloor(partial: Partial<Floor> = {}): Floor {
  return {
    id: uid('f'),
    level: 1,
    name: '1F',
    ceilingHeight: 2400,
    rooms: [],
    walls: [],
    doors: [],
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
    ...partial,
  }
}

export function makeMetadata(
  partial: Partial<FloorplanMetadata> = {},
): FloorplanMetadata {
  return {
    name: 'テストプラン',
    buildingType: 'single-family',
    unit: 'mm',
    gridSize: 910,
    orientation: 0,
    createdAt: '2026-05-11T00:00:00Z',
    updatedAt: '2026-05-11T00:00:00Z',
    ...partial,
  }
}

export function makeFloorplan(partial: Partial<Floorplan> = {}): Floorplan {
  return {
    version: CURRENT_SCHEMA_VERSION,
    metadata: makeMetadata(),
    floors: [makeFloor({ rooms: [makeRoom()] })],
    building: {
      structureType: 'wood',
      isExistingBuilding: false,
    },
    ...partial,
  }
}
