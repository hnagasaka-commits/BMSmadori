/**
 * §M25 Phase 3 → §M122 v0.29: 家具 / BMS 設備の 2D 描画。
 *
 * catalogId は (a) 既存家具カタログ (sofa, bed, …) または (b) 設備マスター
 * (`public/equipment-master.json` の 137 種) のいずれか。
 * 設備マスター由来の場合は spec.shape / spec.symbol / categoryColors / placementColors を
 * 使って慣習的なシンボル表記で描く。
 *
 * - 形状: spec.shape (rect/square/circle) → Konva.Rect / Konva.Circle
 * - 塗り = カテゴリ色 / 枠 = 配置面色 / 中央 = symbol テキスト
 * - 実寸 (width × depth) でレンダリング
 * - 配置面フィルタ (`equipmentMasterStore.placementFilter`) が OFF の placement は
 *   opacity 0.3 で半透明化 (= 表示はする、操作はしない)
 * - layerMode (床/天井) は room/wall 背景の調光用に残し、設備マークは常に描く
 */
import { useRef } from 'react'
import { Circle, Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { FurnitureInstance } from '@/types'
import { furnitureScale3 } from '@/types'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import { useEquipmentMasterStore } from '@/store/equipmentMasterStore'

type Props = {
  furniture: FurnitureInstance
  scale: number
  gridSize: number
}

export function FurnitureMark({ furniture, scale, gridSize }: Props) {
  const groupRef = useRef<Konva.Group>(null)
  const select = useEditorStore((s) => s.select)
  const selected = useEditorStore((s) => s.selected)
  const tool = useEditorStore((s) => s.tool)
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture)
  const interactive = tool === 'select'

  // §M122 v0.29: spec 優先 / 既存家具カタログ fallback
  const spec = useEquipmentMasterStore((s) => s.byId.get(furniture.catalogId))
  const categoryColors = useEquipmentMasterStore((s) => s.categoryColors)
  const placementColors = useEquipmentMasterStore((s) => s.placementColors)
  const placementFilter = useEquipmentMasterStore((s) => s.placementFilter)
  const entry = spec == null ? getCatalogEntry(furniture.catalogId) : undefined
  if (spec == null && entry == null) return null

  const mountTo = furniture.mountTo ?? 'floor'
  const visible = placementFilter[mountTo] !== false
  const opacity = visible ? 1 : 0.3

  const isSelected = selected?.kind === 'furniture' && selected.id === furniture.id
  const sc3 = furnitureScale3(furniture.scale)
  const cx = furniture.position[0]
  const cy = furniture.position[1]

  // ---- 描画パラメータの解決 (spec 優先) ----
  let w: number
  let h: number
  let fillColor: string
  let strokeColor: string
  let label: string
  let symbol: string | null = null
  let isCircle = false
  if (spec != null) {
    w = spec.width * sc3[0]
    h = spec.depth * sc3[2]
    fillColor = categoryColors[spec.category]?.color ?? '#cccccc'
    strokeColor = placementColors[spec.placement] ?? '#888'
    label = spec.name
    symbol = spec.symbol
    isCircle = spec.shape === 'circle'
  } else if (entry != null) {
    const bbox = pieceAabbXZ(entry.pieces)
    if (bbox == null) return null
    w = (bbox.maxX - bbox.minX) * sc3[0]
    h = (bbox.maxZ - bbox.minZ) * sc3[2]
    fillColor = mountTo === 'ceiling' ? 'rgba(34,197,94,0.10)' : 'rgba(0,0,0,0.05)'
    strokeColor = mountTo === 'ceiling' ? '#16a34a' : '#6b7280'
    label = entry.displayName
  } else {
    return null
  }

  // ラベル + スケール表記
  const scLabel =
    Math.abs(sc3[0] - 1) < 0.01 && Math.abs(sc3[1] - 1) < 0.01 && Math.abs(sc3[2] - 1) < 0.01
      ? ''
      : ` (×${sc3[0].toFixed(2)}/${sc3[1].toFixed(2)}/${sc3[2].toFixed(2)})`

  const halfW = w / 2
  const halfH = h / 2

  return (
    <Group
      ref={groupRef}
      x={cx * scale}
      y={cy * scale}
      rotation={(furniture.rotation * 180) / Math.PI}
      opacity={opacity}
      draggable={interactive && visible}
      listening={interactive && visible}
      onClick={(e) => {
        if (!interactive) return
        select({ kind: 'furniture', id: furniture.id })
        e.cancelBubble = true
      }}
      onTap={(e) => {
        if (!interactive) return
        select({ kind: 'furniture', id: furniture.id })
        e.cancelBubble = true
      }}
      onDragEnd={(e) => {
        const grp = e.target
        const dropX = Math.round(grp.x() / scale)
        const dropY = Math.round(grp.y() / scale)
        moveFurniture(furniture.id, [dropX, dropY])
        grp.position({ x: dropX * scale, y: dropY * scale })
        void gridSize
      }}
    >
      {isCircle ? (
        <Circle
          x={0}
          y={0}
          radius={(Math.max(w, h) / 2) * scale}
          fill={fillColor}
          stroke={isSelected ? '#3b82f6' : strokeColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
      ) : (
        <Rect
          x={-halfW * scale}
          y={-halfH * scale}
          width={w * scale}
          height={h * scale}
          fill={fillColor}
          stroke={isSelected ? '#3b82f6' : strokeColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
      )}
      {symbol != null && symbol.length > 0 && (
        <Text
          text={symbol}
          x={-halfW * scale}
          y={-halfH * scale}
          width={w * scale}
          height={h * scale}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(8, Math.min(halfW, halfH) * scale * 0.6)}
          fontStyle="bold"
          fill={contrastTextColor(fillColor)}
          listening={false}
        />
      )}
      {/* 設備名ラベル (枠外の上) */}
      <Text
        text={label + scLabel}
        fontSize={9}
        fill="#374151"
        x={-halfW * scale}
        y={-halfH * scale - 11}
        listening={false}
      />
    </Group>
  )
}

function pieceAabbXZ(
  pieces: ReadonlyArray<{
    position: readonly [number, number, number]
    size: readonly [number, number, number]
  }>,
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (pieces.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of pieces) {
    const [px, , pz] = p.position
    const [sx, , sz] = p.size
    minX = Math.min(minX, px - sx / 2)
    maxX = Math.max(maxX, px + sx / 2)
    minZ = Math.min(minZ, pz - sz / 2)
    maxZ = Math.max(maxZ, pz + sz / 2)
  }
  return { minX, maxX, minZ, maxZ }
}

function contrastTextColor(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})/.exec(hex)
  if (m == null) return '#111'
  const v = m[1]!
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#111' : '#fff'
}
