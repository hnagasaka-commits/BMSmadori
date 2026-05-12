# 間取りプランナー Web アプリ 設計書

> Version: **0.12** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v8)
>
> ## v0.11 → v0.12 の主な変更
>
> ### 1. 家具を 縦 / 横 / 奥行き 個別に拡大率変更 (M69)
>
> v0.6 (M52) で導入した `FurnitureInstance.scale: number` は uniform スケールだったため、
> 「ソファだけを横長にしたい」「テーブルだけ低くしたい」といったニーズに応えられなかった。
>
> 修正:
>  - `FurnitureInstance.scale` を `number | readonly [number, number, number]` に拡張
>    (旧 number 値は後方互換のため引き続き受け入れる)
>  - 正規化ヘルパー `furnitureScale3(scale)` を types/floorplan.ts に新設。
>    `undefined → [1,1,1]`、`number → [n,n,n]`、`tuple → tuple` の単純変換
>  - Zod スキーマも `z.union([z.number().positive(), z.tuple([3 軸]).])` に拡張
>  - `scaleFurniture` ストアアクションも 2 形式を受けるオーバーロード相当
>    (各軸 0.2〜3.0 でクランプ。旧 0.4〜2.5 より広い)
>  - 3D (Furniture.tsx) の group scale を `[x, y, z]` に置換
>  - 2D (FurnitureMark.tsx) は XZ 軸 (床面投影) のみ反映 — 高さは平面図には出さない
>  - PropertyPanel に 3 軸 slider + 数値入力を縦に並べたパネル (`横幅 / 高さ / 奥行`)
>
> ### 2. バルコニーの外周壁を手摺として描画 (M70)
>
> 部屋プリセット `balcony` (M65 で追加) の外周壁は、住宅らしく見せるため
> 通常の壁 (FRP/モルタル風) ではなく金属手摺で描画したいというユーザー要望に対応。
>
> 判定ロジック (`floorplanToScene.wallToBox`):
>  - 各 Wall に対して `roomPresetById` (M70 で追加) を引いて、
>    `wall.sharedBy.length === 1 && roomPresetById.get(wall.sharedBy[0]) === 'balcony'`
>    なら `WallBox.kind = 'railing'` を設定
>  - 家側と共有する壁 (sharedBy = [balcony, living-room] 等) は通常壁のままとする
>
> 描画 (`Canvas3D.tsx` 新規 `Railing` コンポーネント):
>  - 高さ 1000mm の縦柱 (50×50mm) を 800mm 間隔で配置
>  - 上端の太い横棒 (60mm 厚) と下端の細い横棒 (40mm 厚)
>  - 中段に細い縦バー (15mm) を 110mm 間隔で並べる「柵」風
>  - 色: 金属感のあるダークグレー (`#5b6b75` + `#3d4a52`)
>  - 壁本体 (solids) / 窓ガラス (glass) / sill / lintel はすべてスキップ
>  - ドアパネルは引き続き DoorPanelsLayer (M67) で別描画される
>
> 2D 側は標準の壁線 (WallLine) のまま — 平面図では壁線で区別できれば十分という割り切り。
>
> ### 3. 庭の床を芝生テクスチャに (M71)
>
> 部屋プリセット `garden` (M65 で追加、M66 で壁レスに) は 3D 上で他の部屋と
> 同じ木目床になっていたため、屋外らしく見せたいというユーザー要望に対応。
>
> 実装:
>  - `proceduralTextures.ts` に `makeGrassTexture()` を新設
>    - ベース: 深緑 (#3f7a3a → #356a31) の縦グラデで奥行き感
>    - 60 個の土斑点 (暗茶) を擬似ランダム配置
>    - 700 本の芝ブレード (短い線分) を角度バリエーション付きで散布
>    - 一部のブレードを明るい黄緑にしてハイライト
>  - `FloorTextureKind` に `'grass'` を追加
>  - `pickFloorTextureKind(presetId)` で `presetId === 'garden'` 時に `'grass'` を返す
>  - `TextureBundle` に `grassFloor` を追加し `useTextures` で生成
>  - `FloorPlates` の ternary chain に grass 分岐を追加
>
> バルコニーは Phase 2 後半で「ウッドデッキ」テクスチャを別途検討予定 — 今は木目で代替。
>
> v0.11 以前の §1〜§17 はそのまま継承。
