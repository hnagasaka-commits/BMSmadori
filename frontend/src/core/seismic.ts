/**
 * §6.4.4 耐震診断 (簡易壁量計算) — Phase 3 / M21。
 *
 * 国土交通省告示の "壁量計算" (建築基準法施行令 第 46 条) の超簡略版:
 *
 *  1. 階の床面積 [m²] に「必要壁量係数 [cm/m²]」を掛けて「必要壁量 [cm]」を出す。
 *     - 1 階建ての 1 階: 15 cm/m²
 *     - 2 階建ての 1 階: 33 cm/m² (上に階があるため重い)
 *     - 2 階建ての 2 階: 21 cm/m²
 *     - 3 階建ての 1〜3 階は別表だが本アプリでは扱わない (3F は 21 cm/m² で近似)
 *  2. 実壁量 = 各壁について (壁の長さ [cm] × 壁倍率) を方向別 (X/Y) に合計。
 *     方向は「壁が伸びる方向」に従って分類する:
 *      - 横向き (X 軸沿い) の壁 → X 方向の壁
 *      - 縦向き (Y 軸沿い) の壁 → Y 方向の壁
 *  3. 必要壁量 ≤ 実壁量 (X / Y それぞれ) なら OK。どちらかが不足なら warning。
 *
 * 制約 (PoC):
 *  - 木造のみ対象 (RC / steel は別表)
 *  - 屋根荷重区分 (軽い屋根 / 重い屋根) は係数を切替えない。今回は中央値で固定
 *  - 偏心率 / 4 分割法は M22 以降
 *  - 壁倍率は wallType ベース (筋交い詳細は持たない)
 */

import type { Floor, Floorplan, Wall, WallType } from '@/types'
import { roomFloorArea } from '@/core/compliance/areas'

// ---------------------------------------------------------------------------
// 壁倍率テーブル
// ---------------------------------------------------------------------------

/**
 * 壁倍率 (告示 第 1100 号 別表第 1 の数値を超簡略化したもの)。
 *
 * - exterior / shared: 外壁・戸境壁は通常 1.0 (筋交いなしの真壁/大壁)
 * - load-bearing : 耐力壁は 2.0 (筋交い 1 本 = 2.0 相当として近似)
 * - partition : 間仕切りは構造上算入しない (0)
 * - non-bearing : 非耐力壁は 0
 *
 * 実務では筋交い種別・面材・厚みで倍率が決まる (1.0〜5.0)。Phase 3 後半で持つ予定。
 */
export function wallBearingFactor(wallType: WallType): number {
  switch (wallType) {
    case 'exterior':
      return 1.0
    case 'shared':
      return 1.0
    case 'load-bearing':
      return 2.0
    case 'partition':
      return 0
    case 'non-bearing':
      return 0
  }
}

// ---------------------------------------------------------------------------
// 必要壁量係数
// ---------------------------------------------------------------------------

/**
 * 階の位置 (level) と総階数で決まる必要壁量係数 (cm/m²)。
 *
 * 例:
 *  - 1 階建ての 1F: 15
 *  - 2 階建ての 1F: 33, 2F: 21
 *  - 3 階建ての 1F: 50, 2F: 39, 3F: 24 (簡略, 重い屋根近似)
 */
export function requiredFactor(level: number, totalFloors: number): number {
  if (totalFloors === 1) return 15
  if (totalFloors === 2) {
    return level === 1 ? 33 : 21
  }
  // 3 階建て
  if (level === 1) return 50
  if (level === 2) return 39
  return 24
}

// ---------------------------------------------------------------------------
// 計算本体
// ---------------------------------------------------------------------------

export type SeismicReport = {
  /** 階の総床面積 [m²] */
  floorAreaM2: number
  /** 必要壁量 [cm] (X / Y は同値) */
  requiredCm: number
  /** 実壁量 X [cm] = 「Y 軸沿いに伸びる壁 (= X 方向に効く壁)」… ではなく、
   *  本実装では「壁の方向ベクトルを X/Y に分解した寄与」を使う:
   *   - 完全に X 軸沿いの壁は X 方向 100%
   *   - 完全に Y 軸沿いの壁は Y 方向 100%
   *   - 斜め壁は cos²/sin² で按分 (Phase 1 は 0/90 のみだが将来用)
   */
  actualXCm: number
  actualYCm: number
  passX: boolean
  passY: boolean
}

/**
 * 1 階分の壁量報告を返す。
 *
 * @param floor 対象の Floor
 * @param totalFloors 建物全体の階数 (係数選定に使う)
 */
export function computeFloorSeismic(
  floor: Floor,
  totalFloors: number,
): SeismicReport {
  const floorAreaM2 = (floor.rooms ?? []).reduce<number>(
    (acc, r) => acc + roomFloorArea(r),
    0,
  )
  const factor = requiredFactor(floor.level, totalFloors)
  const requiredCm = floorAreaM2 * factor

  let actualXCm = 0
  let actualYCm = 0
  if (Array.isArray(floor.walls)) {
    for (const wall of floor.walls) {
      const { xMm, yMm } = wallDirectionalLengthsMm(wall)
      const factor = wallBearingFactor(wall.wallType)
      if (factor === 0) continue
      // mm → cm に揃える (壁量は cm 単位)
      actualXCm += (xMm / 10) * factor
      actualYCm += (yMm / 10) * factor
    }
  }

  return {
    floorAreaM2,
    requiredCm,
    actualXCm,
    actualYCm,
    passX: actualXCm >= requiredCm,
    passY: actualYCm >= requiredCm,
  }
}

/**
 * 壁を X/Y 方向に分解した有効長を返す (mm)。
 *
 * - 完全に X 軸沿い (from.y === to.y) → xMm = length, yMm = 0
 * - 完全に Y 軸沿い (from.x === to.x) → xMm = 0, yMm = length
 * - 斜め: x = length * |cos|, y = length * |sin| (Phase 1 では 90° 量子化前提で発生しない)
 *
 * Phase 3 / M16 の polygon 部屋は斜め辺を生成するので、これも自然に拾える。
 */
function wallDirectionalLengthsMm(wall: Wall): { xMm: number; yMm: number } {
  const dx = wall.to[0] - wall.from[0]
  const dy = wall.to[1] - wall.from[1]
  const length = Math.hypot(dx, dy)
  if (length < 1) return { xMm: 0, yMm: 0 }
  return {
    xMm: Math.abs(dx),
    yMm: Math.abs(dy),
  }
}

/**
 * 建物全体 (全階) の耐震診断を返す。各階を `computeFloorSeismic` で集計。
 */
export function computeBuildingSeismic(plan: Floorplan): SeismicReport[] {
  return plan.floors.map((f) => computeFloorSeismic(f, plan.floors.length))
}
