/**
 * §M28 Phase 3: フリーハンド描画のライブプレビュー。
 *
 * editorStore.drawing.points は raw ドラッグパス (軸並行化されていない)。
 * ここでは生のポリラインを薄い破線で描き、最初の点に開始マーカーを置く。
 * リリース時に Canvas2D 側で simplifyFreehandPath → addRoom が走る。
 *
 * 単位: 入力は mm (ストアの座標)。レイヤー全体に scale 倍率を掛けて px に。
 */
import { Circle, Line } from 'react-konva'
import { useEditorStore } from '@/store/editorStore'

type Props = {
  scale: number
}

export function DrawingPreview({ scale }: Props) {
  const drawing = useEditorStore((s) => s.drawing)
  if (drawing == null || drawing.points.length === 0) return null

  // すべての raw 点を 1 本のポリラインに
  const flat: number[] = []
  for (const [x, y] of drawing.points) {
    flat.push(x * scale, y * scale)
  }

  const start = drawing.points[0]!

  return (
    <>
      <Line
        points={flat}
        stroke="#3b82f6"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        // フリーハンドは細かい点が多いので Konva の bezier 平滑化で滑らかに
        tension={0.3}
        listening={false}
      />
      <Circle
        x={start[0] * scale}
        y={start[1] * scale}
        radius={5}
        stroke="#3b82f6"
        strokeWidth={2}
        fill="white"
        listening={false}
      />
    </>
  )
}
