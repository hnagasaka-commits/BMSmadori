/**
 * 部屋本体の描画 + ドラッグ。
 * - Phase 1: rect + 90° 回転のみ
 * - Phase 2 / M16: polygon もサポート (Konva.Line で fill close)
 *
 * 描画はワールド座標 (mm) を scale 倍して px に変換した上で、Group 単位で
 * ドラッグ追従させる。ドロップ位置はグリッドにスナップして moveRoom() を呼ぶ。
 */
import { useRef } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { Room } from '@/types'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import { polygonVertices, shapeAabb } from '@/core/geometry'

type Props = {
  room: Room
  /** mm → px の倍率 */
  scale: number
  /** グリッドサイズ (ドラッグ確定時にスナップ) */
  gridSize: number
}

export function RoomShape({ room, scale, gridSize }: Props) {
  const groupRef = useRef<Konva.Group>(null)
  const select = useEditorStore((s) => s.select)
  const selected = useEditorStore((s) => s.selected)
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const setDraggingRoomId = useEditorStore((s) => s.setDraggingRoomId)
  const moveRoom = useFloorplanStore((s) => s.moveRoom)

  if (room.shape.kind !== 'rect' && room.shape.kind !== 'polygon') return null

  const isSelected = selected?.kind === 'room' && selected.id === room.id
  const isDragging = draggingRoomId === room.id

  // Group 原点は shape の AABB minX/minY を採用 (rect は (x,y) と一致)
  const aabb = shapeAabb(room.shape, room.rotation)
  const originX = aabb.minX
  const originY = aabb.minY
  const labelText = room.customName ?? room.presetId

  function commonHandlers() {
    return {
      draggable: true,
      onClick: () => select({ kind: 'room', id: room.id }),
      onTap: () => select({ kind: 'room', id: room.id }),
      onDragStart: () => {
        // §M32: ドラッグ中はこの部屋の壁/窓/ドアを非表示にして、Group 内の Rect/Line 輪郭線だけが
        // 残るようにする (床と壁が一緒に動いて見える)
        setDraggingRoomId(room.id)
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const grp = e.target
        const dropX = grp.x() / scale
        const dropY = grp.y() / scale
        const snappedX = Math.round(dropX / gridSize) * gridSize
        const snappedY = Math.round(dropY / gridSize) * gridSize
        const dx = snappedX - originX
        const dy = snappedY - originY
        const ok = moveRoom(room.id, dx, dy)
        if (!ok) {
          grp.position({ x: originX * scale, y: originY * scale })
        } else {
          grp.position({ x: snappedX * scale, y: snappedY * scale })
        }
        setDraggingRoomId(null)
      },
    }
  }

  if (room.shape.kind === 'rect') {
    const { w, h } = room.shape
    return (
      <Group
        ref={groupRef}
        x={originX * scale}
        y={originY * scale}
        {...commonHandlers()}
      >
        <Rect
          width={w * scale}
          height={h * scale}
          fill={isSelected ? '#eff6ff' : '#ffffff'}
          // §M32: ドラッグ中は壁レイヤーが消えるので、Rect の stroke を本物の壁色に強める
          stroke={isDragging ? '#171717' : isSelected ? '#3b82f6' : '#a3a3a3'}
          strokeWidth={isDragging ? 4 : isSelected ? 2 : 1}
          rotation={room.rotation}
          offsetX={0}
          offsetY={0}
        />
        <Text text={labelText} fontSize={12} fill="#525252" x={8} y={8} listening={false} />
        <Text
          text={`${(w / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} m`}
          fontSize={10}
          fill="#737373"
          x={8}
          y={24}
          listening={false}
          fontFamily="JetBrains Mono, ui-monospace, monospace"
        />
      </Group>
    )
  }

  // polygon: 頂点をワールド座標で計算済み (rotation 適用後) → Group 原点を引いてローカル化
  const verts = polygonVertices(room.shape, room.rotation)
  const flatLocal: number[] = []
  for (const [vx, vy] of verts) {
    flatLocal.push((vx - originX) * scale, (vy - originY) * scale)
  }
  return (
    <Group
      ref={groupRef}
      x={originX * scale}
      y={originY * scale}
      {...commonHandlers()}
    >
      <Line
        points={flatLocal}
        closed
        fill={isSelected ? '#eff6ff' : '#ffffff'}
        stroke={isDragging ? '#171717' : isSelected ? '#3b82f6' : '#a3a3a3'}
        strokeWidth={isDragging ? 4 : isSelected ? 2 : 1}
      />
      <Text text={labelText} fontSize={12} fill="#525252" x={8} y={8} listening={false} />
    </Group>
  )
}
