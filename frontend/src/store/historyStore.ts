/**
 * アンドゥ / リドゥ用の履歴 (Zustand)。
 *
 * floorplanStore とは独立した薄い箱として実装:
 *   - past / future にスナップショットを積む
 *   - 「floorplan を変更する前に push」を floorplanStore のアクション側で呼ぶ
 *   - undo / redo は src/store/history.ts で両ストアを横断して操作する
 *
 * `past` / `future` には Floorplan オブジェクト全体を入れる。Phase 1 では Floor が 1 つだけで
 * 規模も小さいため、構造差分ではなく丸ごとスナップショットで十分。
 */

import { create } from 'zustand'
import type { Floorplan } from '@/types'

/** アンドゥ履歴の上限 (古いものから切り捨て) */
export const HISTORY_LIMIT = 50

export type HistoryState = {
  past: Floorplan[]
  future: Floorplan[]
  /** 新しい変更前にスナップショットを積む。future はクリアされる。 */
  push: (snapshot: Floorplan) => void
  /** ファイル読込やリセット時に呼ぶ。past / future ともクリア */
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  past: [],
  future: [],
  push: (snapshot) =>
    set((s) => ({
      past:
        s.past.length >= HISTORY_LIMIT
          ? [...s.past.slice(1), snapshot]
          : [...s.past, snapshot],
      future: [],
    })),
  clear: () => set({ past: [], future: [] }),
}))

export const selectCanUndo = (s: HistoryState): boolean => s.past.length > 0
export const selectCanRedo = (s: HistoryState): boolean => s.future.length > 0
