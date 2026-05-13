/**
 * §M122 v0.29: 設備マスター (`public/equipment-master.json`) を起動時に fetch して
 * Zustand に保持する。配置面フィルタの ON/OFF 状態もここに置く (UI 横断で参照)。
 *
 * 既存の `furnitureCatalog` (住宅家具) とは別カタログ。配置 instance は両方とも
 * `FurnitureInstance` を使うので、描画側は `getEquipmentSpec(catalogId)` を優先し、
 * 該当しなければ従来の `getCatalogEntry(catalogId)` にフォールバックする。
 */

import { create } from 'zustand'
import type {
  EquipmentCategory,
  EquipmentMasterFile,
  EquipmentPlacement,
  EquipmentSpec,
} from '@/types/equipment'

const DEFAULT_PLACEMENT_COLORS: Record<EquipmentPlacement, string> = {
  ceiling: '#5DADE2',
  floor: '#58D68D',
  wall: '#F5B041',
  roof: '#AF7AC5',
  outdoor: '#85929E',
}

const DEFAULT_CATEGORY_COLORS: Record<EquipmentCategory, { name: string; color: string }> = {
  E: { name: '電気', color: '#FFD700' },
  P: { name: '給排水・衛生', color: '#1E90FF' },
  A: { name: '空調・換気', color: '#32CD32' },
  G: { name: 'ガス系消火', color: '#FF8C00' },
  S: { name: '消火', color: '#E60000' },
  K: { name: '火災報知・防排煙', color: '#FF69B4' },
  B: { name: '防災・避難', color: '#9370DB' },
}

type EquipmentMasterState = {
  /** 読み込み状態 (起動時のローダーフラグ) */
  loaded: boolean
  loadError: string | null
  /** id → spec のインデックス。重複 id は後勝ち (実データに重複は無い前提) */
  byId: Map<string, EquipmentSpec>
  list: EquipmentSpec[]
  categoryColors: Record<EquipmentCategory, { name: string; color: string }>
  placementColors: Record<EquipmentPlacement, string>
  /**
   * §M123 v0.29: 配置面フィルタ。OFF にした面の設備は 2D で半透明化、3D は非表示。
   * 既定は全 ON (= すべて表示)。
   */
  placementFilter: Record<EquipmentPlacement, boolean>

  load: (file: EquipmentMasterFile) => void
  loadFailed: (reason: string) => void
  setPlacementVisible: (placement: EquipmentPlacement, visible: boolean) => void
}

export const useEquipmentMasterStore = create<EquipmentMasterState>((set) => ({
  loaded: false,
  loadError: null,
  byId: new Map(),
  list: [],
  categoryColors: DEFAULT_CATEGORY_COLORS,
  placementColors: DEFAULT_PLACEMENT_COLORS,
  placementFilter: {
    ceiling: true,
    floor: true,
    wall: true,
    roof: true,
    outdoor: true,
  },

  load: (file) => {
    const byId = new Map<string, EquipmentSpec>()
    for (const e of file.equipment) byId.set(e.id, e)
    set({
      loaded: true,
      loadError: null,
      byId,
      list: file.equipment,
      categoryColors: { ...DEFAULT_CATEGORY_COLORS, ...file.metadata.categoryColors },
      placementColors: { ...DEFAULT_PLACEMENT_COLORS, ...file.metadata.placementColors },
    })
  },

  loadFailed: (reason) => set({ loaded: true, loadError: reason }),

  setPlacementVisible: (placement, visible) =>
    set((s) => ({
      placementFilter: { ...s.placementFilter, [placement]: visible },
    })),
}))

// 同期的にも引きたい (Konva 内部から呼ぶことがあるので Hook 経由じゃない)
export function getEquipmentSpec(id: string): EquipmentSpec | undefined {
  return useEquipmentMasterStore.getState().byId.get(id)
}

/**
 * §M122 v0.29: 起動時に 1 回だけ呼ぶローダー。`fetch('/equipment-master.json')` で
 * public 配下から取得し、Zustand に積む。fetch 失敗時は loadFailed で UI 側にエラー伝播。
 *
 * テストでは fetch を mock すれば検証可能。jsdom 環境では `globalThis.fetch` が
 * undefined の場合があるので、その場合はサイレントに諦める (UI 側はカタログ空でも動く)。
 */
let inFlight: Promise<void> | null = null
export function ensureEquipmentMasterLoaded(): Promise<void> {
  const state = useEquipmentMasterStore.getState()
  if (state.loaded) return Promise.resolve()
  if (inFlight != null) return inFlight
  if (typeof fetch !== 'function') {
    state.loadFailed('fetch is not available in this environment')
    return Promise.resolve()
  }
  inFlight = fetch('/equipment-master.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<EquipmentMasterFile>
    })
    .then((file) => {
      useEquipmentMasterStore.getState().load(file)
    })
    .catch((err) => {
      useEquipmentMasterStore.getState().loadFailed(
        err instanceof Error ? err.message : String(err),
      )
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}
