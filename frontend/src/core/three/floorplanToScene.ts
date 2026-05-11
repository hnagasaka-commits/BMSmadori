/**
 * §11 Phase 2 / M12: Floorplan を 3D シーン用の中間表現 (SceneSpec) に落とす。
 *
 * - 単位は mm 整数 (Floorplan の正本) のまま運ぶ。3D 側でメートルに割る (1/1000)。
 *   こうすると Phase 2 後半で行う寸法表示や日当たり距離計算が常に「mm 文化圏」で完結する。
 * - Phase 1.5 までの素材 (rect 部屋 + 壁芯線セグメント + 開口) しか入力に来ない前提。
 *   polygon と任意回転は Phase 2 後半 (M16) で対応する。
 * - ここでは three.js も R3F も import しない。React/Renderer から独立した純粋関数。
 *   テスト容易性のため (M12-b の単体テスト)。
 */

import type { Door, Floor, FloorplanMetadata, Wall, Window as FpWindow } from '@/types'
import { shapeAabb, shapeVertices } from '@/core/geometry'

export type Vec3 = readonly [number, number, number]

/** 中央点 (mm) + 寸法 (mm) + Y 軸回転 (rad) で表現する壁の Box。 */
export type WallBox = {
  id: string
  center: Vec3
  size: Vec3
  rotationY: number
  /** wallType 由来。マテリアル切替に使う */
  kind: 'exterior' | 'shared' | 'interior'
}

/**
 * 床プレート。
 * - rect : Box ジオメトリ (XZ 中心 + サイズ)
 * - polygon : Shape + 押出し用の XZ 頂点列 (mm)。回転適用済みのワールド頂点を渡す
 *
 * §11 Phase 2 / M16: polygon 部屋を 3D に出すために discriminated union 化。
 */
export type FloorPlate = {
  id: string
  presetId: string
} & (
  | { shapeKind: 'rect'; center: Vec3; size: Vec3 }
  | {
      shapeKind: 'polygon'
      /** ワールド XZ (mm) の頂点列。閉じる前の n 点 (n ≥ 3) */
      pointsXZ: ReadonlyArray<readonly [number, number]>
      /** 中心 (家具配置などで AABB 中心を使いたい時用) */
      center: Vec3
      /** AABB サイズ (家具の SizeMm に使う) */
      size: Vec3
    }
)

/** 壁に穿たれる開口 (扉/窓)。three 側で CSG はせず、上下に細い壁を 2 本立てる方式で表現する */
export type Opening = {
  id: string
  /** どの壁に対する開口か (穴あけのために WallBox.id を返さない: 後で wallId で対応付け) */
  wallId: string
  kind: 'door' | 'window'
  /** 開口幅 (mm)。Door.width または Window.width */
  width: number
  /** 床からの sill 高さ (mm)。Door は 0、Window は標準 800mm */
  sillHeight: number
  /** 開口の縦寸法 (mm) */
  height: number
  /** 壁長 (mm) に対する中心の位置比率 (0..1)。Wall.from を 0 とする */
  positionRatio: number
}

export type SceneSpec = {
  /** mm。Phase 2 では Floorplan.metadata.ceilingHeight をそのまま流用 */
  ceilingHeight: number
  floorPlates: FloorPlate[]
  walls: WallBox[]
  openings: Opening[]
  /** ワールド原点を持ってきたいので、全体の中心 (mm) を返す。R3F 側で OrbitControls.target に渡す */
  center: Vec3
  /** 全体の半径 (mm)。R3F 側で初期カメラ距離を決めるのに使う */
  radius: number
}

const DEFAULT_WINDOW_SILL_MM = 800
const DEFAULT_WINDOW_HEIGHT_MM = 1100
const DEFAULT_DOOR_HEIGHT_MM = 2000
const DEFAULT_WALL_HEIGHT_MM = 2400

/**
 * Floor (+ metadata) を SceneSpec に変換する。
 *
 * Phase 1 / 1.5 の制約に依存しているため、polygon 部屋や 90° 以外の回転は無視 (将来追加)。
 */
export function floorplanToScene(floor: Floor, metadata: FloorplanMetadata): SceneSpec {
  const ceilingHeight = metadata.gridSize > 0 ? DEFAULT_WALL_HEIGHT_MM : DEFAULT_WALL_HEIGHT_MM

  const floorPlates: FloorPlate[] = []
  if (Array.isArray(floor.rooms)) {
    for (const room of floor.rooms) {
      if (room.shape.kind === 'rect') {
        // §11 Phase 2 / M16: rect は回転後 AABB から箱を作る (90° 量子化前提)。
        // shapeAabb は回転後を返してくれるので AABB のまま投げる。
        const aabb = shapeAabb(room.shape, room.rotation)
        const cx = (aabb.minX + aabb.maxX) / 2
        const cz = (aabb.minY + aabb.maxY) / 2
        floorPlates.push({
          id: room.id,
          presetId: room.presetId,
          shapeKind: 'rect',
          center: [cx, 0, cz],
          size: [aabb.maxX - aabb.minX, 1, aabb.maxY - aabb.minY],
        })
      } else if (room.shape.kind === 'polygon') {
        // §11 Phase 2 / M16: polygon はワールド頂点を 3D の XZ 平面に落とす。
        // Three.Shape は閉じない開いた頂点列を受け取るので [x, y] のまま渡す。
        const verts = shapeVertices(room.shape, room.rotation)
        const aabb = shapeAabb(room.shape, room.rotation)
        const cx = (aabb.minX + aabb.maxX) / 2
        const cz = (aabb.minY + aabb.maxY) / 2
        floorPlates.push({
          id: room.id,
          presetId: room.presetId,
          shapeKind: 'polygon',
          pointsXZ: verts.map(([x, z]) => [x, z] as const),
          center: [cx, 0, cz],
          size: [aabb.maxX - aabb.minX, 1, aabb.maxY - aabb.minY],
        })
      }
    }
  }

  const walls: WallBox[] = []
  // §M30: hiddenWallIds は 3D でも非表示にする
  const hidden = new Set(floor.hiddenWallIds ?? [])
  if (Array.isArray(floor.walls)) {
    for (const wall of floor.walls) {
      if (hidden.has(wall.id)) continue
      const wb = wallToBox(wall, ceilingHeight)
      if (wb != null) walls.push(wb)
    }
  }
  // §M30: freestandingWalls も 3D に出す
  if (Array.isArray(floor.freestandingWalls)) {
    for (const wall of floor.freestandingWalls) {
      const wb = wallToBox(wall, ceilingHeight)
      if (wb != null) walls.push(wb)
    }
  }

  const openings: Opening[] = []
  if (Array.isArray(floor.doors)) {
    for (const d of floor.doors) openings.push(doorToOpening(d))
  }
  if (Array.isArray(floor.windows)) {
    for (const w of floor.windows) openings.push(windowToOpening(w))
  }

  const { center, radius } = computeBounds(floorPlates, walls, ceilingHeight)

  return {
    ceilingHeight,
    floorPlates,
    walls,
    openings,
    center,
    radius,
  }
}

function wallToBox(wall: Wall, ceilingHeight: number): WallBox | null {
  const [x1, y1] = wall.from
  const [x2, y2] = wall.to
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length < 1) return null

  const cx = (x1 + x2) / 2
  const cz = (y1 + y2) / 2
  const cy = (wall.height ?? ceilingHeight) / 2
  const sizeY = wall.height ?? ceilingHeight
  const rotationY = -Math.atan2(dy, dx)

  const kind: WallBox['kind'] =
    wall.wallType === 'exterior' ? 'exterior' : wall.wallType === 'shared' ? 'shared' : 'interior'

  return {
    id: wall.id,
    center: [cx, cy, cz],
    size: [length, sizeY, wall.thickness],
    rotationY,
    kind,
  }
}

function doorToOpening(d: Door): Opening {
  return {
    id: d.id,
    wallId: d.wallId,
    kind: 'door',
    width: d.width,
    sillHeight: 0,
    height: DEFAULT_DOOR_HEIGHT_MM,
    positionRatio: d.positionRatio,
  }
}

function windowToOpening(w: FpWindow): Opening {
  return {
    id: w.id,
    wallId: w.wallId,
    kind: 'window',
    width: w.width,
    sillHeight: DEFAULT_WINDOW_SILL_MM,
    height: w.height > 0 ? w.height : DEFAULT_WINDOW_HEIGHT_MM,
    positionRatio: w.positionRatio,
  }
}

function computeBounds(
  plates: FloorPlate[],
  walls: WallBox[],
  ceilingHeight: number,
): { center: Vec3; radius: number } {
  if (plates.length === 0 && walls.length === 0) {
    return { center: [0, 0, 0], radius: 5000 }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of plates) {
    const [cx, , cz] = p.center
    const [sx, , sz] = p.size
    minX = Math.min(minX, cx - sx / 2)
    maxX = Math.max(maxX, cx + sx / 2)
    minZ = Math.min(minZ, cz - sz / 2)
    maxZ = Math.max(maxZ, cz + sz / 2)
  }
  for (const w of walls) {
    const [cx, , cz] = w.center
    const [sx, , sz] = w.size
    // 回転を真面目にかけると重いので、最悪値として長辺の半分を加える
    const r = Math.max(sx, sz) / 2
    minX = Math.min(minX, cx - r)
    maxX = Math.max(maxX, cx + r)
    minZ = Math.min(minZ, cz - r)
    maxZ = Math.max(maxZ, cz + r)
  }
  if (!isFinite(minX)) return { center: [0, 0, 0], radius: 5000 }

  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const dx = maxX - minX
  const dz = maxZ - minZ
  const radius = Math.max(Math.hypot(dx, dz) / 2, ceilingHeight)
  return { center: [cx, ceilingHeight / 2, cz], radius }
}
