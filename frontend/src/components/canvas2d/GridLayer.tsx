/**
 * §M31 Phase 3: 「無限スクロール風」のグリッド。
 *
 * Stage の pan / zoom と canvas サイズから *いま見えているワールド範囲* を計算し、
 * その内側にだけグリッド線を描く。パン/ズームに追随して常にビュー全面を埋める。
 *
 * 線の太さ:
 *  - 細線 (gridSize): 薄いグレー
 *  - 太線 (5×gridSize 毎、ふた間ごと相当): やや濃いグレー
 *  - ワールド原点軸 (x=0, y=0): アクセント色 (薄い青)
 *    → 「原点 = 間取りの中心スタート位置」をユーザーに視覚提示する
 */
import { Layer, Line } from 'react-konva'

type Props = {
  /** Canvas の現在の表示サイズ (px) */
  canvasSize: { w: number; h: number }
  /** Stage の pan (px) */
  pan: { x: number; y: number }
  /** mm → px の倍率 */
  scale: number
  /** グリッド間隔 (mm) */
  gridSize: number
}

const MINOR_COLOR = '#eef0f2'
const MAJOR_COLOR = '#d4d4d8'
const AXIS_COLOR = '#a5b4fc'

export function GridLayer({ canvasSize, pan, scale, gridSize }: Props) {
  if (canvasSize.w <= 0 || canvasSize.h <= 0 || scale <= 0 || gridSize <= 0) {
    return <Layer listening={false} />
  }

  // 表示中のワールド範囲 (mm)。pan は px、scale は mm→px。
  // screen = pan + world * scale  →  world = (screen - pan) / scale
  const margin = gridSize // 少し外まで描いてパン時のチラツキを防ぐ
  const worldMinX = (0 - pan.x) / scale - margin
  const worldMaxX = (canvasSize.w - pan.x) / scale + margin
  const worldMinY = (0 - pan.y) / scale - margin
  const worldMaxY = (canvasSize.h - pan.y) / scale + margin

  const firstX = Math.floor(worldMinX / gridSize) * gridSize
  const lastX = Math.ceil(worldMaxX / gridSize) * gridSize
  const firstY = Math.floor(worldMinY / gridSize) * gridSize
  const lastY = Math.ceil(worldMaxY / gridSize) * gridSize

  // パフォーマンス: ズームアウトしすぎて線が多すぎる場合は間引く
  const maxLines = 400
  const approxLines =
    (lastX - firstX) / gridSize + (lastY - firstY) / gridSize
  const step =
    approxLines > maxLines
      ? Math.ceil(approxLines / maxLines) * gridSize
      : gridSize

  const lines: React.JSX.Element[] = []
  for (let x = firstX; x <= lastX; x += step) {
    const isAxis = x === 0
    const isMajor = Math.round(x / gridSize) % 5 === 0
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x * scale, worldMinY * scale, x * scale, worldMaxY * scale]}
        stroke={isAxis ? AXIS_COLOR : isMajor ? MAJOR_COLOR : MINOR_COLOR}
        strokeWidth={isAxis ? 1.5 : 1}
        listening={false}
      />,
    )
  }
  for (let y = firstY; y <= lastY; y += step) {
    const isAxis = y === 0
    const isMajor = Math.round(y / gridSize) % 5 === 0
    lines.push(
      <Line
        key={`h-${y}`}
        points={[worldMinX * scale, y * scale, worldMaxX * scale, y * scale]}
        stroke={isAxis ? AXIS_COLOR : isMajor ? MAJOR_COLOR : MINOR_COLOR}
        strokeWidth={isAxis ? 1.5 : 1}
        listening={false}
      />,
    )
  }
  return <Layer listening={false}>{lines}</Layer>
}
