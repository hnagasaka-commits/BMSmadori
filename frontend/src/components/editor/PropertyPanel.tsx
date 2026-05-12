/**
 * 右ペイン Properties。選択要素の種別ごとに分岐:
 *  - room : プリセット / 位置 / 寸法 / 回転 / 削除
 *  - wall : 壁種別 / isLocked / 厚み
 *  - window : 寸法 / 種類 / 位置比 / 腰高 / 削除
 *  - door は M3 で自動生成のみ。手動編集は M5/M6 で
 */
import {
  selectFloor,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { ROOM_PRESETS, getPreset } from '@/data/roomPresets'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import { listSashCatalog } from '@/data/sashCatalog'
import type { WallType, WindowType } from '@/types'

const WALL_TYPES: ReadonlyArray<{ id: WallType; label: string }> = [
  { id: 'exterior', label: '外壁' },
  { id: 'load-bearing', label: '耐力壁' },
  { id: 'shared', label: '戸境壁' },
  { id: 'partition', label: '間仕切り' },
  { id: 'non-bearing', label: '非耐力壁' },
]

const WINDOW_TYPES: ReadonlyArray<{ id: WindowType; label: string }> = [
  { id: 'fixed', label: 'FIX' },
  { id: 'sliding-2', label: '引違い 2 枚' },
  { id: 'sliding-4', label: '引違い 4 枚' },
  { id: 'casement', label: '片開き / 上げ下げ' },
  { id: 'bay', label: '出窓' },
]

export function PropertyPanel() {
  const selected = useEditorStore((s) => s.selected)
  const floor = useFloorplanStore(selectFloor)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (selected == null) {
    return (
      <section className="editor-properties" data-testid="property-panel">
        <div className="empty-message">要素を選択してください</div>
      </section>
    )
  }

  if (selected.kind === 'room') {
    const room = floor?.rooms.find((r) => r.id === selected.id)
    if (room == null) {
      return <EmptyPanel message="選択された部屋が見つかりません" />
    }
    // §M38: polygon 部屋もパネルを開く (用途変更 / 削除 ができる)
    return <RoomProperties roomId={room.id} />
  }

  if (selected.kind === 'wall') {
    // §M30: 自立壁 (freestandingWalls) も含めて探す
    const derivedWall = floor?.walls.find((w) => w.id === selected.id)
    const freeWall = floor?.freestandingWalls?.find((w) => w.id === selected.id)
    const wall = derivedWall ?? freeWall
    if (wall == null) return <EmptyPanel message="壁が見つかりません" />
    return (
      <WallProperties wallId={wall.id} isFreestanding={derivedWall == null} />
    )
  }

  if (selected.kind === 'window') {
    const win = floor?.windows.find((w) => w.id === selected.id)
    if (win == null) return <EmptyPanel message="窓が見つかりません" />
    return <WindowProperties windowId={win.id} />
  }

  if (selected.kind === 'door') {
    const d = floor?.doors.find((x) => x.id === selected.id)
    if (d == null) return <EmptyPanel message="ドアが見つかりません" />
    return <DoorProperties doorId={d.id} />
  }

  if (selected.kind === 'furniture') {
    const fi = floor?.furniture.find((f) => f.id === selected.id)
    if (fi == null) return <EmptyPanel message="家具が見つかりません" />
    return <FurnitureProperties furnitureId={fi.id} />
  }

  if (selected.kind === 'column') {
    const c = floor?.columns.find((x) => x.id === selected.id)
    if (c == null) return <EmptyPanel message="柱が見つかりません" />
    return <ColumnProperties columnId={c.id} />
  }

  void clearSelection
  return <EmptyPanel message="この要素のプロパティは Phase 1 では未実装です" />
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="empty-message">{message}</div>
    </section>
  )
}

// ============================================================================
// Room
// ============================================================================

function RoomProperties({ roomId }: { roomId: string }) {
  const room = useFloorplanStore((s) =>
    s.floorplan.floors[s.activeFloorIndex]?.rooms.find((r) => r.id === roomId),
  )
  const resizeRoom = useFloorplanStore((s) => s.resizeRoom)
  const rotateRoom = useFloorplanStore((s) => s.rotateRoom)
  const removeRoom = useFloorplanStore((s) => s.removeRoom)
  const updateRoomPreset = useFloorplanStore((s) => s.updateRoomPreset)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (room == null) return null
  const preset = getPreset(room.presetId)
  const isRect = room.shape.kind === 'rect'

  function handleResize(field: 'w' | 'h', value: number) {
    if (room == null || room.shape.kind !== 'rect') return
    const next = { x: room.shape.x, y: room.shape.y, w: room.shape.w, h: room.shape.h }
    next[field] = Math.max(500, Math.round(value))
    resizeRoom(room.id, next)
  }

  function handleDelete() {
    if (room == null) return
    removeRoom(room.id)
    clearSelection()
  }

  // rect 部屋のみ寸法表示。polygon は AABB 概算と頂点数だけ表示
  const rect = room.shape.kind === 'rect' ? room.shape : null

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>基本</h3>
        <div className="property-row">
          <span className="label">用途 (preset)</span>
          {/* §M38: select で用途を変更可能 */}
          <select
            value={room.presetId}
            onChange={(e) => updateRoomPreset(room.id, e.target.value)}
            data-testid="room-preset-select"
            aria-label="部屋の用途 (preset)"
          >
            {ROOM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
        {preset != null && (
          <>
            <div className="property-row">
              <span className="label">採光必須</span>
              <span className="value">{preset.requiresWindow ? 'はい' : 'いいえ'}</span>
            </div>
            <div className="property-row">
              <span className="label">PS 必須</span>
              <span className="value">{preset.requiresPipeSpace ? 'はい' : 'いいえ'}</span>
            </div>
          </>
        )}
      </div>

      {rect != null && (
        <>
          <div className="property-section">
            <h3>位置 (mm)</h3>
            <div className="property-row"><span className="label">x</span><span className="value">{rect.x}</span></div>
            <div className="property-row"><span className="label">y</span><span className="value">{rect.y}</span></div>
          </div>

          <div className="property-section">
            <h3>寸法 (mm)</h3>
            <div className="property-row">
              <span className="label">幅</span>
              <input
                type="number"
                value={rect.w}
                step={910}
                min={500}
                onChange={(e) => handleResize('w', Number(e.target.value))}
                data-testid="prop-width"
                aria-label="部屋の幅 (mm)"
              />
            </div>
            <div className="property-row">
              <span className="label">奥行</span>
              <input
                type="number"
                value={rect.h}
                step={910}
                min={500}
                onChange={(e) => handleResize('h', Number(e.target.value))}
                data-testid="prop-height"
                aria-label="部屋の奥行 (mm)"
              />
            </div>
            <div className="property-row">
              <span className="label">面積 (㎡)</span>
              <span className="value">{((rect.w * rect.h) / 1_000_000).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}

      {!isRect && room.shape.kind === 'polygon' && (
        <div className="property-section">
          <h3>polygon</h3>
          <div className="property-row">
            <span className="label">頂点数</span>
            <span className="value">{room.shape.points.length}</span>
          </div>
          <div className="property-row" style={{ color: 'var(--gray-500)', fontSize: 11 }}>
            <span>頂点ハンドル (青■) をドラッグして形を変えられます</span>
          </div>
        </div>
      )}

      <div className="property-section">
        <h3>回転 (Phase 1: 90° 単位)</h3>
        <div className="rotation-buttons">
          {[0, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              type="button"
              aria-pressed={room.rotation === deg}
              onClick={() => rotateRoom(room.id, deg)}
              disabled={!isRect}
              title={isRect ? '' : 'polygon の回転は未対応'}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      <div className="property-section">
        <button type="button" className="btn danger" onClick={handleDelete} data-testid="prop-delete">
          削除
        </button>
      </div>
    </section>
  )
}

// ============================================================================
// Wall
// ============================================================================

function WallProperties({
  wallId,
  isFreestanding,
}: {
  wallId: string
  isFreestanding: boolean
}) {
  const wall = useFloorplanStore((s) => {
    const f = s.floorplan.floors[s.activeFloorIndex]
    return (
      f?.walls.find((w) => w.id === wallId) ??
      f?.freestandingWalls?.find((w) => w.id === wallId)
    )
  })
  const updateWall = useFloorplanStore((s) => s.updateWall)
  const hideWall = useFloorplanStore((s) => s.hideWall)
  const removeFreestandingWall = useFloorplanStore((s) => s.removeFreestandingWall)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (wall == null) return null

  const length = Math.round(
    Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]),
  )

  function handleDelete() {
    if (wall == null) return
    if (isFreestanding) {
      removeFreestandingWall(wall.id)
      clearSelection()
      return
    }
    // §M30: 部屋由来の壁は実体は残したまま hiddenWallIds に追加 (= 任意区間の壁削除)
    if (
      window.confirm(
        'この壁は部屋の輪郭の一部です。表示と窓・ドア配置から外しますか? (部屋の形は変わりません。後で復元可能)',
      )
    ) {
      hideWall(wall.id)
      clearSelection()
    }
  }

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>壁種別 {isFreestanding ? '(自立壁)' : ''}</h3>
        <div className="rotation-buttons" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {WALL_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={wall.wallType === t.id}
              onClick={() => updateWall(wall.id, { wallType: t.id })}
              data-testid={`wall-type-${t.id}`}
              disabled={isFreestanding}
              title={isFreestanding ? '自立壁の種別変更は未対応' : ''}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="property-section">
        <h3>属性</h3>
        <div className="property-row">
          <span className="label">isLocked</span>
          <input
            type="checkbox"
            checked={wall.isLocked}
            onChange={(e) => updateWall(wall.id, { isLocked: e.target.checked })}
            data-testid="wall-locked"
            aria-label="壁の編集ロック"
            disabled={isFreestanding}
          />
        </div>
        <div className="property-row">
          <span className="label">厚み (mm)</span>
          <input
            type="number"
            value={wall.thickness}
            step={10}
            min={50}
            onChange={(e) => updateWall(wall.id, { thickness: Math.max(50, Number(e.target.value)) })}
            aria-label="壁の厚み (mm)"
            disabled={isFreestanding}
          />
        </div>
        <div className="property-row">
          <span className="label">共有部屋数</span>
          <span className="value">{wall.sharedBy.length}</span>
        </div>
        <div className="property-row">
          <span className="label">長さ (mm)</span>
          <span className="value">{length}</span>
        </div>
      </div>

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={handleDelete}
          data-testid="wall-delete"
        >
          {isFreestanding ? 'この壁を削除' : 'この区間の壁を非表示にする'}
        </button>
      </div>
    </section>
  )
}

// ============================================================================
// Window
// ============================================================================

function WindowProperties({ windowId }: { windowId: string }) {
  const win = useFloorplanStore((s) => s.floorplan.floors[0]?.windows.find((w) => w.id === windowId))
  const updateWindow = useFloorplanStore((s) => s.updateWindow)
  const applyWindowSash = useFloorplanStore((s) => s.applyWindowSash)
  const removeWindow = useFloorplanStore((s) => s.removeWindow)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (win == null) return null

  const sashEntries = listSashCatalog()

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>サッシ規格 (§5.8.3)</h3>
        <select
          value={win.sashId ?? ''}
          onChange={(e) => {
            const next = e.target.value
            if (next === '') return // 「(カスタム)」選択は既存値維持
            applyWindowSash(win.id, next)
          }}
          data-testid="window-sash"
          aria-label="サッシ規格"
        >
          <option value="">(カスタム)</option>
          {sashEntries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
        {win.sashId != null && (
          <div className="property-row">
            <span className="label">適用中</span>
            <span className="value">{win.sashId}</span>
          </div>
        )}
      </div>

      <div className="property-section">
        <h3>窓種別</h3>
        <select
          value={win.type}
          onChange={(e) => updateWindow(win.id, { type: e.target.value as WindowType })}
          data-testid="window-type"
          aria-label="窓の種類"
        >
          {WINDOW_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="property-section">
        <h3>寸法 (mm)</h3>
        <div className="property-row">
          <span className="label">幅</span>
          <input
            type="number"
            value={win.width}
            step={50}
            min={100}
            onChange={(e) => updateWindow(win.id, { width: Number(e.target.value) })}
            data-testid="window-width"
            aria-label="窓の幅 (mm)"
          />
        </div>
        <div className="property-row">
          <span className="label">高さ</span>
          <input
            type="number"
            value={win.height}
            step={50}
            min={100}
            onChange={(e) => updateWindow(win.id, { height: Number(e.target.value) })}
            aria-label="窓の高さ (mm)"
          />
        </div>
        <div className="property-row">
          <span className="label">腰高</span>
          <input
            type="number"
            value={win.sillHeight}
            step={50}
            min={0}
            onChange={(e) => updateWindow(win.id, { sillHeight: Number(e.target.value) })}
            aria-label="窓の腰高 (mm)"
          />
        </div>
        <div className="property-row">
          <span className="label">位置比</span>
          <input
            type="number"
            value={win.positionRatio}
            step={0.05}
            min={0}
            max={1}
            onChange={(e) => updateWindow(win.id, { positionRatio: Number(e.target.value) })}
            aria-label="窓の壁上位置比 (0〜1)"
          />
        </div>
      </div>

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            removeWindow(win.id)
            clearSelection()
          }}
          data-testid="window-delete"
        >
          削除
        </button>
      </div>
    </section>
  )
}

// ============================================================================
// Door (Phase 3 / M24)
// ============================================================================

function DoorProperties({ doorId }: { doorId: string }) {
  const door = useFloorplanStore((s) =>
    s.floorplan.floors[s.activeFloorIndex]?.doors.find((d) => d.id === doorId),
  )
  const updateDoor = useFloorplanStore((s) => s.updateDoor)
  const removeDoor = useFloorplanStore((s) => s.removeDoor)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (door == null) return null
  // §M43: swingInward の既定は true 扱い (旧データに対しても "内開き" として描画する)
  const isInward = door.swingInward !== false

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>ドア</h3>
        <div className="property-row">
          <span className="label">種別</span>
          <span className="value">{door.type}</span>
        </div>
        <div className="property-row">
          <span className="label">幅 (mm)</span>
          <input
            type="number"
            value={door.width}
            step={50}
            min={400}
            onChange={(e) => updateDoor(door.id, { width: Number(e.target.value) })}
            data-testid="door-width"
            aria-label="ドアの幅 (mm)"
          />
        </div>
        <div className="property-row">
          <span className="label">位置比</span>
          <input
            type="number"
            value={door.positionRatio}
            step={0.05}
            min={0}
            max={1}
            onChange={(e) =>
              updateDoor(door.id, { positionRatio: Number(e.target.value) })
            }
            data-testid="door-position-ratio"
            aria-label="ドアの壁上位置比 (0〜1)"
          />
        </div>
      </div>

      <div className="property-section">
        <h3>開閉方向 (§M43)</h3>
        {/* §M43: 内開き / 外開き トグル */}
        <div className="rotation-buttons" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            type="button"
            aria-pressed={isInward}
            onClick={() => updateDoor(door.id, { swingInward: true })}
            data-testid="door-swing-inward"
          >
            内開き
          </button>
          <button
            type="button"
            aria-pressed={!isInward}
            onClick={() => updateDoor(door.id, { swingInward: false })}
            data-testid="door-swing-outward"
          >
            外開き
          </button>
        </div>
      </div>

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            removeDoor(door.id)
            clearSelection()
          }}
          data-testid="door-delete"
        >
          削除
        </button>
      </div>
    </section>
  )
}

// ============================================================================
// Column (Phase 3 / M20)
// ============================================================================

function ColumnProperties({ columnId }: { columnId: string }) {
  const column = useFloorplanStore((s) =>
    s.floorplan.floors[s.activeFloorIndex]?.columns.find((c) => c.id === columnId),
  )
  const updateColumn = useFloorplanStore((s) => s.updateColumn)
  const removeColumn = useFloorplanStore((s) => s.removeColumn)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (column == null) return null

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>柱</h3>
        <div className="property-row">
          <span className="label">ID</span>
          <span className="value">{column.id.slice(0, 8)}</span>
        </div>
        <div className="property-row">
          <span className="label">位置 (mm)</span>
          <span className="value">
            ({column.position[0]}, {column.position[1]})
          </span>
        </div>
      </div>

      <div className="property-section">
        <h3>属性</h3>
        <div className="property-row">
          <span className="label">耐力柱 (loadBearing)</span>
          <input
            type="checkbox"
            checked={column.loadBearing}
            onChange={(e) => updateColumn(column.id, { loadBearing: e.target.checked })}
            data-testid="column-load-bearing"
            aria-label="耐力柱として扱う (通し柱整合の対象になる)"
          />
        </div>
        <div className="property-row">
          <span className="label">ロック</span>
          <input
            type="checkbox"
            checked={column.isLocked}
            onChange={(e) => updateColumn(column.id, { isLocked: e.target.checked })}
            aria-label="柱の編集ロック"
          />
        </div>
        <div className="property-row">
          <span className="label">サイズ (mm)</span>
          <span className="value">
            {column.size.w} × {column.size.h}
          </span>
        </div>
      </div>

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            removeColumn(column.id)
            clearSelection()
          }}
          data-testid="column-delete"
          disabled={column.isLocked}
        >
          削除
        </button>
      </div>
    </section>
  )
}

// ============================================================================
// Furniture (Phase 2 / M14)
// ============================================================================

function FurnitureProperties({ furnitureId }: { furnitureId: string }) {
  const fi = useFloorplanStore((s) =>
    s.floorplan.floors[0]?.furniture.find((f) => f.id === furnitureId),
  )
  const removeFurniture = useFloorplanStore((s) => s.removeFurniture)
  const rotateFurniture = useFloorplanStore((s) => s.rotateFurniture)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (fi == null) return null
  const entry = getCatalogEntry(fi.catalogId)

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>家具</h3>
        <div className="property-row">
          <span className="label">名称</span>
          <span className="value">{entry?.displayName ?? fi.catalogId}</span>
        </div>
        <div className="property-row">
          <span className="label">カタログ ID</span>
          <span className="value">{fi.catalogId}</span>
        </div>
      </div>

      <div className="property-section">
        <h3>位置 (mm)</h3>
        <div className="property-row"><span className="label">x</span><span className="value">{fi.position[0]}</span></div>
        <div className="property-row"><span className="label">z</span><span className="value">{fi.position[1]}</span></div>
      </div>

      <div className="property-section">
        <h3>回転 (90° 単位)</h3>
        <div className="rotation-buttons">
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180
            return (
              <button
                key={deg}
                type="button"
                aria-pressed={Math.abs(fi.rotation - rad) < 1e-3}
                onClick={() => rotateFurniture(fi.id, rad)}
                data-testid={`furniture-rotate-${deg}`}
              >
                {deg}°
              </button>
            )
          })}
        </div>
      </div>

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            removeFurniture(fi.id)
            clearSelection()
          }}
          data-testid="furniture-delete"
        >
          削除
        </button>
      </div>
    </section>
  )
}
