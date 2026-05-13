/**
 * §M25 Phase 3: 家具の 2D 描画 + ドラッグ移動。
 *
 * - Floor.furniture[i] の position は (x, z) = (mm in plan X, mm in plan Y)。
 *   平面図と 3D で同じ座標を共有しているので、ここでは position[0] = X, position[1] = Y (plan view)。
 * - サイズは catalog の AABB をそのまま使う (rotation=0 を仮定)。
 *   90° 回転は Phase 3 後半 (M27 と並行) で扱う。
 * - クリックで選択 (PropertyPanel 連動)、ドラッグでグリッドスナップして moveFurniture を呼ぶ。
 */
import { useRef } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { FurnitureInstance } from '@/types'
import { furnitureScale3 } from '@/types'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import { getCatalogEntry } from '@/data/furnitureCatalog'

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
  const layerMode = useEditorStore((s) => s.layerMode)
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture)
  // §M54 v0.7: select ツール以外では家具を選択/ドラッグさせない
  const interactive = tool === 'select'

  const entry = getCatalogEntry(furniture.catalogId)
  if (entry == null) return null

  // §M119 v0.28: レイヤーモードで表示分岐
  //  - layerMode='floor':   mountTo='floor' のみ表示 (旧挙動)
  //  - layerMode='ceiling': mountTo='ceiling' のみ表示
  const mountTo = furniture.mountTo ?? 'floor'
  if (mountTo !== layerMode) return null

  const isSelected = selected?.kind === 'furniture' && selected.id === furniture.id
  const isCeilingItem = mountTo === 'ceiling'

  // 家具の代表サイズ = pieces の AABB を XZ 平面に投影
  const bbox = pieceAabbXZ(entry.pieces)
  if (bbox == null) return null
  // §M52 v0.6 / §M69 v0.12: 平面図は XZ 軸のみ反映 (Y は高さなので 2D には出さない)。
  // 拡大率は tuple (or number) のどちらでも受けるので、furnitureScale3 で正規化する。
  const sc3 = furnitureScale3(furniture.scale)
  const scX = sc3[0]
  const scZ = sc3[2]
  const w = (bbox.maxX - bbox.minX) * scX
  const h = (bbox.maxZ - bbox.minZ) * scZ
  const minX = bbox.minX * scX
  const minZ = bbox.minZ * scZ
  // ラベル表示用 (3 軸個別を 1 行で読める形式に。等倍なら省略)
  const scLabel =
    Math.abs(sc3[0] - 1) < 0.01 && Math.abs(sc3[1] - 1) < 0.01 && Math.abs(sc3[2] - 1) < 0.01
      ? ''
      : ` (×${sc3[0].toFixed(2)}/${sc3[1].toFixed(2)}/${sc3[2].toFixed(2)})`
  // 家具中心 (position) を Group の x/y にして、子の位置はローカル mm でレイアウト
  const cx = furniture.position[0]
  const cy = furniture.position[1]

  return (
    <Group
      ref={groupRef}
      x={cx * scale}
      y={cy * scale}
      rotation={(furniture.rotation * 180) / Math.PI}
      draggable={interactive}
      listening={interactive}
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
        // §M40 v0.3: グリッドスナップを廃止し、1mm 単位で確定 (家具は任意位置に置ける)
        const dropX = Math.round(grp.x() / scale)
        const dropY = Math.round(grp.y() / scale)
        moveFurniture(furniture.id, [dropX, dropY])
        grp.position({ x: dropX * scale, y: dropY * scale })
        void gridSize
      }}
    >
      {/* §M119 v0.28: 天井設備は「天井に投影された設備」の慣習に従い、
          角丸 + 対角クロスハッチ (✕) + 緑系の縁取りで描く。床設備は従来通り。 */}
      <Rect
        x={minX * scale}
        y={minZ * scale}
        width={w * scale}
        height={h * scale}
        cornerRadius={isCeilingItem ? 4 : 0}
        fill={
          isSelected
            ? 'rgba(59,130,246,0.10)'
            : isCeilingItem
              ? 'rgba(34,197,94,0.10)'
              : 'rgba(0,0,0,0.05)'
        }
        stroke={isSelected ? '#3b82f6' : isCeilingItem ? '#16a34a' : '#6b7280'}
        strokeWidth={isSelected ? 2 : 1}
        dash={isCeilingItem ? [4, 3] : [6, 4]}
      />
      {isCeilingItem && (
        <>
          {/* 対角クロスハッチ (✕) — 「天井設備」の慣習表記 */}
          <Line
            points={[minX * scale, minZ * scale, (minX + w) * scale, (minZ + h) * scale]}
            stroke={isSelected ? '#3b82f6' : '#16a34a'}
            strokeWidth={1}
            listening={false}
          />
          <Line
            points={[(minX + w) * scale, minZ * scale, minX * scale, (minZ + h) * scale]}
            stroke={isSelected ? '#3b82f6' : '#16a34a'}
            strokeWidth={1}
            listening={false}
          />
        </>
      )}
      <Text
        text={entry.displayName + scLabel}
        fontSize={10}
        fill={isCeilingItem ? '#166534' : '#525252'}
        x={minX * scale + 4}
        y={minZ * scale + 4}
        listening={false}
      />
      {/* 中央の十字 (家具中心) */}
      <Line
        points={[-50 * scale, 0, 50 * scale, 0]}
        stroke={isSelected ? '#3b82f6' : '#9ca3af'}
        strokeWidth={0.5}
        listening={false}
      />
      <Line
        points={[0, -50 * scale, 0, 50 * scale]}
        stroke={isSelected ? '#3b82f6' : '#9ca3af'}
        strokeWidth={0.5}
        listening={false}
      />
    </Group>
  )
}

/**
 * piece の position + size から XZ 平面の AABB を計算する。
 * 3D の Y 軸 (= 上方向) は 2D 表示には不要なので落とす。
 */
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
