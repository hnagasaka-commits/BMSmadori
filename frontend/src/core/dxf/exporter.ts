/**
 * §M121 v0.28 → §M155 v0.37: Floorplan を ASCII DXF (AC1009 / R12 互換) で書き出す。
 *
 * §M155 v0.37 改修: AutoCAD で「This drawing file may be damaged.」と表示されて
 * 開けない不具合の修正。
 *
 * 原因と対策:
 *  1. **必須セクション欠落** — AC1021 (R2007) を宣言していたが、それに必要な
 *     CLASSES / OBJECTS / 完全な TABLES / BLOCKS が無く AutoCAD の検証で弾かれていた。
 *     → 最も互換性の高い AC1009 (R12) に戻し、R12 の必須セクション
 *        (HEADER / TABLES (LTYPE/LAYER/STYLE) / BLOCKS / ENTITIES) を完備する。
 *  2. **LAYER 未定義** — ENTITIES で参照する各レイヤーが TABLES → LAYER に定義
 *     されていなかった。
 *     → 全エンティティを書き終わったあと、使用レイヤー集合を抽出して LAYER テーブル
 *        を動的に生成する。
 *  3. **LWPOLYLINE は R12 に存在しない** (R14 以降)。
 *     → POLYLINE + VERTEX + SEQEND の組合せに置換。これは R12 から使える基本要素。
 *  4. **浮動小数フィールドが整数文字列だった**箇所がある (例: 高さ "250")。
 *     → 全て `0.0` 形式で出すよう dxfNum を経由させる。
 *
 * 出力構造 (R12 minimal valid):
 *   SECTION HEADER     ($ACADVER, $INSBASE, $EXTMIN, $EXTMAX, $INSUNITS, $DWGCODEPAGE)
 *   SECTION TABLES     (LTYPE: CONTINUOUS / LAYER: 動的 / STYLE: STANDARD)
 *   SECTION BLOCKS     (空、`*Model_Space` プレースホルダ)
 *   SECTION ENTITIES   (LINE/POLYLINE/CIRCLE/TEXT/INSERT)
 *   EOF
 *
 * 日本語対策 (§M153 v0.36 継続): 非 ASCII 文字は `\U+XXXX` エスケープに置換。
 *
 * 単位は mm。Y 軸は DXF 慣習 (上向き) に合わせて plan Y を反転。複数階は縦に積む。
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
  // 1. 全フロアの XY 範囲を集めて bbox を作る
  const bbox = computeFloorplanBbox(floorplan)
  const bboxW = bbox.maxX - bbox.minX
  const bboxH = bbox.maxY - bbox.minY

  // 2. 先に ENTITIES を作って使用レイヤーを収集する (TABLES → LAYER 定義に必要)
  const entityLines: string[] = []
  floorplan.floors.forEach((floor, idx) => {
    const yOffset = idx * (bboxH + 2000) // 階を縦に積む
    appendFloorEntities(entityLines, floor, bbox, yOffset)
  })
  const usedLayers = collectLayersFromEntities(entityLines)
  const usedBlocks = collectBlocksFromEntities(entityLines)

  // 3. 完全な DXF を組み立てる
  const lines: string[] = []
  pushHeader(lines, bboxW, bboxH * floorplan.floors.length + 2000 * (floorplan.floors.length - 1))
  pushTablesSection(lines, usedLayers)
  pushBlocksSection(lines, usedBlocks)
  pushSectionStart(lines, 'ENTITIES')
  lines.push(...entityLines)
  pushSectionEnd(lines)
  lines.push('0', 'EOF')
  return lines.join('\n')
}

// ============================================================================
// ヘッダ / セクション
// ============================================================================

function pushHeader(out: string[], extW: number, extH: number): void {
  out.push('0', 'SECTION')
  out.push('2', 'HEADER')
  // §M155 v0.37: AC1009 (R12) は最も検証が緩く、最低限のセクションで AutoCAD が
  // 開いてくれる。AC1021 (R2007) には CLASSES / 完全な TABLES / OBJECTS が必須。
  out.push('9', '$ACADVER')
  out.push('1', 'AC1009')
  out.push('9', '$DWGCODEPAGE')
  out.push('3', 'ANSI_1252')
  out.push('9', '$INSBASE')
  out.push('10', '0.0')
  out.push('20', '0.0')
  out.push('30', '0.0')
  out.push('9', '$EXTMIN')
  out.push('10', '0.0')
  out.push('20', '0.0')
  out.push('30', '0.0')
  out.push('9', '$EXTMAX')
  out.push('10', dxfNum(Math.max(1, extW)))
  out.push('20', dxfNum(Math.max(1, extH)))
  out.push('30', '0.0')
  out.push('9', '$LIMMIN')
  out.push('10', '0.0')
  out.push('20', '0.0')
  out.push('9', '$LIMMAX')
  out.push('10', dxfNum(Math.max(1, extW)))
  out.push('20', dxfNum(Math.max(1, extH)))
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

/**
 * §M155 v0.37: TABLES セクション。R12 最小構成は LTYPE / LAYER / STYLE。
 *  - LTYPE: 線種テーブル。CONTINUOUS (実線) のみ定義
 *  - LAYER: 使用中の全レイヤーを列挙。色は 7 (白/黒) 既定、線種 CONTINUOUS
 *  - STYLE: テキストスタイル。STANDARD (txt フォント) のみ
 */
function pushTablesSection(out: string[], usedLayers: Set<string>): void {
  pushSectionStart(out, 'TABLES')

  // LTYPE テーブル
  out.push('0', 'TABLE', '2', 'LTYPE', '70', '1')
  out.push('0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line')
  out.push('72', '65', '73', '0', '40', '0.0')
  out.push('0', 'ENDTAB')

  // LAYER テーブル (動的に定義)
  const layers = ['0', ...Array.from(usedLayers).filter((l) => l !== '0').sort()]
  out.push('0', 'TABLE', '2', 'LAYER', '70', String(layers.length))
  for (const name of layers) {
    out.push('0', 'LAYER')
    out.push('2', name)
    out.push('70', '0')
    // 色番号: 7 = 白/黒。他色を当てたい場合は将来 categoryColors から ACI 番号にマップ
    out.push('62', '7')
    out.push('6', 'CONTINUOUS')
  }
  out.push('0', 'ENDTAB')

  // STYLE テーブル
  out.push('0', 'TABLE', '2', 'STYLE', '70', '1')
  out.push('0', 'STYLE', '2', 'STANDARD', '70', '0')
  out.push('40', '0.0', '41', '1.0', '50', '0.0', '71', '0', '42', '2.5')
  out.push('3', 'txt')
  out.push('4', '')
  out.push('0', 'ENDTAB')

  pushSectionEnd(out)
}

/**
 * §M155 v0.37: BLOCKS セクション。
 *  - `*MODEL_SPACE` / `*PAPER_SPACE` の空 BLOCK を 2 つ用意 (AutoCAD 必須)
 *  - INSERT で参照される block 名はすべて、ここに空の BLOCK 定義として宣言する
 *    (= 「定義されていない block を参照する INSERT」エラーを回避)
 */
function pushBlocksSection(out: string[], blockNames: Set<string>): void {
  pushSectionStart(out, 'BLOCKS')
  pushBlockStub(out, '$MODEL_SPACE', false)
  pushBlockStub(out, '$PAPER_SPACE', true)
  // INSERT で参照されている block 名を空 BLOCK で定義する
  for (const name of Array.from(blockNames).sort()) {
    if (name === '$MODEL_SPACE' || name === '$PAPER_SPACE') continue
    pushBlockStub(out, name, false)
  }
  pushSectionEnd(out)
}

function pushBlockStub(out: string[], name: string, isPaper: boolean): void {
  out.push('0', 'BLOCK')
  out.push('8', '0')
  out.push('2', name)
  out.push('70', isPaper ? '1' : '0')
  out.push('10', '0.0', '20', '0.0', '30', '0.0')
  out.push('3', name)
  out.push('1', '')
  out.push('0', 'ENDBLK')
  out.push('8', '0')
}

/**
 * §M155 v0.37: ENTITIES セクションを走査して、code 8 (layer 名) の直後の値を集合に集める。
 * SEQEND/VERTEX 含むすべてのエンティティでレイヤー指定された値が拾われる。
 */
function collectLayersFromEntities(lines: string[]): Set<string> {
  const layers = new Set<string>()
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '8') {
      const name = lines[i + 1]
      if (name != null && name.length > 0) layers.add(name)
    }
  }
  return layers
}

/**
 * §M155 v0.37: INSERT エンティティの block 名 (code 2 の値) を集合に集める。
 * INSERT 直後に出現する `2 <BLOCK_NAME>` を拾うため、INSERT が登場した次の '2' を見る。
 */
function collectBlocksFromEntities(lines: string[]): Set<string> {
  const blocks = new Set<string>()
  for (let i = 0; i + 1 < lines.length; i += 2) {
    if (lines[i] === '0' && lines[i + 1] === 'INSERT') {
      // 次の同エンティティ内で code 2 を探す (次の '0' の手前まで)
      for (let j = i + 2; j + 1 < lines.length; j += 2) {
        if (lines[j] === '0') break
        if (lines[j] === '2') {
          const name = lines[j + 1]
          if (name != null && name.length > 0) blocks.add(name)
          break
        }
      }
    }
  }
  return blocks
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

  // 1. 部屋: closed POLYLINE + 中央 TEXT
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
  appendCeilingNote(out, floor, yOffset)
}

// ============================================================================
// エンティティ書き出し
// ============================================================================

/**
 * §M155 v0.37: R12 互換 POLYLINE。LWPOLYLINE は R14 以降なので使えない。
 * 構造: POLYLINE → VERTEX × N → SEQEND の 3 要素。
 *  - POLYLINE の `66 1` は「entities follow」フラグ
 *  - POLYLINE の `70 1` は閉じたポリラインフラグ
 *  - VERTEX には XYZ 座標 + 同じ layer 指定
 *  - SEQEND で終端を明示 (これが無いと AutoCAD が damaged 判定する)
 */
function pushPolyline(
  out: string[],
  layer: string,
  pointsXY: ReadonlyArray<readonly [number, number]>,
  closed: boolean,
): void {
  out.push('0', 'POLYLINE')
  out.push('8', layer)
  out.push('66', '1')
  out.push('10', '0.0', '20', '0.0', '30', '0.0')
  out.push('70', closed ? '1' : '0')
  for (const [x, y] of pointsXY) {
    out.push('0', 'VERTEX')
    out.push('8', layer)
    out.push('10', dxfNum(x))
    out.push('20', dxfNum(y))
    out.push('30', '0.0')
  }
  out.push('0', 'SEQEND')
  out.push('8', layer)
}

function appendRoomPolygon(
  out: string[],
  room: Room,
  tx: (x: number) => number,
  ty: (y: number) => number,
): void {
  const verts = shapeVertices(room.shape, room.rotation)
  if (verts.length < 3) return
  const transformed = verts.map(([x, y]) => [tx(x), ty(y)] as [number, number])
  pushPolyline(out, ROOM_LAYER, transformed, true)
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
  out.push('30', '0.0')
  out.push('40', '250.0') // height (mm)
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
  out.push('30', '0.0')
  out.push('11', dxfNum(tx(wall.to[0])))
  out.push('21', dxfNum(ty(wall.to[1])))
  out.push('31', '0.0')
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
  out.push('30', '0.0')
  out.push('40', dxfNum(Math.max(50, door.width / 2)))
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
  out.push('30', '0.0')
  out.push('40', dxfNum(Math.max(50, win.width / 2)))
}

/**
 * §M149 v0.34 / §M155 v0.37: 家具・設備の 2D 図面を書き出す。
 * 外形 (POLYLINE / CIRCLE) + シンボル TEXT + INSERT 互換マーカーの 3 要素。
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

  // レイヤー: spec があれば catalogId をそのまま (E-001 等)、無ければ CATALOG_TO_LAYER
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
  if (w < 1 || d < 1) return

  // (1) 設備外形を DXF 要素として書き出す
  if (isCircle) {
    out.push('0', 'CIRCLE')
    out.push('8', layer)
    out.push('10', dxfNum(tx(fi.position[0])))
    out.push('20', dxfNum(ty(fi.position[1])))
    out.push('30', '0.0')
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
    const transformed = corners.map(([cx, cy]) => [tx(cx), ty(cy)] as [number, number])
    pushPolyline(out, layer, transformed, true)
  }

  // (2) シンボルを中央に TEXT で書く (高さ 200mm)
  if (symbol.length > 0) {
    out.push('0', 'TEXT')
    out.push('8', layer)
    out.push('10', dxfNum(tx(fi.position[0])))
    out.push('20', dxfNum(ty(fi.position[1])))
    out.push('30', '0.0')
    out.push('40', '200.0')
    out.push('1', escapeDxfText(symbol))
  }

  // (3) INSERT も並置 (importDxfText の equipment 検出が CIRCLE/INSERT/TEXT を見るため互換マーカーとして残す)
  // R12 では BLOCKS テーブルに定義が無い INSERT は厳密には不正だが、AutoCAD は警告のみで開ける。
  // 安全のため block name はサニタイズして、英数とハイフン / アンダースコアのみにする。
  const blockName = fi.catalogId.toUpperCase().replace(/[^A-Z0-9_-]/g, '_') || 'EQUIP'
  out.push('0', 'INSERT')
  out.push('8', layer)
  out.push('2', blockName)
  out.push('10', dxfNum(tx(fi.position[0])))
  out.push('20', dxfNum(ty(fi.position[1])))
  out.push('30', '0.0')
  // DXF の回転は度数法、Y 反転の関係で 2D rotation 符号を反転
  out.push('50', dxfNum((-fi.rotation * 180) / Math.PI))
}

/**
 * §M149 v0.34: plan-XY の中心 + 寸法 + 回転 (rad) → 4 隅の plan-XY。
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

function appendCeilingNote(out: string[], floor: Floor, yOffset: number): void {
  // 左上の少し外側に書く
  const x = -300
  const y = -300 + yOffset
  out.push('0', 'TEXT')
  out.push('8', CEILING_LAYER)
  out.push('10', dxfNum(x))
  out.push('20', dxfNum(y))
  out.push('30', '0.0')
  out.push('40', '300.0')
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
  // DXF の float 系 group code (10/20/30/40 等) は小数表現が必要。
  if (!Number.isFinite(n)) return '0.0'
  return n.toFixed(4)
}

/**
 * §M153 v0.36: DXF TEXT のエスケープ (日本語文字化け対策)。
 *
 * 非 ASCII 文字 (codepoint ≥ 128) を `\U+XXXX` エスケープに置換。AutoCAD/BricsCAD/
 * LibreCAD など主要 CAD で共通サポートされる Unicode 表現。
 *
 * BMP 範囲外 (U+10000 以降、絵文字など) はサロゲートペアに分割して書き出す
 * (DXF \U+ は 4 桁 hex のみ受ける実装が多いため)。
 *
 * 改行・制御文字はスペース置換 / 除去、`^` は `^^` にエスケープ。
 */
function escapeDxfText(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code === 0x0a || code === 0x0d) {
      out += ' '
    } else if (code < 0x20) {
      continue
    } else if (code === 0x5e /* ^ */) {
      out += '^^'
    } else if (code < 0x80) {
      out += ch
    } else if (code <= 0xffff) {
      out += '\\U+' + code.toString(16).toUpperCase().padStart(4, '0')
    } else {
      const offset = code - 0x10000
      const hi = 0xd800 + (offset >> 10)
      const lo = 0xdc00 + (offset & 0x3ff)
      out +=
        '\\U+' + hi.toString(16).toUpperCase().padStart(4, '0') +
        '\\U+' + lo.toString(16).toUpperCase().padStart(4, '0')
    }
  }
  return out
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
  const rawName = options.filename ?? floorplan.metadata.name ?? 'floorplan'
  // §M151 v0.35: OS ファイル名禁止文字 (/ \ : * ? " < > |) のみ "_" に置換。
  // 日本語 / 括弧 / 空白 / ハイフンなどはそのまま残し、編集中の間取り名がほぼ
  // そのままファイル名になるようにする。
  const safeName = rawName.replace(/[/\\:*?"<>|]/g, '_').trim()
  const base = safeName.length > 0 ? safeName : 'floorplan'
  a.download = `${base}.dxf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
