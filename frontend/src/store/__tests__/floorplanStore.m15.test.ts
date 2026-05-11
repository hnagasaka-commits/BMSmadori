/**
 * §11 Phase 2 / M15: サッシ規格カタログと applyWindowSash の §5.8.3 「展開保存」テスト。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import { getSashEntry, listSashCatalog } from '@/data/sashCatalog'
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

describe('サッシカタログ', () => {
  it('カタログは 1 件以上を返す', () => {
    expect(listSashCatalog().length).toBeGreaterThan(0)
  })

  it('既知の id で取得できる', () => {
    expect(getSashEntry('h11-w17')).not.toBeNull()
    expect(getSashEntry('h11-w17')!.width).toBe(1700)
    expect(getSashEntry('h11-w17')!.height).toBe(1170)
  })

  it('未知の id では null', () => {
    expect(getSashEntry('not-real')).toBeNull()
  })
})

describe('applyWindowSash (§5.8.3 展開保存)', () => {
  function setupWindow(): { winId: string } {
    const state = useFloorplanStore.getState()
    state.addRoom({
      presetId: 'living',
      shape: shape(0, 0, 4550, 3640),
    })
    const wallId = selectFloor(useFloorplanStore.getState())!.walls[0]!.id
    const winId = state.addWindow({
      wallId,
      positionRatio: 0.5,
      width: 800,
      height: 800,
      type: 'fixed',
      sillHeight: 1000,
    })!
    return { winId }
  }

  it('サッシ規格を選ぶと width/height/type/sillHeight を全部書き換える', () => {
    const { winId } = setupWindow()
    const ok = useFloorplanStore.getState().applyWindowSash(winId, 'h22-w17')
    expect(ok).toBe(true)
    const win = selectFloor(useFloorplanStore.getState())!.windows[0]!
    expect(win.sashId).toBe('h22-w17')
    expect(win.width).toBe(1700)
    expect(win.height).toBe(2230)
    expect(win.type).toBe('sliding-2')
    expect(win.sillHeight).toBe(0)
  })

  it('未知の sashId なら false で何も書き換えない', () => {
    const { winId } = setupWindow()
    const before = selectFloor(useFloorplanStore.getState())!.windows[0]!
    const ok = useFloorplanStore.getState().applyWindowSash(winId, 'not-real')
    expect(ok).toBe(false)
    const after = selectFloor(useFloorplanStore.getState())!.windows[0]!
    expect(after.width).toBe(before.width)
    expect(after.sashId).toBeUndefined()
  })

  it('展開保存後、updateWindow で width のみ変えても sashId は保持される (将来の変更検知用)', () => {
    const { winId } = setupWindow()
    useFloorplanStore.getState().applyWindowSash(winId, 'h11-w17')
    useFloorplanStore.getState().updateWindow(winId, { width: 1900 })
    const win = selectFloor(useFloorplanStore.getState())!.windows[0]!
    expect(win.width).toBe(1900)
    // §5.8.3: 寸法を後で書き換えても sashId は履歴として残す
    expect(win.sashId).toBe('h11-w17')
  })
})
