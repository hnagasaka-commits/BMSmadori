/**
 * 壁の描画。種別ごとに線色・太さを変える (§14.3)。
 * tool === 'select' のときはクリックで選択、tool === 'window' のときは窓を配置する。
 */
import { Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Wall } from '@/types'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'

const STROKE_BY_TYPE: Record<Wall['wallType'], { color: string; widthPx: number }> = {
  exterior: { color: '#171717', widthPx: 4 },
  'load-bearing': { color: '#525252', widthPx: 4 },
  shared: { color: '#737373', widthPx: 4 },
  partition: { color: '#a3a3a3', widthPx: 2 },
  'non-bearing': { color: '#d4d4d4', widthPx: 2 },
}

type Props = {
  wall: Wall
  scale: number
}

export function WallLine({ wall, scale }: Props) {
  const tool = useEditorStore((s) => s.tool)
  const select = useEditorStore((s) => s.select)
  const setTool = useEditorStore((s) => s.setTool)
  const selected = useEditorStore((s) => s.selected)
  const addWindow = useFloorplanStore((s) => s.addWindow)
  const addDoor = useFloorplanStore((s) => s.addDoor)
  const moveSharedWall = useFloorplanStore((s) => s.moveSharedWall)
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const draggingOffset = useEditorStore((s) => s.draggingOffset)
  const setSharedWallPreview = useEditorStore((s) => s.setSharedWallPreview)
  const sharedWallPreview = useEditorStore((s) => s.sharedWallPreview)

  const style = STROKE_BY_TYPE[wall.wallType]
  const isSelected = selected?.kind === 'wall' && selected.id === wall.id
  // §M79 v0.15: ドラッグ中の部屋に属する壁は、非表示にせず Room の draggingOffset (mm)
  // と同じ量だけ平行移動して描画する。これで「床と壁が一緒に動く」見た目になる。
  // (旧 §M32: return null による非表示。バルコニーでは壁だけ消えるのが不自然だった)
  const isFollowingDrag =
    draggingRoomId != null && wall.sharedBy.includes(draggingRoomId) && draggingOffset != null
  const dragDx = isFollowingDrag ? draggingOffset.dx : 0
  const dragDy = isFollowingDrag ? draggingOffset.dy : 0
  // §M41: 共有壁ドラッグ中、影響を受ける 2 部屋の他の壁を非表示。
  // ドラッグ中の壁本体 (sharedBy セットがプレビューと完全一致) は表示し続ける (Konva drag で線が動いている)
  if (sharedWallPreview.length > 0) {
    const previewIds = new Set(sharedWallPreview.map((p) => p.roomId))
    const affects = wall.sharedBy.some((id) => previewIds.has(id))
    if (affects) {
      const wallIds = new Set(wall.sharedBy)
      const sameSet =
        wallIds.size === previewIds.size && [...wallIds].every((id) => previewIds.has(id))
      if (!sameSet) return null
    }
  }

  /**
   * §M35: クリック点を壁 (from→to) のベクトルに正射影して positionRatio (0..1) を返す。
   * - 壁外をクリックしても 0..1 にクランプ
   * - 開口幅 (defaultW) が壁長を超えそうな場合は端から +halfW で内側に詰める
   */
  function clickToPositionRatio(
    e: KonvaEventObject<MouseEvent | TouchEvent>,
    defaultWmm: number,
  ): number {
    const stage = e.target.getStage()
    if (stage == null) return 0.5
    const ptr = stage.getRelativePointerPosition()
    if (ptr == null) return 0.5
    const worldX = ptr.x / scale
    const worldY = ptr.y / scale
    const dx = wall.to[0] - wall.from[0]
    const dy = wall.to[1] - wall.from[1]
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return 0.5
    const t =
      ((worldX - wall.from[0]) * dx + (worldY - wall.from[1]) * dy) / len2
    const wallLen = Math.sqrt(len2)
    // 開口が壁の端からはみ出さないようクランプ
    const half = defaultWmm / 2
    const minT = wallLen > 0 ? Math.min(0.5, half / wallLen) : 0
    const maxT = 1 - minT
    return Math.max(minT, Math.min(maxT, t))
  }

  function handleClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (tool === 'window') {
      const winId = addWindow({
        wallId: wall.id,
        positionRatio: clickToPositionRatio(e, 1690),
      })
      if (winId != null) {
        select({ kind: 'window', id: winId })
        setTool('select')
      }
      e.cancelBubble = true
      return
    }
    if (tool === 'door') {
      // §M35: クリック点に近い位置にドアを置く
      const dId = addDoor({
        wallId: wall.id,
        positionRatio: clickToPositionRatio(e, 800),
      })
      if (dId != null) {
        select({ kind: 'door', id: dId })
        setTool('select')
      }
      e.cancelBubble = true
      return
    }
    // §M54 v0.7: select ツール以外では壁を選択しない (壁ツール/描画ツール時の誤選択を防ぐ)
    if (tool !== 'select') return
    select({ kind: 'wall', id: wall.id })
    e.cancelBubble = true
  }

  // §M34: 共有壁 (sharedBy=2 つ) は select ツール時にドラッグ移動可能
  const isShared = wall.sharedBy.length === 2
  const canResize = isShared && tool === 'select' && !wall.isLocked
  const dxRaw = wall.to[0] - wall.from[0]
  const dyRaw = wall.to[1] - wall.from[1]
  const isVertical = Math.abs(dyRaw) > Math.abs(dxRaw)
  const resizeCursor = isVertical ? 'ew-resize' : 'ns-resize'

  return (
    <Line
      points={[
        (wall.from[0] + dragDx) * scale,
        (wall.from[1] + dragDy) * scale,
        (wall.to[0] + dragDx) * scale,
        (wall.to[1] + dragDy) * scale,
      ]}
      stroke={isSelected ? '#3b82f6' : style.color}
      strokeWidth={isSelected ? style.widthPx + 2 : style.widthPx}
      lineCap="square"
      hitStrokeWidth={Math.max(12, style.widthPx + 8)}
      onClick={handleClick}
      onTap={handleClick}
      // §M79 v0.15: ドラッグ追従中は壁のリサイズドラッグを無効化する (二重ドラッグ防止)
      draggable={canResize && !isFollowingDrag}
      // ドラッグ軸を法線方向に固定 (壁の主軸方向は動かさない)
      {...(canResize && {
        dragBoundFunc: (pos: { x: number; y: number }) =>
          isVertical ? { x: pos.x, y: 0 } : { x: 0, y: pos.y },
        onDragMove: (e: KonvaEventObject<DragEvent>) => {
          // §M41: ドラッグ中は両側の rect 部屋の新 AABB を sharedWallPreview に publish する
          const lineNode = e.target
          const shift = isVertical ? lineNode.x() : lineNode.y()
          const offsetMm = Math.round(shift / scale)
          const fp = useFloorplanStore.getState()
          const floor = fp.floorplan.floors[fp.activeFloorIndex]
          if (floor == null) return
          const preview: Array<{ roomId: string; x: number; y: number; w: number; h: number }> = []
          for (const roomId of wall.sharedBy) {
            const room = floor.rooms.find((r) => r.id === roomId)
            if (room == null || room.shape.kind !== 'rect') {
              setSharedWallPreview([])
              return
            }
            const { x, y, w, h } = room.shape
            if (isVertical) {
              const wallX = wall.from[0]
              if (Math.abs(x - wallX) <= 1) {
                preview.push({ roomId, x: x + offsetMm, y, w: w - offsetMm, h })
              } else if (Math.abs(x + w - wallX) <= 1) {
                preview.push({ roomId, x, y, w: w + offsetMm, h })
              }
            } else {
              const wallY = wall.from[1]
              if (Math.abs(y - wallY) <= 1) {
                preview.push({ roomId, x, y: y + offsetMm, w, h: h - offsetMm })
              } else if (Math.abs(y + h - wallY) <= 1) {
                preview.push({ roomId, x, y, w, h: h + offsetMm })
              }
            }
          }
          setSharedWallPreview(preview)
        },
        onDragEnd: (e: KonvaEventObject<DragEvent>) => {
          const lineNode = e.target
          const shift = isVertical ? lineNode.x() : lineNode.y()
          const offsetMm = Math.round(shift / scale)
          // 視覚オフセットを 0 に戻す (再生成された wall.from/to が正しい位置に来る)
          lineNode.position({ x: 0, y: 0 })
          setSharedWallPreview([])
          if (offsetMm === 0) return
          moveSharedWall(wall.id, offsetMm)
        },
      })}
      onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage()
        if (stage == null) return
        const container: HTMLDivElement | null = stage.container() as unknown as HTMLDivElement | null
        if (container != null) {
          if (tool === 'window' || tool === 'door') container.style.cursor = 'crosshair'
          else if (canResize) container.style.cursor = resizeCursor
          else container.style.cursor = 'pointer'
        }
      }}
      onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage()
        if (stage == null) return
        const container: HTMLDivElement | null = stage.container() as unknown as HTMLDivElement | null
        if (container != null) container.style.cursor = ''
      }}
    />
  )
}

