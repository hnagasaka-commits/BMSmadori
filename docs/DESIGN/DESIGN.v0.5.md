# 間取りプランナー Web アプリ 設計書

> Version: **0.5** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 修正 v3)
>
> ## v0.4 → v0.5 の主な変更
>
> ### 不具合修正 + UX
>
> **§15 3D ビュー: polygon 部屋の床と壁が Z 軸で反転していた (M48)**
>
> `Canvas3D` の `FloorPlatePolygonMesh` は `THREE.ShapeGeometry` を XY 平面に作って
> `mesh.rotation=[-π/2, 0, 0]` で寝かせていた。回転行列を計算すると:
>
> ```
> (px, py, 0) → (px, 0, -py)   ← -π/2 around X
> ```
>
> つまり「平面図 Y → 3D の -Z」となり、Z が反転していた。一方で壁 (`floorplanToScene` の
> `wallToBox`) は `wall.from[1] → center.z` と単純に符号維持で配置していたため、polygon の
> 床は壁の Z 鏡像位置にあり、視覚的に床と壁がずれて見える原因になっていた。
>
> 修正: 回転を `+π/2` に変更し、`(px, py, 0) → (px, 0, py)` で plan_y がそのまま +Z に
> マップされるようにする。material の `side` は既に `DoubleSide` なので片面化の影響なし。
>
> **§9 2D Canvas: 空き領域ドラッグで pan (M49)**
>
> これまで pan は wheel ズーム時の cursor anchored 計算でしか動かなかった。マウスドラッグで
> 自由にビューを動かしたいユーザーの要求に応じ、Konva Stage の `draggable` を
> `tool === 'select'` 時のみ有効化する。
>
> 制約と振る舞い:
>  - select 以外のツール (window / door / draw / wall) は無効化 (ツール本来の操作を優先)
>  - 子要素 (Room / Wall / Furniture / Handle 等) は自身が draggable なので Konva の
>    階層的 hit-test で子のドラッグが優先される (= 部屋ドラッグなどは壊れない)
>  - 「空き領域を**クリック**したら選択解除」も維持する。Konva は drag 開始判定に
>    `dragDistance` (既定 = 3px) を見るので、純粋なクリックは onClick 経由で扱える
>
> 実装 (Canvas2D):
>  - Stage に `draggable={tool === 'select'}`
>  - Stage `onDragEnd`: `editorStore.setPan({x: stage.x(), y: stage.y()})` で同期
>  - Stage の onClick で `if (e.target === e.target.getStage()) clearSelection()`
>    (旧 onMouseDown 経由の選択解除は撤回 — drag と競合)
>  - hover カーソルは `grab` / 押下中は `grabbing`
>
> v0.4 以前の §1〜§17 はそのまま継承。
