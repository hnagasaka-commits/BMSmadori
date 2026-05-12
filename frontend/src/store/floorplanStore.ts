/**
 * Floorplan の中心ストア (Zustand v5)。
 *
 * Phase 1 では `floors[0]` のみ操作する (§11 不変条件 `floors.length === 1`)。
 * 複数階対応は Phase 3 で `activeFloorIndex` を追加する。
 *
 * このストアは「shape を変更したら必ず recomputeFloor を通す」というルールを守る入口。
 * 直接 walls / doors / windows を書き換える action は持たない (壁再生成と再バインドの整合を壊すため)。
 */

import { create } from 'zustand'
import type {
  AutoDoorSuppression,
  Column,
  Door,
  EdgeId,
  Floor,
  Floorplan,
  FloorplanMetadata,
  FurnitureInstance,
  PipeSpace,
  PipeSystem,
  Room,
  Shape,
  Wall,
  Window,
  WindowType,
} from '@/types'
import { defaultFurnitureForPreset, getCatalogEntry } from '@/data/furnitureCatalog'
import { getSashEntry } from '@/data/sashCatalog'
import { getPreset } from '@/data/roomPresets'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'
import { overlapsAny } from '@/core/collision'
import { addAutoDoorSuppression } from '@/core/doors'
import { recomputeFloor } from '@/core/recompute'
import { exportFloorplanJson, importFloorplan, type ImportResult } from '@/data/loader'
import { loadCurrent, saveCurrent } from '@/data/storage'
import { useHistoryStore } from './historyStore'

// ============================================================================
// 初期 Floorplan
// ============================================================================

/** Phase 1 の最小不変条件を満たす空の Floorplan */
export function createEmptyFloorplan(): Floorplan {
  const floor: Floor = {
    id: crypto.randomUUID(),
    level: 1,
    name: '1F',
    ceilingHeight: 2400,
    rooms: [],
    walls: [],
    doors: [],
    windows: [],
    columns: [],
    pipeSpaces: [],
    furniture: [],
    humanModels: [],
    voids: [],
    roomFinishes: [],
    wallFinishes: [],
    windowDecorations: [],
    doorDecorations: [],
    suppressedAutoDoors: [],
  }
  const now = new Date().toISOString()
  return {
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      name: '新規プラン',
      buildingType: 'single-family',
      unit: 'mm',
      gridSize: 910,
      orientation: 0,
      createdAt: now,
      updatedAt: now,
    },
    floors: [floor],
    building: {
      structureType: 'wood',
      isExistingBuilding: false,
    },
  }
}

// ============================================================================
// ストア型
// ============================================================================

export type AddRoomInput = {
  /** 省略時は自動採番 */
  id?: string
  presetId: string
  shape: Shape
  rotation?: number
}

export type FloorplanState = {
  floorplan: Floorplan
  /**
   * §11 Phase 3 / M19: 編集対象の階のインデックス (`floors[activeFloorIndex]`)。
   * 1F=0, 2F=1, 3F=2。loadPlan / reset / removeFloor で必要に応じて 0 に戻す。
   */
  activeFloorIndex: number

  // 入出力
  loadPlan: (plan: Floorplan) => void
  reset: () => void

  // §11 Phase 3 / M19: 階の選択・追加・削除
  setActiveFloor: (index: number) => void
  /**
   * 階を追加する。`copyFrom` を渡すとその階の構造 (rooms/walls/doors/windows...) を
   * deep clone して新階に入れる。id はすべて再採番。
   * 戻り値は追加後の新階インデックス。3 階を超える要求は -1。
   */
  addFloor: (input?: { copyFromIndex?: number; level?: number; name?: string }) => number
  /** 階を削除。最後の 1 階は消せない (false)。activeFloorIndex がオフバウンドになる場合は補正 */
  removeFloor: (index: number) => boolean
  /** 階の表示名・天井高・level を更新 */
  updateFloorMeta: (
    index: number,
    patch: Partial<Pick<Floor, 'name' | 'ceilingHeight' | 'level'>>,
  ) => void

  // Room CRUD
  /** 重なる位置なら追加せず false を返す。成功で true。 */
  addRoom: (input: AddRoomInput) => boolean
  removeRoom: (roomId: string) => void

  // Shape 更新 (§6.3 重なり阻止)
  /** dx / dy は mm。重なる位置に動かそうとした場合は false を返し変更しない。 */
  moveRoom: (roomId: string, dx: number, dy: number) => boolean
  /** 90° 倍数のみ受け付ける (Phase 1)。重なる場合は false。 */
  rotateRoom: (roomId: string, rotation: number) => boolean
  /** rect サイズ変更。重なる場合は false。 */
  /**
   * §11 Phase 2 / M16: rect 部屋を L 字 polygon に変換する。
   *
   * 戦略:
   *  - 既存 rect の右上 (NE) コーナーを「カット幅 × カット深」だけ切り欠く
   *  - カット寸法は AABB の 1/3 を既定とする。短辺が小さすぎる部屋は弾く
   *  - 切り欠き後の 6 頂点 polygon を作り、新しい edgeIds を発行
   *
   * 戻り値は変換できたかどうか。polygon は壁芯ベースの worldEdges に流れるので
   * recomputeFloor を経由すれば共有壁・自動ドアも正しく再構築される。
   */
  convertRoomToLShape: (roomId: string) => boolean
  resizeRoom: (
    roomId: string,
    next: { x: number; y: number; w: number; h: number },
  ) => boolean
  /**
   * §M37 Phase 3 v0.3: polygon 部屋の特定頂点を新位置に動かす。
   * 軸並行を維持するため、隣接 2 頂点のうち「同じ軸を共有する側」だけを 1 hop 補正する。
   * 重なり判定で拒否時は false。
   */
  moveRoomVertex: (
    roomId: string,
    vertexIdx: number,
    newPos: readonly [number, number],
  ) => boolean
  /**
   * §M38 Phase 3 v0.3: 部屋の用途 (presetId) を変更する。
   * 形状や壁は変えない (compliance だけ次回 schedule で評価し直される)。
   */
  updateRoomPreset: (roomId: string, presetId: string) => boolean

  // §M30 自立壁 (部屋に紐づかない手書きの壁)
  /** 自立壁を 1 本追加。from→to は mm、軸並行を期待 */
  addFreestandingWall: (input: {
    from: readonly [number, number]
    to: readonly [number, number]
    wallType?: Wall['wallType']
    thickness?: number
  }) => string | null
  /** id 指定で自立壁を削除 */
  removeFreestandingWall: (wallId: string) => void
  /**
   * 部屋由来の壁を非表示にする (実体は walls に残るが、レンダリング / 開口配置からは除外)。
   * 主に「壁を任意区間で削除」UX で使う。
   */
  hideWall: (wallId: string) => void
  /** 非表示扱いを解除 */
  unhideWall: (wallId: string) => void

  // Door
  /** §M24: 手動でドアを追加。壁を指定して single-swing ドアを置く */
  addDoor: (input: {
    wallId: string
    positionRatio?: number
    width?: number
    swingDirection?: 'left' | 'right'
  }) => string | null
  /** 手動でドアを削除。削除直前の壁の EdgeKey を tombstone に追加する。 */
  removeDoor: (doorId: string) => void
  /** §M43/M44: ドアの編集 (幅 / 内開きフラグ / swingDirection / type) */
  updateDoor: (
    doorId: string,
    patch: Partial<
      Pick<Door, 'width' | 'positionRatio' | 'swingInward' | 'swingDirection' | 'type'>
    >,
  ) => void

  // Wall (種別・ロック編集。Phase 1 では shape 再生成と独立に直接更新できる)
  updateWall: (
    wallId: string,
    patch: Partial<Pick<Wall, 'wallType' | 'isLocked' | 'thickness' | 'height'>>,
  ) => void
  /**
   * §M34 Phase 3: 共有壁 (sharedBy.length === 2) をドラッグして
   * 両側の部屋の shape を同時に更新する。
   *
   * `offsetMm` は壁に対する法線方向の符号付き変位:
   *  - 垂直な壁 (X=const) の場合は +X 方向の変位
   *  - 水平な壁 (Y=const) の場合は +Y 方向の変位
   *
   * 制約: 両側とも rect 部屋 + rotation === 0 でなければ false。
   * 最小寸法 500mm を下回る場合や他の部屋と重なる場合も false。
   */
  moveSharedWall: (wallId: string, offsetMm: number) => boolean

  // Window (§5.8 自由寸法、Phase 1 では sashId なし)
  addWindow: (input: {
    wallId: string
    positionRatio?: number
    width?: number
    height?: number
    type?: WindowType
    sillHeight?: number
  }) => string | null
  removeWindow: (windowId: string) => void
  updateWindow: (
    windowId: string,
    patch: Partial<Pick<Window, 'positionRatio' | 'width' | 'height' | 'type' | 'sillHeight'>>,
  ) => void
  /**
   * §5.8.3 「展開保存」ルール: サッシ規格を選択した時点で width/height/type/sillHeight を
   * すべて Window 本体に展開コピーし、sashId はあくまで「どこから来た値か」のメタとして残す。
   * 後から catalog 側の数値が変わっても既存の Window には波及しない。
   */
  applyWindowSash: (windowId: string, sashId: string) => boolean

  // Metadata (方位・名前・建物タイプなど)
  updateMetadata: (patch: Partial<FloorplanMetadata>) => void

  // §5.4 Column (Phase 1.5+)
  addColumn: (input: {
    id?: string
    position: readonly [number, number]
    size?: { w: number; h: number }
    isLocked?: boolean
    loadBearing?: boolean
  }) => string | null
  removeColumn: (columnId: string) => void
  updateColumn: (
    columnId: string,
    patch: Partial<Pick<Column, 'position' | 'size' | 'isLocked' | 'loadBearing'>>,
  ) => void
  /** §6.4.2 一軒家の柱を 910mm グリッドに自動配置。既存の柱はクリアして置き直す */
  generateColumnsByGrid: (gridSize?: number) => void

  // §5.5 PipeSpace (Phase 1.5+)
  addPipeSpace: (input: {
    id?: string
    position: readonly [number, number]
    size?: { w: number; h: number }
    systems?: PipeSystem[]
    isLocked?: boolean
  }) => string | null
  removePipeSpace: (psId: string) => void
  updatePipeSpace: (
    psId: string,
    patch: Partial<Pick<PipeSpace, 'position' | 'size' | 'systems' | 'isLocked'>>,
  ) => void

  // §5.2.1 FurnitureInstance (Phase 2+ : M14 から本格運用)
  addFurniture: (input: {
    id?: string
    catalogId: string
    position: readonly [number, number]
    rotation?: number
    scale?: number
  }) => string | null
  removeFurniture: (furnitureId: string) => void
  moveFurniture: (furnitureId: string, position: readonly [number, number]) => void
  rotateFurniture: (furnitureId: string, rotation: number) => void
  /**
   * §M52 v0.6: 家具の拡大率を更新 (各軸 0.2 〜 3.0 でクランプ)。
   * §M69 v0.12: 引数を `number` (uniform) または `[x, y, z]` (3 軸個別) で受ける。
   */
  scaleFurniture: (
    furnitureId: string,
    scale: number | readonly [number, number, number],
  ) => void
  /** Sidebar の "部屋に既定家具を入れる" アクション (preset → catalogId 列を Floor.furniture に追加) */
  autoFurnishAllRooms: () => number

  // §M61 v0.9: HumanModel (3D 上で大きさ感を確認するための人型)
  addHuman: (input?: {
    id?: string
    position?: readonly [number, number]
    rotation?: number
    height?: number
  }) => string | null
  removeHuman: (humanId: string) => void
  moveHuman: (humanId: string, position: readonly [number, number]) => void
  setHumanHeight: (humanId: string, height: number) => void
  /** §M64 v0.11: 人物モデルの Y 軸回転 (rad) を更新 */
  rotateHuman: (humanId: string, rotation: number) => void

  // I/O (§5.1.2 8 ステップローダー連携、§3.5 localforage)
  /** 現在のプランを localforage に保存 (autosave / 手動保存共通) */
  saveLocal: () => Promise<void>
  /** localforage から最後のプランを復元。失敗時は false (新規プランのまま) */
  loadLocal: () => Promise<boolean>
  /** JSON 文字列を読み込み (§5.1.2 importFloorplan を経由)。成功時の mode を返す */
  importJson: (text: string) => import('@/data/loader').ImportResult
  /** 現在の Floorplan を JSON 文字列でエクスポート */
  exportJson: () => string
}

// ============================================================================
// ストア実装
// ============================================================================

/**
 * 履歴に push してから state を変更するヘルパー。アクション内のみで使う。
 * historyStore を直接参照することで src/store/history.ts との循環を避ける。
 */
function snapshotForHistory(plan: Floorplan): void {
  useHistoryStore.getState().push(plan)
}

export const useFloorplanStore = create<FloorplanState>((set, get) => ({
  floorplan: createEmptyFloorplan(),
  activeFloorIndex: 0,

  loadPlan: (plan) => {
    useHistoryStore.getState().clear()
    // §M19: 開いたプランの floors[0] を選択。範囲外の activeFloorIndex を防ぐ
    set({ floorplan: plan, activeFloorIndex: 0 })
  },
  reset: () => {
    useHistoryStore.getState().clear()
    set({ floorplan: createEmptyFloorplan(), activeFloorIndex: 0 })
  },

  // §11 Phase 3 / M19: 複数階対応
  setActiveFloor: (index) => {
    const total = get().floorplan.floors.length
    if (index < 0 || index >= total) return
    set({ activeFloorIndex: index })
  },

  addFloor: (input = {}) => {
    const state = get()
    const total = state.floorplan.floors.length
    // §11 PHASE_FLOORS_RANGE['3'] = max 3
    if (total >= 3) return -1
    const sourceIdx = input.copyFromIndex
    const source = sourceIdx != null ? state.floorplan.floors[sourceIdx] : undefined
    const newId = () => crypto.randomUUID()
    // 新階のレベル既定: 既存の最大 level + 1
    const maxLevel = Math.max(0, ...state.floorplan.floors.map((f) => f.level))
    const level = input.level ?? maxLevel + 1
    const name = input.name ?? `${level}F`
    let newFloor: Floor
    if (source != null) {
      // 既存階のコピー → 共有壁を含まない新規階として recompute する
      const cloned = cloneFloorWithNewIds(source, newId)
      newFloor = recomputeFloor(
        { ...cloned, level, name },
        cloned.rooms,
      )
    } else {
      newFloor = {
        id: newId(),
        level,
        name,
        ceilingHeight: 2400,
        rooms: [],
        walls: [],
        doors: [],
        windows: [],
        columns: [],
        pipeSpaces: [],
        furniture: [],
        humanModels: [],
        voids: [],
        roomFinishes: [],
        wallFinishes: [],
        windowDecorations: [],
        doorDecorations: [],
        suppressedAutoDoors: [],
      }
    }
    snapshotForHistory(state.floorplan)
    const newIdx = total
    set({
      floorplan: {
        ...state.floorplan,
        floors: [...state.floorplan.floors, newFloor],
      },
      activeFloorIndex: newIdx,
    })
    return newIdx
  },

  removeFloor: (index) => {
    const state = get()
    const total = state.floorplan.floors.length
    if (total <= 1) return false
    if (index < 0 || index >= total) return false
    snapshotForHistory(state.floorplan)
    const nextFloors = state.floorplan.floors.filter((_, i) => i !== index)
    const nextActive = Math.min(state.activeFloorIndex, nextFloors.length - 1)
    set({
      floorplan: { ...state.floorplan, floors: nextFloors },
      activeFloorIndex: Math.max(0, nextActive),
    })
    return true
  },

  updateFloorMeta: (index, patch) => {
    const state = get()
    const target = state.floorplan.floors[index]
    if (target == null) return
    const next: Floor = {
      ...target,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.ceilingHeight !== undefined && {
        ceilingHeight: Math.max(2000, Math.round(patch.ceilingHeight)),
      }),
      ...(patch.level !== undefined && { level: patch.level }),
    }
    snapshotForHistory(state.floorplan)
    set({ floorplan: replaceFloor(state.floorplan, next, index) })
  },

  addRoom: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false

    const newRoom: Room = {
      id: input.id ?? crypto.randomUUID(),
      presetId: input.presetId,
      shape: input.shape,
      rotation: input.rotation ?? 0,
    }
    if (overlapsAny(newRoom, floor.rooms)) return false

    snapshotForHistory(state.floorplan)
    const nextRooms = [...floor.rooms, newRoom]
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  removeRoom: (roomId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const nextRooms = floor.rooms.filter((r) => r.id !== roomId)
    if (nextRooms.length === floor.rooms.length) return
    snapshotForHistory(state.floorplan)
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
  },

  moveRoom: (roomId, dx, dy) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const target = floor.rooms.find((r) => r.id === roomId)
    if (target == null) return false

    const nextTarget = applyTranslation(target, dx, dy)
    if (overlapsAny(nextTarget, floor.rooms.filter((r) => r.id !== roomId))) {
      return false
    }
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) => (r.id === roomId ? nextTarget : r))
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  rotateRoom: (roomId, rotation) => {
    const quantized = ((Math.round(rotation / 90) % 4) + 4) % 4
    const target = quantized * 90
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const room = floor.rooms.find((r) => r.id === roomId)
    if (room == null) return false
    if (room.rotation === target) return true

    const nextRoom: Room = { ...room, rotation: target }
    if (overlapsAny(nextRoom, floor.rooms.filter((r) => r.id !== roomId))) {
      return false
    }
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) => (r.id === roomId ? nextRoom : r))
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  convertRoomToLShape: (roomId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const room = floor.rooms.find((r) => r.id === roomId)
    if (room == null || room.shape.kind !== 'rect') return false
    const { x, y, w, h } = room.shape
    // 切り欠きは AABB の 1/3 を既定。最低 500mm は欲しい (法 78 cm 廊下基準)
    const cutW = Math.max(500, Math.round(w / 3))
    const cutH = Math.max(500, Math.round(h / 3))
    if (cutW >= w || cutH >= h) return false
    // 反時計回りに 6 点を発行: NW, NE-inner-top, NE-inner-corner, NE-inner-right, SE, SW
    // (rect の Konva 座標系で y は下向きなので、ここでは「screen down = +Y」に従う)
    const points: ReadonlyArray<readonly [number, number]> = [
      [x, y],                          // NW
      [x + w - cutW, y],               // 北辺の切れ目
      [x + w - cutW, y + cutH],        // 内角
      [x + w, y + cutH],               // 右辺の切れ目
      [x + w, y + h],                  // SE
      [x, y + h],                      // SW
    ]
    const edgeIds: string[] = []
    for (let i = 0; i < points.length; i++) edgeIds.push(crypto.randomUUID())
    const nextRoom: Room = {
      ...room,
      shape: {
        kind: 'polygon',
        points,
        edgeIds,
      },
    }
    if (overlapsAny(nextRoom, floor.rooms.filter((r) => r.id !== roomId))) return false
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) => (r.id === roomId ? nextRoom : r))
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  moveRoomVertex: (roomId, vertexIdx, newPos) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const room = floor.rooms.find((r) => r.id === roomId)
    if (room == null || room.shape.kind !== 'polygon') return false
    const pts = room.shape.points
    if (vertexIdx < 0 || vertexIdx >= pts.length) return false
    const n = pts.length
    const oldP = pts[vertexIdx]!
    const newP: readonly [number, number] = [
      Math.round(newPos[0]),
      Math.round(newPos[1]),
    ]
    if (newP[0] === oldP[0] && newP[1] === oldP[1]) return false
    const prevIdx = (vertexIdx - 1 + n) % n
    const nextIdx = (vertexIdx + 1) % n
    const prev = pts[prevIdx]!
    const next = pts[nextIdx]!
    // 隣接エッジの軸を判定 (horizontal: 同 y, vertical: 同 x)
    const prevHorizontal = prev[1] === oldP[1]
    const nextHorizontal = oldP[1] === next[1]
    // 1 hop 補正
    const newPrev: readonly [number, number] = prevHorizontal
      ? [prev[0], newP[1]] // horizontal: 隣の y を新 y に揃える
      : [newP[0], prev[1]] // vertical: 隣の x を新 x に揃える
    const newNext: readonly [number, number] = nextHorizontal
      ? [next[0], newP[1]]
      : [newP[0], next[1]]
    const nextPoints = pts.map((p, i) => {
      if (i === vertexIdx) return newP
      if (i === prevIdx) return newPrev
      if (i === nextIdx) return newNext
      return p
    })
    // 最小寸法チェック (AABB の幅・高さ ≥ 500mm)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [px, py] of nextPoints) {
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    }
    if (maxX - minX < 500 || maxY - minY < 500) return false
    const nextRoom: Room = {
      ...room,
      shape: { ...room.shape, points: nextPoints },
    }
    if (overlapsAny(nextRoom, floor.rooms.filter((r) => r.id !== roomId))) {
      return false
    }
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) => (r.id === roomId ? nextRoom : r))
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  updateRoomPreset: (roomId, presetId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    if (getPreset(presetId) == null) return false
    const room = floor.rooms.find((r) => r.id === roomId)
    if (room == null) return false
    if (room.presetId === presetId) return false
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) =>
      r.id === roomId ? { ...r, presetId } : r,
    )
    set({ floorplan: replaceFloor(state.floorplan, { ...floor, rooms: nextRooms }, floorIdx) })
    return true
  },

  resizeRoom: (roomId, next) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const room = floor.rooms.find((r) => r.id === roomId)
    if (room == null || room.shape.kind !== 'rect') return false

    const nextRoom: Room = {
      ...room,
      shape: {
        ...room.shape,
        x: Math.round(next.x),
        y: Math.round(next.y),
        w: Math.round(next.w),
        h: Math.round(next.h),
      },
    }
    if (overlapsAny(nextRoom, floor.rooms.filter((r) => r.id !== roomId))) {
      return false
    }
    snapshotForHistory(state.floorplan)
    const nextRooms = floor.rooms.map((r) => (r.id === roomId ? nextRoom : r))
    const nextFloor = recomputeFloor(floor, nextRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  // §M30 自立壁
  addFreestandingWall: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    const length = Math.hypot(input.to[0] - input.from[0], input.to[1] - input.from[1])
    if (length < 100) return null // 100mm 未満は捨てる
    const id = crypto.randomUUID()
    const newWall: Wall = {
      id,
      from: [Math.round(input.from[0]), Math.round(input.from[1])],
      to: [Math.round(input.to[0]), Math.round(input.to[1])],
      thickness: input.thickness ?? 100,
      wallType: input.wallType ?? 'partition',
      isLocked: false,
      sharedBy: [],
    }
    snapshotForHistory(state.floorplan)
    const existing = floor.freestandingWalls ?? []
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        freestandingWalls: [...existing, newWall],
      }, floorIdx),
    })
    return id
  },

  removeFreestandingWall: (wallId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const existing = floor.freestandingWalls ?? []
    if (!existing.some((w) => w.id === wallId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        freestandingWalls: existing.filter((w) => w.id !== wallId),
      }, floorIdx),
    })
  },

  hideWall: (wallId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const hidden = floor.hiddenWallIds ?? []
    if (hidden.includes(wallId)) return
    // §M85 v0.18: 壁を非表示にする時、その壁に貼り付いているドア/窓も一緒に削除する。
    // 旧仕様だと壁だけ消えてドアが宙に浮いていた (3D ではパネルだけが残る) ため。
    const nextDoors = floor.doors.filter((d) => d.wallId !== wallId)
    const nextWindows = floor.windows.filter((w) => w.wallId !== wallId)
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        hiddenWallIds: [...hidden, wallId],
        doors: nextDoors,
        windows: nextWindows,
      }, floorIdx),
    })
  },

  unhideWall: (wallId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const hidden = floor.hiddenWallIds ?? []
    if (!hidden.includes(wallId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        hiddenWallIds: hidden.filter((id) => id !== wallId),
      }, floorIdx),
    })
  },

  addDoor: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    // §M53 v0.7: 自立壁 (freestandingWalls) も対象に含める
    const wall =
      floor.walls.find((w) => w.id === input.wallId) ??
      floor.freestandingWalls?.find((w) => w.id === input.wallId)
    if (wall == null) return null

    const id = crypto.randomUUID()
    const door: Door = {
      id,
      wallId: input.wallId,
      positionRatio: clamp(input.positionRatio ?? 0.5, 0, 1),
      width: input.width ?? 800,
      type: 'single-swing',
      ...(input.swingDirection !== undefined && { swingDirection: input.swingDirection }),
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        doors: [...floor.doors, door],
      }, floorIdx),
    })
    return id
  },

  updateDoor: (doorId, patch) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.doors.findIndex((d) => d.id === doorId)
    if (idx < 0) return
    const door = floor.doors[idx]!
    const next: Door = {
      ...door,
      ...(patch.width !== undefined && {
        width: Math.max(400, Math.round(patch.width)),
      }),
      ...(patch.positionRatio !== undefined && {
        positionRatio: clamp(patch.positionRatio, 0, 1),
      }),
      ...(patch.swingInward !== undefined && { swingInward: patch.swingInward }),
      ...(patch.swingDirection !== undefined && {
        swingDirection: patch.swingDirection,
      }),
      ...(patch.type !== undefined && { type: patch.type }),
    }
    snapshotForHistory(state.floorplan)
    const nextDoors = floor.doors.map((d, i) => (i === idx ? next : d))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, doors: nextDoors }, floorIdx),
    })
  },

  removeDoor: (doorId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const door = floor.doors.find((d) => d.id === doorId)
    if (door == null) return
    const wall = floor.walls.find((w) => w.id === door.wallId)
    const nextDoors = floor.doors.filter((d) => d.id !== doorId)
    const nextTombstones: readonly AutoDoorSuppression[] =
      wall == null
        ? floor.suppressedAutoDoors
        : addAutoDoorSuppression({
            wall,
            rooms: floor.rooms,
            existing: floor.suppressedAutoDoors,
          })
    snapshotForHistory(state.floorplan)
    const nextFloor: Floor = {
      ...floor,
      doors: nextDoors,
      suppressedAutoDoors: [...nextTombstones],
    }
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
  },

  updateWall: (wallId, patch) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.walls.findIndex((w) => w.id === wallId)
    if (idx < 0) return
    const wall = floor.walls[idx]!
    const next: Wall = {
      ...wall,
      ...(patch.wallType !== undefined && { wallType: patch.wallType }),
      ...(patch.isLocked !== undefined && { isLocked: patch.isLocked }),
      ...(patch.thickness !== undefined && { thickness: patch.thickness }),
      ...(patch.height !== undefined && { height: patch.height }),
    }
    if (
      next.wallType === wall.wallType &&
      next.isLocked === wall.isLocked &&
      next.thickness === wall.thickness &&
      next.height === wall.height
    ) {
      return
    }
    snapshotForHistory(state.floorplan)
    const nextWalls = floor.walls.map((w, i) => (i === idx ? next : w))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, walls: nextWalls }, floorIdx),
    })
  },

  moveSharedWall: (wallId, offsetMm) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const wall = floor.walls.find((w) => w.id === wallId)
    if (wall == null || wall.sharedBy.length !== 2) return false
    // 壁の方向: ほぼ X 軸沿い (= 横向き / 水平壁) なら法線は Y、X 軸沿いなら法線は X
    const dx = wall.to[0] - wall.from[0]
    const dy = wall.to[1] - wall.from[1]
    const isVertical = Math.abs(dy) > Math.abs(dx)
    if (Math.round(offsetMm) === 0) return false

    // 両側の部屋を引いて、それぞれどのエッジに当たるかを判定
    const updates = new Map<string, { x: number; y: number; w: number; h: number }>()
    const MIN_DIM = 500
    for (const roomId of wall.sharedBy) {
      const room = floor.rooms.find((r) => r.id === roomId)
      if (room == null) return false
      if (room.shape.kind !== 'rect') return false
      // rotation 0/180 のみ対応 (90 / 270 は AABB と shape が swap される)
      const rot = ((Math.round(room.rotation / 90) % 4) + 4) % 4
      if (rot !== 0 && rot !== 2) return false
      const { x, y, w, h } = room.shape
      if (isVertical) {
        const wallX = wall.from[0]
        if (Math.abs(x - wallX) <= 1) {
          // この壁は room の左エッジ
          const nx = x + offsetMm
          const nw = w - offsetMm
          if (nw < MIN_DIM) return false
          updates.set(roomId, { x: nx, y, w: nw, h })
        } else if (Math.abs(x + w - wallX) <= 1) {
          // この壁は room の右エッジ
          const nw = w + offsetMm
          if (nw < MIN_DIM) return false
          updates.set(roomId, { x, y, w: nw, h })
        } else {
          return false
        }
      } else {
        const wallY = wall.from[1]
        if (Math.abs(y - wallY) <= 1) {
          const ny = y + offsetMm
          const nh = h - offsetMm
          if (nh < MIN_DIM) return false
          updates.set(roomId, { x, y: ny, w, h: nh })
        } else if (Math.abs(y + h - wallY) <= 1) {
          const nh = h + offsetMm
          if (nh < MIN_DIM) return false
          updates.set(roomId, { x, y, w, h: nh })
        } else {
          return false
        }
      }
    }

    // 重なり判定: 更新後の 2 部屋が他の部屋と被らないか
    const updatedRooms = floor.rooms.map((r) => {
      const u = updates.get(r.id)
      if (u == null || r.shape.kind !== 'rect') return r
      return { ...r, shape: { ...r.shape, ...u } }
    })
    for (const r of updatedRooms) {
      const others = updatedRooms.filter((x) => x.id !== r.id)
      if (overlapsAny(r, others)) return false
    }

    snapshotForHistory(state.floorplan)
    const nextFloor = recomputeFloor(floor, updatedRooms)
    set({ floorplan: replaceFloor(state.floorplan, nextFloor, floorIdx) })
    return true
  },

  addWindow: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    // §M53 v0.7: 自立壁 (freestandingWalls) も対象に含める
    const wall =
      floor.walls.find((w) => w.id === input.wallId) ??
      floor.freestandingWalls?.find((w) => w.id === input.wallId)
    if (wall == null) return null

    const id = crypto.randomUUID()
    const window: Window = {
      id,
      wallId: input.wallId,
      positionRatio: clamp(input.positionRatio ?? 0.5, 0, 1),
      width: input.width ?? 1690,
      height: input.height ?? 1170,
      type: input.type ?? 'sliding-2',
      sillHeight: input.sillHeight ?? 800,
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        windows: [...floor.windows, window],
      }, floorIdx),
    })
    return id
  },

  removeWindow: (windowId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    if (!floor.windows.some((w) => w.id === windowId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        windows: floor.windows.filter((w) => w.id !== windowId),
      }, floorIdx),
    })
  },

  updateWindow: (windowId, patch) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.windows.findIndex((w) => w.id === windowId)
    if (idx < 0) return
    const w = floor.windows[idx]!
    const next: Window = {
      ...w,
      ...(patch.positionRatio !== undefined && { positionRatio: clamp(patch.positionRatio, 0, 1) }),
      ...(patch.width !== undefined && { width: Math.max(100, Math.round(patch.width)) }),
      ...(patch.height !== undefined && { height: Math.max(100, Math.round(patch.height)) }),
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.sillHeight !== undefined && { sillHeight: Math.max(0, Math.round(patch.sillHeight)) }),
    }
    snapshotForHistory(state.floorplan)
    const nextWindows = floor.windows.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, windows: nextWindows }, floorIdx),
    })
  },

  applyWindowSash: (windowId, sashId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return false
    const idx = floor.windows.findIndex((w) => w.id === windowId)
    if (idx < 0) return false
    const entry = getSashEntry(sashId)
    if (entry == null) return false
    const w = floor.windows[idx]!
    // §5.8.3: catalog の数値を全て本体にコピー。後で catalog が更新されても波及させない。
    const next: Window = {
      ...w,
      sashId,
      width: entry.width,
      height: entry.height,
      type: entry.type,
      sillHeight: entry.sillHeight,
    }
    snapshotForHistory(state.floorplan)
    const nextWindows = floor.windows.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, windows: nextWindows }, floorIdx),
    })
    return true
  },

  updateMetadata: (patch) => {
    const state = get()
    snapshotForHistory(state.floorplan)
    set({
      floorplan: {
        ...state.floorplan,
        metadata: {
          ...state.floorplan.metadata,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    })
  },

  // ---------------------------------------------------------------------------
  // §5.4 Column
  // ---------------------------------------------------------------------------

  addColumn: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    const id = input.id ?? crypto.randomUUID()
    const column: Column = {
      id,
      position: [Math.round(input.position[0]), Math.round(input.position[1])],
      size: input.size ?? { w: 105, h: 105 },
      isLocked: input.isLocked ?? false,
      loadBearing: input.loadBearing ?? false,
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        columns: [...floor.columns, column],
      }, floorIdx),
    })
    return id
  },

  removeColumn: (columnId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    if (!floor.columns.some((c) => c.id === columnId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        columns: floor.columns.filter((c) => c.id !== columnId),
      }, floorIdx),
    })
  },

  updateColumn: (columnId, patch) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.columns.findIndex((c) => c.id === columnId)
    if (idx < 0) return
    const c = floor.columns[idx]!
    const next: Column = {
      ...c,
      ...(patch.position !== undefined && {
        position: [Math.round(patch.position[0]), Math.round(patch.position[1])],
      }),
      ...(patch.size !== undefined && { size: patch.size }),
      ...(patch.isLocked !== undefined && { isLocked: patch.isLocked }),
      ...(patch.loadBearing !== undefined && { loadBearing: patch.loadBearing }),
    }
    snapshotForHistory(state.floorplan)
    const nextColumns = floor.columns.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, columns: nextColumns }, floorIdx),
    })
  },

  generateColumnsByGrid: (gridSize) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const g = gridSize ?? state.floorplan.metadata.gridSize ?? 910

    // 部屋の AABB を集計し、910mm 倍数の grid 交点を列挙する
    if (floor.rooms.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of floor.rooms) {
      if (r.shape.kind !== 'rect') continue
      minX = Math.min(minX, r.shape.x)
      minY = Math.min(minY, r.shape.y)
      maxX = Math.max(maxX, r.shape.x + r.shape.w)
      maxY = Math.max(maxY, r.shape.y + r.shape.h)
    }
    if (!Number.isFinite(minX)) return
    const startX = Math.floor(minX / g) * g
    const startY = Math.floor(minY / g) * g
    const newCols: Column[] = []
    for (let x = startX; x <= maxX; x += g) {
      for (let y = startY; y <= maxY; y += g) {
        // §M20: AABB の四隅は耐力柱として既定で loadBearing=true にする
        // (通し柱整合チェックの起点)。中間柱は false のまま。
        const isCorner =
          (x === startX || x >= maxX) && (y === startY || y >= maxY)
        newCols.push({
          id: crypto.randomUUID(),
          position: [x, y],
          size: { w: 105, h: 105 },
          isLocked: false,
          loadBearing: isCorner,
        })
      }
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, columns: newCols }, floorIdx),
    })
  },

  // ---------------------------------------------------------------------------
  // §5.5 PipeSpace
  // ---------------------------------------------------------------------------

  addPipeSpace: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    const id = input.id ?? crypto.randomUUID()
    const ps: PipeSpace = {
      id,
      position: [Math.round(input.position[0]), Math.round(input.position[1])],
      size: input.size ?? { w: 600, h: 600 },
      systems: input.systems ?? ['water-supply', 'drainage'],
      isLocked: input.isLocked ?? false,
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        pipeSpaces: [...floor.pipeSpaces, ps],
      }, floorIdx),
    })
    return id
  },

  removePipeSpace: (psId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    if (!floor.pipeSpaces.some((p) => p.id === psId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        pipeSpaces: floor.pipeSpaces.filter((p) => p.id !== psId),
      }, floorIdx),
    })
  },

  updatePipeSpace: (psId, patch) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.pipeSpaces.findIndex((p) => p.id === psId)
    if (idx < 0) return
    const p = floor.pipeSpaces[idx]!
    const next: PipeSpace = {
      ...p,
      ...(patch.position !== undefined && {
        position: [Math.round(patch.position[0]), Math.round(patch.position[1])],
      }),
      ...(patch.size !== undefined && { size: patch.size }),
      ...(patch.systems !== undefined && { systems: [...patch.systems] }),
      ...(patch.isLocked !== undefined && { isLocked: patch.isLocked }),
    }
    snapshotForHistory(state.floorplan)
    const nextPs = floor.pipeSpaces.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, pipeSpaces: nextPs }, floorIdx),
    })
  },

  // ---------------------------------------------------------------------------
  // §5.2.1 FurnitureInstance (Phase 2 / M14 から本格運用)
  // ---------------------------------------------------------------------------

  addFurniture: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    if (getCatalogEntry(input.catalogId) == null) return null
    const id = input.id ?? crypto.randomUUID()
    const fi: FurnitureInstance = {
      id,
      catalogId: input.catalogId,
      position: [Math.round(input.position[0]), Math.round(input.position[1])],
      rotation: input.rotation ?? 0,
      ...(input.scale !== undefined && { scale: input.scale }),
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        furniture: [...floor.furniture, fi],
      }, floorIdx),
    })
    return id
  },

  removeFurniture: (furnitureId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    if (!floor.furniture.some((f) => f.id === furnitureId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        furniture: floor.furniture.filter((f) => f.id !== furnitureId),
      }, floorIdx),
    })
  },

  moveFurniture: (furnitureId, position) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.furniture.findIndex((f) => f.id === furnitureId)
    if (idx < 0) return
    const f = floor.furniture[idx]!
    const next: FurnitureInstance = {
      ...f,
      position: [Math.round(position[0]), Math.round(position[1])],
    }
    snapshotForHistory(state.floorplan)
    const nextFurniture = floor.furniture.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, furniture: nextFurniture }, floorIdx),
    })
  },

  rotateFurniture: (furnitureId, rotation) => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.furniture.findIndex((f) => f.id === furnitureId)
    if (idx < 0) return
    const f = floor.furniture[idx]!
    const next: FurnitureInstance = { ...f, rotation }
    snapshotForHistory(state.floorplan)
    const nextFurniture = floor.furniture.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, furniture: nextFurniture }, floorIdx),
    })
  },

  scaleFurniture: (furnitureId, scale) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.furniture.findIndex((f) => f.id === furnitureId)
    if (idx < 0) return
    const f = floor.furniture[idx]!
    // §M69 v0.12: 各軸 0.2〜3.0 にクランプ。number/tuple のいずれも受ける
    const clampAxis = (v: number) => Math.max(0.2, Math.min(3.0, v))
    let nextScale: number | readonly [number, number, number]
    if (typeof scale === 'number') {
      nextScale = clampAxis(scale)
    } else {
      nextScale = [clampAxis(scale[0]), clampAxis(scale[1]), clampAxis(scale[2])] as const
    }
    // 変化なしなら set しない (履歴肥大化防止)
    const prev = f.scale
    const sameAsPrev = (() => {
      if (typeof nextScale === 'number') {
        return typeof prev === 'number' && Math.abs(prev - nextScale) < 0.005
      }
      const prevArr = prev == null ? [1, 1, 1] : typeof prev === 'number' ? [prev, prev, prev] : prev
      return (
        Math.abs(prevArr[0]! - nextScale[0]) < 0.005 &&
        Math.abs(prevArr[1]! - nextScale[1]) < 0.005 &&
        Math.abs(prevArr[2]! - nextScale[2]) < 0.005
      )
    })()
    if (sameAsPrev) return
    const next: FurnitureInstance = { ...f, scale: nextScale }
    snapshotForHistory(state.floorplan)
    const nextFurniture = floor.furniture.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, furniture: nextFurniture }, floorIdx),
    })
  },

  // ---------------------------------------------------------------------------
  // §M61 v0.9: HumanModel — 3D で大きさ感を掴むための人型 (家具と並ぶ entity)
  // ---------------------------------------------------------------------------
  addHuman: (input) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return null
    const id = input?.id ?? crypto.randomUUID()
    const px = input?.position ? Math.round(input.position[0]) : 0
    const pz = input?.position ? Math.round(input.position[1]) : 0
    const heightMm =
      typeof input?.height === 'number' && Number.isFinite(input.height) && input.height > 0
        ? Math.max(500, Math.min(2500, Math.round(input.height)))
        : 1700
    const human = {
      id,
      position: [px, pz] as readonly [number, number],
      rotation: input?.rotation ?? 0,
      height: heightMm,
    }
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        humanModels: [...floor.humanModels, human],
      }, floorIdx),
    })
    return id
  },

  removeHuman: (humanId) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    if (!floor.humanModels.some((h) => h.id === humanId)) return
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, {
        ...floor,
        humanModels: floor.humanModels.filter((h) => h.id !== humanId),
      }, floorIdx),
    })
  },

  moveHuman: (humanId, position) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.humanModels.findIndex((h) => h.id === humanId)
    if (idx < 0) return
    const h = floor.humanModels[idx]!
    const next = {
      ...h,
      position: [Math.round(position[0]), Math.round(position[1])] as readonly [number, number],
    }
    if (next.position[0] === h.position[0] && next.position[1] === h.position[1]) return
    snapshotForHistory(state.floorplan)
    const nextHumans = floor.humanModels.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, humanModels: nextHumans }, floorIdx),
    })
  },

  setHumanHeight: (humanId, height) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.humanModels.findIndex((h) => h.id === humanId)
    if (idx < 0) return
    const h = floor.humanModels[idx]!
    // §M62 v0.9: 身長は 500mm 〜 2500mm の範囲にクランプ (子供〜長身大人をカバー)
    const clamped = Math.max(500, Math.min(2500, Math.round(height)))
    if (clamped === h.height) return
    const next = { ...h, height: clamped }
    snapshotForHistory(state.floorplan)
    const nextHumans = floor.humanModels.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, humanModels: nextHumans }, floorIdx),
    })
  },

  rotateHuman: (humanId, rotation) => {
    const state = get()
    const floorIdx = state.activeFloorIndex
    const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return
    const idx = floor.humanModels.findIndex((h) => h.id === humanId)
    if (idx < 0) return
    const h = floor.humanModels[idx]!
    if (Math.abs(h.rotation - rotation) < 1e-4) return
    const next = { ...h, rotation }
    snapshotForHistory(state.floorplan)
    const nextHumans = floor.humanModels.map((x, i) => (i === idx ? next : x))
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, humanModels: nextHumans }, floorIdx),
    })
  },

  /**
   * 全部屋について preset の既定家具を Floor.furniture に追加する。
   * 既に同じ catalogId が同じ部屋の中央にあるものは重複追加しない (idempotent)。
   */
  autoFurnishAllRooms: () => {
    const state = get()
    const floorIdx = state.activeFloorIndex; const floor = state.floorplan.floors[floorIdx]
    if (floor == null) return 0
    let added = 0
    const baseFurniture = [...floor.furniture]
    for (const room of floor.rooms) {
      if (room.shape.kind !== 'rect') continue
      const cx = room.shape.x + room.shape.w / 2
      const cz = room.shape.y + room.shape.h / 2
      const defaults = defaultFurnitureForPreset(
        room.presetId,
        room.shape.w,
        room.shape.h,
      )
      for (const def of defaults) {
        const worldX = Math.round(cx + def.offsetXZ[0])
        const worldZ = Math.round(cz + def.offsetXZ[1])
        // 既存と完全一致 (catalogId + position) なら skip
        const dup = baseFurniture.some(
          (f) =>
            f.catalogId === def.catalogId &&
            Math.abs(f.position[0] - worldX) <= 1 &&
            Math.abs(f.position[1] - worldZ) <= 1,
        )
        if (dup) continue
        baseFurniture.push({
          id: crypto.randomUUID(),
          catalogId: def.catalogId,
          position: [worldX, worldZ],
          rotation: def.rotation,
        })
        added++
      }
    }
    if (added === 0) return 0
    snapshotForHistory(state.floorplan)
    set({
      floorplan: replaceFloor(state.floorplan, { ...floor, furniture: baseFurniture }, floorIdx),
    })
    return added
  },

  saveLocal: async () => {
    await saveCurrent(get().floorplan)
  },

  loadLocal: async () => {
    const plan = await loadCurrent()
    if (plan == null) return false
    useHistoryStore.getState().clear()
    set({ floorplan: plan })
    return true
  },

  importJson: (text): ImportResult => {
    const result = importFloorplan(text)
    if (result.ok && result.mode === 'normal') {
      useHistoryStore.getState().clear()
      set({ floorplan: result.data as Floorplan })
    } else if (result.ok && result.mode === 'readonly') {
      // readonly モードでは Floorplan として完全な検証を通っていないので、
      // UI 側で readonly フラグを立てた上で「描画用」として扱う。
      // ストアには形だけ Floorplan としてセットする (型は緩めて扱う)。
      useHistoryStore.getState().clear()
      set({ floorplan: result.data as Floorplan })
    }
    return result
  },

  exportJson: () => exportFloorplanJson(get().floorplan),
}))

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ============================================================================
// ヘルパー
// ============================================================================

function replaceFloor(plan: Floorplan, floor: Floor, atIndex = 0): Floorplan {
  return {
    ...plan,
    floors: plan.floors.map((f, i) => (i === atIndex ? floor : f)),
  }
}

/**
 * §11 Phase 3 / M19: 同じ Floor の deep clone を返す (id 再採番付き)。
 * `addFloor({ copyFromIndex })` で別階に複製するときに使う。
 *
 * Wall は room との EdgeKey 結合があるので、room の edgeId を新発行 → walls は
 * recomputeFloor で再生成させるのが安全 (古い壁を流用するとリベインドが破綻する)。
 */
function cloneFloorWithNewIds(source: Floor, newId: () => string): Floor {
  const roomIdMap = new Map<string, string>()
  const newRooms = source.rooms.map((r): Room => {
    const newRoomId = newId()
    roomIdMap.set(r.id, newRoomId)
    if (r.shape.kind === 'rect') {
      const next: Room = {
        ...r,
        id: newRoomId,
        shape: {
          ...r.shape,
          edgeIds: [newId(), newId(), newId(), newId()],
        },
      }
      return next
    }
    return {
      ...r,
      id: newRoomId,
      shape: {
        ...r.shape,
        edgeIds: r.shape.edgeIds.map(() => newId()),
      },
    }
  })
  return {
    ...source,
    id: newId(),
    rooms: newRooms,
    // 壁・ドア・窓は recomputeFloor で完全再生成させるため空にしておく
    walls: [],
    doors: [],
    windows: [],
    columns: source.columns.map((c) => ({ ...c, id: newId() })),
    pipeSpaces: source.pipeSpaces.map((p) => ({ ...p, id: newId() })),
    furniture: source.furniture.map((f) => ({ ...f, id: newId() })),
    humanModels: source.humanModels.map((h) => ({ ...h, id: newId() })),
    voids: source.voids.map((v) => ({ ...v, id: newId() })),
    roomFinishes: source.roomFinishes.map((rf) => ({
      ...rf,
      roomId: roomIdMap.get(rf.roomId) ?? rf.roomId,
    })),
    wallFinishes: [], // 壁を再生成するので仕上げは一旦クリア
    windowDecorations: [],
    doorDecorations: [],
    suppressedAutoDoors: [],
  }
}

function applyTranslation(room: Room, dx: number, dy: number): Room {
  if (room.shape.kind === 'rect') {
    return {
      ...room,
      shape: {
        ...room.shape,
        x: Math.round(room.shape.x + dx),
        y: Math.round(room.shape.y + dy),
      },
    }
  }
  if (room.shape.kind === 'polygon') {
    // §M45 v0.4: polygon 部屋も dx/dy で各頂点を平行移動する。
    // これがないと Konva の Group drag で床は移動するが store は不変 →
    // 壁の再生成が起きず「床と壁がずれる」現象に繋がる
    return {
      ...room,
      shape: {
        ...room.shape,
        points: room.shape.points.map(
          ([px, py]) =>
            [Math.round(px + dx), Math.round(py + dy)] as readonly [number, number],
        ),
      },
    }
  }
  return room
}

// ============================================================================
// セレクタ (UI 層から使いやすくするヘルパー)
//
// 注意: selector 内で `?? []` を返すと毎回新参照になり、Zustand の
// useSyncExternalStore が「変わった」と判定して無限再レンダーする (§M5 で同じ問題に遭遇)。
// 必ず安定参照の EMPTY_* を返すこと。
// ============================================================================

const EMPTY_ROOMS: readonly Room[] = []
const EMPTY_WALLS: readonly Wall[] = []
const EMPTY_DOORS: readonly Door[] = []

export const selectFloor = (s: FloorplanState): Floor | undefined =>
  s.floorplan.floors[s.activeFloorIndex]
export const selectRooms = (s: FloorplanState): readonly Room[] =>
  s.floorplan.floors[s.activeFloorIndex]?.rooms ?? EMPTY_ROOMS
export const selectWalls = (s: FloorplanState): readonly Wall[] =>
  s.floorplan.floors[s.activeFloorIndex]?.walls ?? EMPTY_WALLS
export const selectDoors = (s: FloorplanState): readonly Door[] =>
  s.floorplan.floors[s.activeFloorIndex]?.doors ?? EMPTY_DOORS
export const selectEdgeId = (room: Room, index: number): EdgeId | undefined =>
  room.shape.edgeIds[index]
