/**
 * §M135 v0.30: 壁取り付け設備のスナップロジック。
 */
import { describe, expect, it } from 'vitest'

import { snapToNearestWall } from '@/core/wallSnap'
import type { Wall } from '@/types'

function makeWall(
  id: string,
  from: [number, number],
  to: [number, number],
  thickness = 100,
): Wall {
  return {
    id,
    from,
    to,
    thickness,
    wallType: 'partition',
    isLocked: false,
    sharedBy: [],
  }
}

describe('snapToNearestWall', () => {
  // 部屋: (0,0) - (4000,3000) の矩形。壁 4 本。
  const walls: Wall[] = [
    makeWall('top', [0, 0], [4000, 0]),
    makeWall('right', [4000, 0], [4000, 3000]),
    makeWall('bottom', [4000, 3000], [0, 3000]),
    makeWall('left', [0, 3000], [0, 0]),
  ]

  it('部屋の中央付近をクリックすると最寄り壁 (左壁) に寄る', () => {
    const r = snapToNearestWall([200, 1500], walls, 250)
    expect(r).not.toBeNull()
    expect(r!.wallId).toBe('left')
    // 左壁 (x=0) から depth/2 + thickness/2 = 175mm 内側に寄った位置
    expect(r!.position[0]).toBe(175)
    expect(r!.position[1]).toBe(1500)
  })

  it('上壁付近をクリックすると上壁にスナップ、rotation は水平 (0 rad)', () => {
    const r = snapToNearestWall([2000, 300], walls, 250)
    expect(r).not.toBeNull()
    expect(r!.wallId).toBe('top')
    // 上壁 (y=0) から下に depth/2+thickness/2 = 175mm 入った位置
    expect(r!.position[1]).toBe(175)
    // top wall は (0,0) → (4000,0) なので rotation は 0
    expect(r!.rotation).toBeCloseTo(0)
  })

  it('右壁付近をクリックすると右壁にスナップ、rotation は π/2', () => {
    const r = snapToNearestWall([3800, 1500], walls, 250)
    expect(r).not.toBeNull()
    expect(r!.wallId).toBe('right')
    // right wall は (4000,0)→(4000,3000) で rotation = π/2
    expect(r!.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('maxDist より遠ければ null を返す', () => {
    const r = snapToNearestWall([10000, 10000], walls, 250, { maxDist: 1000 })
    expect(r).toBeNull()
  })

  it('壁の端を超えた位置は線分内に clamp される (top wall の端を超えた点)', () => {
    const r = snapToNearestWall([5000, 100], walls, 250)
    expect(r).not.toBeNull()
    // 上か右の壁にスナップする。最寄りは top wall の右端 (4000,0)
    // 上壁線分は [0..4000] で clamp されるので proj は (4000, 0)
    // ただし top wall の方が近いか right wall の方が近いかは座標で決まる
    // (5000,100) → top wall への距離: sqrt(1000^2 + 100^2) ≈ 1005
    //               right wall への距離: sqrt(1000^2 + 100^2)... no wait, projection
    // right wall は (4000,0)→(4000,3000) なので t=100/3000=0.033, proj=(4000,100)
    //               距離 = |5000-4000| = 1000
    // top wall は (0,0)→(4000,0)、t clamped to 1, proj=(4000,0)
    //              距離 = sqrt((5000-4000)^2 + (100-0)^2) = sqrt(1000000+10000) ≈ 1005
    // → right wall の方が僅かに近い
    expect(r!.wallId).toBe('right')
  })
})
