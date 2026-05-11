/**
 * §5.2 EdgeKey 関連の純粋関数群。
 *
 * - findEdgeId: Room と Wall を照合して EdgeId を逆引き
 * - edgeKeyOf: Wall.sharedBy から EdgeKey を組み立てる (null は破損データ)
 * - edgeKeyEquals: EdgeKey 同士の等価判定 (順序非依存)
 * - oneSidedKeys: 片側 EdgeRef を文字列化して Map のキーに使う
 */

import type { EdgeId, EdgeKey, EdgeRef, Room, Shape, Wall } from '@/types'
import { pointEquals, shapeEdges, type Segment } from './geometry'

// ============================================================================
// findEdgeId
// ============================================================================

/**
 * §5.2 Wall.from / to と Room.shape の辺 (ワールド座標) を照合し、対応する EdgeId を返す。
 * 見つからなければ null (edgeKeyOf 側で ER5 に流す)。
 *
 * Phase 1 は rect + 90° 限定で 1mm 厳格マッチ。
 */
export function findEdgeId(room: Room, wall: Wall): EdgeId | null {
  const segments = worldEdges(room.shape, room.rotation)
  if (segments == null) return null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    if (segmentMatchesWall(seg, wall)) {
      const id = room.shape.edgeIds[i]
      return typeof id === 'string' ? id : null
    }
  }
  return null
}

function segmentMatchesWall(seg: Segment, wall: Wall): boolean {
  const segReversed: Segment = { from: seg.to, to: seg.from }
  return (
    (pointEquals(seg.from, wall.from) && pointEquals(seg.to, wall.to)) ||
    (pointEquals(segReversed.from, wall.from) && pointEquals(segReversed.to, wall.to))
  )
}

/**
 * Room.shape からワールド座標の辺セグメント列を返す。
 * 順序は shape.edgeIds と対応。
 * Phase 2 / M16: polygon にも対応 (shapeEdges 経由)。
 */
export function worldEdges(shape: Shape, rotation: number): readonly Segment[] | null {
  return shapeEdges(shape, rotation)
}

// ============================================================================
// edgeKeyOf
// ============================================================================

/**
 * §5.2 Wall の EdgeKey を計算する。
 *
 * - sharedBy が空の場合 (自由壁) は null (破損データ、ER5 行き)
 * - 参照先の Room が見つからない / 辺が逆引きできない場合も null
 *
 * 戻り値の配列は (roomId, edgeId) でソート済み (順序非依存性を担保)。
 */
export function edgeKeyOf(wall: Wall, rooms: readonly Room[]): EdgeKey | null {
  if (wall.sharedBy.length === 0) return null

  const refs: EdgeRef[] = []
  for (const roomId of wall.sharedBy) {
    const room = rooms.find((r) => r.id === roomId)
    if (room == null) return null
    const edgeId = findEdgeId(room, wall)
    if (edgeId == null) return null
    refs.push({ roomId, edgeId })
  }
  refs.sort(compareEdgeRef)

  if (refs.length === 1) {
    return [refs[0]!]
  }
  if (refs.length === 2) {
    return [refs[0]!, refs[1]!]
  }
  // Wall.sharedBy は最大 2 要素 (§5.3 Zod)。安全策で null
  return null
}

function compareEdgeRef(a: EdgeRef, b: EdgeRef): number {
  return (
    a.roomId.localeCompare(b.roomId) ||
    a.edgeId.localeCompare(b.edgeId)
  )
}

// ============================================================================
// edgeKey 等価判定とハッシュ
// ============================================================================

/** EdgeKey 同士の等価判定 (どちらもソート済前提) */
export function edgeKeyEquals(a: EdgeKey, b: EdgeKey): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (x.roomId !== y.roomId || x.edgeId !== y.edgeId) return false
  }
  return true
}

/** EdgeKey を Map のキーに使うための canonical 文字列 */
export function edgeKeyHash(key: EdgeKey): string {
  return key.map((r) => `${r.roomId}#${r.edgeId}`).join('||')
}

/** 片側 EdgeRef の canonical 文字列 (片側フォールバック用、§5.2 再生成手順 4-(b)(c)) */
export function edgeRefHash(ref: EdgeRef): string {
  return `${ref.roomId}#${ref.edgeId}`
}
