/**
 * §5.4 柱の 2D 描画。
 * - Phase 1.5 から有効
 * - Phase 3 / M20: クリックで選択 (PropertyPanel で loadBearing を編集)
 *
 * loadBearing=true の柱は通し柱整合 (§6.4.3) の対象になるため、UI で目立たせる:
 *   - 通常: 黒塗り
 *   - 耐力柱: 赤茶塗り + 細い枠
 *   - 選択中: アクセント枠 (青)
 */
import { Rect } from 'react-konva'
import type { Column } from '@/types'
import { useEditorStore } from '@/store/editorStore'

type Props = {
  column: Column
  scale: number
}

export function ColumnMark({ column, scale }: Props) {
  const select = useEditorStore((s) => s.select)
  const selected = useEditorStore((s) => s.selected)
  const tool = useEditorStore((s) => s.tool)
  const interactive = tool === 'select'
  const isSelected = selected?.kind === 'column' && selected.id === column.id

  const baseFill = column.loadBearing ? '#7c2d12' : '#171717'
  const strokeColor = isSelected
    ? '#3b82f6'
    : column.loadBearing
      ? '#f97316'
      : 'transparent'
  const strokeWidth = isSelected ? 2 : column.loadBearing ? 1 : 0

  return (
    <Rect
      x={(column.position[0] - column.size.w / 2) * scale}
      y={(column.position[1] - column.size.h / 2) * scale}
      width={column.size.w * scale}
      height={column.size.h * scale}
      fill={baseFill}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      listening={interactive}
      onClick={() => interactive && select({ kind: 'column', id: column.id })}
      onTap={() => interactive && select({ kind: 'column', id: column.id })}
    />
  )
}
