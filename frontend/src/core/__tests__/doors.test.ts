/**
 * TC-C: ドア自動配置 + tombstone 抑止
 */
import { describe, expect, it } from 'vitest'

import {
  AUTO_DOOR_DEFAULT_POSITION_RATIO,
  AUTO_DOOR_DEFAULT_WIDTH,
  addAutoDoorSuppression,
  autoPlaceDoors,
  isAutoDoorSuppressed,
  pruneAutoDoorSuppressions,
} from '@/core/doors'
import { edgeKeyOf } from '@/core/edgeKey'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeRectShape, makeRoom } from '@/test/fixtures'

function setupTwoRooms() {
  const a = makeRoom({
    id: 'a',
    shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
  })
  const b = makeRoom({
    id: 'b',
    shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
  })
  const walls = regenerateWallsFromRooms([a, b])
  return { a, b, walls, rooms: [a, b] }
}

describe('autoPlaceDoors (TC-C)', () => {
  it('共有壁にドアを 1 つ生成する (既定 800mm 片開き、positionRatio 0.5)', () => {
    const { walls, rooms } = setupTwoRooms()
    const result = autoPlaceDoors({ walls, doors: [], rooms, tombstones: [] })
    expect(result).toHaveLength(1)
    expect(result[0]!.width).toBe(AUTO_DOOR_DEFAULT_WIDTH)
    expect(result[0]!.positionRatio).toBe(AUTO_DOOR_DEFAULT_POSITION_RATIO)
    expect(result[0]!.type).toBe('single-swing')
  })

  it('外周壁にはドアを生成しない (共有壁限定)', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a])
    const result = autoPlaceDoors({ walls, doors: [], rooms: [a], tombstones: [] })
    expect(result).toHaveLength(0)
  })

  it('既にドアがある共有壁には自動ドアを追加しない', () => {
    const { walls, rooms } = setupTwoRooms()
    const sharedWall = walls.find((w) => w.sharedBy.length === 2)!
    const existing = {
      id: 'pre',
      wallId: sharedWall.id,
      positionRatio: 0.3,
      width: 700,
      type: 'sliding' as const,
    }
    const result = autoPlaceDoors({
      walls,
      doors: [existing],
      rooms,
      tombstones: [],
    })
    expect(result).toEqual([existing])
  })
})

describe('tombstone (§6.2 再生成抑止)', () => {
  it('共有壁を tombstone に登録すると自動ドアが生成されない', () => {
    const { walls, rooms } = setupTwoRooms()
    const sharedWall = walls.find((w) => w.sharedBy.length === 2)!
    const key = edgeKeyOf(sharedWall, rooms)!
    expect(key).toHaveLength(2)
    expect(key).toHaveLength(2)
    const ref0 = key[0]!
    const ref1 = key[1]!
    const tombstones = [
      { edgeKey: [ref0, ref1] as const, removedAt: '2026-05-11T00:00:00Z' },
    ]
    expect(isAutoDoorSuppressed(sharedWall, rooms, tombstones)).toBe(true)
    const result = autoPlaceDoors({ walls, doors: [], rooms, tombstones })
    expect(result).toHaveLength(0)
  })

  it('addAutoDoorSuppression: 同じ EdgeKey の重複登録を防ぐ', () => {
    const { walls, rooms } = setupTwoRooms()
    const sharedWall = walls.find((w) => w.sharedBy.length === 2)!
    const t1 = addAutoDoorSuppression({
      wall: sharedWall,
      rooms,
      existing: [],
      now: () => '2026-05-11T00:00:00Z',
    })
    expect(t1).toHaveLength(1)
    const t2 = addAutoDoorSuppression({
      wall: sharedWall,
      rooms,
      existing: t1,
      now: () => '2026-05-11T00:00:01Z',
    })
    expect(t2).toHaveLength(1)
    expect(t2).toBe(t1) // 重複なら既存配列をそのまま返す
  })

  it('外周壁 (sharedBy.length !== 2) は tombstone に登録しない', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a])
    const t = addAutoDoorSuppression({
      wall: walls[0]!,
      rooms: [a],
      existing: [],
    })
    expect(t).toHaveLength(0)
  })

  it('pruneAutoDoorSuppressions: 部屋が消えたら tombstone も消える', () => {
    const { walls, rooms } = setupTwoRooms()
    const sharedWall = walls.find((w) => w.sharedBy.length === 2)!
    const key = edgeKeyOf(sharedWall, rooms)!
    expect(key).toHaveLength(2)
    const ref0 = key[0]!
    const ref1 = key[1]!
    const tombstones = [
      { edgeKey: [ref0, ref1] as const, removedAt: '2026-05-11T00:00:00Z' },
    ]
    // a が削除された
    const pruned = pruneAutoDoorSuppressions({
      tombstones,
      livingRoomIds: new Set(['b']),
      livingEdgeIdsByRoom: new Map([['b', new Set(rooms[1]!.shape.edgeIds)]]),
    })
    expect(pruned).toHaveLength(0)
  })

  it('pruneAutoDoorSuppressions: 辺 id が消えたら tombstone も消える', () => {
    const { walls, rooms } = setupTwoRooms()
    const sharedWall = walls.find((w) => w.sharedBy.length === 2)!
    const key = edgeKeyOf(sharedWall, rooms)!
    expect(key).toHaveLength(2)
    const ref0 = key[0]!
    const ref1 = key[1]!
    const tombstones = [
      { edgeKey: [ref0, ref1] as const, removedAt: '2026-05-11T00:00:00Z' },
    ]
    // 両部屋は残るが、a の edgeIds から 1 つを意図的に外す
    const pruned = pruneAutoDoorSuppressions({
      tombstones,
      livingRoomIds: new Set(['a', 'b']),
      livingEdgeIdsByRoom: new Map([
        ['a', new Set([rooms[0]!.shape.edgeIds[0]!])], // 必要な edge を含まない
        ['b', new Set(rooms[1]!.shape.edgeIds)],
      ]),
    })
    expect(pruned).toHaveLength(0)
  })
})
