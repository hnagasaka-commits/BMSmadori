/**
 * アンドゥ / リドゥの横断オペレーション。
 *
 * historyStore と floorplanStore の両方を読み書きするため、別ファイルに分離する
 * (両ストアが互いに import するとモジュール循環になるため)。
 */

import { useFloorplanStore } from './floorplanStore'
import { useHistoryStore } from './historyStore'

export function undo(): boolean {
  const h = useHistoryStore.getState()
  if (h.past.length === 0) return false
  const f = useFloorplanStore.getState()
  const prev = h.past[h.past.length - 1]!
  useHistoryStore.setState({
    past: h.past.slice(0, -1),
    future: [f.floorplan, ...h.future],
  })
  useFloorplanStore.setState({ floorplan: prev })
  return true
}

export function redo(): boolean {
  const h = useHistoryStore.getState()
  if (h.future.length === 0) return false
  const f = useFloorplanStore.getState()
  const next = h.future[0]!
  useHistoryStore.setState({
    past: [...h.past, f.floorplan],
    future: h.future.slice(1),
  })
  useFloorplanStore.setState({ floorplan: next })
  return true
}

/**
 * floorplanStore のアクション内から呼ぶ。
 * 現在の floorplan を履歴に積む (実際の変更はアクションが行う)。
 */
export function pushHistory(): void {
  const f = useFloorplanStore.getState()
  useHistoryStore.getState().push(f.floorplan)
}
