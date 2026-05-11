/**
 * TC-D: 重なり防止。
 */
import { describe, expect, it } from 'vitest'

import { overlapsAny, roomAabb, roomsOverlap } from '@/core/collision'
import { makeRectShape, makeRoom } from '@/test/fixtures'

describe('roomsOverlap (TC-D)', () => {
  it('完全に離れた部屋同士は重ならない', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 2000, y: 0, w: 1000, h: 1000 }),
    })
    expect(roomsOverlap(a, b)).toBe(false)
  })

  it('共有壁で隣接 (境界共有) は重ならない判定', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    expect(roomsOverlap(a, b)).toBe(false)
  })

  it('1mm 内部に食い込んだら重なり', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 999, y: 0, w: 1000, h: 1000 }),
    })
    expect(roomsOverlap(a, b)).toBe(true)
  })

  it('自分自身との重なりは無視', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    expect(roomsOverlap(a, a)).toBe(false)
  })
})

describe('roomAabb (90° 倍数で AABB が正しく入れ替わる)', () => {
  it('rotation = 90° で幅と高さが入れ替わる', () => {
    const r = makeRoom({
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
      rotation: 90,
    })
    const aabb = roomAabb(r)
    expect(aabb).not.toBeNull()
    expect(aabb!.maxX - aabb!.minX).toBe(500)
    expect(aabb!.maxY - aabb!.minY).toBe(1000)
  })

  it('rotation = 270° でも 90° と同じ AABB', () => {
    const r270 = makeRoom({
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
      rotation: 270,
    })
    const r90 = makeRoom({
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
      rotation: 90,
    })
    expect(roomAabb(r270)).toEqual(roomAabb(r90))
  })

  it('Phase 1 でサポートされない非 90° 倍数は null を返す', () => {
    const r = makeRoom({
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 500 }),
      rotation: 45,
    })
    expect(roomAabb(r)).toBeNull()
  })
})

describe('overlapsAny', () => {
  it('複数部屋に対してどれか 1 つでも重なれば true', () => {
    const target = makeRoom({
      id: 't',
      shape: makeRectShape({ x: 500, y: 500, w: 1000, h: 1000 }),
    })
    const others = [
      makeRoom({
        id: 'a',
        shape: makeRectShape({ x: 0, y: 0, w: 100, h: 100 }),
      }),
      makeRoom({
        id: 'b',
        shape: makeRectShape({ x: 1000, y: 1000, w: 1000, h: 1000 }),
      }),
    ]
    expect(overlapsAny(target, others)).toBe(true)
  })

  it('同じ id の部屋は除外される', () => {
    const target = makeRoom({
      id: 'same',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const dup = { ...target }
    expect(overlapsAny(target, [dup])).toBe(false)
  })
})
