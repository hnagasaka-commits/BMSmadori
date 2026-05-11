/**
 * M6 で追加された I/O アクションのテスト (importJson / exportJson)。
 * saveLocal / loadLocal は jsdom IndexedDB の挙動に依存するため、ここでは省略
 * (Playwright + 実ブラウザでのスモークで担保)。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  createEmptyFloorplan,
  selectRooms,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import { TEMPLATE_CARDS } from '@/data/templates'

beforeEach(() => {
  useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('importJson / exportJson', () => {
  it('exportJson は JSON 文字列を返し再度パースできる', () => {
    const state = useFloorplanStore.getState()
    const json = state.exportJson()
    const parsed = JSON.parse(json)
    expect(parsed.metadata).toBeDefined()
    expect(parsed.floors).toHaveLength(1)
  })

  it('テンプレを export → importJson で同じプランが復元される', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    useFloorplanStore.setState({ floorplan: template })
    const json = useFloorplanStore.getState().exportJson()

    // 空にしてから import
    useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
    const result = useFloorplanStore.getState().importJson(json)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.mode).toBe('normal')

    const rooms = selectRooms(useFloorplanStore.getState())
    expect(rooms.length).toBe(template.floors[0]!.rooms.length)
  })

  it('壊れた JSON の importJson は失敗を返し state を変えない', () => {
    const beforePlan = useFloorplanStore.getState().floorplan
    const result = useFloorplanStore.getState().importJson('{ broken')
    expect(result.ok).toBe(false)
    expect(useFloorplanStore.getState().floorplan).toBe(beforePlan)
  })

  it('将来 version の JSON は readonly モードで返る', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    const future = JSON.stringify({ ...template, version: '99.0' })
    const result = useFloorplanStore.getState().importJson(future)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.mode).toBe('readonly')
  })

  it('import 成功時は履歴がクリアされる', () => {
    useHistoryStore.setState({ past: [createEmptyFloorplan()], future: [] })
    const template = TEMPLATE_CARDS[0]!.build()
    useFloorplanStore.getState().importJson(JSON.stringify(template))
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })
})
