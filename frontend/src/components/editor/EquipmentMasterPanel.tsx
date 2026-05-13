/**
 * §M122 v0.29: 設備マスター (137 種) のパレット。
 *
 * - カテゴリタブ (E/P/A/G/S/K/B) + 全件
 * - 検索ボックス (id / name / placement / category)
 * - クリックで `addFurniture({ catalogId: spec.id, ... })` を呼び、配置面に合った
 *   FurnitureInstance を作成。mountTo は spec.placement をそのまま採用する。
 * - 各エントリのプレビュー: カテゴリ色 (背景) + 配置面色 (枠) + symbol (中央)
 */
import { useMemo, useState } from 'react'
import { selectRooms, useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { useEquipmentMasterStore } from '@/store/equipmentMasterStore'
import type { EquipmentCategory, EquipmentPlacement } from '@/types/equipment'

const PLACEMENT_LABEL: Record<EquipmentPlacement, string> = {
  ceiling: '天井',
  floor: '床',
  wall: '壁',
  roof: '屋上',
  outdoor: '屋外',
}

const CATEGORIES: EquipmentCategory[] = ['E', 'P', 'A', 'G', 'S', 'K', 'B']

export function EquipmentMasterPanel() {
  const list = useEquipmentMasterStore((s) => s.list)
  const loaded = useEquipmentMasterStore((s) => s.loaded)
  const loadError = useEquipmentMasterStore((s) => s.loadError)
  const categoryColors = useEquipmentMasterStore((s) => s.categoryColors)
  const placementColors = useEquipmentMasterStore((s) => s.placementColors)
  const addFurniture = useFloorplanStore((s) => s.addFurniture)
  const rooms = useFloorplanStore(selectRooms)
  const select = useEditorStore((s) => s.select)
  const readonly = useEditorStore((s) => s.readonly)

  const [category, setCategory] = useState<EquipmentCategory | 'ALL'>('ALL')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter((spec) => {
      if (category !== 'ALL' && spec.category !== category) return false
      if (q.length === 0) return true
      return (
        spec.id.toLowerCase().includes(q) ||
        spec.name.toLowerCase().includes(q) ||
        spec.placement.includes(q) ||
        PLACEMENT_LABEL[spec.placement].includes(q)
      )
    })
  }, [list, category, query])

  function handlePlace(id: string) {
    if (readonly) return
    // 配置位置: 最初の部屋の中心、なければ原点
    let pos: readonly [number, number] = [0, 0]
    const firstRoom = rooms[0]
    if (firstRoom != null && firstRoom.shape.kind === 'rect') {
      pos = [
        firstRoom.shape.x + firstRoom.shape.w / 2,
        firstRoom.shape.y + firstRoom.shape.h / 2,
      ]
    }
    const newId = addFurniture({ catalogId: id, position: pos })
    if (newId != null) select({ kind: 'furniture', id: newId })
  }

  if (!loaded) {
    return (
      <div className="sidebar-section" data-testid="equipment-master-loading">
        <h2>設備マスター</h2>
        <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>読み込み中…</p>
      </div>
    )
  }
  if (loadError != null) {
    return (
      <div className="sidebar-section" data-testid="equipment-master-error">
        <h2>設備マスター</h2>
        <p style={{ fontSize: 12, color: '#c0392b' }}>
          equipment-master.json の読み込みに失敗: {loadError}
        </p>
      </div>
    )
  }

  return (
    <div className="sidebar-section" data-testid="equipment-master-panel">
      <h2>
        設備マスター
        <span style={{ color: 'var(--gray-400)', marginLeft: 6, fontWeight: 400, fontSize: 11 }}>
          ({list.length} 種)
        </span>
      </h2>

      {/* カテゴリタブ */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6 }}>
        <button
          type="button"
          onClick={() => setCategory('ALL')}
          data-testid="equipment-cat-ALL"
          style={tabStyle(category === 'ALL', 'var(--gray-300)')}
        >
          全
        </button>
        {CATEGORIES.map((c) => {
          const col = categoryColors[c]?.color ?? '#888'
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              data-testid={`equipment-cat-${c}`}
              title={categoryColors[c]?.name}
              style={tabStyle(category === c, col)}
            >
              {c}
            </button>
          )
        })}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="設備を検索 (例: 消火栓 / 天井 / E-001)"
        data-testid="equipment-search"
        aria-label="設備を検索"
        disabled={readonly}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 12,
          border: '1px solid var(--gray-300, #d4d4d4)',
          borderRadius: 4,
          marginBottom: 6,
        }}
      />

      {filtered.length === 0 ? (
        <p
          data-testid="equipment-empty"
          style={{ fontSize: 12, color: 'var(--gray-500)', padding: 6 }}
        >
          該当する設備がありません
        </p>
      ) : (
        <div
          style={{ display: 'grid', gap: 4, maxHeight: 360, overflowY: 'auto' }}
          data-testid="equipment-list"
        >
          {filtered.map((spec) => {
            const cat = categoryColors[spec.category]
            const placeColor = placementColors[spec.placement]
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => handlePlace(spec.id)}
                data-testid={`equipment-${spec.id}`}
                disabled={readonly}
                title={`${spec.id} ${spec.name} / ${spec.width}×${spec.depth}×${spec.height}mm`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px 1fr auto',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  background: 'white',
                  border: `1px solid var(--gray-200)`,
                  borderLeft: `4px solid ${placeColor}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: spec.shape === 'circle' ? '50%' : 4,
                    background: cat?.color ?? '#ccc',
                    border: `2px solid ${placeColor}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: contrastTextColor(cat?.color ?? '#cccccc'),
                  }}
                  aria-hidden="true"
                >
                  {spec.symbol}
                </span>
                <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {spec.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>
                    {spec.id} / {PLACEMENT_LABEL[spec.placement]} /{' '}
                    {spec.width}×{spec.depth}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function tabStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 600,
    border: `2px solid ${active ? color : 'transparent'}`,
    background: active ? color : 'transparent',
    color: active ? contrastTextColor(color) : 'var(--gray-700)',
    borderRadius: 4,
    cursor: 'pointer',
  }
}

/** 背景色から読みやすい文字色 (黒 or 白) を決める (簡易 YIQ) */
function contrastTextColor(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#111'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#111' : '#fff'
}
