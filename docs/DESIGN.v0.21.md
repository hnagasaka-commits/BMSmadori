# 間取りプランナー Web アプリ 設計書

> Version: **0.21** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v17)
>
> ## v0.20 → v0.21 の主な変更
>
> ### 1. 家具の重なり時は後置を上に積む (M94)
>
> XZ で他家具と重なる位置に新しく家具を置く / ドラッグで重ねた場合、
> その家具を「重なる家具のうち最も高い天面」の上に積むようにした。
> 単純に平面で重ねるだけだと 3D で家具が他家具を貫通して気持ち悪い見た目になっていた。
>
> 実装:
>  - `FurnitureInstance.y?: number` (mm、既定 0 = 床直置き) を追加
>  - `data/schemas.ts` の Zod に `y: z.number().nonnegative().optional()` を追加
>  - `floorplanStore` に `worldFurnitureAabbXZ` / `furnitureTopY` /
>    `computeFurnitureStackY` ヘルパーを新設
>    - rotation 適用後の世界 XZ AABB を corners 回転で求める
>    - 天面 Y は `(fi.y ?? 0) + maxLocalY * scale.y`
>    - 1mm 余裕の AABB overlap で接面は重なりと見なさない
>  - `addFurniture` / `moveFurniture` で stack Y を計算し、`> 0` なら `y` 付与、
>    `0` なら `y` を落とす (床に戻す)
>  - `Furniture.tsx` の group position Y を `yMm * MM_TO_M` に置換
>
> 制約:
>  - 接触判定は **XZ AABB** ベースで簡易。回転は corners 回転で包む AABB を使うので
>    細かい斜め家具は余裕気味に「重なる」と判定される
>  - 多段スタック (A on B on C) は addFurniture 時点で B の現在 y を考慮した
>    `furnitureTopY` を返すため自然に積まれる
>
> ### 2. 引き戸 (sliding door) を追加 (M95)
>
> `DoorType` には既に `'sliding'` が存在したが、2D / 3D とも single-swing の
> 弧+扉本体で描画されていた。引き戸の表現に切替:
>
>  - **2D (DoorMark.tsx)**: `door.type === 'sliding'` の場合、弧 + 扉本体を出さず、
>    開口部の左右に短い「パネル」線を法線方向に 30mm オフセットして 2 本の
>    平行線として描く (建築 2D の引き戸記号)
>  - **3D (Canvas3D.tsx DoorPanel)**: `isSliding` prop を追加。
>    - 通常 (回転開閉): 既存の `g.rotation.y` を ±π/2 に lerp
>    - sliding: `g.position.x` を `leftMm` から `+widthMm * 0.95` まで lerp (約 1.5 m/s)
>    - クリックで開閉 toggle するのは共通
>  - **Opening 型**: `doorType?: 'single-swing' | 'sliding' | 'other'` を追加し
>    `doorToOpening` で `Door.type` から派生
>  - **PropertyPanel.DoorProperties**: 種別が `<span>` だったのを `<select>` に変更し
>    「開き戸 / 引き戸」を選択可能に
>
> ### 3. 2F+ で窓プロパティが出ないバグ修正 (M96)
>
> 旧 `PropertyPanel.WindowProperties` は窓の検索で `floors[0]` を
> ハードコードしていたため、2F 以上の窓を選択しても「窓が見つかりません」と表示され、
> 編集 UI が出なかった。`floors[s.activeFloorIndex]` に修正。
>
> ### 4. 3D で屋根を切替表示 (M97)
>
> `editorStore.roofStyle: 'none' | 'flat' | 'gable' | 'shed'` を新設。
> 3D ビュー右上の HumanToolbar に 4 択ボタンを追加。
>
> 描画 (`Canvas3D.tsx RoofMesh`):
>  - 最上階の `scene.floorPlates` から XZ AABB を集計し 500mm の eave (軒) を追加
>  - **flat**: 厚さ 200mm の薄い slab を被せる
>  - **gable**: 長辺方向を棟として両側に 30° pitch で 2 枚の slab
>  - **shed**: 長辺方向に 15° pitch の片流れ slab
>  - 色は外装系の暗茶 (#6b3a2a) ベース、castShadow / receiveShadow 共に ON
>
> Floor 多階建てでも一番上の天井位置に屋根が乗る。
>
> v0.20 以前の §1〜§17 はそのまま継承。
