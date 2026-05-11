/**
 * §M27 Phase 3: 「線で間取りを描く」モードの幾何ヘルパー。
 *
 * 設計の意図:
 *  - ユーザーは点を順次クリックして壁芯ポリラインを作る。
 *  - 各点はクリック直後に「直前点と軸並行 (横 or 縦)」に自動補正する。
 *    こうすると Phase 3 の壁芯規約 (X 軸沿い or Y 軸沿いのみ) を維持できる。
 *  - 同じ場所への戻り (= 最初の点付近をクリック) で polygon を閉じて部屋を作る。
 *  - すべて mm 整数 (§3.6 量子化) を維持する。
 */

import type { Shape } from '@/types'

export type Point = readonly [number, number]

/**
 * `prev` から `cand` への線を、X 軸沿い or Y 軸沿いに「軸並行化」する。
 *
 * 戦略: 候補点と直前点の dx / dy の絶対値を比較して、大きい方の軸を維持し
 * もう一方の座標を直前点に揃える。これにより必ず水平 or 垂直の線になる。
 */
export function autoStraighten(prev: Point, cand: Point): Point {
  const dx = Math.abs(cand[0] - prev[0])
  const dy = Math.abs(cand[1] - prev[1])
  if (dx >= dy) {
    // 横 (X 軸沿い)
    return [cand[0], prev[1]]
  }
  // 縦 (Y 軸沿い)
  return [prev[0], cand[1]]
}

/** 1 点をグリッドにスナップ (mm) */
export function snapToGrid(p: Point, gridSize: number): Point {
  const g = Math.max(1, gridSize)
  return [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g]
}

/**
 * 描画途中バッファに新規候補点を追加する際の処理。
 *  - グリッドスナップ
 *  - 直前点があれば軸並行化
 *  - 直前点と同一なら無視 (null)
 */
export function commitDrawPoint(
  prev: Point | null,
  cand: Point,
  gridSize: number,
): Point | null {
  const snapped = snapToGrid(cand, gridSize)
  if (prev == null) return snapped
  const straightened = autoStraighten(prev, snapped)
  if (straightened[0] === prev[0] && straightened[1] === prev[1]) return null
  return straightened
}

/**
 * 最終クリックが「最初の点に十分近い」かを判定する (px ではなく mm の世界座標)。
 * 距離は CLOSE_TOLERANCE_MM 以内なら閉じる。
 */
const CLOSE_TOLERANCE_MM = 200
export function isClosingNearStart(start: Point, cand: Point): boolean {
  return (
    Math.abs(start[0] - cand[0]) <= CLOSE_TOLERANCE_MM &&
    Math.abs(start[1] - cand[1]) <= CLOSE_TOLERANCE_MM
  )
}

/**
 * §M28 Phase 3: フリーハンドのドラッグ経路を「軸並行ポリライン」に変換する。
 *
 * アルゴリズム:
 *  1. 直前の確定点と現在点の dx/dy を比較し、優勢な軸 (水平/垂直) を決定
 *  2. 同じ優勢軸が続く間は読み流す
 *  3. 優勢軸が反転した時点で「コーナー点」を確定 (前点の軸座標を維持)
 *  4. 最後の点も同様に commit する
 *  5. 全点をグリッドスナップして連続重複点を除去
 *
 * 制約:
 *  - 入力は 4 点以上を期待 (短すぎる経路は空配列を返す)
 *  - 結果はワールド座標 (mm)。閉じるかどうかは呼び出し側で判定する
 */
export function simplifyFreehandPath(
  path: ReadonlyArray<Point>,
  gridSize: number,
): Point[] {
  if (path.length < 4) return []

  const MIN_SEGMENT_MM = Math.max(gridSize, 200)
  const result: Point[] = [snapToGrid(path[0]!, gridSize)]

  // 「現在の優勢軸」と「最後にコーナーを置いた点」を追跡
  let lastFixed: Point = result[0]!
  let dominantAxis: 'h' | 'v' | null = null

  for (let i = 1; i < path.length; i++) {
    const pt = path[i]!
    const dx = pt[0] - lastFixed[0]
    const dy = pt[1] - lastFixed[1]
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    // 動きが小さければ無視 (ノイズ)
    if (absDx < MIN_SEGMENT_MM / 2 && absDy < MIN_SEGMENT_MM / 2) continue

    const axis: 'h' | 'v' = absDx >= absDy ? 'h' : 'v'
    if (dominantAxis == null) {
      dominantAxis = axis
      continue
    }
    if (axis === dominantAxis) continue

    // 軸が変わった: 直前の優勢軸方向にコーナーを置く
    const corner: Point =
      dominantAxis === 'h'
        ? snapToGrid([pt[0], lastFixed[1]], gridSize)
        : snapToGrid([lastFixed[0], pt[1]], gridSize)
    // 直前コーナーと同一なら捨てる
    if (corner[0] !== lastFixed[0] || corner[1] !== lastFixed[1]) {
      result.push(corner)
      lastFixed = corner
    }
    dominantAxis = axis
  }

  // 終点を確定
  const endRaw = path[path.length - 1]!
  if (dominantAxis != null) {
    const end: Point =
      dominantAxis === 'h'
        ? snapToGrid([endRaw[0], lastFixed[1]], gridSize)
        : snapToGrid([lastFixed[0], endRaw[1]], gridSize)
    if (end[0] !== lastFixed[0] || end[1] !== lastFixed[1]) result.push(end)
  }

  // 連続重複の除去
  const dedup: Point[] = []
  for (const p of result) {
    const last = dedup[dedup.length - 1]
    if (last != null && last[0] === p[0] && last[1] === p[1]) continue
    dedup.push(p)
  }
  return dedup
}

/**
 * 点列を polygon Shape に変換する。
 *
 * 制約:
 *  - 3 点以上必要
 *  - 自動直線化により隣接辺は軸並行になっている前提
 *  - edgeIds は呼び出し側で生成して渡す (テスト容易性)
 *
 * 戻り値が null なら「無効な点列」(2 点以下、または重複点が多い)。
 */
export function pointsToPolygonShape(
  points: ReadonlyArray<Point>,
  newId: () => string,
): Extract<Shape, { kind: 'polygon' }> | null {
  // 重複点を削除しつつ整数 mm に量子化
  const cleaned: Point[] = []
  for (const p of points) {
    const q: Point = [Math.round(p[0]), Math.round(p[1])]
    const last = cleaned[cleaned.length - 1]
    if (last != null && last[0] === q[0] && last[1] === q[1]) continue
    cleaned.push(q)
  }
  // 始点と終点が重複していたら最後を削る (polygon は最初と最後が自動的につながる)
  const first = cleaned[0]
  const last = cleaned[cleaned.length - 1]
  if (first != null && last != null && first[0] === last[0] && first[1] === last[1]) {
    cleaned.pop()
  }
  if (cleaned.length < 3) return null
  return {
    kind: 'polygon',
    points: cleaned,
    edgeIds: cleaned.map(() => newId()),
  }
}
