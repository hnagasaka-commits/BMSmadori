/**
 * UI 状態 (選択中の要素、表示設定など)。
 * 履歴の対象にしないため floorplanStore とは分離する。
 */

import { create } from 'zustand'
import type Konva from 'konva'
import type { Season } from '@/core/three/sunPosition'

export type SelectedElement =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'door'; id: string }
  | { kind: 'window'; id: string }
  /** §11 Phase 2 / M14: 3D 中で選択された家具 */
  | { kind: 'furniture'; id: string }
  /** §11 Phase 3 / M20: 柱 (loadBearing 編集 + 通し柱整合のため) */
  | { kind: 'column'; id: string }
  /** §M61 v0.9: 3D 中で選択された人物モデル (スケール感の確認用) */
  | { kind: 'human'; id: string }
  | null

/**
 * 編集ツール。
 * - select : クリックで要素選択 (既定)
 * - window : 壁クリックで窓配置
 */
/**
 * §M24/M27/M30: ツール一覧。
 * - select : 既定 (要素選択)
 * - window : 壁クリックで窓配置
 * - door   : 壁クリックでドア配置
 * - draw   : §M28 線で間取りを描く (ドラッグフリーハンド)
 * - wall   : §M30 自立壁を 1 本ずつ描く (ドラッグ)
 */
export type EditorTool = 'select' | 'window' | 'door' | 'draw' | 'wall'

/**
 * §M27 Phase 3: 線描画中のバッファ。
 * - points は既にコミット済みのクリック座標 (mm)。
 * - cursorMm はマウスの現在位置 (mm)。ライブプレビュー用。
 * - すべての点は呼び出し側で「自動直線化 + グリッドスナップ」してから push する。
 */
export type DrawingState = {
  points: ReadonlyArray<readonly [number, number]>
  /** 直近マウス位置 (px ではなく mm)。プレビュー用 */
  cursorMm: readonly [number, number] | null
}

/**
 * §11 Phase 2 / M12: ビュー切替。
 * - 2d : Konva 2D エディタ (既定。すべての編集ツールが利用可)
 * - 3d : R3F の 3D プレビュー (M12 時点では閲覧のみ)
 */
export type ViewMode = '2d' | '3d'

/**
 * §11 Phase 2 / M13: 3D ビューの IBL / sun プリセット。
 * - noon : 真昼 (既定)。drei の "city" + 太陽真上付近
 * - evening : 夕方。drei の "sunset" + 太陽を低く
 * - night : 夜。drei の "night" + 室内灯モック
 */
export type LightingPreset = 'noon' | 'evening' | 'night'

/**
 * §M119 v0.28: 2D の表示レイヤー。
 *  - 'floor'   (既定): 床に置くもの (壁 / 床 / 床家具) を表示。天井設備は非表示
 *  - 'ceiling': 床面プランを薄くグレーアウトし、天井設備 (mountTo='ceiling') のマークを重畳描画する
 * BMS 点検用途では DXF 取込直後に 'ceiling' を既定に立てる (setInitialFromImport)。
 */
export type LayerMode = 'floor' | 'ceiling'

export type EditorState = {
  selected: SelectedElement
  tool: EditorTool
  /** §M27: 描画中バッファ。null なら描画モードは「待機」 */
  drawing: DrawingState | null
  /**
   * §M32 Phase 3: 現在ドラッグ中の部屋 id。
   * その部屋に紐づく壁 / 窓 / ドアは 2D で一時的に非表示にして、
   * Group ローカルの Rect stroke を「動く部屋輪郭」として見せる。
   */
  draggingRoomId: string | null
  /**
   * §M79 v0.15: ドラッグ中の部屋の移動量 (mm)。
   * RoomShape の onDragMove で更新し、WallLine 側でこの値を加算して
   * 「床 (Rect) と壁が一緒に動く」見た目を実現する。
   * 旧 §M32 は壁を非表示にしていたが、バルコニーのように剥き出しの外周壁を
   * 持つ部屋では「壁が消えて床だけ動く」ように見えて違和感が強かったため。
   */
  draggingOffset: { dx: number; dy: number } | null
  /**
   * §M41 Phase 3 v0.3: リサイズ中のライブプレビュー (1 部屋向け、角ハンドル用)。
   */
  resizePreview: {
    roomId: string
    x: number
    y: number
    w: number
    h: number
  } | null
  /**
   * §M41 Phase 3 v0.3: 共有壁ドラッグ中の 2 部屋プレビュー (room.id → 新しい AABB)。
   * 0 件か 2 件のどちらか。
   */
  sharedWallPreview: ReadonlyArray<{
    roomId: string
    x: number
    y: number
    w: number
    h: number
  }>
  viewMode: ViewMode
  lightingPreset: LightingPreset
  /**
   * §M78 v0.14: 一人称視点 (FPV) でカメラを置く対象の HumanModel.id。
   * null なら通常の OrbitControls 視点。文字列が入ると Canvas3D が
   * 該当する人モデルの目の高さにカメラを置き、PointerLockControls で見回す。
   */
  fpvHumanId: string | null
  /**
   * §M97 v0.21: 3D 上の屋根スタイル。
   *  - 'none'  : 屋根なし (旧挙動)
   *  - 'flat'  : 平らな陸屋根
   *  - 'gable' : 切妻 (両側に傾斜)
   *  - 'shed'  : 片流れ (片側のみ傾斜)
   */
  roofStyle: 'none' | 'flat' | 'gable' | 'shed'
  /**
   * §M99 v0.22: 3D で表示する階のインデックス。null なら全階表示 (旧挙動)。
   * 数値が入ると Canvas3D はその階のみ描画する (他階の壁/床/家具を全て非表示)。
   */
  visibleFloorIndex: number | null
  /**
   * §M119 v0.28: 2D の表示レイヤー (床 / 天井)。
   * UI のトグルで切替。'ceiling' 時は床面プランをグレーアウトして天井設備マークを重畳。
   */
  layerMode: LayerMode
  /** §11 Phase 2 / M17: 太陽時 (0..24)。LightingRig が太陽位置に変換 */
  sunHour: number
  /** §11 Phase 2 / M17: 季節。日の出/日の入り時刻と南中高度を決める */
  season: Season
  /**
   * §M17 復旧プレビューモード。
   * 編集アクション / 保存 / エクスポート系の UI をすべて無効化する。
   * Tolerant スキーマで開いた将来 version、または整合性チェックで重大エラーが出たファイル。
   */
  readonly: boolean
  /** 復旧プレビューに入った理由 (バナーに表示) */
  readonlyReason: string | null
  /** 910mm / 455mm / 50mm (§9.7.1) */
  gridSize: number
  /** ステージのズーム倍率 */
  zoom: number
  /** ステージのパン (mm) */
  pan: { x: number; y: number }

  select: (sel: SelectedElement) => void
  clearSelection: () => void
  setTool: (tool: EditorTool) => void
  /** §M32: 部屋ドラッグの開始/終了マーカー (壁プレビューと同期) */
  setDraggingRoomId: (id: string | null) => void
  /** §M79 v0.15: 部屋ドラッグ中のオフセット (mm)。WallLine が壁を追従させるのに使う */
  setDraggingOffset: (offset: { dx: number; dy: number } | null) => void
  /** §M41: リサイズ中のプレビュー寸法を設定 (null でクリア) */
  setResizePreview: (preview: EditorState['resizePreview']) => void
  /** §M41: 共有壁ドラッグ中の 2 部屋プレビューを設定 ([] でクリア) */
  setSharedWallPreview: (preview: EditorState['sharedWallPreview']) => void
  /** §M27 描画 API: 開始 / 点追加 / カーソル移動 / 確定 (= 点列を返す) / キャンセル */
  startDrawing: (firstPoint: readonly [number, number]) => void
  addDrawPoint: (point: readonly [number, number]) => void
  moveDrawCursor: (point: readonly [number, number] | null) => void
  finishDrawing: () => ReadonlyArray<readonly [number, number]> | null
  cancelDrawing: () => void
  setViewMode: (mode: ViewMode) => void
  setLightingPreset: (preset: LightingPreset) => void
  /** §M78 v0.14: 一人称視点モードに入る/抜ける */
  enterFpv: (humanId: string) => void
  exitFpv: () => void
  /** §M97 v0.21: 屋根スタイルを切替 */
  setRoofStyle: (style: 'none' | 'flat' | 'gable' | 'shed') => void
  /** §M99 v0.22: 3D の表示対象階を設定 (null=全階表示) */
  setVisibleFloorIndex: (index: number | null) => void
  /** §M119 v0.28: 2D レイヤー (floor/ceiling) の切替 */
  setLayerMode: (mode: LayerMode) => void
  setSunHour: (hour: number) => void
  setSeason: (season: Season) => void
  enterReadonly: (reason: string) => void
  exitReadonly: () => void
  setGridSize: (size: number) => void
  setZoom: (z: number) => void
  setPan: (p: { x: number; y: number }) => void
  /**
   * §M29 Phase 3: 与えられた canvas サイズと content AABB (mm) から、
   * 中央センタリング & 9 割表示の zoom + pan を一括設定する。
   * AABB が null なら既定値にリセット。
   */
  fitToContent: (
    canvasSize: { w: number; h: number },
    contentAabbMm: { minX: number; minY: number; maxX: number; maxY: number } | null,
  ) => void

  /**
   * Konva Stage の参照 (PDF/PNG 出力で使う)。
   * Canvas2D が mount/unmount 時に setStage で登録/解除する。
   * 直接 Zustand に Konva インスタンスを入れると変更検知の対象になるが、
   * ここでは UI から購読しないので問題ない。
   */
  stage: Konva.Stage | null
  setStage: (stage: Konva.Stage | null) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selected: null,
  tool: 'select',
  drawing: null,
  draggingRoomId: null,
  draggingOffset: null,
  resizePreview: null,
  sharedWallPreview: [],
  viewMode: '2d',
  lightingPreset: 'noon',
  fpvHumanId: null,
  roofStyle: 'none',
  visibleFloorIndex: null,
  layerMode: 'floor',
  sunHour: 12,
  season: 'spring',
  readonly: false,
  readonlyReason: null,
  gridSize: 910,
  zoom: 0.1, // 既定: 1mm = 0.1px → 1m = 100px
  pan: { x: 0, y: 0 },

  select: (sel) => set({ selected: sel }),
  clearSelection: () => set({ selected: null }),
  setTool: (tool) => {
    // §M27: ツールが変わった瞬間に描画中バッファは捨てる
    set({ tool, drawing: null })
  },
  setDraggingRoomId: (id) => set({ draggingRoomId: id }),
  setDraggingOffset: (offset) => set({ draggingOffset: offset }),
  setResizePreview: (preview) => set({ resizePreview: preview }),
  setSharedWallPreview: (preview) => set({ sharedWallPreview: preview }),
  startDrawing: (p) => set({ drawing: { points: [p], cursorMm: null } }),
  addDrawPoint: (p) =>
    set((s) =>
      s.drawing == null
        ? { drawing: { points: [p], cursorMm: null } }
        : { drawing: { ...s.drawing, points: [...s.drawing.points, p] } },
    ),
  moveDrawCursor: (p) =>
    set((s) => (s.drawing == null ? {} : { drawing: { ...s.drawing, cursorMm: p } })),
  finishDrawing: () => {
    const drawing = get().drawing
    set({ drawing: null })
    return drawing?.points ?? null
  },
  cancelDrawing: () => set({ drawing: null }),
  setViewMode: (viewMode) => set({ viewMode }),
  setLightingPreset: (lightingPreset) => set({ lightingPreset }),
  enterFpv: (humanId) => set({ fpvHumanId: humanId }),
  exitFpv: () => set({ fpvHumanId: null }),
  setRoofStyle: (roofStyle) => set({ roofStyle }),
  setVisibleFloorIndex: (visibleFloorIndex) => set({ visibleFloorIndex }),
  setLayerMode: (layerMode) => set({ layerMode }),
  setSunHour: (sunHour) => set({ sunHour: Math.max(0, Math.min(24, sunHour)) }),
  setSeason: (season) => set({ season }),
  enterReadonly: (reason) => set({ readonly: true, readonlyReason: reason }),
  exitReadonly: () => set({ readonly: false, readonlyReason: null }),
  setGridSize: (size) => set({ gridSize: size }),
  setZoom: (z) => set({ zoom: Math.max(0.02, Math.min(0.5, z)) }),
  setPan: (p) => set({ pan: p }),
  fitToContent: (canvasSize, aabb) => {
    // §M31: 空プランはワールド原点 (0, 0) を canvas 中央に置く。
    // グリッドは無限スクロール (GridLayer がビュー範囲を動的に埋める) なので、
    // 原点軸を中心に置くだけで「中央に作業フィールドがある」体験になる。
    if (aabb == null) {
      const defaultZoom = 0.1
      set({
        zoom: defaultZoom,
        pan: { x: canvasSize.w / 2, y: canvasSize.h / 2 },
      })
      return
    }
    const w = aabb.maxX - aabb.minX
    const h = aabb.maxY - aabb.minY
    if (w <= 0 || h <= 0 || canvasSize.w <= 0 || canvasSize.h <= 0) {
      set({ zoom: 0.1, pan: { x: 0, y: 0 } })
      return
    }
    const PADDING_RATIO = 0.85
    // 横/縦どちらかにフィットする倍率の小さい方
    const zoomFit = Math.min(canvasSize.w / w, canvasSize.h / h) * PADDING_RATIO
    const zoom = Math.max(0.02, Math.min(0.5, zoomFit))
    // ワールド中心 (mm) を canvas 中心 (px) に置く
    const worldCx = (aabb.minX + aabb.maxX) / 2
    const worldCy = (aabb.minY + aabb.maxY) / 2
    const panX = canvasSize.w / 2 - worldCx * zoom
    const panY = canvasSize.h / 2 - worldCy * zoom
    set({ zoom, pan: { x: panX, y: panY } })
  },

  stage: null,
  setStage: (stage) => set({ stage }),
}))
