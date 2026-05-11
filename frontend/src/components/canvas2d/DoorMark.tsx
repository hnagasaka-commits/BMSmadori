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
  const draggingRoomId = useEditorStore((s) => s.draggingRoomId)
  const isSelected = selected?.kind === 'door' && selected.id === door.id
  // §M32: ドラッグ中の部屋に属する壁のドアは非表示
  if (draggingRoomId != null && wall.sharedBy.includes(draggingRoomId)) return null

  const [x1, y1] = wall.from
  const [x2, y2] = wall.to
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
  // 弧の開始角は壁方向。終了は + 90° (法線方向)。
  const wallAngleDeg = (Math.atan2(uy, ux) * 180) / Math.PI

  function handleClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    select({ kind: 'door', id: door.id })
    e.cancelBubble = true
  }

  const stroke = isSelected ? '#3b82f6' : '#525252'
  const strokeWidth = isSelected ? 2.5 : 1.5

  return (
    <Group onClick={handleClick} onTap={handleClick}>
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
      {/* 扉本体 (90° 開いた状態の直線) */}
      <Line
        points={[
          arcCenterMm.x * scale,
          arcCenterMm.y * scale,
          (arcCenterMm.x + -uy * door.width) * scale,
          (arcCenterMm.y + ux * door.width) * scale,
        ]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    </Group>
  )
}
