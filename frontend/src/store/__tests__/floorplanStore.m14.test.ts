/**
 * Phase 2 / M14 で追加された Furniture ストアアクションのテスト。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import type { Shape } from '@/types'

function shape(x: number, y: number, w: number, h: number): Extract<Shape, { kind: 'rect' }> {
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
  useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('Furniture アクション', () => {
  it('addFurniture で家具を 1 つ追加できる', () => {
    const id = useFloorplanStore.getState().addFurniture({
      catalogId: 'sofa-standard',
      position: [1000, 2000],
    })
    expect(id).not.toBeNull()
    const list = selectFloor(useFloorplanStore.getState())!.furniture
    expect(list).toHaveLength(1)
    expect(list[0]!.position).toEqual([1000, 2000])
    expect(list[0]!.rotation).toBe(0)
  })

  it('未知の catalogId は弾く', () => {
    const id = useFloorplanStore.getState().addFurniture({
      catalogId: 'unknown-thing',
      position: [0, 0],
    })
    expect(id).toBeNull()
    expect(selectFloor(useFloorplanStore.getState())!.furniture).toHaveLength(0)
  })

  it('moveFurniture / rotateFurniture で更新できる', () => {
    const id = useFloorplanStore.getState().addFurniture({
      catalogId: 'sofa-standard',
      position: [0, 0],
    })!
    useFloorplanStore.getState().moveFurniture(id, [500, 700])
    useFloorplanStore.getState().rotateFurniture(id, Math.PI / 2)
    const fi = selectFloor(useFloorplanStore.getState())!.furniture[0]!
    expect(fi.position).toEqual([500, 700])
    expect(fi.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('removeFurniture で消える', () => {
    const id = useFloorplanStore.getState().addFurniture({
      catalogId: 'sofa-standard',
      position: [0, 0],
    })!
    useFloorplanStore.getState().removeFurniture(id)
    expect(selectFloor(useFloorplanStore.getState())!.furniture).toHaveLength(0)
  })

  it('autoFurnishAllRooms はリビングに 3 つの既定家具を入れる', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 4000, 3500) })
    const added = state.autoFurnishAllRooms()
    expect(added).toBeGreaterThanOrEqual(3)
    const list = selectFloor(useFloorplanStore.getState())!.furniture
    expect(list.map((f) => f.catalogId).sort()).toEqual(
      ['coffee-table', 'sofa-standard', 'tv-board'].sort(),
    )
  })

  it('autoFurnishAllRooms は idempotent (2 回呼んでも追加されない)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 4000, 3500) })
    state.autoFurnishAllRooms()
    const added2 = useFloorplanStore.getState().autoFurnishAllRooms()
    expect(added2).toBe(0)
  })

  it('部屋が小さすぎると家具は追加されない (寸法下限)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1500, 1500) })
    const added = state.autoFurnishAllRooms()
    expect(added).toBe(0)
  })
})
