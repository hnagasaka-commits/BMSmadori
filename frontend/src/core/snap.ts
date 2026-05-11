/**
 * §6.1 スナップ判定 + §6.6 グリッドスナップ。
 *
 * Phase 1 は rect 部屋のみ対応 (worldEdges が null を返すなら無視)。
 */

import type { Room, Wall } from '@/types'
import { quantize, type Segment } from './geometry'
import { worldEdges } from './edgeKey'

export type { Segment }

export const SNAP_THRESHOLD = 200
export const OVERLAP_RATIO_MIN = 0.5

// ============================================================================
// グリッドスナップ
// ============================================================================

/** 整数 mm の値を grid に量子化する */
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return Math.round(value)
  return Math.round(value / grid) * grid
}

/** 点を grid にスナップ */
export function snapPointToGrid(p: readonly [number, number], grid: number): [number, number] {
  return [snapToGrid(p[0], grid), snapToGrid(p[1], grid)]
}

// ============================================================================
// 壁スナップ
// ============================================================================

export type SnapCandidate = {
  /** ドラッグ中の部屋側の辺 (元の世界座標) */
  movingEdge: Segment
  /** スナップ先の壁 */
  targetWall: Wall
  /**
   * 投影軸 (壁の方向の単位ベクトル) 上で重なる長さ ÷ ドラッグ側エッジの長さ。
   * OVERLAP_RATIO_MIN 以上なら吸着確定 (§6.1 ステップ 2)。
   */
  overlapRatio: number
  /** 壁から見て垂直方向の距離 (mm) */
  perpendicularDistance: number
}

/**
 * ドラッグ中の `movingRoom` と他壁とのスナップ候補を列挙する。
 * `targetWalls` には `isLocked` が true の壁も含めてよい (吸着「先」にはなれる、§6.1)。
 *
 * `movingRoom` 側の `isLocked: true` 壁は除外する (動かない壁同士のスナップは無意味)。
 * Phase 1 では isLocked は壁単位、ドラッグ側の判定は Room 全体で行うので、ここでは Room の
 * 全エッジを対象にする (UI 層で isLocked 部屋のドラッグを禁止する想定)。
 */
export function detectSnapCandidates(
  movingRoom: Room,
  targetWalls: readonly Wall[],
  options: { snapThreshold?: number; overlapRatioMin?: number } = {},
): SnapCandidate[] {
  const threshold = options.snapThreshold ?? SNAP_THRESHOLD
  const minRatio = options.overlapRatioMin ?? OVERLAP_RATIO_MIN

  const segments = worldEdges(movingRoom.shape, movingRoom.rotation)
  if (segments == null) return []

  const out: SnapCandidate[] = []
  for (const movingEdge of segments) {
    for (const wall of targetWalls) {
      // movingRoom 自身の壁はスナップ対象から外す (sharedBy で同 id)
      if (wall.sharedBy.includes(movingRoom.id)) continue

      const projection = projectEdgeOntoWall(movingEdge, wall)
      if (projection == null) continue
      const { perpendicularDistance, overlapRatio } = projection
      if (perpendicularDistance > threshold) continue
      if (overlapRatio < minRatio) continue
      out.push({ movingEdge, targetWall: wall, overlapRatio, perpendicularDistance })
    }
  }
  return out
}

// ============================================================================
// 投影計算 (壁の方向に movingEdge を射影し、垂直距離と重なり比率を求める)
// ============================================================================

type Projection = { perpendicularDistance: number; overlapRatio: number }

function projectEdgeOntoWall(edge: Segment, wall: Wall): Projection | null {
  const wallVec: [number, number] = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]]
  const wallLen = Math.hypot(wallVec[0], wallVec[1])
  if (wallLen === 0) return null

  // 壁の単位方向ベクトル
  const ux = wallVec[0] / wallLen
  const uy = wallVec[1] / wallLen

  // 1) movingEdge が壁の方向と「ほぼ平行」かを判定 (cross product による)
  const edgeVec: [number, number] = [edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]]
  const edgeLen = Math.hypot(edgeVec[0], edgeVec[1])
  if (edgeLen === 0) return null
  const ex = edgeVec[0] / edgeLen
  const ey = edgeVec[1] / edgeLen
  const cross = Math.abs(ex * uy - ey * ux)
  // 角度差が大きい (5° 以上) は平行とみなさない
  if (cross > Math.sin((5 * Math.PI) / 180)) return null

  // 2) 垂直距離: edge の任意点から wall 直線への距離
  const dx = edge.from[0] - wall.from[0]
  const dy = edge.from[1] - wall.from[1]
  // 法線方向 (-uy, ux) との内積の絶対値
  const perpendicularDistance = Math.abs(-uy * dx + ux * dy)

  // 3) 重なり比率: edge の 2 端点を壁方向に投影し、壁の [0, wallLen] と重なる長さ
  const tFrom = ux * dx + uy * dy
  const tToDx = edge.to[0] - wall.from[0]
  const tToDy = edge.to[1] - wall.from[1]
  const tTo = ux * tToDx + uy * tToDy
  const lo = Math.min(tFrom, tTo)
  const hi = Math.max(tFrom, tTo)
  const overlapLo = Math.max(0, lo)
  const overlapHi = Math.min(wallLen, hi)
  const overlapLen = Math.max(0, overlapHi - overlapLo)
  const overlapRatio = overlapLen / edgeLen

  return { perpendicularDistance, overlapRatio }
}

// ============================================================================
// スナップ確定後のオフセット計算
// ============================================================================

/**
 * 候補にスナップしたとき、Room の (x, y) に加算すべきオフセットを返す。
 * 最近候補がなければ null。
 *
 * 計算: movingEdge を targetWall の直線上に貼り付けるための平行移動量。
 * 壁方向への接線方向移動はせず、垂直方向の補正のみ行う (整数 mm に量子化)。
 */
export function computeSnapOffset(
  candidate: SnapCandidate,
): readonly [number, number] | null {
  const wall = candidate.targetWall
  const wallVec: [number, number] = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]]
  const wallLen = Math.hypot(wallVec[0], wallVec[1])
  if (wallLen === 0) return null
  const ux = wallVec[0] / wallLen
  const uy = wallVec[1] / wallLen

  // edge から wall への符号付き法線距離 (法線方向 (-uy, ux))
  const dx = candidate.movingEdge.from[0] - wall.from[0]
  const dy = candidate.movingEdge.from[1] - wall.from[1]
  const signedDist = -uy * dx + ux * dy

  // movingRoom 全体を -法線方向に signedDist だけ平行移動すると壁直線に乗る
  const offsetX = quantize(-(-uy) * signedDist)
  const offsetY = quantize(-ux * signedDist)
  return [offsetX, offsetY]
}
