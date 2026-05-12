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
import { areaToDisplayUnits, polygonVertices, shapeAabb, shapeArea } from '@/core/geometry'
import { snapRoomDrop, type AabbMm } from '@/core/snap'
import { selectRooms } from '@/store/floorplanStore'

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
  const tool = useEditorStore((s) => s.tool)
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const setDraggingRoomId = useEditorStore((s) => s.setDraggingRoomId)
  const setDraggingOffset = useEditorStore((s) => s.setDraggingOffset)
  const resizePreview = useEditorStore((s) => s.resizePreview)
  const sharedWallPreview = useEditorStore((s) => s.sharedWallPreview)
  const moveRoom = useFloorplanStore((s) => s.moveRoom)
  const otherRooms = useFloorplanStore(selectRooms)

  if (room.shape.kind !== 'rect' && room.shape.kind !== 'polygon') return null

  const isSelected = selected?.kind === 'room' && selected.id === room.id
  const isDragging = draggingRoomId === room.id

  // Group 原点は shape の AABB minX/minY を採用 (rect は (x,y) と一致)
  const aabb = shapeAabb(room.shape, room.rotation)
  const originX = aabb.minX
  const originY = aabb.minY
  const labelText = room.customName ?? room.presetId

  // §M54 v0.7: select ツール以外では room を選択 / ドラッグさせない
  const interactive = tool === 'select'

  function commonHandlers() {
    return {
      draggable: interactive,
      onClick: () => {
        if (!interactive) return
        select({ kind: 'room', id: room.id })
      },
      onTap: () => {
        if (!interactive) return
        select({ kind: 'room', id: room.id })
      },
      onDragStart: () => {
        // §M32: ドラッグ中の部屋を draggingRoomId に記録。
        // §M79 v0.15: 旧仕様は壁を非表示にしていたが、バルコニーのように壁が
        // 剥き出しの外周だけの部屋では「壁が消えて床だけ動く」ように見えていた。
        // 代わりに draggingOffset を WallLine が読み取って一緒に動くようにする。
        setDraggingRoomId(room.id)
        setDraggingOffset({ dx: 0, dy: 0 })
      },
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
        const grp = e.target
        // 現在の Konva 位置から元位置までの mm 単位オフセット
        const dx = grp.x() / scale - originX
        const dy = grp.y() / scale - originY
        setDraggingOffset({ dx, dy })
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const grp = e.target
        const dropX = grp.x() / scale
        const dropY = grp.y() / scale
        // §M36 v0.3: 自由位置 + 角スナップ。dropX/dropY は新しい AABB minX/minY。
        const dropAabb: AabbMm = {
          minX: dropX,
          minY: dropY,
          maxX: dropX + (aabb.maxX - aabb.minX),
          maxY: dropY + (aabb.maxY - aabb.minY),
        }
        const otherAabbs: AabbMm[] = otherRooms
          .filter((r) => r.id !== room.id)
          .map((r) => {
            const a = shapeAabb(r.shape, r.rotation)
            return { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY }
          })
        const snap = snapRoomDrop(dropAabb, otherAabbs, gridSize)
        const dx = snap.minX - originX
        const dy = snap.minY - originY
        const ok = moveRoom(room.id, dx, dy)
        if (!ok) {
          grp.position({ x: originX * scale, y: originY * scale })
        } else {
          grp.position({ x: snap.minX * scale, y: snap.minY * scale })
        }
        setDraggingRoomId(null)
        setDraggingOffset(null)
      },
    }
  }

  if (room.shape.kind === 'rect') {
    // §M41: リサイズプレビュー中はそちらの寸法/位置を優先 (床と壁が同期して見える)
    const corner =
      resizePreview != null && resizePreview.roomId === room.id ? resizePreview : null
    const shared = sharedWallPreview.find((p) => p.roomId === room.id) ?? null
    const preview = corner ?? shared
    const dispX = preview?.x ?? room.shape.x
    const dispY = preview?.y ?? room.shape.y
    const w = preview?.w ?? room.shape.w
    const h = preview?.h ?? room.shape.h
    const isResizing = preview != null
    // §M84 v0.18: 床面積を 畳 / 坪 でラベル表示する
    const areaUnits = areaToDisplayUnits(w * h)
    return (
      <Group
        ref={groupRef}
        x={dispX * scale}
        y={dispY * scale}
        {...commonHandlers()}
      >
        <Rect
          width={w * scale}
          height={h * scale}
          fill={isSelected ? '#eff6ff' : '#ffffff'}
          // §M32 + M41: ドラッグ/リサイズ中は壁レイヤーが消えるので、Rect の stroke を本物の壁色に強める
          stroke={isDragging || isResizing ? '#171717' : isSelected ? '#3b82f6' : '#a3a3a3'}
          strokeWidth={isDragging || isResizing ? 4 : isSelected ? 2 : 1}
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
        <Text
          text={`${areaUnits.m2.toFixed(2)} ㎡ / ${areaUnits.tatami.toFixed(1)} 畳 / ${areaUnits.tsubo.toFixed(2)} 坪`}
          fontSize={10}
          fill="#737373"
          x={8}
          y={38}
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
  // §M84 v0.18: polygon でも床面積を表示
  const polyAreaUnits = areaToDisplayUnits(shapeArea(room.shape))
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
      <Text
        text={`${polyAreaUnits.m2.toFixed(2)} ㎡ / ${polyAreaUnits.tatami.toFixed(1)} 畳 / ${polyAreaUnits.tsubo.toFixed(2)} 坪`}
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
