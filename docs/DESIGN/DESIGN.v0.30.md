# 間取りプランナー Web アプリ 設計書

> Version: **0.30** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (BMS / 住宅モード分離 + 壁スナップ)
>
> ## v0.29 → v0.30 の主な変更
>
> v0.29 で 137 種設備マスターと 5 面配置 (ceiling/floor/wall/roof/outdoor) を実装した。
> v0.30 はそれを実運用に近づける 3 点改修:
>
>  1. **用途モード (住宅 / BMS) の分離** — 1 つのプランは住宅用かビルメンテ用かの
>     どちらか。Sidebar の部屋プリセット / 設備パレット / 既定床材が切り替わる
>  2. **壁取り付け設備の自動壁スナップ** — placement='wall' の設備は 2D で配置 /
>     ドラッグした地点から最寄り壁に自動寄せ + 壁角度に回転
>  3. **既定床材の用途別切替** — 住宅は wood、BMS は concrete / tile を既定に
>
> ### M130 FloorplanMetadata に `usageMode` を追加
>
> ```ts
> // types/floorplan.ts
> export type UsageMode = 'residential' | 'bms'
> export type FloorplanMetadata = {
>   …
>   /** §M130 v0.30 — 用途モード (住宅 / BMS)。未指定は 'residential' */
>   usageMode?: UsageMode
> }
> ```
>
>  - Zod スキーマ `FloorplanMetadataSchema` に `usageMode: z.enum(['residential', 'bms']).optional()` を追加
>  - 既存データ (v0.29 まで) は `undefined` のまま読めて、ランタイムで 'residential' 扱い
>
> ### M131 RoomPreset に `usageMode` 属性 + BMS 用 9 種を追加
>
> 各 `RoomPreset` に `usageMode?: 'residential' | 'bms' | 'both'` を追加。
> 既存プリセット (living / bedroom / bathroom / kitchen 等) は実質 'residential'、
> 動線系 (entrance / hallway / stairs-start / stairs-end) は 'both'、
> 新規 BMS 用 9 種は 'bms'。
>
> 新規プリセット:
>  - `office`            執務室 (6.0 × 5.0m, requiresWindow=true, minLightingRatio=1/10)
>  - `conference-room`   会議室 (5.0 × 4.0m)
>  - `lobby`             ロビー (6.0 × 6.0m)
>  - `corridor-bms`      商業廊下 (2.0 × 10.0m)
>  - `machine-room`      機械室 (4.0 × 4.0m, requiresPipeSpace=true)
>  - `electric-room`     電気室 (3.0 × 3.0m)
>  - `storage-warehouse` 倉庫 (3.0 × 4.0m)
>  - `kitchenette`       給湯室 (2.0 × 2.0m, requiresPipeSpace=true)
>  - `restroom-public`   公衆トイレ (3.0 × 3.0m, requiresPipeSpace=true)
>
> ヘルパ `listPresetsByUsage(usageMode)` で 'both' を含めてフィルタする。
>
> ### M132 `pickFloorTextureKind` の用途別既定
>
> 旧: presetId → wood/kitchen/tile/concrete/grass を固定マッピング。
> 新: BMS プリセットを追加マップ:
>  - office / conference-room / machine-room / electric-room / storage-warehouse → `concrete`
>  - lobby / corridor-bms / kitchenette / restroom-public → `tile`
>
> 住宅プリセットの既定 (wood / kitchen / tile / concrete) は変更なし。
> Room.floorMaterial の手動上書きは引き続き優先される。
>
> ### M133 Home の新規作成ピッカーを 2 ステップ化
>
> 旧 1 ステップ: `choose (template/blank/CAD)` → 編集画面
> 新 2 ステップ: `usage (住宅/BMS)` → `choose (template/blank/CAD)` → 編集画面
>
> 用途モードチップ (緑=住宅 / 紺=BMS) はヘッダに常駐し、迷子防止。
>
>  - BMS モードで新規作成すると `metadata.buildingType='office'`、
>    `building.structureType='rc'` / `isExistingBuilding=true` を既定で当てる
>  - 住宅モードは従来通り `single-family` / `wood` / 新築前提
>
> ### M134 Sidebar を usageMode で切替
>
> ```text
> usageMode='residential' :
>   - 部屋プリセット (listPresetsByUsage('residential'))
>   - 自動家具配置ボタン
>   - 家具カタログ (検索 + カテゴリ別)
>   - 設備マスター は非表示
>
> usageMode='bms' :
>   - 部屋プリセット (listPresetsByUsage('bms'))
>   - 設備マスター (137 種、カテゴリタブ + 検索)
>   - 自動家具配置 / 家具カタログ は非表示
> ```
>
> `Sidebar.tsx` 上部に用途モードチップ (緑 / 紺) を表示。
>
> ### M135 壁取り付け設備の自動壁スナップ (`core/wallSnap.ts`)
>
> `placement='wall'` の設備 (= 屋内消火栓箱 / 分電盤 / 発信機 / 表示灯 / 避難口誘導灯
> など) を 2D で配置すると、ユーザーの click / drop 位置から **最寄り壁** を探し、
> その壁線への正射影 + 法線方向に depth/2 オフセットした位置にスナップする。
>
> アルゴリズム (`snapToNearestWall(pos, walls, depth, options)`):
>  1. 各 wall について `pos` を線分に正射影 (t を [0,1] に clamp) → 投影点 P
>  2. P と pos の距離が最小の壁を採用
>  3. 法線 N = (pos - P) の単位ベクトル (= ユーザーが置きたかった部屋側)
>     - 距離 ~0 の場合は左手法線 (-dy, dx)/len をフォールバックに使用
>  4. 設備中心 = P + N × (depth/2 + wall.thickness/2)
>  5. rotation = atan2(wall.dy, wall.dx) — 設備のローカル X が壁線に沿う向き
>
> 設定:
>  - `options.maxDist` (既定 2500mm) — これより遠ければスナップしない
>  - `MIN_WALL_LEN_MM` 200 — 極端に短い壁は候補から除外
>
> 組み込み箇所 (`floorplanStore.ts`):
>  - `addFurniture`: mountTo='wall' のとき入力 position を snap 結果で上書き
>  - `moveFurniture`: 既存 instance の mountTo='wall' なら毎回再スナップ
>    → 2D ドラッグでも 3D ドラッグでも自動的に壁に張り付く
>  - 壁候補 = `floor.walls` から hiddenWallIds を除いた派生壁 + `freestandingWalls`
>  - depth は spec 由来なら `spec.depth`、家具カタログ由来なら `approxFurnitureDepth(entry)` で算出
>
> 副次: mountTo='wall' / 'roof' / 'outdoor' の設備は **床積みスタッキング** (M94) の
> 対象外。`computeFurnitureStackY` を bypass して y=0 リセット。
>
> ### v0.30 で扱わない範囲 (今後)
>
> 1. **複数壁またぎの設備サイズ調整** — 例えば 3m 幅の防火シャッタを 4m 壁に貼ると
>    両端から少しはみ出すケースの自動分割は未対応
> 2. **DXF I/O の usageMode 反映** — DXF 取込時は metadata.usageMode を 'bms' に
>    既定で当てるべきだが、現状は 'residential' 既定のまま。次バージョンで対応
> 3. **テンプレ群の usageMode 対応** — 現状の TEMPLATE_CARDS (1LDK / 2LDK / 3LDK) は
>    住宅向けだが、選択時に usageMode='residential' を強制していない。テンプレ
>    自体に推奨 usageMode を持たせる改修は v0.31 で
>
> v0.29 以前の §1〜§17 はそのまま継承。
