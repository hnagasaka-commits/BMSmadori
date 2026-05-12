/**
 * 壁上の窓を 2D で描画する (簡易記号)。
 * 壁の中心線に沿って width 分の二重線を引き、両端に小さなマーカーを置く。
 * 種類別の細かい記号化は §17.2 PDF 出力で対応するため、画面上はミニマルに。
 */
import { Group, Line, Rect } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Wall, Window } from '@/types'
import { useEditorStore } from '@/store/editorStore'

type Props = {
  window: Window
  wall: Wall
  scale: number
}

export function WindowMark({ window: win, wall, scale }: Props) {
  const select = useEditorStore((s) => s.select)
  const selected = useEditorStore((s) => s.selected)
  const tool = useEditorStore((s) => s.tool)
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const draggingOffset = useEditorStore((s) => s.draggingOffset)
  const sharedWallPreview = useEditorStore((s) => s.sharedWallPreview)
  const interactive = tool === 'select'
  const isSelected = selected?.kind === 'window' && selected.id === win.id
  // §M41: 共有壁ドラッグ中、影響を受ける部屋の壁の窓は非表示
  if (sharedWallPreview.length > 0) {
    const ids = new Set(sharedWallPreview.map((p) => p.roomId))
    if (wall.sharedBy.some((id) => ids.has(id))) return null
  }
  // §M79 v0.15: ドラッグ中の部屋に属する窓は床/壁と一緒に動かす (旧 §M32 の非表示を廃止)
  const isFollowingDrag =
    draggingRoomId != null && wall.sharedBy.includes(draggingRoomId) && draggingOffset != null
  const dragDx = isFollowingDrag ? draggingOffset.dx : 0
  const dragDy = isFollowingDrag ? draggingOffset.dy : 0

  // 壁の方向ベクトル (ワールド mm)
  const dx = wall.to[0] - wall.from[0]
  const dy = wall.to[1] - wall.from[1]
  const wallLen = Math.hypot(dx, dy)
  if (wallLen === 0) return null
  const ux = dx / wallLen
  const uy = dy / wallLen
  // 法線方向 (左手系で 90° 回転)
  const nx = -uy
  const ny = ux

  // 窓の中心点 (ワールド mm)。ドラッグ追従中はオフセットを足す
  const cx = wall.from[0] + dragDx + ux * (win.positionRatio * wallLen)
  const cy = wall.from[1] + dragDy + uy * (win.positionRatio * wallLen)

  // 壁上の幅
  const halfW = win.width / 2
  const startX = cx - ux * halfW
  const startY = cy - uy * halfW
  const endX = cx + ux * halfW
  const endY = cy + uy * halfW

  // 法線方向にわずかにオフセットして二重線を作る (描画上の見栄え)
  const offsetMm = 60
  const off = offsetMm
  const leftStart: [number, number] = [startX + nx * off, startY + ny * off]
  const leftEnd: [number, number] = [endX + nx * off, endY + ny * off]
  const rightStart: [number, number] = [startX - nx * off, startY - ny * off]
  const rightEnd: [number, number] = [endX - nx * off, endY - ny * off]

  function handleClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!interactive) return
    select({ kind: 'window', id: win.id })
    e.cancelBubble = true
  }

  const color = isSelected ? '#3b82f6' : '#525252'
  const widthPx = isSelected ? 2 : 1

  return (
    <Group onClick={handleClick} onTap={handleClick} listening={interactive}>
      {/* 二重線 */}
      <Line
        points={[leftStart[0] * scale, leftStart[1] * scale, leftEnd[0] * scale, leftEnd[1] * scale]}
        stroke={color}
        strokeWidth={widthPx}
      />
      <Line
        points={[rightStart[0] * scale, rightStart[1] * scale, rightEnd[0] * scale, rightEnd[1] * scale]}
        stroke={color}
        strokeWidth={widthPx}
      />
      {/* §M57 v0.8: ヒット領域 (透明矩形)。
          以前は y に `(cy - halfW)` (窓幅の半分) を入れていたため、ヒット領域が窓の中心から
          数百 mm 上にずれてクリック不能だった。y = cy * scale に修正し、offsetY で中央寄せ。
          高さも余裕を持って ±100mm (= offsetMm*3.3) に広げて選択しやすく */}
      <Rect
        x={cx * scale}
        y={cy * scale}
        width={win.width * scale}
        height={Math.max(16, offsetMm * 3.3 * scale)}
        offsetX={halfW * scale}
        offsetY={(offsetMm * 3.3 * scale) / 2}
        rotation={(Math.atan2(uy, ux) * 180) / Math.PI}
        fill="rgba(0,0,0,0.001)"
      />
    </Group>
  )
}
