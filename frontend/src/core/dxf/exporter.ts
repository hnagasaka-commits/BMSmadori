/**
 * §M121 v0.28: Floorplan を ASCII DXF (R12 互換) で書き出す。
 *
 * 出力方針:
 *  - 単位は mm。`$INSUNITS = 4` をヘッダに明示
 *  - 座標系は DXF 慣習 (Y 上向き) に合わせて plan Y を反転
 *    (= dxfY = bboxMaxY - planY)。再インポート時に build 側で再反転されて round-trip する
 *  - レイヤー名は import 側の `classifyLayer` と整合させる:
 *    WALL / ROOM / CEILING / E-LIGHT / E-SMOKE / E-HEAT / E-AC / E-EMERG / E-SPK /
 *    E-SP / F-EXT / DOOR / WINDOW / FURNITURE
 *  - 部屋: closed LWPOLYLINE + 中央 TEXT (room.customName または preset.displayName)
 *  - 壁: LINE (派生壁 + freestandingWalls)。hiddenWallIds は出さない
 *  - ドア/窓: 壁上の世界座標を計算して CIRCLE で位置マーク
 *  - 家具: INSERT (簡易) で位置・回転を記録。block 定義は出さない
 *    (= R12 緩い実装としては許容範囲。読み手が block を要求すれば fallback で
 *    CIRCLE を補助出力する)
 *  - 天井高: 各フロアに 1 件 TEXT (CH=2700 形式) を CEILING レイヤーに置く
 *
 * 複数階の DXF (Phase 3 の floors.length > 1) は **すべて 1 つの ENTITIES セクション** に
 * 統合し、階ごとに Y 方向 にオフセットを置く (= dxfY = (bboxH + 1000) * floorIdx + flipY)。
 * これで 1 階 / 2 階 が縦に並ぶ図面になり、外部 CAD でも判別できる。
 */

import type { Door, Floor, Floorplan, FurnitureInstance, Room, Wall, Window } from '@/types'
import { shapeAabb, shapeVertices } from '@/core/geometry'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import { getPreset } from '@/data/roomPresets'
import { useEquipmentMasterStore } from '@/store/equipmentMasterStore'

const WALL_LAYER = 'WALL'
const ROOM_LAYER = 'ROOM'
const CEILING_LAYER = 'CEILING'
const DOOR_LAYER = 'DOOR'
const WINDOW_LAYER = 'WINDOW'
const FURNITURE_LAYER = 'FURNITURE'

/** catalogId → DXF レイヤー名 (import 側の classifyLayer と対応) */
const CATALOG_TO_LAYER: Record<string, string> = {
  'ceiling-light-led': 'E-LIGHT',
  'ceiling-downlight': 'E-DOWN',
  'smoke-detector': 'E-SMOKE',
  'heat-detector': 'E-HEAT',
  'ac-cassette-4way': 'E-AC',
  'emergency-light': 'E-EMERG',
  'speaker-ceiling': 'E-SPK',
  'sprinkler-head': 'E-SP',
  'fire-extinguisher': 'F-EXT',
}

export function exportFloorplanToDxf(floorplan: Floorplan): string {
  // 1. 全フロアの全エンティティ XY 範囲を集めて bbox を作る
  const bbox = computeFloorplanBbox(floorplan)
  const bboxH = bbox.maxY - bbox.minY
  // 2. フロアごとに Y オフセットを乗せて (= 縦に積む) ENTITIES を生成する
  const lines: string[] = []
  pushHeader(lines)
  pushSectionStart(lines, 'ENTITIES')
  floorplan.floors.forEach((floor, idx) => {
    const yOffset = idx * (bboxH + 2000) // 1 階分の縦長 + 2m の隙間
    appendFloorEntities(lines, floor, bbox, yOffset)
  })
  pushSectionEnd(lines)
  lines.push('0', 'EOF')
  return lines.join('\n')
}

// ============================================================================
// ヘッダ / セクション
// ============================================================================

function pushHeader(out: string[]): void {
  out.push('0', 'SECTION')
  out.push('2', 'HEADER')
  out.push('9', '$ACADVER')
  out.push('1', 'AC1009')
  out.push('9', '$INSUNITS')
  out.push('70', '4') // 4 = mm
  out.push('0', 'ENDSEC')
}

function pushSectionStart(out: string[], name: string): void {
  out.push('0', 'SECTION')
  out.push('2', name)
}

function pushSectionEnd(out: string[]): void {
  out.push('0', 'ENDSEC')
}

// ============================================================================
// 1 フロア分の ENTITIES
// ============================================================================

function appendFloorEntities(
  out: string[],
  floor: Floor,
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  yOffset: number,
): void {
  /** plan (Y 下向き) → DXF (Y 上向き) 変換 */
  const tx = (x: number) => x - bbox.minX
  const ty = (y: number) => bbox.maxY - y + yOffset

  // 1. 部屋: closed LWPOLYLINE + 中央 TEXT
  for (const room of floor.rooms) {
    appendRoomPolygon(out, room, tx, ty)
    appendRoomLabel(out, room, tx, ty)
  }

  // 2. 壁 (派生壁から hiddenWallIds を除く + freestandingWalls)
  const hidden = new Set(floor.hiddenWallIds ?? [])
  const allWalls: Wall[] = [
    ...floor.walls.filter((w) => !hidden.has(w.id)),
    ...(floor.freestandingWalls ?? []),
  ]
  for (const wall of allWalls) {
    appendWallLine(out, wall, tx, ty)
  }

  // 3. ドア / 窓 (壁上の世界座標を CIRCLE でマーク)
  const wallById = new Map(allWalls.map((w) => [w.id, w]))
  for (const door of floor.doors) {
    const wall = wallById.get(door.wallId)
    if (wall == null) continue
    appendDoorMark(out, wall, door, tx, ty)
  }
  for (const win of floor.windows) {
    const wall = wallById.get(win.wallId)
    if (wall == null) continue
    appendWindowMark(out, wall, win, tx, ty)
  }

  // 4. 家具 / BMS 設備 (catalogId → layer マッピング)
  for (const fi of floor.furniture) {
    appendFurnitureInsert(out, fi, tx, ty)
  }

  // 5. 天井高アノテーション (CEILING レイヤーに 1 件)
  appendCeilingNote(out, floor, bbox, yOffset)
}

// ============================================================================
// エンティティ書き出し
// ============================================================================

function appendRoomPolygon(
  out: string[],
  room: Room,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const verts = shapeVertices(room.shape, room.rotation)
  if (verts.length < 3) return
  out.push('0', 'LWPOLYLINE')
  out.push('8', ROOM_LAYER)
  out.push('90', String(verts.length))
  out.push('70', '1') // closed
  for (const [x, y] of verts) {
    out.push('10', dxfNum(tx(x)))
    out.push('20', dxfNum(ty(y)))
  }
}

function appendRoomLabel(
  out: string[],
  room: Room,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const aabb = shapeAabb(room.shape)
  const cx = (aabb.minX + aabb.maxX) / 2
  const cy = (aabb.minY + aabb.maxY) / 2
  const preset = getPreset(room.presetId)
  const label = room.customName ?? preset?.displayName ?? room.presetId
  out.push('0', 'TEXT')
  out.push('8', ROOM_LAYER)
  out.push('10', dxfNum(tx(cx)))
  out.push('20', dxfNum(ty(cy)))
  out.push('40', '250') // height (mm)
  out.push('1', escapeDxfText(label))
}

function appendWallLine(
  out: string[],
  wall: Wall,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  out.push('0', 'LINE')
  out.push('8', WALL_LAYER)
  out.push('10', dxfNum(tx(wall.from[0])))
  out.push('20', dxfNum(ty(wall.from[1])))
  out.push('11', dxfNum(tx(wall.to[0])))
  out.push('21', dxfNum(ty(wall.to[1])))
}

function appendDoorMark(
  out: string[],
  wall: Wall,
  door: Door,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const [wx, wy] = pointOnWall(wall, door.positionRatio)
  out.push('0', 'CIRCLE')
  out.push('8', DOOR_LAYER)
  out.push('10', dxfNum(tx(wx)))
  out.push('20', dxfNum(ty(wy)))
  out.push('40', dxfNum(door.width / 2))
}

function appendWindowMark(
  out: string[],
  wall: Wall,
  win: Window,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const [wx, wy] = pointOnWall(wall, win.positionRatio)
  out.push('0', 'CIRCLE')
  out.push('8', WINDOW_LAYER)
  out.push('10', dxfNum(tx(wx)))
  out.push('20', dxfNum(ty(wy)))
  out.push('40', dxfNum(win.width / 2))
}

/**
 * §M149 v0.34: 家具 / 設備の **2D 図面** を DXF に書き込む。
 *
 * 旧仕様 (〜v0.33): INSERT 1 件のみ。配置点だけで形が見えなかった。
 * 新仕様: 設備の実寸 (width × depth) と shape (rect/square/circle) を DXF 要素として
 * 書き出すため、外部 CAD で開いた瞬間に「どこに何があるか」が視覚的に把握できる。
 *
 * 書き出し内容:
 *  1. LWPOLYLINE (rect/square) または CIRCLE (circle) — 設備外形 (回転反映)
 *  2. TEXT — シンボル (例: "[消栓]", "S光"...) を中央に
 *  3. INSERT — block 参照を 1 件 (importDxfText が picks up 用)
 *
 * レイヤー名:
 *  - equipment-master 由来 (E-001 等): catalogId をそのままレイヤー名 (= 旧 CAD 互換)
 *  - 旧 BMS catalog (ceiling-light-led 等): CATALOG_TO_LAYER で BMS の慣習名にマップ
 *  - その他家具 (sofa 等): FURNITURE レイヤー
 */
function appendFurnitureInsert(
  out: string[],
  fi: FurnitureInstance,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const entry = getCatalogEntry(fi.catalogId)
  const spec = entry == null
    ? useEquipmentMasterStore.getState().byId.get(fi.catalogId)
    : undefined
  if (entry == null && spec == null) return

  // レイヤー: spec があれば catalogId をそのまま使う (E-001 等)、無ければ CATALOG_TO_LAYER
  const layer =
    spec != null
      ? fi.catalogId
      : (CATALOG_TO_LAYER[fi.catalogId] ?? FURNITURE_LAYER)

  // 2D footprint (mm) を取得
  let w: number
  let d: number
  let isCircle = false
  let symbol = ''
  if (spec != null) {
    w = spec.width
    d = spec.depth
    isCircle = spec.shape === 'circle'
    symbol = spec.symbol
  } else if (entry != null) {
    const aabb = pieceAabbXZ(entry.pieces)
    if (aabb == null) return
    w = aabb.maxX - aabb.minX
    d = aabb.maxZ - aabb.minZ
  } else {
    return
  }

  // (1) 設備外形を DXF 要素として書き出す
  if (isCircle) {
    out.push('0', 'CIRCLE')
    out.push('8', layer)
    out.push('10', dxfNum(tx(fi.position[0])))
    out.push('20', dxfNum(ty(fi.position[1])))
    out.push('40', dxfNum(Math.max(w, d) / 2))
  } else {
    // 回転矩形: 4 隅をローカル → 回転 → world → DXF 変換
    const corners = rotatedRectCorners(
      fi.position[0],
      fi.position[1],
      w,
      d,
      fi.rotation,
    )
    out.push('0', 'LWPOLYLINE')
    out.push('8', layer)
    out.push('90', '4')
    out.push('70', '1') // closed
    for (const [cx, cy] of corners) {
      out.push('10', dxfNum(tx(cx)))
      out.push('20', dxfNum(ty(cy)))
    }
  }

  // (2) シンボルを中央に TEXT で書く (高さ 200mm)
  if (symbol.length > 0) {
    out.push('0', 'TEXT')
    out.push('8', layer)
    out.push('10', dxfNum(tx(fi.position[0])))
    out.push('20', dxfNum(ty(fi.position[1])))
    out.push('40', '200')
    out.push('1', escapeDxfText(symbol))
  }

  // (3) INSERT も並置 (importDxfText が equipment 検出に使う互換マーカー)
  out.push('0', 'INSERT')
  out.push('8', layer)
  out.push('2', fi.catalogId.toUpperCase().replace(/[^A-Z0-9_-]/g, '_'))
  out.push('10', dxfNum(tx(fi.position[0])))
  out.push('20', dxfNum(ty(fi.position[1])))
  // DXF の回転は度数法、Y 反転の関係で 2D rotation 符号を反転
  out.push('50', dxfNum((-fi.rotation * 180) / Math.PI))
}

/**
 * §M149 v0.34: plan-XY の中心 (cx, cy) + 寸法 (w × d) + 回転 (rad) → 4 隅の plan-XY。
 * Floorplan の rotation は 3D の Y 軸まわり (rad)、plan view では時計回りに見える。
 * ローカル座標 (dx, dy) は -w/2..+w/2, -d/2..+d/2 の矩形。
 * (cos, sin) で回して、ワールド XY を返す。
 */
function rotatedRectCorners(
  cx: number,
  cy: number,
  w: number,
  d: number,
  rotation: number,
): Array<readonly [number, number]> {
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const hw = w / 2
  const hd = d / 2
  const local: ReadonlyArray<readonly [number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
  return local.map(([dx, dy]) => [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos,
  ])
}

/** entry.pieces から XZ 平面 AABB を計算 (catalog 由来家具向け) */
function pieceAabbXZ(
  pieces: ReadonlyArray<{
    position: readonly [number, number, number]
    size: readonly [number, number, number]
  }>,
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (pieces.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of pieces) {
    const [px, , pz] = p.position
    const [sx, , sz] = p.size
    minX = Math.min(minX, px - sx / 2)
    maxX = Math.max(maxX, px + sx / 2)
    minZ = Math.min(minZ, pz - sz / 2)
    maxZ = Math.max(maxZ, pz + sz / 2)
  }
  return { minX, maxX, minZ, maxZ }
}

function appendCeilingNote(
  out: string[],
  floor: Floor,
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  yOffset: number,
): void {
  // 左上の少し外側に書く
  const x = -300
  const y = -300 + yOffset
  void bbox
  out.push('0', 'TEXT')
  out.push('8', CEILING_LAYER)
  out.push('10', dxfNum(x))
  out.push('20', dxfNum(y))
  out.push('40', '300')
  out.push('1', escapeDxfText(`CH=${floor.ceilingHeight} (${floor.name})`))
}

// ============================================================================
// 補助
// ============================================================================

function pointOnWall(wall: Wall, t: number): [number, number] {
  const x = wall.from[0] + (wall.to[0] - wall.from[0]) * t
  const y = wall.from[1] + (wall.to[1] - wall.from[1]) * t
  return [x, y]
}

function dxfNum(n: number): string {
  // DXF は小数を許容。整数化しすぎると失われる情報があるので 4 桁の小数で書く
  if (!Number.isFinite(n)) return '0.0'
  return n.toFixed(4)
}

function escapeDxfText(s: string): string {
  // DXF TEXT は基本そのまま。改行と特殊記号だけエスケープ
  return s.replace(/\r?\n/g, ' ').replace(/\^/g, '^^')
}

function computeFloorplanBbox(plan: Floorplan): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      const aabb = shapeAabb(room.shape)
      if (aabb.minX < minX) minX = aabb.minX
      if (aabb.minY < minY) minY = aabb.minY
      if (aabb.maxX > maxX) maxX = aabb.maxX
      if (aabb.maxY > maxY) maxY = aabb.maxY
    }
    for (const wall of [...floor.walls, ...(floor.freestandingWalls ?? [])]) {
      for (const p of [wall.from, wall.to]) {
        if (p[0] < minX) minX = p[0]
        if (p[1] < minY) minY = p[1]
        if (p[0] > maxX) maxX = p[0]
        if (p[1] > maxY) maxY = p[1]
      }
    }
    for (const fi of floor.furniture) {
      const [x, y] = fi.position
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

// ============================================================================
// ダウンロード起動 (Blob → <a download>)
// ============================================================================

export function downloadFloorplanAsDxf(
  floorplan: Floorplan,
  options: { filename?: string } = {},
): void {
  const text = exportFloorplanToDxf(floorplan)
  const blob = new Blob([text], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const base = (options.filename ?? floorplan.metadata.name ?? 'floorplan').replace(
    /[^\w\-.]+/g,
    '_',
  )
  a.download = `${base}.dxf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
