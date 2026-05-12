/**
 * §6.3 重なり判定。
 *
 * - Phase 1 (rect + 90°): 回転後も軸並行に戻る → AABB のみで判定
 * - Phase 2 / M16 (polygon + 90°): polygon の場合は polygonVertices を経由して AABB を得る
 * - Phase 2 後半で任意角度を入れたら SAT (Separating Axis Theorem) を追加する
 *
 * 1mm でも内部で重なれば配置不能。境界共有 (touching) は重なりとしない。
 */

import type { Room } from '@/types'
import { aabbOverlaps, shapeAabb, type Aabb } from './geometry'

/**
 * Room の回転後 AABB を返す。rect / polygon どちらでも動く。
 * 90° 量子化されていない角度はサポート外として null を返す (Phase 2 後半で SAT を入れた時点で削除)。
 */
export function roomAabb(room: Room): Aabb | null {
  const rot = ((Math.round(room.rotation / 90) % 4) + 4) % 4
  if (Math.abs(room.rotation - rot * 90) > 1) return null
  return shapeAabb(room.shape, rot * 90)
}

/** 2 つの部屋が重なるか (Phase 1: rect + 90°, Phase 2 / M16: polygon + 90° まで) */
export function roomsOverlap(a: Room, b: Room): boolean {
  if (a.id === b.id) return false
  const aa = roomAabb(a)
  const bb = roomAabb(b)
  if (aa == null || bb == null) return false
  return aabbOverlaps(aa, bb)
}

/**
 * `target` が `others` のいずれかと重なるか。
 * 同一 id の部屋は除外 (自身との重なりは無視)。
 */
export function overlapsAny(target: Room, others: readonly Room[]): boolean {
  for (const o of others) {
    if (o.id === target.id) continue
    if (roomsOverlap(target, o)) return true
  }
  return false
}

/**
 * §M112 v0.26: リサイズ時の AABB を「隣の部屋に食い込んだら接する位置に止める」。
 *
 * `proposed` (= ユーザー入力の AABB) と `original` (= 編集開始時の AABB) を比較し、
 * 外側に拡張した辺だけを `obstacles` の辺で止める。
 * - L 辺が左に動いた (= proposed.minX < original.minX) のに other.maxX に食い込むなら
 *   minX を other.maxX に丸める
 * - 同じく R/T/B 辺で対称に処理
 *
 * obstacles と target が初めから重なるケース (= initial state バグ) は無視する。
 */
export function clampResizeAgainstObstacles(
  proposed: Aabb,
  original: Aabb,
  obstacles: readonly Aabb[],
): Aabb {
  let { minX, minY, maxX, maxY } = proposed
  for (const o of obstacles) {
    // open-interval overlap check (touching is OK)
    if (maxX <= o.minX || minX >= o.maxX) continue
    if (maxY <= o.minY || minY >= o.maxY) continue
    // 各方向への "食い込み深さ"
    const depthRight = maxX - o.minX  // 我々が右に飛び出して other の左辺を超えた量
    const depthLeft = o.maxX - minX   // 左に飛び出して other の右辺を超えた量
    const depthBottom = maxY - o.minY
    const depthTop = o.maxY - minY
    // どの辺の食い込みが一番浅いか = そこを境界として吸着する
    const min = Math.min(depthRight, depthLeft, depthBottom, depthTop)
    if (min === depthRight && maxX > original.maxX) {
      // 我々の右辺が外側に拡張して obstacle.minX に当たった → 接する位置で止める
      maxX = o.minX
    } else if (min === depthLeft && minX < original.minX) {
      minX = o.maxX
    } else if (min === depthBottom && maxY > original.maxY) {
      maxY = o.minY
    } else if (min === depthTop && minY < original.minY) {
      minY = o.maxY
    }
    // else: 拡張していない方向に既に食い込んでいる (=旧状態でも overlap) → 触らない
  }
  return { minX, minY, maxX, maxY }
}
