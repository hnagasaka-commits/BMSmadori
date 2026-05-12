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
import { areaToDisplayUnits, shapeArea } from '@/core/geometry'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import { listSashCatalog } from '@/data/sashCatalog'
import type { WallType, WindowType } from '@/types'
import { furnitureScale3 } from '@/types'

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

  // §M61 / §M62 v0.9: 3D の人物モデル (大きさ感の確認用)
  if (selected.kind === 'human') {
    const h = floor?.humanModels.find((x) => x.id === selected.id)
    if (h == null) return <EmptyPanel message="人物モデルが見つかりません" />
    return <HumanProperties humanId={h.id} />
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
  const setRoomFloorMaterial = useFloorplanStore((s) => s.setRoomFloorMaterial)
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
  // §M84 v0.18: 床面積を m² / 畳 / 坪 に正規化 (rect/polygon どちらでも shapeArea で取れる)
  const areaUnits = areaToDisplayUnits(shapeArea(room.shape))

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

      {/* §M84 v0.18: 床面積を m² / 畳 / 坪 で表示。rect / polygon どちらでも shapeArea を経由 */}
      <div className="property-section">
        <h3>床面積</h3>
        <div className="property-row">
          <span className="label">㎡</span>
          <span className="value">{areaUnits.m2.toFixed(2)}</span>
        </div>
        <div className="property-row">
          <span className="label">畳</span>
          <span className="value">{areaUnits.tatami.toFixed(2)}</span>
        </div>
        <div className="property-row">
          <span className="label">坪</span>
          <span className="value">{areaUnits.tsubo.toFixed(2)}</span>
        </div>
      </div>

      {/* §M109 v0.25: 床素材の上書き選択 */}
      <div className="property-section">
        <h3>床素材</h3>
        <div className="property-row">
          <span className="label">種別</span>
          <select
            value={room.floorMaterial ?? '__preset__'}
            onChange={(e) => {
              const v = e.target.value
              if (v === '__preset__') {
                setRoomFloorMaterial(room.id, undefined)
              } else {
                setRoomFloorMaterial(
                  room.id,
                  v as 'wood' | 'kitchen' | 'tile' | 'concrete' | 'grass',
                )
              }
            }}
            data-testid="room-floor-material-select"
            aria-label="床素材"
          >
            <option value="__preset__">既定 (preset 由来)</option>
            <option value="wood">木目フローリング</option>
            <option value="kitchen">クッションフロア</option>
            <option value="tile">タイル</option>
            <option value="concrete">コンクリート</option>
            <option value="grass">芝生</option>
          </select>
        </div>
      </div>

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
  // §M96 v0.21: 旧コードは floors[0] をハードコードしていたため、2F 以上で
  // 窓を選択しても WindowProperties が「窓が見つかりません」状態になり、
  // 編集 UI が出なかった。activeFloorIndex を参照するように修正
  const win = useFloorplanStore((s) =>
    s.floorplan.floors[s.activeFloorIndex]?.windows.find((w) => w.id === windowId),
  )
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
          {/* §M95 v0.21: 開き戸 / 引き戸 をドロップダウンで選択 */}
          <select
            value={door.type}
            onChange={(e) =>
              updateDoor(door.id, { type: e.target.value as 'single-swing' | 'sliding' })
            }
            data-testid="door-type-select"
            aria-label="ドアの種別"
          >
            <option value="single-swing">開き戸 (single-swing)</option>
            <option value="sliding">引き戸 (sliding)</option>
          </select>
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
    s.floorplan.floors[s.activeFloorIndex]?.furniture.find((f) => f.id === furnitureId),
  )
  const removeFurniture = useFloorplanStore((s) => s.removeFurniture)
  const rotateFurniture = useFloorplanStore((s) => s.rotateFurniture)
  const scaleFurniture = useFloorplanStore((s) => s.scaleFurniture)
  const setFurnitureColor = useFloorplanStore((s) => s.setFurnitureColor)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  if (fi == null) return null
  const entry = getCatalogEntry(fi.catalogId)
  // §M69 v0.12: scale を 3 軸 [x, y, z] に正規化。slider は 0.2〜3.0 の範囲。
  const scale3 = furnitureScale3(fi.scale)
  const setAxis = (axis: 0 | 1 | 2, v: number) => {
    const next: [number, number, number] = [...scale3] as [number, number, number]
    next[axis] = v
    scaleFurniture(fi.id, next)
  }

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

      {/* §M111 v0.26: 家具の寸法を cm 単位で入力 (旧 v0.12 の拡大率表示を置換)。
          カタログ AABB × scale[axis] / 10 で現在の cm を計算し、
          ユーザー入力 cm から逆算で scale を更新する。範囲は scale 0.2〜3.0× に対応 */}
      <div className="property-section">
        <h3>サイズ (cm)</h3>
        {(() => {
          // カタログのローカル AABB (= scale=1 のときの寸法、mm)
          let mnX = Infinity, mxX = -Infinity
          let mnY = Infinity, mxY = -Infinity
          let mnZ = Infinity, mxZ = -Infinity
          for (const p of entry?.pieces ?? []) {
            mnX = Math.min(mnX, p.position[0] - p.size[0] / 2)
            mxX = Math.max(mxX, p.position[0] + p.size[0] / 2)
            mnY = Math.min(mnY, p.position[1] - p.size[1] / 2)
            mxY = Math.max(mxY, p.position[1] + p.size[1] / 2)
            mnZ = Math.min(mnZ, p.position[2] - p.size[2] / 2)
            mxZ = Math.max(mxZ, p.position[2] + p.size[2] / 2)
          }
          const baseMm: readonly [number, number, number] = Number.isFinite(mnX)
            ? [mxX - mnX, mxY - mnY, mxZ - mnZ]
            : [1, 1, 1]
          const axes = [
            { axis: 0 as const, label: '横幅 (X)', testid: 'furniture-size-x' },
            { axis: 1 as const, label: '高さ (Y)', testid: 'furniture-size-y' },
            { axis: 2 as const, label: '奥行 (Z)', testid: 'furniture-size-z' },
          ]
          return axes.map(({ axis, label, testid }) => {
            const baseCm = baseMm[axis] / 10
            // 現在の cm = baseCm * scale[axis]、有効スケール 0.2〜3.0 → cm 範囲
            const minCm = Math.max(1, Math.round(baseCm * 0.2))
            const maxCm = Math.max(minCm + 1, Math.round(baseCm * 3.0))
            const currentCm = Math.round(baseCm * scale3[axis])
            const setCm = (cm: number) => {
              const clamped = Math.max(minCm, Math.min(maxCm, cm))
              const newScale = (clamped * 10) / baseMm[axis]
              setAxis(axis, newScale)
            }
            return (
              <div
                key={axis}
                className="property-row"
                style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, marginBottom: 8 }}
              >
                <span className="label" style={{ fontSize: 11 }}>
                  {label} (基準 {baseCm.toFixed(0)} cm)
                </span>
                <input
                  type="range"
                  min={minCm}
                  max={maxCm}
                  step={1}
                  value={currentCm}
                  onChange={(e) => setCm(Number(e.target.value))}
                  data-testid={`${testid}-slider`}
                  aria-label={`${label} の寸法 (cm)`}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--gray-500)',
                  }}
                >
                  <span>{minCm} cm</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      value={currentCm}
                      step={1}
                      min={minCm}
                      max={maxCm}
                      onChange={(e) => setCm(Number(e.target.value))}
                      data-testid={`${testid}-number`}
                      aria-label={`${label} の寸法 (cm) 数値入力`}
                      style={{ width: 64, textAlign: 'right' }}
                    />
                    <span>cm</span>
                  </span>
                  <span>{maxCm} cm</span>
                </div>
              </div>
            )
          })
        })()}
      </div>

      {/* §M107 v0.25: 家具の色を上書き。クリアでカタログ色に戻る */}
      <div className="property-section">
        <h3>色</h3>
        <div className="property-row">
          <span className="label">カラー</span>
          <input
            type="color"
            value={fi.colorOverride ?? '#888888'}
            onChange={(e) => setFurnitureColor(fi.id, e.target.value)}
            data-testid="furniture-color-picker"
            aria-label="家具の色"
            style={{ width: 40, height: 28, padding: 0, border: 'none', cursor: 'pointer' }}
          />
          <button
            type="button"
            onClick={() => setFurnitureColor(fi.id, undefined)}
            data-testid="furniture-color-clear"
            disabled={fi.colorOverride == null}
            style={{
              marginLeft: 6,
              fontSize: 11,
              padding: '2px 8px',
            }}
            title="カタログのオリジナル色に戻す"
          >
            戻す
          </button>
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

/**
 * §M61 / §M62 v0.9: 人物モデル (3D で大きさ感を確認する用) のプロパティ。
 * 身長 (mm) を 500〜2500 で編集 + 削除のみ。位置は 3D 上でドラッグして変更する。
 */
function HumanProperties({ humanId }: { humanId: string }) {
  const h = useFloorplanStore((s) =>
    s.floorplan.floors[s.activeFloorIndex]?.humanModels.find((x) => x.id === humanId),
  )
  const setHumanHeight = useFloorplanStore((s) => s.setHumanHeight)
  const rotateHuman = useFloorplanStore((s) => s.rotateHuman)
  const removeHuman = useFloorplanStore((s) => s.removeHuman)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const viewMode = useEditorStore((s) => s.viewMode)
  const enterFpv = useEditorStore((s) => s.enterFpv)
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)

  if (h == null) return null

  return (
    <section className="editor-properties" data-testid="property-panel">
      <div className="property-section">
        <h3>人物モデル</h3>
        <div className="property-row">
          <span className="label">位置 x (mm)</span>
          <span className="value">{h.position[0]}</span>
        </div>
        <div className="property-row">
          <span className="label">位置 z (mm)</span>
          <span className="value">{h.position[1]}</span>
        </div>
      </div>

      {/* §M64 v0.11: 人物モデルの向きを 90° 単位で変更 */}
      <div className="property-section">
        <h3>向き (90° 単位)</h3>
        <div className="rotation-buttons">
          {[0, 90, 180, 270].map((deg) => {
            const rad = (deg * Math.PI) / 180
            return (
              <button
                key={deg}
                type="button"
                aria-pressed={Math.abs(h.rotation - rad) < 1e-3}
                onClick={() => rotateHuman(h.id, rad)}
                data-testid={`human-rotate-${deg}`}
              >
                {deg}°
              </button>
            )
          })}
        </div>
      </div>

      <div className="property-section">
        <h3>身長 (mm)</h3>
        <div className="property-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <input
            type="range"
            min={500}
            max={2500}
            step={10}
            value={h.height}
            onChange={(e) => setHumanHeight(h.id, Number(e.target.value))}
            data-testid="human-height-slider"
            aria-label="人物モデルの身長 (mm)"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)' }}>
            <span>500mm</span>
            <input
              type="number"
              value={h.height}
              step={10}
              min={500}
              max={2500}
              onChange={(e) => setHumanHeight(h.id, Number(e.target.value))}
              data-testid="human-height-number"
              aria-label="人物モデルの身長 (mm) 数値入力"
              style={{ width: 96, textAlign: 'right' }}
            />
            <span>2500mm</span>
          </div>
        </div>
      </div>

      {/* §M78 v0.14: 3D 表示中限定で「この人の視点」に切り替えるボタン */}
      {viewMode === '3d' && (
        <div className="property-section">
          <button
            type="button"
            onClick={() => enterFpv(h.id)}
            disabled={fpvHumanId === h.id}
            data-testid="human-fpv"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: fpvHumanId === h.id ? 'var(--gray-300)' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: fpvHumanId === h.id ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            {fpvHumanId === h.id ? 'FPV 中…' : 'この人の視点で見る (FPV)'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>
            ボタン押下後、3D ビュー内をクリックでマウスロック。ESC で抜けます。
          </p>
        </div>
      )}

      <div className="property-section">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            removeHuman(h.id)
            clearSelection()
          }}
          data-testid="human-delete"
        >
          削除
        </button>
      </div>
    </section>
  )
}
