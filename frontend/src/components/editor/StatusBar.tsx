/**
 * ステータスバー: 階タブ + 部屋数 / 壁数 / グリッド情報。
 *
 * §11 Phase 3 / M19: 複数階対応の階タブをここに置く。
 * - 各階タブをクリックで `activeFloorIndex` 切替
 * - 末尾に「+ 階を追加」ボタン (3 階を超えると非表示)
 * - 各タブの右肩に × で削除 (1 階しかないときは無効)
 */
import { selectRooms, selectWalls, useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'

const MAX_FLOORS = 3

export function StatusBar() {
  const rooms = useFloorplanStore(selectRooms)
  const walls = useFloorplanStore(selectWalls)
  const floors = useFloorplanStore((s) => s.floorplan.floors)
  const activeIdx = useFloorplanStore((s) => s.activeFloorIndex)
  const setActiveFloor = useFloorplanStore((s) => s.setActiveFloor)
  const addFloor = useFloorplanStore((s) => s.addFloor)
  const removeFloor = useFloorplanStore((s) => s.removeFloor)
  // §M104 v0.24: 編集中の階の天井高 (= 壁高さ) を表示 & 編集
  const activeCeilingHeight =
    useFloorplanStore((s) => s.floorplan.floors[s.activeFloorIndex]?.ceilingHeight) ?? 2400
  const updateFloorMeta = useFloorplanStore((s) => s.updateFloorMeta)
  const gridSize = useEditorStore((s) => s.gridSize)
  const readonly = useEditorStore((s) => s.readonly)

  function handleAddFloor() {
    // 既存の最後の階を雛形にコピー (1F の部屋配置をそのまま 2F に複製)
    const copyFromIndex = floors.length > 0 ? floors.length - 1 : undefined
    const newIdx =
      copyFromIndex != null ? addFloor({ copyFromIndex }) : addFloor()
    if (newIdx < 0) {
      window.alert(`${MAX_FLOORS} 階を超える階は追加できません`)
    }
  }

  function handleRemoveFloor(index: number) {
    if (floors.length <= 1) return
    const name = floors[index]?.name ?? `${index + 1}F`
    if (!window.confirm(`${name} を削除します。この階の部屋・壁・家具がすべて消えます。よろしいですか?`)) return
    removeFloor(index)
  }

  return (
    <footer className="editor-statusbar" data-testid="status-bar">
      {/*
        §M19 階タブ。
        ARIA tablist は「直接子に role=tab しか置けない」厳しい制約があるが、
        ここでは削除ボタンを隣に並べたい (axe aria-required-children に引っかかる)。
        そのため tablist は使わず、aria-pressed の通常ボタン群として実装する。
      */}
      <div
        aria-label="階の切替"
        data-testid="floor-tabs"
        style={{ display: 'flex', gap: 4, alignItems: 'center' }}
      >
        {floors.map((f, i) => {
          const active = i === activeIdx
          return (
            <div
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setActiveFloor(i)}
                data-testid={`floor-tab-${i}`}
                style={{
                  padding: '2px 10px',
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: active ? '#3b82f6' : '#e5e5e5',
                  background: active ? '#eff6ff' : 'white',
                  color: active ? '#1e3a8a' : '#525252',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {f.name}
              </button>
              {floors.length > 1 && active && !readonly && (
                <button
                  type="button"
                  onClick={() => handleRemoveFloor(i)}
                  aria-label={`${f.name} を削除`}
                  data-testid={`floor-remove-${i}`}
                  title={`${f.name} を削除`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#a3a3a3',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        {floors.length < MAX_FLOORS && !readonly && (
          <button
            type="button"
            onClick={handleAddFloor}
            data-testid="floor-add"
            title={floors.length === 0 ? '階を追加' : `${floors.length + 1}F を追加 (現在の階をコピー)`}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px dashed #a3a3a3',
              background: 'transparent',
              color: '#737373',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            + 階
          </button>
        )}
      </div>

      <span style={{ marginLeft: 12 }}>部屋: {rooms.length}</span>
      <span>壁: {walls.length}</span>
      <span>グリッド: {gridSize}mm</span>
      {/* §M104 v0.24: 天井高 (= 全ての壁の高さ) を編集できる。階ごとに独立。 */}
      <label
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}
        title="現在の階の天井高 (= 全ての壁の高さ) を mm 単位で変更"
      >
        <span>天井高:</span>
        <input
          type="number"
          value={activeCeilingHeight}
          step={50}
          min={2000}
          max={5000}
          onChange={(e) =>
            updateFloorMeta(activeIdx, { ceilingHeight: Number(e.target.value) })
          }
          disabled={readonly}
          data-testid="ceiling-height-input"
          aria-label="天井高 (mm)"
          style={{ width: 64, padding: '1px 4px', fontSize: 12 }}
        />
        <span>mm</span>
      </label>
    </footer>
  )
}
