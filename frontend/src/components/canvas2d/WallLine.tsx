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

  const style = STROKE_BY_TYPE[wall.wallType]
  const isSelected = selected?.kind === 'wall' && selected.id === wall.id
  // §M32: この壁が "ドラッグ中の部屋" に属していたら非表示 (Group 内の輪郭線で置き換わる)
  if (draggingRoomId != null && wall.sharedBy.includes(draggingRoomId)) {
    return null
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
        wall.from[0] * scale,
        wall.from[1] * scale,
        wall.to[0] * scale,
        wall.to[1] * scale,
      ]}
      stroke={isSelected ? '#3b82f6' : style.color}
      strokeWidth={isSelected ? style.widthPx + 2 : style.widthPx}
      lineCap="square"
      hitStrokeWidth={Math.max(12, style.widthPx + 8)}
      onClick={handleClick}
      onTap={handleClick}
      draggable={canResize}
      // ドラッグ軸を法線方向に固定 (壁の主軸方向は動かさない)
      {...(canResize && {
        dragBoundFunc: (pos: { x: number; y: number }) =>
          isVertical ? { x: pos.x, y: 0 } : { x: 0, y: pos.y },
        onDragEnd: (e: KonvaEventObject<DragEvent>) => {
          const lineNode = e.target
          const shift = isVertical ? lineNode.x() : lineNode.y()
          const offsetMm = Math.round(shift / scale)
          // 視覚オフセットを 0 に戻す (再生成された wall.from/to が正しい位置に来る)
          lineNode.position({ x: 0, y: 0 })
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

