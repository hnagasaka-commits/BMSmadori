/**
 * §5 データモデルの正本。本書 (docs/DESIGN.md) §5 のコメントは型定義ファイルへ集約する。
 *
 * 構造:
 *   §5.1 Floorplan / FloorplanMetadata / TemplateMetadata / BuildingProperties / SchemaVersion / BuildingType
 *   §5.2 Floor / Shape / EdgeId / FurnitureInstance / HumanModel / Void / AutoDoorSuppression / EdgeKey / EdgeRef
 *   §5.3 WallType / Wall
 *   §5.4 Column
 *   §5.5 PipeSpace / PipeSystem
 *   §5.6 Room
 *   §5.7 Door
 *   §5.8 Window / WindowType / Sash
 *   §5.9 ComplianceWarning / ComplianceSeverity / ComplianceCategory
 *   §5.10 RoomFinish / WallFinish / WindowDecoration / DoorDecoration / MaterialId / DoorStyleId
 */

// ============================================================================
// §5.1 トップレベル
// ============================================================================

/**
 * Phase ごとに段階的に union を広げる:
 * - Phase 1   : "1.0" のみ
 * - Phase 1.5 : "1.1" を追加 (templateOrigin と PS 同梱許容)
 * - Phase 3   : "1.2" を追加 (複数階対応で floors.length 制約を緩める)
 */
export type SchemaVersion = '1.0' | '1.1' | '1.2'

export type BuildingType =
  | 'single-family'
  | 'condo-unit'
  | 'apartment-unit'
  | 'hotel'
  | 'office'
  | 'retail'
  | 'mixed'

export type TemplateLicense =
  | 'CC0'
  | 'CC-BY'
  | 'MIT'
  | 'original'
  | 'reference-only'

export type TemplateMetadata = {
  /** §7.1 の id と突合(例: "condo-3ldk-70")。templateOrigin.templateId と一致 */
  id: string
  /** テンプレ本体のバージョン。PS 追加等の更新で +1 (SemVer 推奨) */
  version: string
  description: string
  thumbnail?: string
  license: TemplateLicense
  designer?: string
  /** 延床面積。自動計算結果と一致するように保つ */
  area: number
  bedrooms?: number
  tags: string[]
  recommendedBuildingType?: BuildingType
}

export type FloorplanMetadata = {
  name: string
  buildingType: BuildingType
  unit: 'mm'
  /** 既定 910mm (尺モジュール)。自由グリッドは 50mm 等 */
  gridSize: number
  /** 北からの角度 0-359。必須 */
  orientation: number
  siteArea?: number
  createdAt: string
  updatedAt: string
  /** 同梱テンプレ・配布物にだけ存在。普通の保存ファイルでは省略 */
  template?: TemplateMetadata
  /**
   * §5.9.2 ユーザーが ack した法規警告 ID のリスト。
   * 同じ違反でも ID は決定論的なので、ack はファイル間で共有・移植可能。
   */
  acknowledgedWarnings?: string[]
  /**
   * §1.6 エクスポート時に短縮版免責文を埋め込む。
   * インポート時は読み飛ばし。値は §1.6.2 短縮版テンプレートとアプリバージョンを含む。
   */
  disclaimer?: string
  /**
   * §M108 v0.25: 壁紙の色を上書き (`#rrggbb`)。undefined ならデフォルト (#f5f1ea) を使う。
   * 3D 描画の `meshStandardMaterial.color` に流れる。texture (壁紙パターン) は据え置きで
   * color と乗算されるため、テクスチャの陰影は残しつつ全体の色味だけ変えられる。
   * Floorplan 全体に適用 (= すべての階の全ての壁の内側に効く)。
   */
  wallpaperColor?: string
  /**
   * §6.4.3 テンプレ起点で作成されたプランの由来情報。
   * ユーザーが「ゼロから描く」を選んだ場合は undefined。一度設定したら以降変更しない。
   * Phase 1.5 で導入される PS 追加候補バナーの判断材料に使う。
   */
  templateOrigin?: {
    templateId: string
    /** 取り込み時のテンプレバージョン */
    templateVersion: string
  }
}

export type BuildingProperties = {
  structureType: 'wood' | 'steel' | 'rc' | 'src'
  isExistingBuilding: boolean
}

export type Floorplan = {
  version: SchemaVersion
  metadata: FloorplanMetadata
  floors: Floor[]
  building: BuildingProperties
}

// ============================================================================
// §5.2 フロア / 形状 / 永続 ID
// ============================================================================

/** §5.2.1 部屋形状の辺の永続 ID。crypto.randomUUID() で発行 */
export type EdgeId = string

/**
 * §5.2.1 部屋形状。Phase 1 は rect のみ運用、Phase 2 で polygon を許す。
 *
 * 各辺には永続 ID (`edgeIds`) を持たせる:
 *  - rect の edgeIds[0..3] は N / E / S / W に対応(順序固定)
 *  - polygon の edgeIds[i] は points[i] → points[(i+1) % n] の辺に対応
 *  - 移動・拡縮では変更しない
 *  - 頂点挿入・削除では、不変の辺は同じ id を保ち、新規辺だけ新 id を発行
 */
export type Shape =
  | {
      kind: 'rect'
      x: number
      y: number
      w: number
      h: number
      edgeIds: readonly [EdgeId, EdgeId, EdgeId, EdgeId]
    }
  | {
      kind: 'polygon'
      points: ReadonlyArray<readonly [number, number]>
      edgeIds: EdgeId[] // length === points.length
    }

/** §5.2.1 家具インスタンス (Phase 2 から本格運用、Phase 1 では空配列) */
export type FurnitureInstance = {
  id: string
  catalogId: string
  position: readonly [number, number]
  rotation: number
  /**
   * §M52 v0.6: 旧仕様は number (uniform 拡大率) のみ。
   * §M69 v0.12: 縦横奥行きを個別に編集できるよう tuple を許容。
   * 後方互換: 既存データ (number) は X/Y/Z 全てに同じ値を適用する。
   */
  scale?: number | readonly [number, number, number]
  /**
   * §M94 v0.21: 床からの高さオフセット (mm)。既定 0 (床直置き)。
   * XZ 位置で既存家具と重なる場合、重なる家具のうち最も高い「天板」の上に
   * 新規家具を載せるロジック (addFurniture / moveFurniture) で自動付与される。
   */
  y?: number
  /**
   * §M107 v0.25: 家具全パーツに被せる色 (16 進)。
   * 設定時は catalog の `piece.material.color` を全て差し替えて単色化する。
   * undefined ならカタログのオリジナル配色を使う。
   */
  colorOverride?: string
}

/**
 * §M69 v0.12: FurnitureInstance.scale を必ず [x, y, z] の 3 軸タプルに正規化するヘルパー。
 * - undefined → [1, 1, 1]
 * - number → [n, n, n]
 * - tuple → そのまま
 */
export function furnitureScale3(
  scale: FurnitureInstance['scale'],
): readonly [number, number, number] {
  if (scale == null) return [1, 1, 1]
  if (typeof scale === 'number') return [scale, scale, scale]
  return scale
}

/** §5.2.1 人物モデル (Phase 2) */
export type HumanModel = {
  id: string
  position: readonly [number, number]
  rotation: number
  /** mm、既定 1700 */
  height: number
}

/** §5.2.1 吹き抜け (Phase 3) */
export type Void = {
  id: string
  shape: Shape
  fromLevel: number
  toLevel: number
}

// §5.2 EdgeKey: 壁の論理キー (詳細は core/geometry の edgeKeyOf で構成する)
export type EdgeRef = { roomId: string; edgeId: EdgeId }
export type EdgeKey = readonly [EdgeRef] | readonly [EdgeRef, EdgeRef]

/**
 * §6.2 自動ドアの再生成抑止 tombstone。
 * 共有壁は常に長さ 2 (自動ドアは共有壁にだけ生成される)。
 */
export type AutoDoorSuppression = {
  edgeKey: readonly [EdgeRef, EdgeRef]
  /** ISO8601 */
  removedAt: string
}

export type Floor = {
  id: string
  level: number
  name: string
  ceilingHeight: number
  rooms: Room[]
  walls: Wall[]
  doors: Door[]
  windows: Window[]
  /** Phase 1.5 から実値が入る。Phase 1 は常に空配列 (Zod superRefine 強制) */
  columns: Column[]
  /** Phase 1.5 から実値が入る。Phase 1 は常に空配列 */
  pipeSpaces: PipeSpace[]
  /** Phase 2 から実値が入る。Phase 1 / 1.5 は空配列 */
  furniture: FurnitureInstance[]
  /** Phase 2 から実値が入る */
  humanModels: HumanModel[]
  /** Phase 3 から実値が入る (吹き抜け) */
  voids: Void[]
  /** §5.10 仕上げ材の正本。Phase 1 では基本 0 件 */
  roomFinishes: RoomFinish[]
  wallFinishes: WallFinish[]
  /** Phase 2 から実値が入る */
  windowDecorations: WindowDecoration[]
  /** Phase 2 から実値が入る */
  doorDecorations: DoorDecoration[]
  /** §6.2 自動ドア再生成抑止 */
  suppressedAutoDoors: AutoDoorSuppression[]
  /**
   * §M30 Phase 3: 部屋に紐づかない自立壁。
   * Floor.walls は Room.shape の辺から再生成される派生データだが、
   * freestandingWalls はユーザーが直接描いた壁 (パーティション/塀など) を保持する。
   * 互換のため optional。Phase 1〜2 のデータは undefined のまま動く。
   */
  freestandingWalls?: Wall[]
  /**
   * §M30 Phase 3: ユーザーが「削除」した部屋由来壁の id を退避する集合。
   * これらの id は再生成 / リベイン後も保持され、レンダリング時にフィルタアウトする。
   * 壁本体は walls からは消えないが、表示と door/window 配置の対象外になる。
   */
  hiddenWallIds?: string[]
}

// ============================================================================
// §5.3 壁
// ============================================================================

/**
 * §5.3 壁種別 (役割の分類のみ)。
 * 編集可否は wallType ではなく isLocked が正。
 */
export type WallType =
  | 'exterior'
  | 'load-bearing'
  | 'shared'
  | 'partition'
  | 'non-bearing'

/**
 * §5.3 壁。
 * - from / to は壁芯 (centerline) 座標 (mm、整数)。Room.shape の辺と同じ系
 * - 共有壁マージは sharedBy を増やすだけで from / to は変えない
 */
export type Wall = {
  id: string
  from: readonly [number, number]
  to: readonly [number, number]
  thickness: number
  wallType: WallType
  isLocked: boolean
  /** Room IDs (0〜2 個) */
  sharedBy: string[]
  height?: number
}

// ============================================================================
// §5.4 柱
// ============================================================================

export type Column = {
  id: string
  position: readonly [number, number]
  size: { w: number; h: number }
  isLocked: boolean
  loadBearing: boolean
}

// ============================================================================
// §5.5 PS (パイプスペース)
// ============================================================================

export type PipeSystem =
  | 'water-supply'
  | 'drainage'
  | 'gas'
  | 'vent'
  | 'electrical'

export type PipeSpace = {
  id: string
  position: readonly [number, number]
  size: { w: number; h: number }
  systems: PipeSystem[]
  isLocked: boolean
}

// ============================================================================
// §5.6 部屋
// ============================================================================

/**
 * §M109 v0.25: 床テクスチャ種別。preset から自動選択する場合と、
 * `Room.floorMaterial` で部屋ごとに上書きする場合がある。
 */
export type FloorMaterialKind = 'wood' | 'kitchen' | 'tile' | 'concrete' | 'grass'

export type Room = {
  id: string
  /** §7 RoomPreset.id を参照 */
  presetId: string
  customName?: string
  shape: Shape
  /** 部屋中心まわりの回転。Phase 1 は 0/90/180/270 のみ、Phase 2 以降は 15° スナップ + Shift 1° */
  rotation: number
  /** 設備要件のオーバーライド (preset.requiresPipeSpace を上書き) */
  equipmentOverride?: {
    requiresPipeSpace?: boolean
  }
  /**
   * §M109 v0.25: 床テクスチャ種別の上書き。
   * 未指定なら `pickFloorTextureKind(presetId)` の既定が使われる。
   */
  floorMaterial?: FloorMaterialKind
  /**
   * §M114 v0.27: この部屋の **内壁** に貼る壁紙色 (#rrggbb)。
   * 未指定 (undefined) なら `metadata.wallpaperColor` (Floorplan 全体既定) → デフォルト
   * (#f5f1ea) の順でフォールバック。
   * 共有壁の場合は両側で異なる色になる (= 各部屋から見たときに自分の色が見える)。
   */
  wallpaperColor?: string
}

// ============================================================================
// §5.7 ドア
// ============================================================================

export type DoorType =
  | 'single-swing'
  | 'double-swing'
  | 'sliding'
  | 'folding'
  | 'opening'

export type Door = {
  id: string
  wallId: string
  /** 壁上の位置比率 (0..1)。壁長変化に追従 */
  positionRatio: number
  width: number
  type: DoorType
  swingDirection?: 'left' | 'right'
  /** 開いた先の部屋 ID (片開きの内開き/外開きを表す) */
  swingTo?: string
  /**
   * §M43 v0.3: 内開き/外開き。
   * true = 壁の法線方向 +X/+Y 側 (= 共有壁の場合は sharedBy[1] 側、外壁の場合は外側)
   * false = 反対側。
   * UI 上の「内開き」「外開き」のトグルとして使う。
   */
  swingInward?: boolean
}

// ============================================================================
// §5.8 窓・サッシ
// ============================================================================

/**
 * §5.8.2 窓種別。採光・換気の補正係数選定に使う。
 * - fixed : FIX 窓 (換気面積に算入しない)
 * - sliding-2 : 引違い 2 枚
 * - sliding-4 : 引違い 4 枚
 * - casement : 片開き・上げ下げ等の開放系
 * - bay : 出窓
 */
export type WindowType =
  | 'fixed'
  | 'sliding-2'
  | 'sliding-4'
  | 'casement'
  | 'bay'

/**
 * §5.8 窓。
 * Phase 1 は sashId 省略可・自由寸法を許す。Phase 2 で sashId 指定時は
 * §5.8.3 「展開保存」ルールにより width/height/type は常に必須で、規格選択時にコピーされる。
 */
export type Window = {
  id: string
  wallId: string
  positionRatio: number
  /** Phase 2+ で本格運用。Phase 1 は省略 */
  sashId?: string
  /** mm。常に必須 (§5.8.3) */
  width: number
  /** mm。常に必須 */
  height: number
  type: WindowType
  /** 窓台の高さ (床から、mm) */
  sillHeight: number
}

/**
 * §5.8.2 サッシ規格マスター。
 * Phase 1 でデータ同梱、UI は Phase 2 (§9.7.5)。
 */
export type Sash = {
  id: string
  manufacturer: 'ykk-ap' | 'lixil' | 'sankyo-tateyama'
  productCode: string
  width: number
  height: number
  type: WindowType
  glass: 'single' | 'double' | 'triple'
  category: 'small' | 'medium' | 'large' | 'balcony'
}

// ============================================================================
// §5.9 法規警告
// ============================================================================

export type ComplianceSeverity = 'warning' | 'info'

export type ComplianceCategory =
  | 'lighting'
  | 'ventilation'
  | 'circulation'
  | 'fire-egress'
  | 'structure'
  | 'equipment'
  | 'adjacency'

export type ComplianceWarning = {
  /** 安定 ID。category:roomIds:rule で決定論的に生成 (§5.9.1) */
  id: string
  severity: ComplianceSeverity
  category: ComplianceCategory
  affectedRoomIds?: string[]
  affectedWallIds?: string[]
  message: string
  suggestion?: string
  rule: string
}

// ============================================================================
// §5.10 仕上げ材・装飾 (型定義の正本、保存場所は Floor.* )
// ============================================================================

/** §15.2 マテリアルマスター (public/materials/manifest.json) の ID */
export type MaterialId = string
export type DoorStyleId = string

export type RoomFinish = {
  roomId: string
  floorMaterialId?: MaterialId
  ceilingMaterialId?: MaterialId
  /** 部屋全周一括の壁仕上げ。WallFinish が優先 */
  defaultWallMaterialId?: MaterialId
}

export type WallFinish = {
  wallId: string
  /** 壁の表裏。共有壁の場合 inside / outside で別々のマテリアルを持てる */
  side: 'inside' | 'outside'
  materialId: MaterialId
}

export type CurtainStyle = {
  type: 'drape' | 'lace' | 'blind' | 'roll'
  /** HEX */
  color: string
}

export type WindowDecoration = {
  windowId: string
  curtain?: CurtainStyle
}

export type DoorDecoration = {
  doorId: string
  styleId?: DoorStyleId
}

// ============================================================================
// §7 部屋プリセット
// ============================================================================

export type RoomCategory =
  | 'living-room'
  | 'wet'
  | 'entrance'
  | 'circulation'
  | 'storage'
  | 'outdoor'
  | 'hotel'
  | 'office'
  | 'retail'
  | 'common'

/**
 * §7 RoomPreset。完全版 (M4 で M3 の SimpleRoomPreset を置き換え)。
 * Phase 1/1.5 では minLightingRatio / minVentilationRatio / utilityRequirements が
 * M5 (法規警告) / Phase 1.5 (設備系統) で実際に消費される。
 */
export type RoomPreset = {
  id: string
  displayName: string
  category: RoomCategory
  defaultSize: { w: number; h: number }
  defaultWallType: WallType
  /** 居室は true。採光・換気警告の対象になる */
  requiresWindow: boolean
  /** 水回りは true。§6.5 設備チェックの対象 */
  requiresPipeSpace: boolean
  /** §6.5 で PS に要求する系統。preset ごとに宣言する (IH/ガス併設キッチンを分けたいときに別 preset 化) */
  utilityRequirements?: PipeSystem[]
  preferredWallTypes: WallType[]
  /** 最小採光比 (居室は 1/7)。undefined なら採光チェック対象外 */
  minLightingRatio?: number
  /** 最小換気比 (居室は 1/20) */
  minVentilationRatio?: number
}

// ============================================================================
// §8 隣接ルール
// ============================================================================

export type AdjacencyRelation = 'direct-adjacent' | 'shared-wall' | 'door-connected'

export type AdjacencyRule = {
  id: string
  /** RoomPreset.id × 2 (順序非依存) */
  pair: readonly [string, string]
  relation: AdjacencyRelation
  severity: ComplianceSeverity
  message: string
  rule?: string
}

// ============================================================================
// §C.0 法規ルールのメタ
// ============================================================================

/**
 * §C.0 LegalRule。各法規ルールに必ず持たせるメタ。
 * - `lastVerifiedAt` から 18 ヶ月で CI 警告
 * - ロジック式・閾値を変えたら `appRuleVersion` を +1 (ack 済み警告の世代分離)
 * - 警告 ID は `${rule.id}@v${rule.appRuleVersion}:${affectedRoomIds.join(",")}` (§C.0)
 */
export type LegalRule = {
  id: string
  category: ComplianceCategory
  title: string
  /** 警告 message に出す引用 (例: 「建築基準法第28条第1項」) */
  ruleCitation: string
  /** e-Gov の法令 URL (現行版)。実務推奨ルールは "n/a" */
  sourceUrl: string
  /** 参照した法令の改正版識別子 (例: "令和6年6月1日施行")。実装時に記入 */
  lawVersion: string
  /** ISO8601。最後に開発者が条文を見て突き合わせた日 */
  lastVerifiedAt: string
  /** ロジック世代。閾値や式を変えたら +1 */
  appRuleVersion: number
  severity: ComplianceSeverity
}
