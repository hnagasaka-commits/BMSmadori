/**
 * §M116 v0.28: DXF 抽出結果から Floorplan を組み立てる。
 *
 * 入力: parseDxf の返り値 (raw エンティティ群)
 * 出力: Floorplan + 取込レポート (壁 / 部屋 / 設備の件数)
 *
 * 主な責務:
 *  1. 単位推定 (mm/メートル) + Y 軸反転 (DXF は上向き、Floorplan は下向き)
 *  2. レイヤー名 → 役割 (壁 / 部屋 / 天井高 / BMS 設備種別) の解決
 *  3. 閉じた LWPOLYLINE → 矩形 / ポリゴンの部屋に変換
 *  4. 壁レイヤーの LINE / LWPOLYLINE → freestandingWalls にセグメント化
 *  5. INSERT / CIRCLE → FurnitureInstance に変換 (catalogId は layer → mapping)
 *  6. 天井高 TEXT (「CH=2700」「2400」など) を正規表現で拾って floor.ceilingHeight に採用
 */

import type {
  Floor,
  Floorplan,
  FurnitureInstance,
  FurnitureMount,
  Room,
  Shape,
  Wall,
} from '@/types'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import type { DxfEntities, DxfEntity, Vec2 } from './parser'

// ============================================================================
// レイヤー名 → 役割マッピング
// ============================================================================

type LayerRole =
  | { kind: 'wall' }
  | { kind: 'room' }
  | { kind: 'ceiling' }
  | { kind: 'equipment'; catalogId: string; mountTo: FurnitureMount }
  | { kind: 'ignore' }

/**
 * レイヤー名 (大文字化済み) を役割に分類する。完全一致ではなく substring 判定:
 *  例: `A-WALL`, `WALL-EXTERIOR`, `壁芯` のいずれも wall とみなす
 *
 * 日本語の層名は実務現場で多いので明示的に列挙する。
 */
function classifyLayer(layerRaw: string): LayerRole {
  const layer = layerRaw.toUpperCase()
  const ja = layerRaw // 日本語比較は原文のまま

  // 設備系 (より具体的なものを先にチェック)
  const equipmentMap: Array<{
    test: (en: string, ja: string) => boolean
    catalogId: string
    mountTo: FurnitureMount
  }> = [
    {
      test: (en, j) =>
        en.includes('E-DOWN') || en.includes('DOWNLIGHT') || j.includes('ダウンライト'),
      catalogId: 'ceiling-downlight',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-LIGHT') ||
        en.includes('LIGHTING') ||
        en === 'LIGHT' ||
        en.includes('CEIL-LIGHT') ||
        j.includes('照明'),
      catalogId: 'ceiling-light-led',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-SMOKE') ||
        en === 'SD' ||
        en.includes('SMOKE') ||
        j.includes('煙感知'),
      catalogId: 'smoke-detector',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-HEAT') ||
        en === 'HD' ||
        en.includes('HEAT-DET') ||
        j.includes('熱感知'),
      catalogId: 'heat-detector',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-AC') ||
        en.includes('HVAC') ||
        en.includes('CASSETTE') ||
        j.includes('空調') ||
        j.includes('エアコン'),
      catalogId: 'ac-cassette-4way',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-EMERG') ||
        en.includes('EXIT') ||
        en.includes('EMERGENCY') ||
        j.includes('誘導灯'),
      catalogId: 'emergency-light',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('E-SPK') ||
        en.includes('SPEAKER') ||
        j.includes('スピーカー'),
      catalogId: 'speaker-ceiling',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('SPRINKLER') ||
        en === 'E-SP' ||
        j.includes('スプリンクラー'),
      catalogId: 'sprinkler-head',
      mountTo: 'ceiling',
    },
    {
      test: (en, j) =>
        en.includes('F-EXT') ||
        en.includes('EXTINGUISHER') ||
        j.includes('消火器'),
      catalogId: 'fire-extinguisher',
      mountTo: 'floor',
    },
  ]
  for (const m of equipmentMap) {
    if (m.test(layer, ja)) {
      return { kind: 'equipment', catalogId: m.catalogId, mountTo: m.mountTo }
    }
  }

  if (
    layer.includes('CEILING') ||
    layer === 'CH' ||
    layer.startsWith('CH-') ||
    ja.includes('天井')
  ) {
    return { kind: 'ceiling' }
  }
  if (
    layer.includes('WALL') ||
    layer === 'S-WALL' ||
    layer === 'A-WALL' ||
    ja.includes('壁') ||
    ja.includes('躯体')
  ) {
    return { kind: 'wall' }
  }
  if (
    layer.includes('ROOM') ||
    layer.includes('AREA') ||
    layer === 'A-AREA' ||
    ja.includes('部屋') ||
    ja.includes('室名') ||
    ja.includes('間取り')
  ) {
    return { kind: 'room' }
  }
  return { kind: 'ignore' }
}

/**
 * 部屋名 (textValue) から RoomPreset.id を推定する。
 * - 「リビング」「LDK」→ living
 * - 「キッチン」「台所」→ kitchen
 * - 「寝室」「ベッドルーム」→ bedroom
 * - 「トイレ」「WC」→ toilet
 * - 「浴室」「バス」→ bathroom
 * - 「洗面」→ washroom
 * - 「玄関」→ entrance
 * - 「廊下」「ホール」→ hallway
 * - 「子供」→ kids-room
 * - 不明 → 'living'
 */
function inferRoomPreset(name: string): string {
  const s = name.toLowerCase()
  if (s.includes('living') || /リビング|居間|ldk/i.test(name)) return 'living'
  if (s.includes('dining') || /ダイニング|食堂/i.test(name)) return 'dining'
  if (s.includes('kitchen') || /キッチン|台所/i.test(name)) return 'kitchen'
  if (s.includes('bedroom') || /寝室|ベッド/i.test(name)) return 'bedroom'
  if (/kids|child/i.test(name) || /子供|こども/i.test(name)) return 'kids-room'
  if (s.includes('toilet') || s === 'wc' || /トイレ|便所/i.test(name)) return 'toilet'
  if (s.includes('bath') || /浴室|バス|風呂/i.test(name)) return 'bathroom'
  if (/wash|powder/i.test(name) || /洗面|脱衣/i.test(name)) return 'washroom'
  if (s.includes('entrance') || /玄関/i.test(name)) return 'entrance'
  if (s.includes('hall') || /廊下|ホール|エントランス/i.test(name)) return 'hallway'
  if (s.includes('closet') || /収納|クローゼット/i.test(name)) return 'closet'
  if (/balcony|veranda/i.test(name) || /バルコニー|ベランダ/i.test(name)) return 'balcony'
  return 'living'
}

// ============================================================================
// 天井高 (mm) を TEXT 値から抽出
// ============================================================================

/**
 * 天井高レイヤーの TEXT から数値を拾う。
 *  - "2400" → 2400
 *  - "CH=2700" → 2700
 *  - "H:2700" / "H 2700" → 2700
 *  - "天井高 2700mm" → 2700
 *  - "2.7" → 2700 (= メートル単位だと判定し x 1000)
 */
export function extractCeilingHeight(value: string): number | null {
  if (!value) return null
  // 単位 mm or 数字 + 数字。3〜5 桁を mm として優先
  const mmMatch = value.match(/(\d{3,5})\s*mm?/i)
  if (mmMatch != null) {
    const n = Number.parseInt(mmMatch[1]!, 10)
    if (n >= 1500 && n <= 6000) return n
  }
  // 純粋な 3〜4 桁数字 (高さ表記の慣習: 2400, 2700 等)
  const intMatch = value.match(/(\d{3,4})(?!\d)/)
  if (intMatch != null) {
    const n = Number.parseInt(intMatch[1]!, 10)
    if (n >= 1500 && n <= 6000) return n
  }
  // メートル単位の小数表記 (2.7 → 2700)
  const floatMatch = value.match(/(\d\.\d{1,2})/)
  if (floatMatch != null) {
    const n = Number.parseFloat(floatMatch[1]!)
    if (n >= 1.5 && n <= 6.0) return Math.round(n * 1000)
  }
  return null
}

// ============================================================================
// メイン: buildFloorplanFromDxf
// ============================================================================

export type DxfImportReport = {
  walls: number
  rooms: number
  equipment: number
  /** equipment の catalogId 別件数 (UI Toast 用) */
  equipmentByCatalog: Record<string, number>
  ceilingHeight: number
  /** Y 軸反転後の建物 AABB (mm) */
  bboxMm: { w: number; h: number }
  /** 認識できなかった layer 名 (デバッグ用) */
  unknownLayers: string[]
  /** 単位推定の結果 */
  unitScale: number
}

export type BuildFloorplanResult = {
  floorplan: Floorplan
  report: DxfImportReport
}

const DEFAULT_CEILING_MM = 2400
const DEFAULT_WALL_THICKNESS_MM = 100

export function buildFloorplanFromDxf(
  dxf: DxfEntities,
  options: { fileName?: string } = {},
): BuildFloorplanResult {
  const { entities } = dxf

  // 1. 単位推定: $INSUNITS で明示があればそれ。なければ座標値の max abs を見て、
  //    < 100 ならメートル指定とみなし × 1000 する。
  const unitScale = inferUnitScale(dxf)

  // 2. すべてのエンティティを mm スケール + Y 反転前の状態に変換
  const scaled = entities.map((e) => scaleEntity(e, unitScale))

  // 3. AABB を計算
  const bbox = computeBbox(scaled)
  // 4. Y 反転 (DXF は Y 上向き、本アプリ 2D は Y 下向き) + 原点を 0,0 にシフト
  const transform = (xy: Vec2): Vec2 => {
    const x = xy[0] - bbox.minX
    const y = bbox.maxY - xy[1]
    return [Math.round(x), Math.round(y)]
  }

  // 5. 部屋を抽出 (閉じた LWPOLYLINE on room layer)
  const rooms: Room[] = []
  const roomRects: Array<{ id: string; minX: number; minY: number; maxX: number; maxY: number }> = []
  const textsByLayer = new Map<string, DxfEntity[]>()
  for (const e of scaled) {
    if (e.kind === 'text') {
      const list = textsByLayer.get(e.layer) ?? []
      list.push(e)
      textsByLayer.set(e.layer, list)
    }
  }

  const unknownLayerSet = new Set<string>()
  for (const e of scaled) {
    if (e.kind !== 'lwpolyline') continue
    const role = classifyLayer(e.layer)
    if (role.kind !== 'room') continue
    if (!e.closed || e.vertices.length < 3) continue

    const transformed = e.vertices.map(transform)
    const xs = transformed.map((v) => v[0])
    const ys = transformed.map((v) => v[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    if (maxX - minX < 100 || maxY - minY < 100) continue

    // 名前を推定: 同レイヤーの TEXT のうち、部屋の AABB 内に position があるものを採用
    const layerTexts = textsByLayer.get(e.layer) ?? []
    let inferredName: string | null = null
    for (const t of layerTexts) {
      if (t.kind !== 'text') continue
      const [tx, ty] = transform(t.position)
      if (tx >= minX && tx <= maxX && ty >= minY && ty <= maxY && t.value.trim().length > 0) {
        inferredName = t.value.trim()
        break
      }
    }
    const presetId = inferredName != null ? inferRoomPreset(inferredName) : 'living'

    const isRect = transformed.length === 4 && isAxisAligned(transformed)
    const id = crypto.randomUUID()
    const shape: Shape = isRect
      ? {
          kind: 'rect',
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
          edgeIds: [
            crypto.randomUUID(),
            crypto.randomUUID(),
            crypto.randomUUID(),
            crypto.randomUUID(),
          ],
        }
      : {
          kind: 'polygon',
          points: transformed,
          edgeIds: transformed.map(() => crypto.randomUUID()),
        }
    rooms.push({
      id,
      presetId,
      ...(inferredName != null && { customName: inferredName }),
      shape,
      rotation: 0,
    })
    roomRects.push({ id, minX, minY, maxX, maxY })
  }

  // 6. 壁を抽出: wall layer の LINE / LWPOLYLINE
  const freestandingWalls: Wall[] = []
  for (const e of scaled) {
    const role = classifyLayer(e.layer)
    if (role.kind !== 'wall') {
      if (role.kind === 'ignore' && e.kind !== 'text') unknownLayerSet.add(e.layer)
      continue
    }
    if (e.kind === 'line') {
      const from = transform(e.from)
      const to = transform(e.to)
      if (segLen(from, to) < 50) continue
      freestandingWalls.push(buildWall(from, to))
    } else if (e.kind === 'lwpolyline') {
      const pts = e.vertices.map(transform)
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!
        const b = pts[i + 1]!
        if (segLen(a, b) < 50) continue
        freestandingWalls.push(buildWall(a, b))
      }
      if (e.closed && pts.length >= 2) {
        const a = pts[pts.length - 1]!
        const b = pts[0]!
        if (segLen(a, b) >= 50) freestandingWalls.push(buildWall(a, b))
      }
    }
  }

  // 7. 設備を抽出: INSERT または CIRCLE
  const furniture: FurnitureInstance[] = []
  const equipmentByCatalog: Record<string, number> = {}
  for (const e of scaled) {
    const role = classifyLayer(e.layer)
    if (role.kind !== 'equipment') continue
    let positionRaw: Vec2 | null = null
    let rotation = 0
    if (e.kind === 'insert' || e.kind === 'circle' || e.kind === 'text') {
      positionRaw = e.kind === 'insert' ? e.position : e.kind === 'circle' ? e.center : e.position
      if (e.kind === 'insert') rotation = e.rotation
    }
    if (positionRaw == null) continue
    const [x, y] = transform(positionRaw)
    if (getCatalogEntry(role.catalogId) == null) continue
    const id = crypto.randomUUID()
    furniture.push({
      id,
      catalogId: role.catalogId,
      position: [x, y],
      rotation,
      mountTo: role.mountTo,
    })
    equipmentByCatalog[role.catalogId] = (equipmentByCatalog[role.catalogId] ?? 0) + 1
  }

  // 8. 天井高を ceiling layer の TEXT から抽出 (最大値)
  let ceilingHeight = DEFAULT_CEILING_MM
  for (const e of scaled) {
    if (e.kind !== 'text') continue
    if (classifyLayer(e.layer).kind !== 'ceiling') continue
    const h = extractCeilingHeight(e.value)
    if (h != null && h > ceilingHeight) ceilingHeight = h
  }

  // 9. Floorplan を組み立て
  const now = new Date().toISOString()
  const floor: Floor = {
    id: crypto.randomUUID(),
    level: 1,
    name: '1F',
    ceilingHeight,
    rooms,
    walls: [],
    doors: [],
    windows: [],
    columns: [],
    pipeSpaces: [],
    furniture,
    humanModels: [],
    voids: [],
    roomFinishes: [],
    wallFinishes: [],
    windowDecorations: [],
    doorDecorations: [],
    suppressedAutoDoors: [],
    freestandingWalls,
    hiddenWallIds: [],
  }
  const floorplan: Floorplan = {
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      name: options.fileName != null ? `CAD: ${stripExt(options.fileName)}` : 'CAD 取込プラン',
      buildingType: 'office',
      unit: 'mm',
      gridSize: 910,
      orientation: 0,
      createdAt: now,
      updatedAt: now,
    },
    floors: [floor],
    building: {
      structureType: 'rc',
      isExistingBuilding: true,
    },
  }

  return {
    floorplan,
    report: {
      walls: freestandingWalls.length,
      rooms: rooms.length,
      equipment: furniture.length,
      equipmentByCatalog,
      ceilingHeight,
      bboxMm: {
        w: Math.round((bbox.maxX - bbox.minX) * unitScale),
        h: Math.round((bbox.maxY - bbox.minY) * unitScale),
      },
      unknownLayers: Array.from(unknownLayerSet).sort(),
      unitScale,
    },
  }
}

// ============================================================================
// 補助関数
// ============================================================================

function inferUnitScale(dxf: DxfEntities): number {
  // $INSUNITS: 1=inch, 4=mm, 6=m
  if (dxf.insUnits === 4) return 1
  if (dxf.insUnits === 6) return 1000
  if (dxf.insUnits === 1) return 25.4
  // 自動推定: 全エンティティの最大 abs 座標が < 200 ならメートル指定 → x1000
  let maxAbs = 0
  for (const e of dxf.entities) {
    const pts = entityPoints(e)
    for (const p of pts) {
      maxAbs = Math.max(maxAbs, Math.abs(p[0]), Math.abs(p[1]))
    }
  }
  if (maxAbs > 0 && maxAbs < 200) return 1000
  return 1
}

function entityPoints(e: DxfEntity): Vec2[] {
  switch (e.kind) {
    case 'line':
      return [e.from, e.to]
    case 'lwpolyline':
      return e.vertices
    case 'circle':
      return [e.center]
    case 'text':
      return [e.position]
    case 'insert':
      return [e.position]
  }
}

function scaleEntity(e: DxfEntity, s: number): DxfEntity {
  if (s === 1) return e
  switch (e.kind) {
    case 'line':
      return { ...e, from: [e.from[0] * s, e.from[1] * s], to: [e.to[0] * s, e.to[1] * s] }
    case 'lwpolyline':
      return {
        ...e,
        vertices: e.vertices.map((v) => [v[0] * s, v[1] * s] as Vec2),
      }
    case 'circle':
      return { ...e, center: [e.center[0] * s, e.center[1] * s], radius: e.radius * s }
    case 'text':
      return { ...e, position: [e.position[0] * s, e.position[1] * s], height: e.height * s }
    case 'insert':
      return { ...e, position: [e.position[0] * s, e.position[1] * s] }
  }
}

function computeBbox(entities: DxfEntity[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const e of entities) {
    for (const p of entityPoints(e)) {
      if (p[0] < minX) minX = p[0]
      if (p[1] < minY) minY = p[1]
      if (p[0] > maxX) maxX = p[0]
      if (p[1] > maxY) maxY = p[1]
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

function segLen(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.hypot(dx, dy)
}

function buildWall(from: Vec2, to: Vec2): Wall {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    thickness: DEFAULT_WALL_THICKNESS_MM,
    wallType: 'partition',
    isLocked: false,
    sharedBy: [],
  }
}

function isAxisAligned(pts: ReadonlyArray<Vec2>): boolean {
  // 4 頂点で軸並行な矩形か (頂点間が水平/垂直のみ)
  if (pts.length !== 4) return false
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % 4]!
    const dx = Math.abs(a[0] - b[0])
    const dy = Math.abs(a[1] - b[1])
    if (dx > 1 && dy > 1) return false
  }
  return true
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}
