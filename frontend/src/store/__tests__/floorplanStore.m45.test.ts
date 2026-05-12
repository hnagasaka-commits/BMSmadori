/**
 * §M45 v0.4: polygon 部屋を moveRoom できることを検証。
 * v0.3 までの applyTranslation は polygon を no-op にしていたため
 * 「壁と床がずれる」事故になっていた。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import type { Shape } from '@/types'

beforeEach(() => {
  useFloorplanStore.setState({
    floorplan: createEmptyFloorplan(),
    activeFloorIndex: 0,
  })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('moveRoom — polygon (M45)', () => {
  it('polygon 部屋を dx/dy で平行移動できる', () => {
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
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: polygon })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id

    const ok = state.moveRoom(roomId, 500, 300)
    expect(ok).toBe(true)

    const after = selectFloor(useFloorplanStore.getState())!.rooms[0]!
    if (after.shape.kind !== 'polygon') throw new Error()
    expect(after.shape.points[0]).toEqual([500, 300])
    expect(after.shape.points[1]).toEqual([4500, 300])
    expect(after.shape.points[4]).toEqual([6500, 4300])
  })

  it('壁も平行移動後の頂点に合わせて再生成される', () => {
    const polygon: Extract<Shape, { kind: 'polygon' }> = {
      kind: 'polygon',
      points: [
        [0, 0],
        [3000, 0],
        [3000, 3000],
        [0, 3000],
      ],
      edgeIds: Array.from({ length: 4 }, () => crypto.randomUUID()),
    }
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: polygon })
    const roomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id
    state.moveRoom(roomId, 1000, 0)
    const after = selectFloor(useFloorplanStore.getState())!
    // どれか 1 つの壁が (1000, 0) 起点になっているか確認
    const hasMovedWall = after.walls.some(
      (w) =>
        (w.from[0] === 1000 && w.from[1] === 0) ||
        (w.to[0] === 1000 && w.to[1] === 0),
    )
    expect(hasMovedWall).toBe(true)
  })
})
