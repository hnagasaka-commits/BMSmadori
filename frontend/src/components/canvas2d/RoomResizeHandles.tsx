/**
 * §M26 Phase 3: rect 部屋の 4 隅リサイズハンドル。
 *
 * 設計の意図:
 *  - 既存の RoomShape は Group 全体を draggable にしているので、
 *    "ハンドルだけドラッグ" を Group 内で実装すると競合する。
 *  - ハンドルは Canvas2D 側で「選択中の部屋に対してのみ」 RoomShape の外で重ねて描く。
 *  - ハンドル自体は世界座標 (mm) で配置するため、scale を掛けて px 配置する。
 *  - リアルタイム resize は描画コストが嵩むので onDragEnd でのみ store を更新する。
 *    ドラッグ中はハンドル位置がプレビューとして動くだけ (Konva の自然な挙動)。
 *
 * 制約 (PoC):
 *  - rect 部屋のみ対象 (polygon の頂点ハンドルは M27 で扱う)
 *  - rotation = 0/180 のときだけ AABB と shape が一致するため簡単。
 *    rotation=90/270 では shape.w/h と AABB が swap される → 回転中は handles 非表示にする
 *  - 最小寸法は 500mm。下回るときは resizeRoom が false を返すので元位置に戻る
 */
import { Rect } from 'react-konva'
import type Konva from 'konva'
import type { Room } from '@/types'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { polygonVertices } from '@/core/geometry'

const HANDLE_SIZE_PX = 10
const MIN_DIMENSION_MM = 500

type Anchor = 'nw' | 'ne' | 'sw' | 'se'

type Props = {
  room: Room
  scale: number
  gridSize: number
}

export function RoomResizeHandles({ room, scale, gridSize }: Props) {
  const resizeRoom = useFloorplanStore((s) => s.resizeRoom)
  const moveRoomVertex = useFloorplanStore((s) => s.moveRoomVertex)
  const setResizePreview = useEditorStore((s) => s.setResizePreview)
  const setDraggingRoomId = useEditorStore((s) => s.setDraggingRoomId)
  const resizePreview = useEditorStore((s) => s.resizePreview)

  // §M37: polygon 部屋は各頂点に独立した青ハンドルを描画 (1 hop 補正で軸並行を維持)
  if (room.shape.kind === 'polygon') {
    const verts = polygonVertices(room.shape, room.rotation)
    return (
      <>
        {verts.map((v, i) => (
          <Rect
            key={`poly-${i}`}
            x={v[0] * scale}
            y={v[1] * scale}
            width={HANDLE_SIZE_PX}
            height={HANDLE_SIZE_PX}
            offsetX={HANDLE_SIZE_PX / 2}
            offsetY={HANDLE_SIZE_PX / 2}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={1.5}
            draggable
            data-testid={`room-vertex-${i}`}
            onDragEnd={(e) => {
              const nx = Math.round(e.target.x() / scale / gridSize) * gridSize
              const ny = Math.round(e.target.y() / scale / gridSize) * gridSize
              const ok = moveRoomVertex(room.id, i, [nx, ny])
              if (!ok) e.target.position({ x: v[0] * scale, y: v[1] * scale })
            }}
            onMouseEnter={(e) => {
              const stage = e.target.getStage()
              if (stage != null) {
                const c = stage.container() as unknown as HTMLDivElement | null
                if (c != null) c.style.cursor = 'move'
              }
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage()
              if (stage != null) {
                const c = stage.container() as unknown as HTMLDivElement | null
                if (c != null) c.style.cursor = ''
              }
            }}
          />
        ))}
      </>
    )
  }

  if (room.shape.kind !== 'rect') return null
  // 回転が 0 / 180 のときのみ AABB = shape.{x,y,w,h} がそのまま使える
  const rot = ((Math.round(room.rotation / 90) % 4) + 4) % 4
  if (rot !== 0 && rot !== 2) return null

  // §M41: リサイズプレビューがあれば、他の 3 隅もそれに従ってリアルタイムに動かす
  const effectivePreview =
    resizePreview != null && resizePreview.roomId === room.id
      ? resizePreview
      : null
  const x = effectivePreview?.x ?? room.shape.x
  const y = effectivePreview?.y ?? room.shape.y
  const w = effectivePreview?.w ?? room.shape.w
  const h = effectivePreview?.h ?? room.shape.h

  const corners: { anchor: Anchor; cx: number; cy: number }[] = [
    { anchor: 'nw', cx: x, cy: y },
    { anchor: 'ne', cx: x + w, cy: y },
    { anchor: 'sw', cx: x, cy: y + h },
    { anchor: 'se', cx: x + w, cy: y + h },
  ]

  /**
   * §M41: ハンドル位置 (mm) と anchor から、新しい (x, y, w, h) を計算する純関数。
   * MIN_DIMENSION_MM へのクランプも含む。
   */
  function computeResize(
    rect: { x: number; y: number; w: number; h: number },
    anchor: Anchor,
    newCxMm: number,
    newCyMm: number,
  ) {
    let nx = rect.x
    let ny = rect.y
    let nw = rect.w
    let nh = rect.h
    switch (anchor) {
      case 'nw': {
        const dx = newCxMm - rect.x
        const dy = newCyMm - rect.y
        nx = newCxMm
        ny = newCyMm
        nw = rect.w - dx
        nh = rect.h - dy
        break
      }
      case 'ne': {
        const dy = newCyMm - rect.y
        ny = newCyMm
        nw = newCxMm - rect.x
        nh = rect.h - dy
        break
      }
      case 'sw': {
        const dx = newCxMm - rect.x
        nx = newCxMm
        nw = rect.w - dx
        nh = newCyMm - rect.y
        break
      }
      case 'se': {
        nw = newCxMm - rect.x
        nh = newCyMm - rect.y
        break
      }
    }
    if (nw < MIN_DIMENSION_MM) {
      if (anchor === 'nw' || anchor === 'sw') nx = rect.x + (rect.w - MIN_DIMENSION_MM)
      nw = MIN_DIMENSION_MM
    }
    if (nh < MIN_DIMENSION_MM) {
      if (anchor === 'nw' || anchor === 'ne') ny = rect.y + (rect.h - MIN_DIMENSION_MM)
      nh = MIN_DIMENSION_MM
    }
    return { x: nx, y: ny, w: nw, h: nh }
  }

  /**
   * §M41: ドラッグ中はライブプレビューを editorStore.resizePreview に出すだけ。
   * 壁と床は同じ preview を見て同時に描画 → ずれない。
   */
  function handleDragMove(anchor: Anchor) {
    return (e: Konva.KonvaEventObject<DragEvent>) => {
      if (room.shape.kind !== 'rect') return
      // ドラッグ中は連続なので grid スナップしない (1mm 精度)。M36 と同様、release で吸着させる
      const newCxMm = Math.round(e.target.x() / scale)
      const newCyMm = Math.round(e.target.y() / scale)
      const next = computeResize(room.shape, anchor, newCxMm, newCyMm)
      setResizePreview({ roomId: room.id, ...next })
    }
  }

  function handleDragStart() {
    // §M41: ドラッグ開始時に壁/窓/ドアを非表示にして preview と二重描画を避ける
    setDraggingRoomId(room.id)
  }

  function handleDragEnd(anchor: Anchor) {
    return (e: Konva.KonvaEventObject<DragEvent>) => {
      if (room.shape.kind !== 'rect') return
      const rect = room.shape
      // §M41: release は gridSize スナップに丸めて確定
      const newCxMm = Math.round(e.target.x() / scale / gridSize) * gridSize
      const newCyMm = Math.round(e.target.y() / scale / gridSize) * gridSize
      const next = computeResize(rect, anchor, newCxMm, newCyMm)
      const ok = resizeRoom(room.id, next)
      setResizePreview(null)
      setDraggingRoomId(null)
      if (!ok) {
        // 重なりなどで拒否 → ハンドルを元に戻す
        const original = corners.find((c) => c.anchor === anchor)!
        e.target.position({ x: original.cx * scale, y: original.cy * scale })
      }
    }
  }

  return (
    <>
      {corners.map((c) => (
        <Rect
          key={c.anchor}
          x={c.cx * scale}
          y={c.cy * scale}
          width={HANDLE_SIZE_PX}
          height={HANDLE_SIZE_PX}
          offsetX={HANDLE_SIZE_PX / 2}
          offsetY={HANDLE_SIZE_PX / 2}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          draggable
          data-testid={`room-handle-${c.anchor}`}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove(c.anchor)}
          onDragEnd={handleDragEnd(c.anchor)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage()
            const cur =
              c.anchor === 'nw' || c.anchor === 'se' ? 'nwse-resize' : 'nesw-resize'
            if (stage != null) {
              const container = stage.container() as unknown as HTMLDivElement | null
              if (container != null) container.style.cursor = cur
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage()
            if (stage != null) {
              const container = stage.container() as unknown as HTMLDivElement | null
              if (container != null) container.style.cursor = ''
            }
          }}
        />
      ))}
    </>
  )
}
