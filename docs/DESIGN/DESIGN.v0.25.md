# 間取りプランナー Web アプリ 設計書

> Version: **0.25** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v21)
>
> ## v0.24 → v0.25 の主な変更
>
> ### 1. 部屋リサイズの粒度を 50mm に細かく (M106)
>
> 旧 RoomResizeHandles は drag end 時の吸着を `editorStore.gridSize` (= 既定 910mm =
> 尺モジュール 1 マス) に丸めていた。これだと「あと数 cm だけ広げたい」が
> 出来なかった。
>
>  - `FINE_RESIZE_SNAP_MM = 50` 定数を導入し、リサイズ・polygon 頂点ドラッグ両方の
>    drag end 吸着で使う
>  - `gridSize` prop は API 互換のため残すが内部では使わない (`_gridSize` で void)
>  - 結果: **50mm (5cm) 単位**で寸法を自由に変えられる。既存の最小幅 500mm
>    クランプ (resizeRoom) はそのまま
>
> ### 2. 家具の色を上書き編集 (M107)
>
> `FurnitureInstance` に `colorOverride?: string` を追加。
>
>  - Zod スキーマも `z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()` で受け入れ
>  - `setFurnitureColor(furnitureId, color | undefined)` ストアアクション
>    - undefined / '' で key 自体を削除して preset 既定色に戻す
>    - 16 進文字列 (`#rrggbb`) を渡すと全パーツに乗算で上書き
>  - `Furniture.tsx` の `PieceMesh` に `colorOverride` prop を流し、
>    `meshStandardMaterial.color = colorOverride ?? piece.material.color` で上書き
>  - `PropertyPanel.FurnitureProperties` に `<input type="color">` と「戻す」ボタンを追加
>
> ### 3. 壁紙の色を上書き編集 (M108)
>
> `FloorplanMetadata.wallpaperColor?: string` を追加 (Floorplan 全体に適用)。
>
>  - 既定値 `#f5f1ea` (cream / 旧 WALL_MATERIAL.color と同じ)
>  - `WallWithOpenings` で `wall.kind !== 'exterior'` の壁のみ `wallpaperColor` を
>    `meshStandardMaterial.color` に流す。外壁サイディングには影響しない
>  - 壁紙テクスチャ (procedural wallpaper) は据え置きで color と乗算されるため、
>    パターンの陰影は残しつつ全体の色味だけ変えられる
>  - `StatusBar` に `<input type="color">` と「↺」(既定戻し) ボタン
>
> ### 4. 床素材を部屋ごとに上書き (M109)
>
> `Room.floorMaterial?: 'wood' | 'kitchen' | 'tile' | 'concrete' | 'grass'` を追加。
> 未指定なら `pickFloorTextureKind(presetId)` の既定が使われる (旧挙動と互換)。
>
>  - `FloorPlate.floorMaterial?` で 3D 側に伝播
>  - `Canvas3D.FloorPlates` の kind 解決を `plate.floorMaterial ??
>    pickFloorTextureKind(plate.presetId)` に変更
>  - `setRoomFloorMaterial(roomId, kind | undefined)` ストアアクション
>    - undefined で key 削除 → preset 既定に戻る
>  - `PropertyPanel.RoomProperties` に `<select>` を追加。選択肢:
>    既定 (preset 由来) / 木目フローリング / クッションフロア / タイル /
>    コンクリート / 芝生
>
> v0.24 以前の §1〜§17 はそのまま継承。
