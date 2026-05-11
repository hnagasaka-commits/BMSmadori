/**
 * §6.6.0 採光・換気の有効面積計算。
 *
 * 採光と換気は計算式が違う (FIX 窓は換気に算入しないなど) ので、関数を分ける。
 * 共通の `sumWindowArea` は使わない (§6.6.0 boxed note)。
 *
 * 単位:
 * - 入力: mm
 * - 出力: m² (採光・換気 1/7 / 1/20 比較は m² で行う)
 */

import type { Room, Wall, Window, WindowType } from '@/types'
import { shapeArea } from '@/core/geometry'

// ============================================================================
// 部屋の床面積
// ============================================================================

/**
 * §6.8 面積計算 (壁芯)。
 * - rect : w * h
 * - polygon : Shoelace 公式 (Phase 2 / M16 で導入)
 * 単位は m²。回転しても面積は変わらないため shapeArea は rotation を見ない。
 */
export function roomFloorArea(room: Room): number {
  return shapeArea(room.shape) / 1_000_000
}

// ============================================================================
// 窓の有効面積
// ============================================================================

/**
 * Phase 1 採光補正係数。一律 1.0。
 * Phase 2 で隣地距離・庇深さを加味して 0.7〜1.0 に拡張する (§C.1)。
 * 拡張時は §C.0 のメタにある appRuleVersion を +1 すること。
 */
function lightingCorrection(window: Window): number {
  void window
  return 1.0
}

/**
 * §6.6.0 換気での開放可能率。WindowType ごとに固定値。
 * - FIX 窓は 0 (換気に算入しない)
 * - 引違い 2 枚 / 4 枚 / 出窓は 0.5
 * - 片開き・上げ下げは 1.0
 */
export function openableRatio(type: WindowType): number {
  switch (type) {
    case 'fixed':
      return 0
    case 'sliding-2':
      return 0.5
    case 'sliding-4':
      return 0.5
    case 'casement':
      return 1.0
    case 'bay':
      return 0.5
  }
}

/**
 * その部屋に「属する窓」を返す。窓は壁に紐づくため、`Wall.sharedBy` に部屋 ID が含まれる窓だけが対象。
 * 共有壁の窓は両側の部屋に算入される (Phase 1 の素朴運用)。
 */
function windowsOnRoom(
  room: Room,
  windows: readonly Window[],
  walls: readonly Wall[],
): Window[] {
  const wallIdsOfRoom = new Set(
    walls.filter((w) => w.sharedBy.includes(room.id)).map((w) => w.id),
  )
  return windows.filter((w) => wallIdsOfRoom.has(w.wallId))
}

/**
 * §6.6.0 採光有効面積 (m²)。
 * window.width × window.height × 採光補正係数 を合計。
 */
export function sumLightingArea(
  room: Room,
  windows: readonly Window[],
  walls: readonly Wall[],
): number {
  let total = 0
  for (const w of windowsOnRoom(room, windows, walls)) {
    const raw = (w.width * w.height) / 1_000_000
    total += raw * lightingCorrection(w)
  }
  return total
}

/**
 * §6.6.0 換気有効面積 (m²)。
 * window.width × window.height × openableRatio(type) を合計。FIX 窓は 0。
 */
export function sumVentilationArea(
  room: Room,
  windows: readonly Window[],
  walls: readonly Wall[],
): number {
  let total = 0
  for (const w of windowsOnRoom(room, windows, walls)) {
    const raw = (w.width * w.height) / 1_000_000
    total += raw * openableRatio(w.type)
  }
  return total
}
