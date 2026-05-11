/**
 * §M35〜M40 Phase 3 v0.3: UX 改善関連のストアテスト。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import { snapRoomDrop, type AabbMm } from '@/core/snap'
import type { Shape } from '@/types'

function rect(x: number, y: number, w: number, h: number): Extract<Shape, { kind: 'rect' }> {
  return {
    kind: 'rect',
    x,
    y,
    w,
    h,
    edgeIds: [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ],
  }
}

beforeEach(() => {
  useFloorplanStore.setState({
    floorplan: createEmptyFloorplan(),
    activeFloorIndex: 0,
  })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('§M36 snapRoomDrop', () => {
  it('角が 200mm 以内にあれば角スナップで一致させる', () => {
    const other: AabbMm = { minX: 0, minY: 0, maxX: 4000, maxY: 3000 }
    // 自部屋は (4150, 0) - (8150, 3000)。右隣にしたいが 150mm のズレあり
    const drop: AabbMm = { minX: 4150, minY: 0, maxX: 8150, maxY: 3000 }
    const r = snapRoomDrop(drop, [other], 910)
    expect(r.mode).toBe('corner')
    // 左上 (4150, 0) → (4000, 0) に揃う
    expect(r.minX).toBe(4000)
    expect(r.minY).toBe(0)
  })

  it('辺だけ揃う場合は edge モード (X 軸/Y 軸のいずれかだけ補正)', () => {
    const other: AabbMm = { minX: 0, minY: 0, maxX: 4000, maxY: 3000 }
    // X だけ 100mm ズレ。Y は遠い (どこにも近くない)
    const drop: AabbMm = { minX: 4100, minY: 10000, maxX: 8100, maxY: 13000 }
    const r = snapRoomDrop(drop, [other], 910)
    expect(r.mode).toBe('edge')
    expect(r.minX).toBe(4000)
    expect(r.minY).toBe(10000)
  })

  it('近接対象がなければ grid に丸める', () => {
    const drop: AabbMm = { minX: 1200, minY: 1500, maxX: 5200, maxY: 4500 }
    const r = snapRoomDrop(drop, [], 910)
    expect(r.mode).toBe('grid')
    expect(r.minX).toBe(910) // 1200 / 910 = 1.3 → round = 1
    expect(r.minY).toBe(1820) // 1500 / 910 = 1.65 → round = 2
  })
})

describe('§M37 moveRoomVertex (polygon)', () => {
  it('L 字 polygon の頂点を動かすと隣接 2 頂点も 1 hop 補正される', () => {
    const state = useFloorplanStore.getState()
    // 6 頂点の L 字 polygon (左上から反時計回り)
    const polygon: Extract<Shape, { kind: 'polygon' }> = {
      kind: 'polygon',
      points: [
        [0, 0],
        [4000, 0],
        [4000, 2000],
        [6000, 2000],
        [6000, 4000],
        [0, 4000],
      ],
      edgeIds: Array.from({ length: 6 }, () => crypto.randomUUID()),
    }
    state.addRoom({ presetId: 'living', shape: polygon })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    // 頂点 0 (0,0) を (500, 500) に動かす
    const ok = state.moveRoomVertex(roomId, 0, [500, 500])
    expect(ok).toBe(true)
    const after = selectFloor(useFloorplanStore.getState())!.rooms[0]!
    if (after.shape.kind !== 'polygon') throw new Error()
    expect(after.shape.points[0]).toEqual([500, 500])
    // 隣の頂点 1 (4000, 0) は y を 500 に合わせる (v0→v1 は horizontal)
    expect(after.shape.points[1]).toEqual([4000, 500])
    // 隣の頂点 5 (0, 4000) は x を 500 に合わせる (v5→v0 は vertical)
    expect(after.shape.points[5]).toEqual([500, 4000])
  })

  it('最小寸法 500mm 未満になる頂点移動は拒否', () => {
    const state = useFloorplanStore.getState()
    const polygon: Extract<Shape, { kind: 'polygon' }> = {
      kind: 'polygon',
      points: [
        [0, 0],
        [600, 0],
        [600, 600],
        [0, 600],
      ],
      edgeIds: Array.from({ length: 4 }, () => crypto.randomUUID()),
    }
    state.addRoom({ presetId: 'living', shape: polygon })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    // 頂点 0 (0,0) を (500, 0) に動かすと AABB 幅が 100mm に → 拒否
    const ok = state.moveRoomVertex(roomId, 0, [500, 0])
    expect(ok).toBe(false)
  })
})

describe('§M38 updateRoomPreset', () => {
  it('preset id を有効値に変更できる', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    const ok = state.updateRoomPreset(roomId, 'bedroom')
    expect(ok).toBe(true)
    expect(selectFloor(useFloorplanStore.getState())!.rooms[0]!.presetId).toBe(
      'bedroom',
    )
  })

  it('未知の preset id は拒否', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    const ok = state.updateRoomPreset(roomId, 'not-real')
    expect(ok).toBe(false)
  })

  it('同じ id への変更は no-op (false)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    const ok = state.updateRoomPreset(roomId, 'living')
    expect(ok).toBe(false)
  })
})

describe('§M39 拡充された家具カタログ', () => {
  it('新カタログ id が getCatalogEntry で引ける', async () => {
    const { getCatalogEntry, listCatalog } = await import('@/data/furnitureCatalog')
    expect(getCatalogEntry('sofa-l-shape')).not.toBeNull()
    expect(getCatalogEntry('bed-queen')).not.toBeNull()
    expect(getCatalogEntry('desk-work')).not.toBeNull()
    expect(getCatalogEntry('refrigerator')).not.toBeNull()
    // 全体件数が増えたことを確認 (旧 11 → 拡充後 23+)
    expect(listCatalog().length).toBeGreaterThanOrEqual(23)
  })
})

describe('§M40 moveFurniture は 1mm 量子化', () => {
  it('小数 mm でも整数 mm に丸めて保存', () => {
    const state = useFloorplanStore.getState()
    const id = state.addFurniture({
      catalogId: 'sofa-standard',
      position: [0, 0],
    })!
    state.moveFurniture(id, [123.7, 456.3])
    const fi = selectFloor(useFloorplanStore.getState())!.furniture[0]!
    expect(fi.position).toEqual([124, 456])
  })
})
