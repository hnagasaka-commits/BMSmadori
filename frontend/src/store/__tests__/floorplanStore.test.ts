/**
 * TC-E: 移動・削除・回転の波及。
 *
 * floorplanStore のアクション経由で、壁の再生成・ドアの引き継ぎ・tombstone が
 * 一貫しているかを確認する。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectDoors,
  selectFloor,
  selectRooms,
  selectWalls,
  useFloorplanStore,
} from '@/store/floorplanStore'
import type { Shape } from '@/types'

function shape(x: number, y: number, w: number, h: number): Extract<Shape, { kind: 'rect' }> {
  return {
    kind: 'rect',
    x,
    y,
    w,
    h,
    edgeIds: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  }
}

beforeEach(() => {
  useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
})

describe('addRoom', () => {
  it('部屋を追加し、4 つの外周壁が生成される', () => {
    const ok = useFloorplanStore
      .getState()
      .addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    expect(ok).toBe(true)
    const walls = selectWalls(useFloorplanStore.getState())
    expect(walls).toHaveLength(4)
  })

  it('重なる位置への追加は拒否 (false)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const ok = state.addRoom({ presetId: 'bedroom', shape: shape(500, 0, 1000, 1000) })
    expect(ok).toBe(false)
    expect(selectRooms(useFloorplanStore.getState())).toHaveLength(1)
  })

  it('隣接した部屋を 2 つ追加すると共有壁が生まれ、自動ドアが 1 つ生成される (TC-C 連動)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'a',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    state.addRoom({
      id: 'b',
      presetId: 'bedroom',
      shape: shape(1000, 0, 1000, 1000),
    })
    const doors = selectDoors(useFloorplanStore.getState())
    expect(doors).toHaveLength(1)
    expect(doors[0]!.width).toBe(800)
  })
})

describe('moveRoom (TC-E: 移動の波及)', () => {
  it('部屋を平行移動しても壁の id が引き継がれる', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'r',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    const wallsBefore = selectWalls(useFloorplanStore.getState()).map((w) => w.id).sort()
    const ok = state.moveRoom('r', 500, 0)
    expect(ok).toBe(true)
    const wallsAfter = selectWalls(useFloorplanStore.getState()).map((w) => w.id).sort()
    expect(wallsAfter).toEqual(wallsBefore)
  })

  it('移動先で他部屋と重なるなら拒否', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'a',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    state.addRoom({
      id: 'b',
      presetId: 'bedroom',
      shape: shape(2000, 0, 1000, 1000),
    })
    const ok = state.moveRoom('b', -1500, 0) // a の上に重なる
    expect(ok).toBe(false)
    const floor = selectFloor(useFloorplanStore.getState())!
    const b = floor.rooms.find((r) => r.id === 'b')!
    expect(b.shape.kind).toBe('rect')
    if (b.shape.kind === 'rect') {
      expect(b.shape.x).toBe(2000) // 元位置のまま
    }
  })
})

describe('removeRoom + tombstone', () => {
  it('共有壁の自動ドアを手動で削除すると tombstone が登録され、再生成されない (TC-E: 削除の波及)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'a',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    state.addRoom({
      id: 'b',
      presetId: 'bedroom',
      shape: shape(1000, 0, 1000, 1000),
    })
    const door = selectDoors(useFloorplanStore.getState())[0]!
    state.removeDoor(door.id)
    // 手動削除されたので 0 件
    expect(selectDoors(useFloorplanStore.getState())).toHaveLength(0)

    // 何か別の編集 (部屋を平行移動) しても自動ドアは再生されない
    state.moveRoom('b', 0, 0) // no-op だが recomputeFloor が走る
    expect(selectDoors(useFloorplanStore.getState())).toHaveLength(0)
  })

  it('部屋を削除すると tombstone も消える (clean up)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'a',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    state.addRoom({
      id: 'b',
      presetId: 'bedroom',
      shape: shape(1000, 0, 1000, 1000),
    })
    const door = selectDoors(useFloorplanStore.getState())[0]!
    state.removeDoor(door.id)
    expect(selectFloor(useFloorplanStore.getState())!.suppressedAutoDoors).toHaveLength(1)

    state.removeRoom('b')
    expect(selectFloor(useFloorplanStore.getState())!.suppressedAutoDoors).toHaveLength(0)
  })
})

describe('rotateRoom (TC-E: 回転の波及)', () => {
  it('90° 倍数でない値も 90° 倍数に量子化される (Phase 1 制約)', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({
      id: 'r',
      presetId: 'living',
      shape: shape(0, 0, 1000, 1000),
    })
    state.rotateRoom('r', 47)
    const r = selectRooms(useFloorplanStore.getState()).find((x) => x.id === 'r')!
    expect(r.rotation).toBe(90)
  })

  it('90° の回転で他部屋と重なる場合は拒否', () => {
    const state = useFloorplanStore.getState()
    // a: 横長 2000x500、中心 (1000, 250)
    state.addRoom({
      id: 'a',
      presetId: 'living',
      shape: shape(0, 0, 2000, 500),
    })
    // b: a と隣接しないが、a を 90° 回転させると AABB { 750, -750, 1250, 1250 } に膨らみ b と重なる
    state.addRoom({
      id: 'b',
      presetId: 'bedroom',
      shape: shape(500, 700, 2000, 500),
    })
    const ok = state.rotateRoom('a', 90)
    expect(ok).toBe(false)
  })
})
