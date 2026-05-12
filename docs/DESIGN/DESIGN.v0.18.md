# 間取りプランナー Web アプリ 設計書

> Version: **0.18** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v14)
>
> ## v0.17 → v0.18 の主な変更
>
> ### 1. 部屋面積を m² / 畳 / 坪 で表示 (M84)
>
> v0.17 までは PropertyPanel で「面積 (㎡)」を 1 行だけ表示していた。
> 日本の住宅プランニングでは「畳数」「坪数」が同じくらい重要なので 3 単位を並べる:
>
>  - **1 坪 = 3.3058 m²** (= 6 尺 × 6 尺、JIS 公正規格)
>  - **1 畳 = 0.5 坪 = 1.6529 m²** (= 不動産表示の慣行値)
>
> 実装:
>  - `core/geometry.ts` に `TATAMI_M2` / `TSUBO_M2` 定数と
>    `areaToDisplayUnits(areaMm2)` ヘルパーを追加
>  - `PropertyPanel.RoomProperties` で 旧「寸法 (mm) > 面積 (㎡)」 を撤去し、
>    別 section 「床面積」に m² / 畳 / 坪 の 3 行を表示 (rect / polygon 両対応)
>  - `Canvas2D.RoomShape` の room rect ラベルにも `12.34 ㎡ / 7.5 畳 / 3.73 坪` を追記。
>    polygon 部屋では「寸法 (mm) ×」がそもそも無いので面積ラベルだけ出す
>
> ### 2. 壁を非表示にしたら付随するドア / 窓も削除 (M85)
>
> 旧 `hideWall` は `hiddenWallIds` に wallId を追加するだけだったため、
> その壁にあったドアや窓は floor.doors / floor.windows に残ったまま、
> 3D 上でパネルだけが宙に浮く事故が出ていた (M60 で「非表示壁でもドアは出す」を
> 守った副作用)。
>
> 修正:
>  - `hideWall(wallId)` で `floor.doors.filter(d => d.wallId !== wallId)` /
>    `floor.windows.filter(w => w.wallId !== wallId)` を同時に実行
>  - 一発の操作 (1 snapshot) で「壁 + 付随ドア + 付随窓」がまとめて消える
>  - Undo 1 回で元に戻る (snapshotForHistory は 1 度だけ呼ぶ)
>
> ### 3. 家具のリアルテクスチャモード (M86)
>
> 単色シェーディングだった 3D 家具に「リアル」モードを追加。
> ON にすると procedural な木目 / 布テクスチャを家具色と乗算して描画する。
>
> 実装:
>  - `proceduralTextures.ts` に 2 つの 128×128 テクスチャを追加
>    - `makeFurnitureWoodTexture`: 縦の木目縞 + 節 + 砂目ノイズ (白基調)
>    - `makeFurnitureFabricTexture`: 経緯糸のグリッド + 細かいノイズ (白基調)
>    - 白基調 = `meshStandardMaterial.color` と乗算されて模様だけ浮かび上がる
>  - `pickFurnitureTextureKind(colorHex)` で color から自動選択
>    - 茶系 (R > G > B かつ R-B > 25) → `'wood'`
>    - それ以外 → `'fabric'`
>    - 純白系 (R,G,B 全部 > 220) → `null` (テクスチャ無し、塗装ものはそのまま)
>  - `useTextures.TextureBundle` に `furnitureWood` / `furnitureFabric` を追加
>  - `Furniture.PieceMesh` で `realisticFurniture === true` ならテクスチャをクローン+
>    repeat 設定 (家具寸法に応じて 0.4m で 1 タイル) → `meshStandardMaterial.map` に渡す
>  - `editorStore` に `realisticFurniture: boolean` + `setRealisticFurniture` を追加
>  - 3D ビュー右上の HumanToolbar に「家具リアル」チェックボックスを設置
>
> 既定値:
>  - `realisticFurniture = false` (旧挙動と互換)
>
> 副作用:
>  - 既存 e2e (家具表示系) はチェック OFF 既定のため挙動変わらず通過
>  - チェック ON の状態で巨大な家具を多数置くと texture clone が増えるが、
>    各クローンは uv だけ違う共有 source なので GPU メモリへのインパクトは軽微
>
> v0.17 以前の §1〜§17 はそのまま継承。
