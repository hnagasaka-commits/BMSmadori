/**
 * 左サイドバー: 部屋プリセットの一覧。クリックで配置。
 *
 * Phase 1 はプリセットのリストをそのまま表示。配置位置は「現在の部屋 AABB の右側にスタック」
 * という単純戦略にする (重なり判定で拒否されたら横にずらす)。
 */
import { ROOM_PRESETS } from '@/data/roomPresets'
import { listCatalog } from '@/data/furnitureCatalog'
import { selectRooms, useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import type { Shape } from '@/types'
import { SeismicPanel } from './SeismicPanel'

function findFreePlacement(
  existingRooms: ReturnType<typeof selectRooms>,
  gridSize: number,
): { x: number; y: number } {
  if (existingRooms.length === 0) return { x: 0, y: 0 }
  let maxRight = 0
  for (const r of existingRooms) {
    if (r.shape.kind !== 'rect') continue
    const right = r.shape.x + r.shape.w
    if (right > maxRight) maxRight = right
  }
  return { x: Math.ceil(maxRight / gridSize) * gridSize, y: 0 }
}

export function Sidebar() {
  const addRoom = useFloorplanStore((s) => s.addRoom)
  const generateColumnsByGrid = useFloorplanStore((s) => s.generateColumnsByGrid)
  const addPipeSpace = useFloorplanStore((s) => s.addPipeSpace)
  const autoFurnishAllRooms = useFloorplanStore((s) => s.autoFurnishAllRooms)
  const addFurniture = useFloorplanStore((s) => s.addFurniture)
  const convertRoomToLShape = useFloorplanStore((s) => s.convertRoomToLShape)
  const rooms = useFloorplanStore(selectRooms)
  const selected = useEditorStore((s) => s.selected)
  const gridSize = useEditorStore((s) => s.gridSize)
  const select = useEditorStore((s) => s.select)
  const readonly = useEditorStore((s) => s.readonly)
  const buildingType = useFloorplanStore((s) => s.floorplan.metadata.buildingType)
  // 「L 字に変換」は rect の部屋が選択中のときだけ有効
  const selectedRectRoomId =
    selected?.kind === 'room'
      ? rooms.find((r) => r.id === selected.id && r.shape.kind === 'rect')?.id ?? null
      : null

  /**
   * §11 Phase 2 / M15: 規格カタログから個別に家具を 1 つ追加。
   * 配置位置は「最初の部屋の中心」を既定 (3D 上で PivotControls により後で動かせる)。
   * 部屋がなければ原点。
   */
  function handleAddFromCatalog(catalogId: string) {
    let pos: readonly [number, number] = [0, 0]
    const firstRoom = rooms[0]
    if (firstRoom != null && firstRoom.shape.kind === 'rect') {
      pos = [
        firstRoom.shape.x + firstRoom.shape.w / 2,
        firstRoom.shape.y + firstRoom.shape.h / 2,
      ]
    }
    const id = addFurniture({ catalogId, position: pos })
    if (id != null) select({ kind: 'furniture', id })
  }

  function handleAdd(presetId: string, w: number, h: number) {
    const id = crypto.randomUUID()
    void w
    void h
    const pos = findFreePlacement(rooms, gridSize)
    const shape: Shape = {
      kind: 'rect',
      x: pos.x,
      y: pos.y,
      w,
      h,
      edgeIds: [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    }
    const ok = addRoom({ id, presetId, shape })
    if (ok) select({ kind: 'room', id })
  }

  function handleGenerateColumns() {
    if (
      window.confirm(
        `現在の部屋の AABB に対して ${gridSize}mm グリッドで柱を一括生成します。既存の柱は置き換えられます。よろしいですか?`,
      )
    ) {
      generateColumnsByGrid(gridSize)
    }
  }

  function handleAddPipeSpace() {
    // 部屋がなければ原点、ある場合は最初の部屋の右上に新規 PS を置く (仮位置)
    let pos: readonly [number, number] = [0, 0]
    const firstRoom = rooms[0]
    if (firstRoom != null && firstRoom.shape.kind === 'rect') {
      pos = [firstRoom.shape.x + firstRoom.shape.w + 200, firstRoom.shape.y + 200]
    }
    addPipeSpace({ position: pos, systems: ['water-supply', 'drainage', 'vent'] })
  }

  return (
    <aside className="editor-sidebar">
      <div className="sidebar-section">
        <h2>部屋プリセット</h2>
        <div className="preset-list">
          {ROOM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleAdd(p.id, p.defaultSize.w, p.defaultSize.h)}
              data-testid={`preset-${p.id}`}
              disabled={readonly}
            >
              <span>{p.displayName}</span>
              <span className="preset-size">
                {(p.defaultSize.w / 1000).toFixed(1)} × {(p.defaultSize.h / 1000).toFixed(1)}
              </span>
            </button>
          ))}
        </div>
        {/*
          §11 Phase 2 / M16: 選択中の rect 部屋を L 字 polygon にカット変換するアクション。
          - 部屋が rect で選択されているときだけ enabled
          - 切り欠きは AABB の 1/3 を既定 (実装は floorplanStore.convertRoomToLShape)
          - Undo で戻せる (history snapshot を経由)
        */}
        <div className="preset-list" style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (selectedRectRoomId == null) return
              const ok = convertRoomToLShape(selectedRectRoomId)
              if (!ok) {
                window.alert(
                  'L 字に変換できませんでした (寸法不足、または他の部屋と重なる)',
                )
              }
            }}
            data-testid="convert-l-shape"
            disabled={readonly || selectedRectRoomId == null}
            title="選択中の rect 部屋を L 字 polygon に変換 (北東角を切り欠く)"
          >
            <span>選択中の部屋を L 字に変換</span>
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h2>家具 (Phase 2)</h2>
        <div className="preset-list">
          <button
            type="button"
            onClick={() => {
              const added = autoFurnishAllRooms()
              if (added === 0) {
                window.alert(
                  '追加できる家具がありませんでした (既に配置済み、または部屋寸法が下限未満)',
                )
              }
            }}
            data-testid="auto-furnish"
            disabled={readonly || rooms.length === 0}
            title="各部屋の用途に応じて既定家具を配置 (3D ビューで動かせます)"
          >
            <span>部屋に既定家具を入れる</span>
          </button>
        </div>
        {/*
          §11 Phase 2 / M15: 規格カタログから 1 アイテムずつ配置するピッカー。
          自動家具配置は「部屋に合った既定セット」が出るが、追加で別カタログを欲しいときの口。
          配置位置は最初の部屋の中央。3D ビューで PivotControls により動かして調整する想定。
        */}
        <div className="preset-list" style={{ marginTop: 8 }}>
          {listCatalog().map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleAddFromCatalog(entry.id)}
              data-testid={`furniture-${entry.id}`}
              disabled={readonly}
              title={`カタログから「${entry.displayName}」を 1 つ追加`}
            >
              <span>{entry.displayName}</span>
              <span className="preset-size">
                {(entry.minRoom.w / 1000).toFixed(1)} × {(entry.minRoom.h / 1000).toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <h2>構造体・設備 (Phase 1.5)</h2>
        <div className="preset-list">
          {buildingType === 'single-family' && (
            <button
              type="button"
              onClick={handleGenerateColumns}
              data-testid="generate-columns"
              disabled={readonly || rooms.length === 0}
              title="現在の部屋 AABB に 910mm グリッドで柱を一括生成"
            >
              <span>柱を 910mm グリッドに自動配置</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleAddPipeSpace}
            data-testid="add-pipespace"
            disabled={readonly}
            title="給水・排水・換気を持つ標準 PS を追加"
          >
            <span>PS を追加</span>
          </button>
        </div>
      </div>

      {/* §M21 Phase 3: 耐震診断 (壁量計算) */}
      <SeismicPanel />
    </aside>
  )
}
