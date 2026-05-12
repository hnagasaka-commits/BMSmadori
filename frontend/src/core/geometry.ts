/**
 * 基礎幾何ヘルパー。すべて純粋関数、整数 mm 前提 (§3.6)。
 *
 * Phase 1 は rect + 90° 回転のみ運用 (§6.3 / §9.5.4)。polygon と任意回転は Phase 2 で。
 */

import type { Shape } from '@/types'

// ============================================================================
// 基本型
// ============================================================================

export type Point = readonly [number, number]
export type Segment = { readonly from: Point; readonly to: Point }
export type Aabb = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }

// ============================================================================
// 量子化と比較
// ============================================================================

/** 整数 mm に丸める (§3.6) */
export function quantize(v: number): number {
  return Math.round(v)
}

/** 2 点が 1mm 以内で一致するか (§5.2 findEdgeId 照合) */
export function pointEquals(a: Point, b: Point, epsilon = 1): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

// ============================================================================
// AABB
// ============================================================================

export function aabbOfRect(rect: Extract<Shape, { kind: 'rect' }>): Aabb {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.w,
    maxY: rect.y + rect.h,
  }
}

/** 軸並行 AABB 同士の交差。境界共有 (touching) は重なりとしない */
export function aabbOverlaps(a: Aabb, b: Aabb): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

// ============================================================================
// rect の頂点・辺の展開 (Phase 1)
// ============================================================================

/**
 * rect Shape の 4 頂点 (NW, NE, SE, SW) をワールド座標で返す。
 * Phase 1 では rotation は 0/90/180/270 のみ受ける前提 (§9.5.4)。
 */
export function rectVertices(rect: Extract<Shape, { kind: 'rect' }>, rotation = 0): readonly [Point, Point, Point, Point] {
  const { x, y, w, h } = rect
  const cx = x + w / 2
  const cy = y + h / 2

  // Phase 1: 90° 量子化を強制
  const rot = ((Math.round(rotation / 90) % 4) + 4) % 4

  // ローカル頂点 (NW, NE, SE, SW) を中心からのオフセットで
  const local: readonly [Point, Point, Point, Point] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ] as const

  const rotated = local.map(([lx, ly]) => rotate90Times(lx, ly, rot)) as [Point, Point, Point, Point]
  return [
    [quantize(cx + rotated[0][0]), quantize(cy + rotated[0][1])],
    [quantize(cx + rotated[1][0]), quantize(cy + rotated[1][1])],
    [quantize(cx + rotated[2][0]), quantize(cy + rotated[2][1])],
    [quantize(cx + rotated[3][0]), quantize(cy + rotated[3][1])],
  ]
}

function rotate90Times(x: number, y: number, times: number): Point {
  switch (times & 3) {
    case 0: return [x, y]
    case 1: return [-y, x]
    case 2: return [-x, -y]
    default: return [y, -x] // case 3
  }
}

/**
 * rect Shape の 4 辺をワールド座標 Segment 配列で返す。
 * 順序は edgeIds[0..3] と対応: N / E / S / W (ローカル基準、回転後はワールドの実エッジ)。
 */
export function rectEdges(
  rect: Extract<Shape, { kind: 'rect' }>,
  rotation = 0,
): readonly [Segment, Segment, Segment, Segment] {
  const [nw, ne, se, sw] = rectVertices(rect, rotation)
  return [
    { from: nw, to: ne }, // N: edgeIds[0]
    { from: ne, to: se }, // E: edgeIds[1]
    { from: se, to: sw }, // S: edgeIds[2]
    { from: sw, to: nw }, // W: edgeIds[3]
  ]
}

// ============================================================================
// 辺の canonical キー (壁の共有マージで使用)
// ============================================================================

/**
 * 線分の canonical 文字列キー。端点をソートしてから文字列化することで、
 * (from, to) と (to, from) を同一とみなす。1mm 単位で量子化済の Point 前提。
 */
export function canonicalSegmentKey(seg: Segment): string {
  const a = seg.from
  const b = seg.to
  const [first, second] = compareSegmentEndpoints(a, b) <= 0 ? [a, b] : [b, a]
  return `${first[0]},${first[1]}|${second[0]},${second[1]}`
}

function compareSegmentEndpoints(a: Point, b: Point): number {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]
}

/** 2 つの Segment が同じ線分 (端点が逆順でも) なら true */
export function segmentEquals(a: Segment, b: Segment, epsilon = 1): boolean {
  return (
    (pointEquals(a.from, b.from, epsilon) && pointEquals(a.to, b.to, epsilon)) ||
    (pointEquals(a.from, b.to, epsilon) && pointEquals(a.to, b.from, epsilon))
  )
}

// ============================================================================
// §5.2 polygon (Phase 2 / M16)
// ============================================================================

/**
 * polygon Shape のワールド座標頂点列。
 *
 * Phase 2 では rotation は rect と同様に 0/90/180/270 のみ許す。任意角度は Phase 3 で。
 * 中心は AABB 中心 (= 重心ではない) を採用する。これは
 *   - rect との挙動一貫性 (rectVertices も AABB 中心まわりに回す)
 *   - ユーザー操作の予測可能性 (重心はゴーストになって動きが読みづらい)
 * を優先した結果。
 */
export function polygonVertices(
  polygon: Extract<Shape, { kind: 'polygon' }>,
  rotation = 0,
): readonly Point[] {
  const aabb = aabbOfPolygon(polygon)
  const cx = (aabb.minX + aabb.maxX) / 2
  const cy = (aabb.minY + aabb.maxY) / 2
  const rot = ((Math.round(rotation / 90) % 4) + 4) % 4
  return polygon.points.map(([px, py]) => {
    const lx = px - cx
    const ly = py - cy
    const [rx, ry] = rotate90Times(lx, ly, rot)
    return [quantize(cx + rx), quantize(cy + ry)] as Point
  })
}

/**
 * polygon Shape の辺セグメント列。順序は edgeIds[i] = points[i] → points[(i+1) % n]。
 */
export function polygonEdges(
  polygon: Extract<Shape, { kind: 'polygon' }>,
  rotation = 0,
): readonly Segment[] {
  const verts = polygonVertices(polygon, rotation)
  const out: Segment[] = []
  for (let i = 0; i < verts.length; i++) {
    out.push({ from: verts[i]!, to: verts[(i + 1) % verts.length]! })
  }
  return out
}

/** polygon の AABB (rotation は考慮しない元データ前提)。回転後 AABB が欲しい場合は polygonVertices から計算 */
export function aabbOfPolygon(polygon: Extract<Shape, { kind: 'polygon' }>): Aabb {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of polygon.points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * 多角形の符号付き面積 (Shoelace formula)。
 * 結果は時計回り (画面座標系で見て) なら正、反時計回りなら負。
 * 単位は mm²。
 */
export function polygonSignedArea(
  polygon: Extract<Shape, { kind: 'polygon' }>,
): number {
  const pts = polygon.points
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]!
    const [x2, y2] = pts[(i + 1) % pts.length]!
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

/** Shoelace の絶対値。常に正の面積 (mm²)。 */
export function polygonArea(polygon: Extract<Shape, { kind: 'polygon' }>): number {
  return Math.abs(polygonSignedArea(polygon))
}

// ============================================================================
// §5.2 統一インターフェース: shape の kind で分岐する
// ============================================================================

/**
 * shape の頂点列をワールド座標で返す (rotation 適用後)。
 * rect / polygon どちらでも動く。
 */
export function shapeVertices(shape: Shape, rotation = 0): readonly Point[] {
  if (shape.kind === 'rect') return rectVertices(shape, rotation)
  return polygonVertices(shape, rotation)
}

/** shape の辺セグメント列 (rotation 適用後)。edgeIds との添字対応を維持する */
export function shapeEdges(shape: Shape, rotation = 0): readonly Segment[] {
  if (shape.kind === 'rect') return rectEdges(shape, rotation)
  return polygonEdges(shape, rotation)
}

/** shape の AABB (rotation 適用後)。 */
export function shapeAabb(shape: Shape, rotation = 0): Aabb {
  if (rotation === 0 && shape.kind === 'rect') return aabbOfRect(shape)
  const verts = shapeVertices(shape, rotation)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of verts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/** shape の床面積 (mm²)。rect は w*h、polygon は shoelace。rotation は面積に影響しない */
export function shapeArea(shape: Shape): number {
  if (shape.kind === 'rect') return shape.w * shape.h
  return polygonArea(shape)
}

/**
 * §M84 v0.18: 床面積 (mm²) を [m², 畳, 坪] に変換する。
 *
 * 1 坪 = 3.3058 m² (= 6 尺 × 6 尺、JIS 公正規格に基づく)
 * 1 畳 = 0.5 坪 = 1.6529 m² (= 不動産表示の慣行値)
 *
 * 戻り値は double のまま (表示側で `.toFixed()` する)。
 */
export const TATAMI_M2 = 1.6529
export const TSUBO_M2 = 3.3058

export function areaToDisplayUnits(areaMm2: number): {
  m2: number
  tatami: number
  tsubo: number
} {
  const m2 = areaMm2 / 1_000_000
  return {
    m2,
    tatami: m2 / TATAMI_M2,
    tsubo: m2 / TSUBO_M2,
  }
}

/** shape の AABB 中心 (rotation 適用後)。 */
export function shapeCenter(shape: Shape, rotation = 0): Point {
  const a = shapeAabb(shape, rotation)
  return [(a.minX + a.maxX) / 2, (a.minY + a.maxY) / 2]
}
