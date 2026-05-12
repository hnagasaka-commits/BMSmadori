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

import type { Door, Floor, FloorplanMetadata, Room, Wall, Window as FpWindow } from '@/types'
import { shapeAabb, shapeVertices } from '@/core/geometry'

export type Vec3 = readonly [number, number, number]

/** 中央点 (mm) + 寸法 (mm) + Y 軸回転 (rad) で表現する壁の Box。 */
export type WallBox = {
  id: string
  center: Vec3
  size: Vec3
  rotationY: number
  /**
   * wallType 由来。マテリアル切替に使う。
   * §M70 v0.12: 'railing' を追加 — バルコニーの外周壁 (= sharedBy が balcony 1 つだけの壁) は
   * 通常の壁ではなく手摺として描画する。
   */
  kind: 'exterior' | 'shared' | 'interior' | 'railing'
  /**
   * §M60 v0.9: 非表示フラグ。hiddenWallIds に含まれる壁は wall 本体は描かないが、
   * 載っているドア/窓のヒント (= 開口部マッチ) は引き続き使うため WallBox 自体は残す。
   */
  hidden?: boolean
  /**
   * §M75 v0.13: kind='railing' の壁限定。
   * 部屋の「外側」を指す wall-local +Z 方向の符号 (-1 / +1)。
   * これで手摺をバルコニー床の外側 (建物の外周側) に張り付けて描画できる。
   */
  outsideSign?: -1 | 1
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
  /** §M50 v0.6: ドアパネルを壁の内側 / 外側どちらに描くか (door のみ) */
  swingInward?: boolean
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

  // §M70 v0.12 / §M75 v0.13: バルコニー外周判定 + outsideSign 計算用に
  // roomId → Room の lookup を作る
  const roomById = new Map<string, Room>()
  if (Array.isArray(floor.rooms)) {
    for (const room of floor.rooms) roomById.set(room.id, room)
  }

  const walls: WallBox[] = []
  // §M30 / §M60 v0.9: hiddenWallIds は壁本体を非表示にするが、
  // 載っているドア/窓は引き続き 3D に出したいので、WallBox は hidden=true で残す
  const hidden = new Set(floor.hiddenWallIds ?? [])
  if (Array.isArray(floor.walls)) {
    for (const wall of floor.walls) {
      const wb = wallToBox(wall, ceilingHeight, roomById)
      if (wb == null) continue
      if (hidden.has(wall.id)) wb.hidden = true
      walls.push(wb)
    }
  }
  // §M30: freestandingWalls も 3D に出す
  if (Array.isArray(floor.freestandingWalls)) {
    for (const wall of floor.freestandingWalls) {
      const wb = wallToBox(wall, ceilingHeight, roomById)
      if (wb != null) walls.push(wb)
    }
  }

  const baseOpenings: Opening[] = []
  if (Array.isArray(floor.doors)) {
    for (const d of floor.doors) baseOpenings.push(doorToOpening(d))
  }
  if (Array.isArray(floor.windows)) {
    for (const w of floor.windows) baseOpenings.push(windowToOpening(w))
  }

  // §M81 v0.16: 同じ直線上に並んでいる別の壁にも開口部を伝播させる。
  // closet と bedroom など、片方の長辺と他方の短辺が同じ Y (or X) に乗っている時、
  // regenerateWallsFromRooms はそれぞれを独立した Wall として生成する
  // (canonicalSegmentKey が端点完全一致を要求するため)。結果として、ドアを置いた
  // 短い壁には穴が空くが、それを覆う長い壁は solid のままで「壁の中にドアが隠れる」事故が出る。
  // 解決: 各 opening について、ソース壁と同一直線上 + 開口部範囲がオーバーラップする
  // 他の壁にも opening を複製する。複製先の positionRatio はその壁の長さに合わせて再計算。
  const sourceWallsForOpenings: Wall[] = [
    ...(Array.isArray(floor.walls) ? floor.walls : []),
    ...(Array.isArray(floor.freestandingWalls) ? floor.freestandingWalls : []),
  ]
  const openings = propagateOpeningsToCoplanarWalls(baseOpenings, sourceWallsForOpenings)

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

/**
 * §M81 v0.16: ソース壁と同じ直線上に乗っている別の壁にも開口部を複製する。
 * canonicalSegmentKey が「端点完全一致」を要求するため、長い壁と短い壁が同じ直線上に
 * 並ぶ (例: 長い bedroom 北壁の一部分が短い closet 南壁と重なる) と、別々の Wall に
 * なる → 一方にしかドア穴が空かない → 3D で隠れる、を解決する。
 */
function propagateOpeningsToCoplanarWalls(
  openings: readonly Opening[],
  walls: readonly Wall[],
): Opening[] {
  if (walls.length === 0) return openings.slice()
  const wallById = new Map(walls.map((w) => [w.id, w]))

  // 2 つの壁が同じ無限直線上にあるか (parallel + 同一直線)
  const onSameLine = (a: Wall, b: Wall): boolean => {
    const adx = a.to[0] - a.from[0]
    const ady = a.to[1] - a.from[1]
    const bdx = b.to[0] - b.from[0]
    const bdy = b.to[1] - b.from[1]
    // 平行判定: 方向ベクトルの cross が 0
    const cross = adx * bdy - ady * bdx
    if (Math.abs(cross) > 2) return false
    // 直線一致判定: b.from が a の無限直線上にある
    const px = b.from[0] - a.from[0]
    const py = b.from[1] - a.from[1]
    const cross2 = px * ady - py * adx
    return Math.abs(cross2) < 2
  }

  const result: Opening[] = []
  for (const op of openings) {
    result.push(op)
    const sourceWall = wallById.get(op.wallId)
    if (sourceWall == null) continue

    const sdx = sourceWall.to[0] - sourceWall.from[0]
    const sdy = sourceWall.to[1] - sourceWall.from[1]
    const sLen = Math.hypot(sdx, sdy)
    if (sLen < 1) continue
    // 開口部中心のワールド座標
    const cx = sourceWall.from[0] + sdx * op.positionRatio
    const cy = sourceWall.from[1] + sdy * op.positionRatio

    for (const w of walls) {
      if (w.id === op.wallId) continue
      if (!onSameLine(sourceWall, w)) continue
      const wdx = w.to[0] - w.from[0]
      const wdy = w.to[1] - w.from[1]
      const wLen = Math.hypot(wdx, wdy)
      if (wLen < 1) continue
      // 開口部中心を w 上に射影 → t (0..1 で w の中、それ以外は壁外)
      const px = cx - w.from[0]
      const py = cy - w.from[1]
      const t = (px * wdx + py * wdy) / (wLen * wLen)
      // 開口部の幅 (mm 単位) を w 上の比率に
      const halfRatio = op.width / 2 / wLen
      const tLeft = t - halfRatio
      const tRight = t + halfRatio
      // 開口部が壁範囲 [0, 1] と少しでも重なるなら伝播
      if (tRight < 0 || tLeft > 1) continue
      result.push({ ...op, wallId: w.id, positionRatio: t })
    }
  }
  return result
}

function wallToBox(
  wall: Wall,
  ceilingHeight: number,
  roomById: ReadonlyMap<string, Room>,
): WallBox | null {
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

  // §M70 v0.12: balcony の外周壁 (= sharedBy が balcony 1 件だけ) は railing とする。
  // sharedBy.length === 1 で唯一の部屋が balcony プリセットの時に限定 (家側に接する壁は通常壁)
  const balconyRoom =
    wall.sharedBy.length === 1
      ? (() => {
          const r = roomById.get(wall.sharedBy[0]!)
          return r != null && r.presetId === 'balcony' ? r : null
        })()
      : null
  const isBalconyRailing = balconyRoom != null

  const kind: WallBox['kind'] = isBalconyRailing
    ? 'railing'
    : wall.wallType === 'exterior'
      ? 'exterior'
      : wall.wallType === 'shared'
        ? 'shared'
        : 'interior'

  // §M75 v0.13: railing の場合、部屋の「外側」を指す wall-local +Z の符号を計算する。
  //  three.js での wall-local +Z は world (-dy/L, 0, dx/L) (Y 軸回転 rotationY 後)。
  //  floorplan 平面で言えば (-dy, dx) の方向に向く。
  //  部屋中心が +Z 側にあるなら 外側 = -Z (outsideSign=-1)、逆なら +1。
  let outsideSign: -1 | 1 | undefined
  if (isBalconyRailing && balconyRoom != null) {
    const aabb = shapeAabb(balconyRoom.shape, balconyRoom.rotation)
    const rcx = (aabb.minX + aabb.maxX) / 2
    const rcy = (aabb.minY + aabb.maxY) / 2
    // wall-local +Z 方向のワールド表現 = (-dy/L, dx/L)。部屋中心 - 壁中心 と内積
    const dot = (rcx - cx) * (-dy) + (rcy - cz) * dx
    outsideSign = dot > 0 ? -1 : 1
  }

  const result: WallBox = {
    id: wall.id,
    center: [cx, cy, cz],
    size: [length, sizeY, wall.thickness],
    rotationY,
    kind,
  }
  if (outsideSign !== undefined) result.outsideSign = outsideSign
  return result
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
    // §M50 v0.6: swingInward が未指定なら true (= 既定で内開き) を採用
    swingInward: d.swingInward !== false,
  }
}

function windowToOpening(w: FpWindow): Opening {
  // §M59 v0.9: Window.sillHeight (床から窓下端までの mm) を 3D に反映。
  // 0 以上の有限値なら採用し、未定義/負値なら既定 (800mm) にフォールバック
  const sill =
    typeof w.sillHeight === 'number' && Number.isFinite(w.sillHeight) && w.sillHeight >= 0
      ? w.sillHeight
      : DEFAULT_WINDOW_SILL_MM
  return {
    id: w.id,
    wallId: w.wallId,
    kind: 'window',
    width: w.width,
    sillHeight: sill,
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
