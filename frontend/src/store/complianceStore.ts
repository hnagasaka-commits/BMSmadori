/**
 * §6.6.1 警告系の debounce + ack 機構。
 *
 * - 警告は floorplan の変更を debounce 300ms で受けて再計算する
 * - 構造警告 (削除直後) は debounce バイパスで即時 → §5.2 onDeleteWall 等が `runLegalChecksNow()` を呼ぶ
 * - ack 機構: `Floorplan.metadata.acknowledgedWarnings` に保存。表示は非 ack のみ
 * - フィルタモード: all / warning-only / none
 */

import { create } from 'zustand'
import { debounce, type DebouncedFunc } from 'lodash'
import type { ComplianceWarning } from '@/types'
import { runLegalChecks } from '@/core/compliance'
import { useFloorplanStore } from './floorplanStore'

export type ComplianceFilterMode = 'all' | 'warning-only' | 'none'

export type ComplianceStoreState = {
  warnings: ComplianceWarning[]
  filterMode: ComplianceFilterMode
  /** debounce 後の最終計算開始時刻。デバッグや UI 表示用 */
  lastEvaluatedAt: string | null

  setFilterMode: (mode: ComplianceFilterMode) => void

  /** 同期で再計算 (debounce バイパス、§6.6.1 構造警告) */
  runNow: () => void
  /** debounce で再計算 (300ms 後) */
  schedule: () => void
  /** debounce 用 cancel */
  cancel: () => void
}

let _debounced: DebouncedFunc<() => void> | null = null

export const DEFAULT_COMPLIANCE_DEBOUNCE_MS = 300

export const useComplianceStore = create<ComplianceStoreState>((set) => {
  function evaluate() {
    const floorplan = useFloorplanStore.getState().floorplan
    const warnings = runLegalChecks(floorplan)
    set({ warnings, lastEvaluatedAt: new Date().toISOString() })
  }

  _debounced = debounce(evaluate, DEFAULT_COMPLIANCE_DEBOUNCE_MS)

  return {
    warnings: [],
    filterMode: 'all',
    lastEvaluatedAt: null,

    setFilterMode: (mode) => set({ filterMode: mode }),

    runNow: () => {
      _debounced?.cancel()
      evaluate()
    },
    schedule: () => {
      _debounced?.()
    },
    cancel: () => {
      _debounced?.cancel()
    },
  }
})

// ============================================================================
// セレクタ / 操作ヘルパー
// ============================================================================

/** §5.9 §6.6.5 ack 済みをフィルタした「表示すべき警告」 */
export function visibleWarnings(
  warnings: readonly ComplianceWarning[],
  acked: readonly string[],
  mode: ComplianceFilterMode,
): ComplianceWarning[] {
  if (mode === 'none') return []
  const ackedSet = new Set(acked)
  return warnings.filter((w) => {
    if (ackedSet.has(w.id)) return false
    if (mode === 'warning-only' && w.severity === 'info') return false
    return true
  })
}

/**
 * 警告を ack する。`Floorplan.metadata.acknowledgedWarnings` に追加し履歴を更新する。
 */
export function ackWarning(warningId: string): void {
  const floorplan = useFloorplanStore.getState().floorplan
  const current = floorplan.metadata.acknowledgedWarnings ?? []
  if (current.includes(warningId)) return
  useFloorplanStore.getState().updateMetadata({
    acknowledgedWarnings: [...current, warningId],
  })
}

/** ack 取り消し */
export function unackWarning(warningId: string): void {
  const floorplan = useFloorplanStore.getState().floorplan
  const current = floorplan.metadata.acknowledgedWarnings ?? []
  if (!current.includes(warningId)) return
  useFloorplanStore.getState().updateMetadata({
    acknowledgedWarnings: current.filter((id) => id !== warningId),
  })
}
