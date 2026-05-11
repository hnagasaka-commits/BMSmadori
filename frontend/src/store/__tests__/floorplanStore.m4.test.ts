/**
 * M4 で追加された Wall / Window / Metadata 系アクションのテスト。
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
    edgeIds: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
  }
}

beforeEach(() => {
  useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('updateWall', () => {
  it('壁の wallType / isLocked を更新できる', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    state.updateWall(wallId, { wallType: 'exterior', isLocked: true })
    const wall = selectFloor(useFloorplanStore.getState())!.walls.find((w) => w.id === wallId)!
    expect(wall.wallType).toBe('exterior')
    expect(wall.isLocked).toBe(true)
  })

  it('変更がなければ履歴に積まない', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    const before = useHistoryStore.getState().past.length
    state.updateWall(wallId, { wallType: 'partition' }) // 既定と同じ
    expect(useHistoryStore.getState().past.length).toBe(before)
  })
})

describe('addWindow / updateWindow / removeWindow', () => {
  it('既定 1690x1170 の引違い 2 枚を生成し、Floor.windows に追加される', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    const winId = state.addWindow({ wallId })
    expect(winId).not.toBeNull()
    const win = selectFloor(useFloorplanStore.getState())!.windows[0]!
    expect(win.width).toBe(1690)
    expect(win.height).toBe(1170)
    expect(win.type).toBe('sliding-2')
    expect(win.positionRatio).toBe(0.5)
  })

  it('updateWindow: positionRatio は 0〜1 にクランプ', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    const winId = state.addWindow({ wallId })!
    state.updateWindow(winId, { positionRatio: 1.5 })
    expect(selectFloor(useFloorplanStore.getState())!.windows[0]!.positionRatio).toBe(1)
    state.updateWindow(winId, { positionRatio: -0.5 })
    expect(selectFloor(useFloorplanStore.getState())!.windows[0]!.positionRatio).toBe(0)
  })

  it('removeWindow で削除される', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 1000, 1000) })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    const winId = state.addWindow({ wallId })!
    state.removeWindow(winId)
    expect(selectFloor(useFloorplanStore.getState())!.windows).toHaveLength(0)
  })

  it('存在しない wallId への addWindow は null', () => {
    const state = useFloorplanStore.getState()
    expect(state.addWindow({ wallId: 'ghost' })).toBeNull()
  })
})

describe('updateMetadata', () => {
  it('北方位を更新できる', () => {
    const state = useFloorplanStore.getState()
    state.updateMetadata({ orientation: 90 })
    expect(useFloorplanStore.getState().floorplan.metadata.orientation).toBe(90)
  })

  it('updatedAt は updateMetadata 呼び出しごとに上書きされる (ISO 文字列)', () => {
    const state = useFloorplanStore.getState()
    state.updateMetadata({ orientation: 45 })
    const after = useFloorplanStore.getState().floorplan.metadata.updatedAt
    // 同 ms で実行されると before == after になりうるので、形式だけ検証
    expect(after).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
