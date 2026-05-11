/**
 * §5.5 PS の 2D 描画 (Phase 1.5 から有効)。
 * 青系の矩形 + "PS" ラベル。
 */
import { Group, Rect, Text } from 'react-konva'
import type { PipeSpace } from '@/types'

type Props = {
  pipeSpace: PipeSpace
  scale: number
}

export function PipeSpaceMark({ pipeSpace, scale }: Props) {
  const x = (pipeSpace.position[0] - pipeSpace.size.w / 2) * scale
  const y = (pipeSpace.position[1] - pipeSpace.size.h / 2) * scale
  return (
    <Group listening={false}>
      <Rect
        x={x}
        y={y}
        width={pipeSpace.size.w * scale}
        height={pipeSpace.size.h * scale}
        stroke="#2563eb"
        strokeWidth={2}
        fill="rgba(59, 130, 246, 0.15)"
      />
      <Text
        x={x}
        y={y}
        text="PS"
        fontSize={10}
        fontStyle="bold"
        fill="#2563eb"
        padding={4}
      />
    </Group>
  )
}
