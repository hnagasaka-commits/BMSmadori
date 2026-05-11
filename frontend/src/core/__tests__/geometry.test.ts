import { describe, expect, it } from 'vitest'

import {
  aabbOfRect,
  aabbOverlaps,
  canonicalSegmentKey,
  pointEquals,
  rectEdges,
  rectVertices,
  segmentEquals,
} from '@/core/geometry'

describe('aabbOverlaps', () => {
  it('明らかに重なる矩形は true', () => {
    expect(
      aabbOverlaps(
        { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        { minX: 50, minY: 50, maxX: 150, maxY: 150 },
      ),
    ).toBe(true)
  })

  it('境界共有 (touching) は false (1mm 重なれば配置不能なので strict)', () => {
    expect(
      aabbOverlaps(
        { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        { minX: 100, minY: 0, maxX: 200, maxY: 100 },
      ),
    ).toBe(false)
  })

  it('完全に離れていれば false', () => {
    expect(
      aabbOverlaps(
        { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        { minX: 200, minY: 0, maxX: 300, maxY: 100 },
      ),
    ).toBe(false)
  })
})

describe('rectVertices / rectEdges', () => {
  const rect = {
    kind: 'rect' as const,
    x: 0,
    y: 0,
    w: 1000,
    h: 500,
    edgeIds: ['n', 'e', 's', 'w'] as readonly [string, string, string, string],
  }

  it('rotation = 0 では矩形の 4 頂点をそのまま返す', () => {
    const [nw, ne, se, sw] = rectVertices(rect, 0)
    expect(nw).toEqual([0, 0])
    expect(ne).toEqual([1000, 0])
    expect(se).toEqual([1000, 500])
    expect(sw).toEqual([0, 500])
  })

  it('rotation = 90° で頂点が時計回りに回転 (中心を保つ)', () => {
    const verts = rectVertices(rect, 90)
    // 中心 (500, 250) まわりに 90° 回転すると、幅と高さが入れ替わる
    // bounding box は { 250, -250, 750, 750 }
    const xs = verts.map((p) => p[0])
    const ys = verts.map((p) => p[1])
    expect(Math.min(...xs)).toBe(250)
    expect(Math.max(...xs)).toBe(750)
    expect(Math.min(...ys)).toBe(-250)
    expect(Math.max(...ys)).toBe(750)
  })

  it('rectEdges は edgeIds と同じ順序 (N/E/S/W) で 4 辺を返す', () => {
    const edges = rectEdges(rect, 0)
    expect(edges).toHaveLength(4)
    expect(edges[0].from).toEqual([0, 0])
    expect(edges[0].to).toEqual([1000, 0])
    expect(edges[3].from).toEqual([0, 500])
    expect(edges[3].to).toEqual([0, 0])
  })
})

describe('canonicalSegmentKey / segmentEquals', () => {
  it('始点・終点を入れ替えても同じ canonical キー', () => {
    const a = { from: [0, 0] as const, to: [100, 0] as const }
    const b = { from: [100, 0] as const, to: [0, 0] as const }
    expect(canonicalSegmentKey(a)).toBe(canonicalSegmentKey(b))
    expect(segmentEquals(a, b)).toBe(true)
  })

  it('違う線分は違うキー', () => {
    const a = { from: [0, 0] as const, to: [100, 0] as const }
    const b = { from: [0, 0] as const, to: [100, 1] as const }
    expect(canonicalSegmentKey(a)).not.toBe(canonicalSegmentKey(b))
  })

  it('pointEquals は 1mm 以内で true', () => {
    expect(pointEquals([100, 200], [101, 200])).toBe(true)
    expect(pointEquals([100, 200], [102, 200])).toBe(false)
  })
})

describe('aabbOfRect', () => {
  it('rect の AABB を返す', () => {
    expect(
      aabbOfRect({
        kind: 'rect',
        x: 10,
        y: 20,
        w: 100,
        h: 50,
        edgeIds: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 })
  })
})
