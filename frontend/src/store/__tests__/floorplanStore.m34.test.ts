/**
 * §M34 Phase 3: 共有壁ドラッグで両側の rect 部屋の shape を同時更新する。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
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

describe('moveSharedWall', () => {
  function setup2RoomsSharingVerticalWall(): { wallId: string; leftId: string; rightId: string } {
    // Room A: 4m × 3m at origin。Room B: 同じ寸法を右に並べる
    // 共有壁は x=4000 の垂直壁
    const s = useFloorplanStore.getState()
    s.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    s.addRoom({ presetId: 'bedroom', shape: rect(4000, 0, 4000, 3000) })
    const floor = selectFloor(useFloorplanStore.getState())!
    const sharedWall = floor.walls.find(
      (w) =>
        w.sharedBy.length === 2 &&
        Math.abs(w.from[0] - 4000) <= 1 &&
        Math.abs(w.to[0] - 4000) <= 1,
    )!
    return {
      wallId: sharedWall.id,
      leftId: floor.rooms[0]!.id,
      rightId: floor.rooms[1]!.id,
    }
  }

  it('共有壁を右にずらすと左の部屋が広がり右の部屋が縮む', () => {
    const { wallId, leftId, rightId } = setup2RoomsSharingVerticalWall()
    const ok = useFloorplanStore.getState().moveSharedWall(wallId, 1000)
    expect(ok).toBe(true)
    const floor = selectFloor(useFloorplanStore.getState())!
    const left = floor.rooms.find((r) => r.id === leftId)!
    const right = floor.rooms.find((r) => r.id === rightId)!
    if (left.shape.kind !== 'rect' || right.shape.kind !== 'rect') throw new Error()
    expect(left.shape.w).toBe(5000)
    expect(right.shape.x).toBe(5000)
    expect(right.shape.w).toBe(3000)
  })

  it('オフセット = 0 は no-op (false 返却)', () => {
    const { wallId } = setup2RoomsSharingVerticalWall()
    const ok = useFloorplanStore.getState().moveSharedWall(wallId, 0)
    expect(ok).toBe(false)
  })

  it('最小寸法 500mm を下回るオフセットは拒否', () => {
    const { wallId } = setup2RoomsSharingVerticalWall()
    // 右側部屋の幅 4000 → -3700 すると 300 になって 500 未満。拒否される
    const ok = useFloorplanStore.getState().moveSharedWall(wallId, 3700)
    expect(ok).toBe(false)
  })

  it('共有していない壁 (sharedBy=1) は拒否', () => {
    const s = useFloorplanStore.getState()
    s.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    const floor = selectFloor(useFloorplanStore.getState())!
    const outerWall = floor.walls.find((w) => w.sharedBy.length === 1)!
    const ok = useFloorplanStore.getState().moveSharedWall(outerWall.id, 1000)
    expect(ok).toBe(false)
  })

  it('水平な共有壁は Y 方向にだけ動く', () => {
    // Room A: 上、Room B: 下に並べて、共有壁は y=3000 の水平壁
    const s = useFloorplanStore.getState()
    s.addRoom({ presetId: 'living', shape: rect(0, 0, 4000, 3000) })
    s.addRoom({ presetId: 'bedroom', shape: rect(0, 3000, 4000, 3000) })
    const floor = selectFloor(useFloorplanStore.getState())!
    const sharedWall = floor.walls.find(
      (w) =>
        w.sharedBy.length === 2 &&
        Math.abs(w.from[1] - 3000) <= 1 &&
        Math.abs(w.to[1] - 3000) <= 1,
    )!
    const ok = useFloorplanStore.getState().moveSharedWall(sharedWall.id, 500)
    expect(ok).toBe(true)
    const after = selectFloor(useFloorplanStore.getState())!
    const top = after.rooms[0]!
    const bottom = after.rooms[1]!
    if (top.shape.kind !== 'rect' || bottom.shape.kind !== 'rect') throw new Error()
    expect(top.shape.h).toBe(3500)
    expect(bottom.shape.y).toBe(3500)
    expect(bottom.shape.h).toBe(2500)
  })
})
