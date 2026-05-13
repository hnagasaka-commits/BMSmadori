# 間取りプランナー Web アプリ 設計書

> Version: **0.29** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (BMS 拡張 v2 — 設備マスター 137 種)
>
> ## v0.28 → v0.29 の主な変更
>
> v0.28 で「DXF 取込 + 9 種 BMS 設備 + 透明天井」までを実装した。v0.29 はこれを拡張し、
> **137 種類の点検対象設備カタログ** を JSON で同梱、2D 配置で 3D 建物に自動再現する
> フローを完成させる。点検時に「天井のどこにエアコンがあるか」「屋外のどこに送水口
> があるか」を一目で把握するためのコア体験を作る。
>
> ### M122 設備マスター JSON + ストア
>
> `public/equipment-master.json` を新規同梱。`equipment` 配列に 137 件の
> `EquipmentSpec` を持つ。カテゴリは E/P/A/G/S/K/B の 7 種、配置面は
> ceiling/floor/wall/roof/outdoor の 5 種。`metadata.categoryColors` /
> `metadata.placementColors` でカテゴリ・配置面ごとの色を持つ。
>
>  - 起動時に `App.tsx` の `useEffect` から `ensureEquipmentMasterLoaded()` を 1 回呼ぶ
>  - `fetch('/equipment-master.json')` で取得 → `useEquipmentMasterStore.load(file)`
>  - 失敗時は `loadError` を立てて UI 側に表示 (致命でないので空でも動作継続)
>
> 既存の `FurnitureMount` 型 (`'floor' | 'ceiling'`) を **5 面 (`'floor' | 'ceiling' |
> 'wall' | 'roof' | 'outdoor'`)** に拡張。Zod スキーマも `z.enum(['floor', 'ceiling',
> 'wall', 'roof', 'outdoor']).optional()` に拡張する。後方互換: 既存データの mountTo は
> そのまま (= 'floor' / 'ceiling')、新値は今後追加されるインスタンスにだけ付く。
>
> ### M123 配置面フィルタ
>
> `useEquipmentMasterStore.placementFilter: Record<Placement, boolean>` (既定: 全 ON)
> をストアに持ち、Canvas2D 左下に 5 つのチェックボックス UI を出す:
>  - チェック OFF: 当該 placement の設備は 2D で opacity 0.3、操作不可
>  - 3D では非表示 (`Furniture` コンポーネントの早期 return)
>  - 「天井 OFF」にすると 3D の屋根が消えて中が見える、という用途
>
> 既存の **layerMode** (床/天井) はそのまま残し、こちらは room/wall/door 背景の調光に
> 使う。配置面フィルタとは独立 (役割が違う)。
>
> ### M124 2D 描画の刷新 (FurnitureMark)
>
> `FurnitureMark.tsx` を全面刷新:
>  - catalogId が equipment master の spec を指していれば、spec.shape / spec.symbol /
>    spec.width / spec.depth / categoryColors / placementColors で描画
>    - shape='circle': `<Circle>`、shape='square'/'rect': `<Rect>`
>    - 塗り = カテゴリ色 / 枠 = 配置面色 / 中央 = symbol テキスト (中央寄せ、bold)
>    - シンボルの文字色は背景色から YIQ で読みやすい黒/白を選ぶ
>  - catalogId が既存家具カタログ (sofa など) の id なら従来通り `pieces` AABB で描画
>  - 旧 §M119 の「layerMode で天井/床を出し分け」ロジックは廃止
>    (= equipment master の 5 面は placementFilter で制御し、layerMode は背景調光のみに)
>
> ### M125 3D 描画の刷新 (Furniture)
>
> `Furniture.tsx` を equipment master 対応 + 5 面取り付け対応に拡張:
>  - spec が見つかれば `<SpecMesh>` を新ロジックで描く (Box または Cylinder 1 つだけ)
>  - 取り付け面 → ローカル Y (mm):
>    | placement | Y |
>    |---|---|
>    | floor   | 0 + fi.y (= 床直置き、家具スタッキングで上に積むケース対応) |
>    | ceiling | ceilingHeight - spec.height (= 上端を天井に貼る) |
>    | wall    | 1500 (= 床から 1500mm の標準取付高、最寄り壁スナップは v0.30 で実装) |
>    | roof    | ceilingHeight (= 当該フロアの天井の上) |
>    | outdoor | 0 (= 地面、屋外設備は 1F の furniture に置く前提) |
>  - 形状: spec.shape='circle' → `<cylinderGeometry>` (軸 Y、半径=max(w,d)/2)
>           それ以外 → `<boxGeometry args={[w, h, d]}>`
>  - 色: `categoryColors[spec.category]`。`fi.colorOverride` があればそれを優先
>  - `placementFilter[placement] === false` なら mesh を return null (非表示)
>  - 既存家具カタログのパス (sofa など) も 5 面対応に拡張 (wall=1500, roof=ceiling,
>    outdoor=0)
>
> ### M126 EquipmentMasterPanel (Sidebar 拡張)
>
> 既存 Sidebar の家具リストの **下** に「設備マスター」セクションを追加:
>  - カテゴリタブ (E/P/A/G/S/K/B + 全) + 検索ボックス (id/名前/placement/カテゴリ)
>  - 一覧は最大高さ 360px のスクロール領域に grid 表示
>  - 各エントリ: カテゴリ色チップ + 配置面色の左ボーダー + シンボル + 名前 + id/サイズ
>  - クリックで `addFurniture({ catalogId: spec.id, position: 最初の部屋の中心 })`
>    → `floorplanStore.addFurniture` 内で spec.placement を mountTo にコピー
>
> ### M127 store.addFurniture を equipment master 対応
>
> 旧仕様: `addFurniture({ catalogId })` は `getCatalogEntry(catalogId)` で見つから
> ない id を全部 reject していた。v0.29 では:
>  1. 家具カタログを引く → 当たれば `entry.mountToDefault` を mountTo に
>  2. 当たらなければ `getEquipmentSpec(catalogId)` を引く → 当たれば `spec.placement` を mountTo に
>  3. どちらも当たらなければ null を返す (これまで通り)
>
> ### M128 後方互換 / 既存データ
>
> - 既存の保存済みプラン (mountTo='floor' or 'ceiling') はそのまま読める
> - DXF インポート (§M116) で作られる FurnitureInstance も mountTo は 'floor'/'ceiling'
>   のみで変化なし。今後の DXF パターンに 'E-201' (wall) や 'P-301' (roof) が現れたら
>   build 側で placement を正しく拾うよう拡張する (v0.30+)
> - DXF エクスポート (§M121) は equipment-master 系 catalogId をそのままレイヤー名に
>   マッピングできれば理想だが、v0.29 では未マップの id は `FURNITURE` レイヤーに
>   落ちる (= 取り込み直しでは復元されない)。これも v0.30 で改善
>
> ### M129 配置面フィルタの 3D / 2D 同期
>
> 5 面フィルタは Zustand store の単一の真実。同じ store を 2D / 3D 両方が購読するため、
> チェックを切り替えるとリアルタイムに反映される (Konva も R3F も React の reactivity で
> 再レンダリング)。
>
> ### v0.29 で扱わない範囲 (今後)
>
> 1. **設備の点検履歴 (`lastInspectedAt`)** — 型と UI は未着手 (Phase 3 で予定)
> 2. **検索ハイライト** — Sidebar 検索結果を 2D / 3D 上で点滅させる演出 (Phase 3)
> 3. **凡例パネル (Legend overlay)** — カテゴリ色 / 配置面色の説明オーバーレイ (Phase 3)
> 4. **wall 取り付けの最寄り壁スナップ** — XY 位置から最寄りの Wall に自動寄せ
>    (現状は手動で壁付近に置く前提)
> 5. **roof / outdoor の自動フロア割当** — 1 個目のフロア (1F) 限定で配置するなど
>    ガイドが必要 (現状はユーザーが意識する必要あり)
>
> v0.28 以前の §1〜§17 はそのまま継承。
