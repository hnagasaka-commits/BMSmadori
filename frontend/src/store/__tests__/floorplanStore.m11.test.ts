/**
 * Phase 1.5 で追加されたストアアクションのテスト (Column / PipeSpace + 自動配置)。
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

describe('Column アクション', () => {
  it('addColumn で柱を 1 つ追加できる', () => {
    const id = useFloorplanStore.getState().addColumn({ position: [910, 910] })
    expect(id).not.toBeNull()
    const cols = selectFloor(useFloorplanStore.getState())!.columns
    expect(cols).toHaveLength(1)
    expect(cols[0]!.position).toEqual([910, 910])
  })

  it('removeColumn で削除', () => {
    const id = useFloorplanStore.getState().addColumn({ position: [0, 0] })!
    useFloorplanStore.getState().removeColumn(id)
    expect(selectFloor(useFloorplanStore.getState())!.columns).toHaveLength(0)
  })

  it('updateColumn で位置を変更できる', () => {
    const id = useFloorplanStore.getState().addColumn({ position: [0, 0] })!
    useFloorplanStore.getState().updateColumn(id, { position: [910, 1820] })
    const col = selectFloor(useFloorplanStore.getState())!.columns[0]!
    expect(col.position).toEqual([910, 1820])
  })

  it('generateColumnsByGrid で部屋 AABB に柱が並ぶ', () => {
    const state = useFloorplanStore.getState()
    state.addRoom({ presetId: 'living', shape: shape(0, 0, 3640, 2730) }) // 4×3 grid
    state.generateColumnsByGrid(910)
    const cols = selectFloor(useFloorplanStore.getState())!.columns
    // 0/910/1820/2730/3640 (5 cols) × 0/910/1820/2730 (4 rows) = 20
    expect(cols.length).toBe(20)
  })

  it('部屋がなければ generateColumnsByGrid は何もしない', () => {
    useFloorplanStore.getState().generateColumnsByGrid()
    expect(selectFloor(useFloorplanStore.getState())!.columns).toHaveLength(0)
  })
})

describe('PipeSpace アクション', () => {
  it('addPipeSpace 既定で給水・排水を持つ', () => {
    const id = useFloorplanStore.getState().addPipeSpace({ position: [0, 0] })
    expect(id).not.toBeNull()
    const ps = selectFloor(useFloorplanStore.getState())!.pipeSpaces[0]!
    expect(ps.systems).toContain('water-supply')
    expect(ps.systems).toContain('drainage')
  })

  it('updatePipeSpace で systems を変更できる', () => {
    const id = useFloorplanStore.getState().addPipeSpace({ position: [0, 0] })!
    useFloorplanStore.getState().updatePipeSpace(id, {
      systems: ['water-supply', 'drainage', 'vent', 'gas'],
    })
    const ps = selectFloor(useFloorplanStore.getState())!.pipeSpaces[0]!
    expect(ps.systems).toEqual(['water-supply', 'drainage', 'vent', 'gas'])
  })

  it('removePipeSpace で削除', () => {
    const id = useFloorplanStore.getState().addPipeSpace({ position: [0, 0] })!
    useFloorplanStore.getState().removePipeSpace(id)
    expect(selectFloor(useFloorplanStore.getState())!.pipeSpaces).toHaveLength(0)
  })
})
