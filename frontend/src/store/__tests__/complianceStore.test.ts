/**
 * complianceStore の ack / visibleWarnings / debounce 動作。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ackWarning,
  unackWarning,
  useComplianceStore,
  visibleWarnings,
} from '@/store/complianceStore'
import {
  createEmptyFloorplan,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import type { ComplianceWarning } from '@/types'

const sampleWarning = (id: string, severity: 'warning' | 'info' = 'warning'): ComplianceWarning => ({
  id,
  severity,
  category: 'lighting',
  message: 'test',
  rule: 'test',
  affectedRoomIds: ['r1'],
})

beforeEach(() => {
  useFloorplanStore.setState({ floorplan: createEmptyFloorplan() })
  useHistoryStore.setState({ past: [], future: [] })
  useComplianceStore.setState({ warnings: [], filterMode: 'all', lastEvaluatedAt: null })
})

describe('visibleWarnings', () => {
  const warnings = [
    sampleWarning('a', 'warning'),
    sampleWarning('b', 'info'),
    sampleWarning('c', 'warning'),
  ]

  it('mode = all かつ ack なし: すべて表示', () => {
    expect(visibleWarnings(warnings, [], 'all')).toHaveLength(3)
  })

  it('mode = warning-only: info を除外', () => {
    const v = visibleWarnings(warnings, [], 'warning-only')
    expect(v).toHaveLength(2)
    expect(v.every((w) => w.severity === 'warning')).toBe(true)
  })

  it('mode = none: 全部非表示', () => {
    expect(visibleWarnings(warnings, [], 'none')).toHaveLength(0)
  })

  it('ack 済みは all モードでも非表示', () => {
    expect(visibleWarnings(warnings, ['a'], 'all').map((w) => w.id)).toEqual(['b', 'c'])
  })
})

describe('ackWarning / unackWarning', () => {
  it('ack で metadata.acknowledgedWarnings に追加される', () => {
    ackWarning('warn-1')
    const acked = useFloorplanStore.getState().floorplan.metadata.acknowledgedWarnings
    expect(acked).toContain('warn-1')
  })

  it('同じ ID を 2 回 ack しても重複追加されない', () => {
    ackWarning('warn-1')
    ackWarning('warn-1')
    const acked = useFloorplanStore.getState().floorplan.metadata.acknowledgedWarnings ?? []
    expect(acked.filter((id) => id === 'warn-1')).toHaveLength(1)
  })

  it('unack で削除される', () => {
    ackWarning('warn-1')
    unackWarning('warn-1')
    const acked = useFloorplanStore.getState().floorplan.metadata.acknowledgedWarnings ?? []
    expect(acked).not.toContain('warn-1')
  })
})

describe('runNow / schedule (debounce)', () => {
  it('runNow は同期で警告を再計算する', () => {
    useComplianceStore.getState().runNow()
    expect(useComplianceStore.getState().lastEvaluatedAt).not.toBeNull()
  })

  it('schedule は 300ms 後に評価される (フェイクタイマー)', () => {
    vi.useFakeTimers()
    try {
      useComplianceStore.getState().schedule()
      // すぐには更新されない
      expect(useComplianceStore.getState().lastEvaluatedAt).toBeNull()
      vi.advanceTimersByTime(310)
      expect(useComplianceStore.getState().lastEvaluatedAt).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancel で予約中の評価をキャンセル', () => {
    vi.useFakeTimers()
    try {
      useComplianceStore.getState().schedule()
      useComplianceStore.getState().cancel()
      vi.advanceTimersByTime(400)
      expect(useComplianceStore.getState().lastEvaluatedAt).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
