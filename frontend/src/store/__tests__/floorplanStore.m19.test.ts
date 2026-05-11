/**
 * §11 Phase 3 / M19: 複数階対応のテスト。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  selectRooms,
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
  useFloorplanStore.setState({
    floorplan: createEmptyFloorplan(),
    activeFloorIndex: 0,
  })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('複数階アクション', () => {
  it('初期は 1F のみ、activeFloorIndex = 0', () => {
    const state = useFloorplanStore.getState()
    expect(state.floorplan.floors).toHaveLength(1)
    expect(state.activeFloorIndex).toBe(0)
  })

  it('addFloor で新階が追加され、activeFloorIndex が新階に移る', () => {
    const newIdx = useFloorplanStore.getState().addFloor()
    expect(newIdx).toBe(1)
    const state = useFloorplanStore.getState()
    expect(state.floorplan.floors).toHaveLength(2)
    expect(state.activeFloorIndex).toBe(1)
    expect(state.floorplan.floors[1]!.level).toBe(2)
    expect(state.floorplan.floors[1]!.name).toBe('2F')
  })

  it('addFloor は 3 階を超えると -1 を返す (Phase 3 上限)', () => {
    const s = useFloorplanStore.getState()
    s.addFloor()
    s.addFloor()
    // ここで 3 階 (1F, 2F, 3F)
    expect(useFloorplanStore.getState().floorplan.floors).toHaveLength(3)
    const newIdx = s.addFloor()
    expect(newIdx).toBe(-1)
    expect(useFloorplanStore.getState().floorplan.floors).toHaveLength(3)
  })

  it('copyFromIndex を指定すると部屋構造がコピーされる (id は再採番)', () => {
    const s = useFloorplanStore.getState()
    s.addRoom({ presetId: 'living', shape: shape(0, 0, 4000, 3000) })
    const beforeRoomId = selectFloor(useFloorplanStore.getState())!.rooms[0]!.id

    s.addFloor({ copyFromIndex: 0 })
    const after = useFloorplanStore.getState()
    expect(after.floorplan.floors).toHaveLength(2)
    const newFloor = after.floorplan.floors[1]!
    expect(newFloor.rooms).toHaveLength(1)
    // 同じ shape だが id は別
    expect(newFloor.rooms[0]!.id).not.toBe(beforeRoomId)
    expect(newFloor.rooms[0]!.presetId).toBe('living')
    // 壁も recompute で 4 本立っている
    expect(newFloor.walls.length).toBeGreaterThanOrEqual(4)
  })

  it('setActiveFloor で selectFloor / selectRooms が切り替わる', () => {
    const s = useFloorplanStore.getState()
    s.addRoom({ presetId: 'living', shape: shape(0, 0, 4000, 3000) })
    s.addFloor() // 空の 2F
    // 2F 選択中 → 部屋 0
    expect(selectRooms(useFloorplanStore.getState())).toHaveLength(0)
    s.setActiveFloor(0)
    expect(selectRooms(useFloorplanStore.getState())).toHaveLength(1)
  })

  it('removeFloor は 1 階しかなければ拒否、複数階なら削除可', () => {
    const s = useFloorplanStore.getState()
    expect(s.removeFloor(0)).toBe(false)
    s.addFloor()
    expect(useFloorplanStore.getState().floorplan.floors).toHaveLength(2)
    expect(s.removeFloor(1)).toBe(true)
    expect(useFloorplanStore.getState().floorplan.floors).toHaveLength(1)
    // activeFloorIndex は 0 に補正される
    expect(useFloorplanStore.getState().activeFloorIndex).toBe(0)
  })

  it('updateFloorMeta で名前や天井高を変更できる (ceilingHeight は 2000 でクランプ)', () => {
    const s = useFloorplanStore.getState()
    s.updateFloorMeta(0, { name: '1階LDK', ceilingHeight: 2700 })
    const f = useFloorplanStore.getState().floorplan.floors[0]!
    expect(f.name).toBe('1階LDK')
    expect(f.ceilingHeight).toBe(2700)

    // 2000 未満は 2000 にクランプ
    s.updateFloorMeta(0, { ceilingHeight: 1000 })
    expect(useFloorplanStore.getState().floorplan.floors[0]!.ceilingHeight).toBe(2000)
  })

  it('addRoom は activeFloor に対して動く (2F 選択中なら 2F に追加)', () => {
    const s = useFloorplanStore.getState()
    s.addFloor() // active=1
    s.addRoom({ presetId: 'living', shape: shape(0, 0, 3000, 2500) })
    const state = useFloorplanStore.getState()
    expect(state.floorplan.floors[0]!.rooms).toHaveLength(0)
    expect(state.floorplan.floors[1]!.rooms).toHaveLength(1)
  })
})
