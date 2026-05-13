/**
 * §M122 v0.29: ビルメンテナンス設備マスター (`public/equipment-master.json`) の型。
 *
 * 既存の `FurnitureCatalogEntry` (リビング/寝室など住宅向け) とは別軸の **点検対象設備**
 * カタログ。137 種類が JSON で同梱され、起動時に fetch して `equipmentMasterStore` に
 * 積む。配置時は `FurnitureInstance` を再利用 (catalogId = EquipmentSpec.id) し、3D / 2D
 * 描画では catalogId が equipment-master 由来かどうかを判定して spec から描画情報を引く。
 *
 * Placement (5 面) は `FurnitureMount` と同型 (= ceiling / floor / wall / roof / outdoor)。
 */

import type { FurnitureMount } from './floorplan'

export type EquipmentPlacement = FurnitureMount

/** 7 大カテゴリ。色は equipment-master.json の `metadata.categoryColors` から取得 */
export type EquipmentCategory = 'E' | 'P' | 'A' | 'G' | 'S' | 'K' | 'B'

/** 2D / 3D の代表形状 */
export type EquipmentShape = 'rect' | 'square' | 'circle' | 'line'

export type EquipmentSpec = {
  id: string
  name: string
  category: EquipmentCategory
  placement: EquipmentPlacement
  shape: EquipmentShape
  /** mm */
  width: number
  /** mm */
  depth: number
  /** mm (3D 高さ。床/天井からの取付高は placement で決まる) */
  height: number
  /** 2D マークの中央に描く短いシンボル (例: "◇", "DL", "送水") */
  symbol: string
}

export type EquipmentMasterFile = {
  metadata: {
    version: string
    unit: 'mm'
    categoryColors: Record<EquipmentCategory, { name: string; color: string }>
    placementColors: Record<EquipmentPlacement, string>
  }
  equipment: EquipmentSpec[]
}
