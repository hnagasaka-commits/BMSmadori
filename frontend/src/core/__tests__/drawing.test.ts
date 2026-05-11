/**
 * §M27 Phase 3: 線で間取りを描くモードの幾何ヘルパー単体テスト。
 */
import { describe, expect, it } from 'vitest'

import {
  autoStraighten,
  commitDrawPoint,
  isClosingNearStart,
  pointsToPolygonShape,
  snapToGrid,
} from '@/core/drawing'

describe('autoStraighten', () => {
  it('dx > dy なら水平 (Y を直前点に揃える)', () => {
    expect(autoStraighten([0, 0], [3000, 200])).toEqual([3000, 0])
  })
  it('dy > dx なら垂直 (X を直前点に揃える)', () => {
    expect(autoStraighten([0, 0], [200, 3000])).toEqual([0, 3000])
  })
  it('dx === dy のときは水平を採用 (>= で判定)', () => {
    expect(autoStraighten([0, 0], [1000, 1000])).toEqual([1000, 0])
  })
})

describe('snapToGrid', () => {
  it('910mm グリッドに丸める', () => {
    expect(snapToGrid([100, 1500], 910)).toEqual([0, 1820])
    expect(snapToGrid([455, 455], 910)).toEqual([910, 910])
  })
})

describe('commitDrawPoint', () => {
  it('最初の点はスナップだけ', () => {
    expect(commitDrawPoint(null, [200, 200], 910)).toEqual([0, 0])
  })
  it('直前点がある場合は軸並行化される', () => {
    expect(commitDrawPoint([0, 0], [3500, 200], 910)).toEqual([3640, 0])
  })
  it('直前点と完全に同じになる場合は null (重複点を弾く)', () => {
    // 既に (0, 0) にいて、(100, 100) は snap → (0, 0)。直前と一致するので null
    expect(commitDrawPoint([0, 0], [100, 100], 910)).toBeNull()
  })
})

describe('isClosingNearStart', () => {
  it('200mm 以内なら閉じる', () => {
    expect(isClosingNearStart([0, 0], [150, 50])).toBe(true)
  })
  it('200mm 超は閉じない', () => {
    expect(isClosingNearStart([0, 0], [500, 0])).toBe(false)
  })
})

describe('pointsToPolygonShape', () => {
  it('3 点以上で polygon Shape を返す', () => {
    let n = 0
    const newId = () => `e${++n}`
    const shape = pointsToPolygonShape(
      [
        [0, 0],
        [4000, 0],
        [4000, 3000],
        [0, 3000],
      ],
      newId,
    )
    expect(shape).not.toBeNull()
    if (shape == null) return
    expect(shape.kind).toBe('polygon')
    expect(shape.points).toHaveLength(4)
    expect(shape.edgeIds).toHaveLength(4)
  })

  it('開始点と終了点が同一なら最後を切る', () => {
    let n = 0
    const newId = () => `e${++n}`
    const shape = pointsToPolygonShape(
      [
        [0, 0],
        [4000, 0],
        [4000, 3000],
        [0, 0],
      ],
      newId,
    )
    expect(shape).not.toBeNull()
    if (shape == null) return
    expect(shape.points).toHaveLength(3)
  })

  it('2 点以下は null', () => {
    expect(
      pointsToPolygonShape(
        [
          [0, 0],
          [1000, 0],
        ],
        () => 'e',
      ),
    ).toBeNull()
  })

  it('連続する重複点は除去される', () => {
    let n = 0
    const newId = () => `e${++n}`
    const shape = pointsToPolygonShape(
      [
        [0, 0],
        [0, 0],
        [4000, 0],
        [4000, 3000],
        [0, 3000],
      ],
      newId,
    )
    expect(shape).not.toBeNull()
    if (shape == null) return
    expect(shape.points).toHaveLength(4)
  })
})
