/**
 * §3.5 ローカル保存 / オフライン対応。
 *
 * localforage (IndexedDB を優先) を使って Floorplan を保存・復元する。
 * 自動保存は floorplanStore の変更を debounce 1 秒で受けて書き戻す。
 *
 * 名前空間 / キー設計 (Phase 1):
 *   - storeName = "floorplan-planner"
 *   - "current"  : 編集中のプラン (autosave 対象)
 *   - 将来 "plans/{id}" でユーザーのプラン一覧を管理する (Phase 1 MVP では不要)
 */

import localforage from 'localforage'
import type { Floorplan } from '@/types'

const store = localforage.createInstance({
  name: 'floorplan-planner',
  storeName: 'floorplans',
  description: '間取りプランナー Phase 1 ローカル保存',
})

const KEY_CURRENT = 'current'
const PREFIX_PLAN = 'plans/'
const KEY_LAST_OPENED = 'last-opened-id'

export async function saveCurrent(plan: Floorplan): Promise<void> {
  await store.setItem(KEY_CURRENT, plan)
}

export async function loadCurrent(): Promise<Floorplan | null> {
  const value = await store.getItem<Floorplan>(KEY_CURRENT)
  return value ?? null
}

export async function clearCurrent(): Promise<void> {
  await store.removeItem(KEY_CURRENT)
}

// ---------------------------------------------------------------------------
// §11 Phase 3 / M22: 複数プラン管理 (プラットフォーム画面)
// ---------------------------------------------------------------------------

export type StoredPlanRecord = {
  id: string
  plan: Floorplan
}

export type PlanSummary = {
  id: string
  name: string
  buildingType: string
  updatedAt: string
  roomCount: number
  /** floors のサムネ用に最初の階の部屋数を出す程度。Phase 3 では本格サムネ画像は持たない */
  floorCount: number
}

/** プラン本体を `plans/{id}` キーで保存。autosave 用の `current` も同期更新 */
export async function savePlan(id: string, plan: Floorplan): Promise<void> {
  await store.setItem<StoredPlanRecord>(PREFIX_PLAN + id, { id, plan })
  await store.setItem(KEY_LAST_OPENED, id)
  await store.setItem(KEY_CURRENT, plan)
}

export async function loadPlanById(id: string): Promise<Floorplan | null> {
  const rec = await store.getItem<StoredPlanRecord>(PREFIX_PLAN + id)
  return rec?.plan ?? null
}

export async function deletePlan(id: string): Promise<void> {
  await store.removeItem(PREFIX_PLAN + id)
  const last = await store.getItem<string>(KEY_LAST_OPENED)
  if (last === id) await store.removeItem(KEY_LAST_OPENED)
}

export async function listPlanSummaries(): Promise<PlanSummary[]> {
  const summaries: PlanSummary[] = []
  await store.iterate<unknown, void>((value, key) => {
    if (!key.startsWith(PREFIX_PLAN)) return
    const rec = value as StoredPlanRecord
    if (rec?.plan == null) return
    summaries.push({
      id: rec.id,
      name: rec.plan.metadata?.name ?? '(無題)',
      buildingType: rec.plan.metadata?.buildingType ?? 'single-family',
      updatedAt: rec.plan.metadata?.updatedAt ?? '',
      roomCount: rec.plan.floors?.[0]?.rooms?.length ?? 0,
      floorCount: rec.plan.floors?.length ?? 0,
    })
  })
  // 更新日時 (ISO 文字列なので辞書順 = 時系列) で降順
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

export async function getLastOpenedPlanId(): Promise<string | null> {
  return (await store.getItem<string>(KEY_LAST_OPENED)) ?? null
}

export async function setLastOpenedPlanId(id: string): Promise<void> {
  await store.setItem(KEY_LAST_OPENED, id)
}

/**
 * テスト用に独自インスタンスを差し替えるためのフック。
 * Vitest では jsdom の IndexedDB 実装が不完全なため localforage が memory driver にフォールバックする。
 * 動作確認の範囲では問題ないが、本格テストはアプリ層のロジックを直接呼ぶ単体テストで賄う。
 */
export const _storageInstance = store
