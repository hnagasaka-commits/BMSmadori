# 間取りプランナー Web アプリ 設計書

> Version: **0.28** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (Phase 3 → BMS 拡張 v1)
>
> ## v0.27 → v0.28 の主な変更
>
> 本アプリの用途を **「業者打ち合わせ用 L2 叩き台」 (旧) + 「ビルメンテナンス
> (BMS) 設備位置の再現」 (新)** に拡張する。BMS 用途では:
>  - CAD 図面 (DXF) を取り込み、壁・部屋・天井高・設備を自動再構成
>  - 天井に取り付く設備 (照明・煙感知器・熱感知器・空調・スプリンクラー・誘導灯
>    ・スピーカー) を 3D の **天井面に貼り付けて描画**
>  - 床に置く設備 (消火器など) は従来通り床に配置
>  - 3D で天井を表示するが、**部屋内部を阻害しないよう半透明** で描画
>  - 2D で「天井レイヤー」をトグル ON にすると、天井設備のマークが床面プランに
>    重畳描画される
>
> ### M115 Home 画面に「CAD 図面からアップロード」オプション追加
>
> v0.21 以降 Home の「新規間取りを作成」は **テンプレ / 白紙** の 2 択だったが、
> ビルメン用途の現場では「既存図面 (DXF) を渡されてから点検する」フローが主流の
> ため、3 つ目の選択肢として `DXF アップロード` を追加する。
>
>  - `Home.tsx` の `NewPlanPicker` を 2 列 → 3 列レイアウトに拡張
>  - 「CAD 図面から作成」ボタン → ファイル選択 (`<input type="file" accept=".dxf">`)
>  - 受け取ったテキストを `parseDxf(text)` → `buildFloorplanFromDxf(entities, options)` で
>    Floorplan に変換し、その場で `savePlan` + `navigate('/editor/:id')`
>  - パース失敗時はモーダル内でエラーメッセージを表示しキャンセル可能
>
> ### M116 DXF パーサ + Floorplan 復元 (`core/dxf/`)
>
> 外部依存は **追加しない** (npm install のフットプリント抑制 + 信頼境界縮小)。
> ASCII DXF (R12/R14/R2000 系) の最小プロファイルだけを自前実装する。
>
> **parseDxf(text: string): DxfEntities**
>
> DXF は「group code / value」を 1 行ずつ交互に出すタグ形式。`ENTITIES` セクションの
> 中だけを走査し、`LINE` / `LWPOLYLINE` / `POLYLINE+VERTEX` / `CIRCLE` / `TEXT` /
> `MTEXT` / `INSERT` を抽出する。group code 8 は **layer 名** で、レイヤー名で
> 設備種別をルーティングする。
>
> ```ts
> export type DxfEntity =
>   | { kind: 'line'; layer: string; from: Vec2; to: Vec2 }
>   | { kind: 'lwpolyline'; layer: string; closed: boolean; vertices: Vec2[] }
>   | { kind: 'circle'; layer: string; center: Vec2; radius: number }
>   | { kind: 'text'; layer: string; position: Vec2; value: string; height: number; rotation: number }
>   | { kind: 'insert'; layer: string; blockName: string; position: Vec2; rotation: number; xScale: number; yScale: number }
> ```
>
> **buildFloorplanFromDxf(entities, options): { floorplan, report }**
>
> 1. **単位推定**: DXF 自体は mm/inch 区別を持たない (ヘッダ `$INSUNITS` を見ない
>    実装も多い)。ここでは **入力単位はミリメートル前提** とし、座標値が小さい
>    (max < 100) 場合のみ `× 1000` する (= メートル指定救済)。
> 2. **壁抽出**: layer 名が `WALL` / `A-WALL` / `壁` / `壁芯` / `S-WALL` のいずれかに
>    マッチする LINE と LWPOLYLINE のエッジを `Wall` セグメントに変換 (`from/to` は
>    mm 整数に丸め、`thickness` は既定 100mm)。
> 3. **部屋抽出**: layer 名が `ROOM` / `A-ROOM` / `部屋` / `室名` のいずれかにマッチ
>    する **閉じた LWPOLYLINE** を `Shape.polygon` の部屋に変換。
>    - 同レイヤーの近傍 TEXT (中心から最も近いもの) を `customName` に採用
>    - `presetId` は名前から推定 (「リビング」→`living`、「キッチン」→`kitchen`、
>      「トイレ」→`toilet`、…)。マッチしなければ `living` をフォールバック
> 4. **天井高抽出**: layer 名が `CEILING` / `CH` / `天井` を含む TEXT で数値
>    (`2400`, `CH=2700`, `H:2700` など) を正規表現で拾い、最大値を `floor.ceilingHeight`
>    に採用。複数階の DXF は v0.28 では非対応 (1 階フロアに集約)。
> 5. **設備抽出**:
>    | layer (大文字化 / 正規化後) | catalogId | mountTo |
>    |---|---|---|
>    | `E-LIGHT` / `照明` / `LIGHTING` | `ceiling-light-led` | `ceiling` |
>    | `E-DOWN` / `ダウンライト` | `ceiling-downlight` | `ceiling` |
>    | `E-SMOKE` / `煙感知` / `SD` | `smoke-detector` | `ceiling` |
>    | `E-HEAT` / `熱感知` / `HD` | `heat-detector` | `ceiling` |
>    | `E-AC` / `空調` / `エアコン` / `HVAC` | `ac-cassette-4way` | `ceiling` |
>    | `E-EMERG` / `誘導灯` / `EXIT` | `emergency-light` | `ceiling` |
>    | `E-SPK` / `スピーカー` | `speaker-ceiling` | `ceiling` |
>    | `E-SP` / `スプリンクラー` / `SPRINKLER` | `sprinkler-head` | `ceiling` |
>    | `F-EXT` / `消火器` / `EXTINGUISHER` | `fire-extinguisher` | `floor` |
>    対象エンティティは `INSERT` (= ブロック挿入) と `CIRCLE` (シンボルを丸で書く
>    流派にも対応)。INSERT の場合は `position` を、CIRCLE の場合は `center` を
>    `FurnitureInstance.position` (mm 整数) に採用する。
> 6. **座標系の補正**: DXF は Y 上向き右手系、本アプリの Floorplan は **2D で Y 下向き
>    (Konva 系)** + **3D は X/Z 床面** という変則合成。`buildFloorplanFromDxf` で
>    Y 軸を反転 (`y' = maxY - y`) し、AABB の `minX/minY` を 0 にシフトしてから
>    返す。
> 7. **report**: 何件 / どのレイヤーから何を作ったかを `string[]` で返し、Home
>    遷移後の Toast (M118 で実装) で「壁 142 / 部屋 8 / 照明 24 / 検知器 12 …」を
>    確認できるようにする。
>
> ### M117 型モデル拡張: `FurnitureInstance.mountTo` + BMS カタログ
>
> 既存の `FurnitureInstance` には床直置き前提の `y?: number` だけだが、天井設備の
> ために `mountTo` フィールドを追加する。
>
> ```ts
> export type FurnitureMount = 'floor' | 'ceiling'
>
> export type FurnitureInstance = {
>   // …既存…
>   /** §M117 v0.28: 取り付け面。'ceiling' なら 3D で天井から吊る形で描画 */
>   mountTo?: FurnitureMount
> }
> ```
>
> 後方互換: 既存データは `mountTo === undefined` を `'floor'` 扱い。
>
> **カタログ追加 (`furnitureCatalog.ts`)**: 9 種類のビルメン設備を新規 entry として追加。
> 既存の 9 カテゴリに加えて **`bms` (ビルメンテ設備)** を `FurnitureCategory` に
> 追加する。
>
>  - `ceiling-light-led` (LED ベースライト 600×600×60mm, 角型, 白)
>  - `ceiling-downlight` (ダウンライト φ100×60mm, 円柱)
>  - `smoke-detector` (煙感知器 φ100×40mm, 白円柱)
>  - `heat-detector` (熱感知器 φ100×40mm, 赤円柱)
>  - `ac-cassette-4way` (天井カセット 4 方向吹出 800×800×280mm, グレー)
>  - `emergency-light` (誘導灯 300×150×30mm, 緑)
>  - `speaker-ceiling` (天井スピーカー φ200×80mm)
>  - `sprinkler-head` (スプリンクラーヘッド φ40×100mm)
>  - `fire-extinguisher` (消火器 φ150×600mm, 赤 — mountTo='floor')
>
> いずれも `category: 'bms'`、`mountToDefault` を catalog entry に持たせて、Sidebar
> から配置した時点で `FurnitureInstance.mountTo` の初期値を決める。
>
> ```ts
> export type FurnitureCatalogEntry = {
>   // …既存…
>   /** §M117 v0.28: 既定の取り付け面。省略時は 'floor' */
>   mountToDefault?: FurnitureMount
> }
> ```
>
> ### M118 3D: 天井メッシュ (半透明) + 天井設備の吊り下げ描画
>
> **天井メッシュ**: `floorplanToScene` の `FloorPlate` を再利用して、各部屋の床
> プレートと同じ XZ 形状の `CeilingPlate` を作る。FloorPlates の隣に
> `<CeilingPlates>` を立てる:
>  - Y = `scene.ceilingHeight` (mm → m 換算後)、厚さ 60mm 程度の薄い板
>  - マテリアルは `meshStandardMaterial` で `color = #f5f5f0`、`transparent: true`、
>    `opacity: 0.12`、`depthWrite: false`、`side = THREE.DoubleSide`
>  - 影は受けない (`receiveShadow = false`) — 半透明では影描画が崩れるため
>  - polygon 部屋でも `ExtrudeGeometry` ではなく `Shape + ShapeGeometry` を XZ 平面で
>    押し当てる (薄い板)
>
> opacity 0.12 だと「天井の存在感」は残しつつ家具のフォルムは透けて見える。0.0 だと
> 完全に透明で「天井がない」印象になり、点検対象としての天井位置感が伝わらないため
> 採用しない。
>
> **天井設備の吊り下げ**: `Furniture.tsx` の `FurnitureInstanceMesh` で
> `mountTo === 'ceiling'` のケースを処理。
>
>  - 既存ロジック: `groupRef.position.y = (yMm + 0) * MM_TO_M` (床基準)
>  - 新規: 設備自体の高さ (`pieces` の AABB Y 寸法) を取り、
>    `topY = floor.ceilingHeight - pieceHeight` から
>    `groupRef.position.y = topY * MM_TO_M` で天井から吊るす
>    - つまり「設備の天面が部屋の天井に貼り付く」よう Y を計算
>  - 階層スタッキングを保つため、`Furniture` props に `floorCeilingHeight: number` を
>    渡す (現在は親 Floor の `ceilingHeight`)
>
> **天井設備の選択 UI**: 既存の `selectFurniture` フローをそのまま使う (id ベース)。
> 3D で天井設備をクリック → PropertyPanel に「取り付け面: 天井 ⇄ 床」のトグル。
> ドラッグ移動は引き続き XZ 平面のみ (= 天井上を動かす)。
>
> ### M119 2D: 天井レイヤートグル
>
> 既定では 2D は **「床レイヤー」** (= 床に置いてあるもの・床自体・壁) を表示する。
> Sidebar (または Toolbar) に天井トグルを追加し、ON にすると:
>  - 壁・床・床家具は若干グレーアウト (opacity 0.5)
>  - `mountTo === 'ceiling'` の家具マークを **角丸長方形 + ✕ クロスハッチ**
>    (= 「天井に投影されたマーク」を示す慣習) で描く
>  - 天井設備のラベルは catalog displayName を上書きで表示
>
> 床レイヤーモードでは天井設備のマークは **非表示** (今までの 2D には影響しない)。
>
> 内部実装:
>  - `editorStore.layerMode: 'floor' | 'ceiling'` を追加
>  - `Canvas2D.tsx` で `layerMode === 'ceiling'` のとき床レイヤーの `<Group opacity={0.5}>` で覆う
>  - `FurnitureMark.tsx` で `mountTo` を読み、`layerMode` と組み合わせて表示・スタイル分岐
>
> ### M120 スキーマ / migrate / store の整合
>
> - `FurnitureInstanceSchema` に `mountTo: z.enum(['floor', 'ceiling']).optional()` を追加
> - `floorplanStore.addFurniture` で catalog の `mountToDefault` を `FurnitureInstance.mountTo` に
>   コピー (= UI 操作で「天井設備をドラッグ配置」した時点で正しい値が入る)
> - DXF インポート経由で作成された Floorplan は `editorStore.layerMode = 'ceiling'` を
>   既定で立てる (= 開いた直後に天井設備が見えるように)。これは「BMS 用途で開く」
>   ことが文脈から明らかなため。`editorStore` の `setInitialFromImport(plan)` を
>   経由する。
>
> ### v0.28 で扱わない範囲
>
> 1. **DWG / IFC / PDF のインポート** — 別フェーズ。v0.28 は DXF (ASCII) 1 形式に絞る。
> 2. **複数階の DXF 分割インポート** — 1 ファイル → 1 階フロアに集約。階層タグを
>    DXF から自動判定するのは精度が出にくいので別フェーズ。
> 3. **設備の点検履歴 / コメント / 写真添付** — メンテ作業 UI そのものは v0.29 以降。
>    v0.28 は「設備が **どこにあるか** を再現」までで止める。
> 4. **天井の素材 (石膏ボード / ロックウール) 種別** — Floor.ceilingFinish を追加せず、
>    透明な単一マテリアルで描画する。
>
> v0.27 以前の §1〜§17 はそのまま継承。
