/**
 * TC-B: 共有壁マージ。
 */
import { describe, expect, it } from 'vitest'

import { regenerateWallsFromRooms } from '@/core/walls'
import { makeRectShape, makeRoom } from '@/test/fixtures'

describe('regenerateWallsFromRooms (TC-B: 共有壁マージ)', () => {
  it('単独の部屋からは 4 つの外周壁を生成し、sharedBy にその部屋 1 つを含む', () => {
    const room = makeRoom({
      id: 'r1',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
    })
    const walls = regenerateWallsFromRooms([room])
    expect(walls).toHaveLength(4)
    for (const w of walls) {
      expect(w.sharedBy).toEqual(['r1'])
      expect(w.id.length).toBeGreaterThan(0)
    }
  })

  it('辺を共有する 2 部屋から 7 つの壁 (4+4-1 で共有壁 1 本に統合) を生成する', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a, b])
    // 4 + 4 = 8 個の辺のうち、a 東 と b 西 がマージされて 1 本になる → 計 7 本
    expect(walls).toHaveLength(7)
    const shared = walls.filter((w) => w.sharedBy.length === 2)
    expect(shared).toHaveLength(1)
    expect(shared[0]!.sharedBy.sort()).toEqual(['a', 'b'])
  })

  it('共有壁の Wall.from / to は壁芯座標で同一線分', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a, b])
    const shared = walls.find((w) => w.sharedBy.length === 2)!
    // x = 1000 の縦線
    const xs = [shared.from[0], shared.to[0]]
    expect(xs).toEqual([1000, 1000])
    const ys = [shared.from[1], shared.to[1]].sort((p, q) => p - q)
    expect(ys).toEqual([0, 1000])
  })

  it('離れた部屋同士は共有壁なし (外周壁 8 本)', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 2000, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a, b])
    expect(walls).toHaveLength(8)
    expect(walls.filter((w) => w.sharedBy.length === 2)).toHaveLength(0)
  })
})
