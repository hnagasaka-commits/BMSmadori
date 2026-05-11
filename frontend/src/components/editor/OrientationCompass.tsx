/**
 * 方位インジケーター。Canvas の右上に SVG で表示する。
 * クリックで簡易ダイアログを開き、北方位角度を 0〜359 で編集できる。
 * Phase 1 は機能優先のためモーダル省略、prompt() で済ませる。
 */
import { useFloorplanStore } from '@/store/floorplanStore'

export function OrientationCompass() {
  const orientation = useFloorplanStore((s) => s.floorplan.metadata.orientation)
  const updateMetadata = useFloorplanStore((s) => s.updateMetadata)

  function handleEdit() {
    const input = window.prompt('北方位角度を入力してください (0〜359)', String(orientation))
    if (input == null) return
    const value = Number(input)
    if (!Number.isFinite(value)) return
    const normalized = ((Math.round(value) % 360) + 360) % 360
    updateMetadata({ orientation: normalized })
  }

  return (
    <button
      type="button"
      onClick={handleEdit}
      title={`北方位: ${orientation}°`}
      aria-label="北方位を編集"
      data-testid="orientation-compass"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        width: 56,
        height: 56,
        padding: 0,
        background: 'white',
        border: '1px solid #d4d4d4',
        borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg width={40} height={40} viewBox="-20 -20 40 40">
        <g style={{ transform: `rotate(${-orientation}deg)` }}>
          <polygon points="0,-16 4,4 0,1 -4,4" fill="#dc2626" />
          <text
            x={0}
            y={-18}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            fill="#171717"
          >
            N
          </text>
        </g>
      </svg>
    </button>
  )
}
