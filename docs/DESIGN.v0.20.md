# 間取りプランナー Web アプリ 設計書

> Version: **0.20** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v16)
>
> ## v0.19 → v0.20 の主な変更
>
> ### 1. 家具リアルテクスチャ機能を撤去 (M90)
>
> v0.18 (M86) で追加、v0.19 (M88) で強化した「家具リアル」テクスチャ機能を、
> ユーザー要望「家具のリアル機能はなくす」に応じて全部削除した。
>
>  - `editorStore.realisticFurniture` / `setRealisticFurniture` を削除
>  - `Furniture.PieceMesh` の texture map 適用ロジックを撤去 (旧 M88 の PBR チューニングも巻き戻し)
>  - `useTextures.TextureBundle` から `furnitureWood` / `furnitureFabric` / `furnitureLeather` を削除
>  - `proceduralTextures.ts` から `makeFurnitureWoodTexture` / `makeFurnitureFabricTexture` /
>    `makeFurnitureLeatherTexture` / `pickFurnitureTextureKind` を削除
>  - 3D ビュー右上 HumanToolbar の「家具リアル」チェックボックスを撤去
>
> ### 2. 2D 上の PipeSpace 四角を非表示 (M91)
>
> `Canvas2D.tsx` の PS Layer (`<PipeSpaceMark>`) と import を撤去。
> ユーザー作業画面に PS の四角が出ない設計に。データ (`floor.pipeSpaces`) は保持
> されたままで、将来 ON/OFF が必要になれば 1 行追加で復活させられる構造。
>
> ### 3. 家具カタログを大幅拡張 + カテゴリ分類 (M92)
>
> `FurnitureCatalogEntry` に `category: FurnitureCategory` を追加。
>
>  - **カテゴリ定義** (`FURNITURE_CATEGORY_LABELS` / `FURNITURE_CATEGORY_ORDER`):
>    `living` / `dining` / `kitchen` / `bedroom` / `bath` / `storage` / `work` / `lighting` / `misc`
>  - **既存 34 件** のすべてに `category` を埋め込み (perl one-liner で一括挿入)
>  - **新規 16 件** を追加 — オットマン / 観葉植物 (小) / カウンターチェア /
>    L 型キッチン / 電子レンジ / 食器洗浄機 / ワードローブ / 姿見 / オフィスチェア /
>    学習デスク / デスクライト / シーリングライト / ハンガーラック / 玄関マット /
>    傘立て
>
> ### 4. 家具に検索 + カテゴリグループ表示 (M93)
>
> `Sidebar.tsx` の家具リストを 1 列フラットから「検索 + カテゴリグループ」に置換:
>
>  - 上部に `<input type="search">` を設置 (`data-testid="furniture-search"`)
>  - クエリは `displayName` / `id` / カテゴリラベルに対して大小無視で部分一致
>  - `useMemo` で filtered → category 別に Map にまとめ、`FURNITURE_CATEGORY_ORDER` の順に
>    `<h3>` 見出し付きで表示 (空カテゴリは省略)
>  - 各見出し横に件数バッジを表示 ("リビング (8)" 等)
>  - 検索結果が 0 件なら "該当する家具がありません" のメッセージ
>
> 既存の `data-testid="furniture-<id>"` ボタンは構造の中でそのまま維持されているので、
> e2e (家具カタログから個別配置) はそのまま通る。
>
> v0.19 以前の §1〜§17 はそのまま継承。
