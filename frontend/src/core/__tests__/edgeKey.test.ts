import { describe, expect, it } from 'vitest'

import {
  edgeKeyEquals,
  edgeKeyHash,
  edgeKeyOf,
  edgeRefHash,
  findEdgeId,
} from '@/core/edgeKey'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeRectShape, makeRoom } from '@/test/fixtures'

describe('findEdgeId', () => {
  it('rect の各辺を 1mm 厳格で逆引きできる', () => {
    const room = makeRoom({
      id: 'r1',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
    })
    const expected = room.shape.edgeIds

    const walls = regenerateWallsFromRooms([room])
    // 4 辺それぞれに edgeId が引ける
    const ids = walls.map((w) => findEdgeId(room, w))
    for (const id of ids) {
      expect(id).not.toBeNull()
      expect(expected).toContain(id)
    }
  })

  it('対応する辺がなければ null', () => {
    const room = makeRoom({
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
    })
    const fakeWall = {
      id: 'w-fake',
      from: [9999, 9999] as const,
      to: [10000, 10000] as const,
      thickness: 100,
      wallType: 'partition' as const,
      isLocked: false,
      sharedBy: [],
    }
    expect(findEdgeId(room, fakeWall)).toBeNull()
  })
})

describe('edgeKeyOf', () => {
  it('共有壁 (sharedBy: 2) は長さ 2 の EdgeKey、外周壁は長さ 1', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a, b])
    for (const w of walls) {
      const key = edgeKeyOf(w, [a, b])
      expect(key).not.toBeNull()
      if (w.sharedBy.length === 2) {
        expect(key!).toHaveLength(2)
      } else {
        expect(key!).toHaveLength(1)
      }
    }
  })

  it('sharedBy が空なら null (自由壁は破損データ扱い)', () => {
    const r = makeRoom()
    const wall = {
      id: 'w',
      from: [0, 0] as const,
      to: [1, 0] as const,
      thickness: 100,
      wallType: 'partition' as const,
      isLocked: false,
      sharedBy: [],
    }
    expect(edgeKeyOf(wall, [r])).toBeNull()
  })

  it('参照先 room が存在しなければ null', () => {
    const wall = {
      id: 'w',
      from: [0, 0] as const,
      to: [1, 0] as const,
      thickness: 100,
      wallType: 'partition' as const,
      isLocked: false,
      sharedBy: ['ghost'],
    }
    expect(edgeKeyOf(wall, [])).toBeNull()
  })
})

describe('edgeKeyEquals / edgeKeyHash', () => {
  it('同一 EdgeKey は equals = true、ハッシュも同じ', () => {
    const k1 = [
      { roomId: 'a', edgeId: 'e1' },
      { roomId: 'b', edgeId: 'e2' },
    ] as const
    const k2 = [
      { roomId: 'a', edgeId: 'e1' },
      { roomId: 'b', edgeId: 'e2' },
    ] as const
    expect(edgeKeyEquals(k1, k2)).toBe(true)
    expect(edgeKeyHash(k1)).toBe(edgeKeyHash(k2))
  })

  it('長さが違えば等価ではない', () => {
    expect(
      edgeKeyEquals(
        [{ roomId: 'a', edgeId: 'e1' }],
        [{ roomId: 'a', edgeId: 'e1' }, { roomId: 'b', edgeId: 'e2' }],
      ),
    ).toBe(false)
  })
})

describe('edgeRefHash', () => {
  it('roomId と edgeId が違えば違うハッシュ', () => {
    const h1 = edgeRefHash({ roomId: 'a', edgeId: 'e1' })
    const h2 = edgeRefHash({ roomId: 'a', edgeId: 'e2' })
    expect(h1).not.toBe(h2)
  })
})
