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
