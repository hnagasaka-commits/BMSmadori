/**
 * §5.7 ドアの 2D 描画 (M24)。
 *
 * 壁上の `positionRatio` の位置に、壁の方向ベクトルに沿った長さ `width` の開口を描く。
 * single-swing ドアは「開口線 + 90° 弧」の組み合わせで表現する (建築 2D 図記号)。
 *
 * 単位:
 *  - 入力 (Wall, Door) はすべて mm
 *  - 描画は wall.from / wall.to を mm 座標で取り、scale (mm→px) を掛ける
 *
 * クリックで選択 → PropertyPanel (Door は今のところは「削除」のみ)
 */
import { Arc, Group, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Door, Wall } from '@/types'
import { useEditorStore } from '@/store/editorStore'

type Props = {
  door: Door
  wall: Wall
  scale: number
}

export function DoorMark({ door, wall, scale }: Props) {
  const select = useEditorStore((s) => s.select)
  const selected = useEditorStore((s) => s.selected)
  const tool = useEditorStore((s) => s.tool)
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const draggingOffset = useEditorStore((s) => s.draggingOffset)
  const sharedWallPreview = useEditorStore((s) => s.sharedWallPreview)
  const interactive = tool === 'select'
  const isSelected = selected?.kind === 'door' && selected.id === door.id
  // §M41: 共有壁ドラッグ中、影響を受ける部屋の壁のドアは非表示
  if (sharedWallPreview.length > 0) {
    const ids = new Set(sharedWallPreview.map((p) => p.roomId))
    if (wall.sharedBy.some((id) => ids.has(id))) return null
  }
  // §M79 v0.15: ドラッグ中の部屋に属するドアは床/壁と一緒に動かす (旧 §M32 の非表示を廃止)
  const isFollowingDrag =
    draggingRoomId != null && wall.sharedBy.includes(draggingRoomId) && draggingOffset != null
  const dragDx = isFollowingDrag ? draggingOffset.dx : 0
  const dragDy = isFollowingDrag ? draggingOffset.dy : 0

  const [wx1, wy1] = wall.from
  const [wx2, wy2] = wall.to
  const x1 = wx1 + dragDx
  const y1 = wy1 + dragDy
  const x2 = wx2 + dragDx
  const y2 = wy2 + dragDy
  const wallDx = x2 - x1
  const wallDy = y2 - y1
  const wallLen = Math.hypot(wallDx, wallDy)
  if (wallLen < 1) return null

  // ドア中心 (mm)
  const cxMm = x1 + wallDx * door.positionRatio
  const cyMm = y1 + wallDy * door.positionRatio
  // 壁方向の単位ベクトル
  const ux = wallDx / wallLen
  const uy = wallDy / wallLen
  // ドア開口の半幅 (mm)
  const halfMm = door.width / 2
  // 開口の両端 (mm)
  const aMm = { x: cxMm - ux * halfMm, y: cyMm - uy * halfMm }
  const bMm = { x: cxMm + ux * halfMm, y: cyMm + uy * halfMm }

  // 弧の中心は開口の端 a 側 (single-swing は片開き)
  // 弧の半径 = door.width (90° 開けた時の扇形)
  const arcCenterMm = { x: aMm.x, y: aMm.y }
  // §M43: swingInward=true (既定 true 扱い) なら +Y 側に開く (Konva の時計回り 90°)
  //       swingInward=false なら -Y 側に開く (rotation を -90 してから 90° 弧で逆側に)
  const isInward = door.swingInward !== false
  const baseAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI
  const wallAngleDeg = isInward ? baseAngleDeg : baseAngleDeg - 90
  // 扉本体の方向ベクトル (法線)。inward → (-uy, +ux) / outward → (+uy, -ux)
  const panelNx = isInward ? -uy : uy
  const panelNy = isInward ? ux : -ux

  function handleClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!interactive) return
    select({ kind: 'door', id: door.id })
    e.cancelBubble = true
  }

  const stroke = isSelected ? '#3b82f6' : '#525252'
  const strokeWidth = isSelected ? 2.5 : 1.5

  return (
    <Group onClick={handleClick} onTap={handleClick} listening={interactive}>
      {/* 開口線 (壁を切り抜く線。実装上は壁の上に "白で消す" 細い帯ではなく、
          開口位置の上辺に細線を載せて識別) */}
      <Line
        points={[aMm.x * scale, aMm.y * scale, bMm.x * scale, bMm.y * scale]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        hitStrokeWidth={12}
      />
      {/* 開いた扉の弧 (90°)。Konva の Arc は時計回り。
          壁方向に対して右側に開く想定で 0° → +90° の弧を描く */}
      <Arc
        x={arcCenterMm.x * scale}
        y={arcCenterMm.y * scale}
        innerRadius={0}
        outerRadius={door.width * scale}
        angle={90}
        rotation={wallAngleDeg}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
      {/* 扉本体 (90° 開いた状態の直線)。swingInward により法線方向が反転 */}
      <Line
        points={[
          arcCenterMm.x * scale,
          arcCenterMm.y * scale,
          (arcCenterMm.x + panelNx * door.width) * scale,
          (arcCenterMm.y + panelNy * door.width) * scale,
        ]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    </Group>
  )
}
