# 間取りプランナー Web アプリ 設計書

> Version: **0.22** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v18)
>
> ## v0.21 → v0.22 の主な変更
>
> ### 1. 階段プリセット (M98)
>
> `ROOM_PRESETS` に 2 種類を追加 — どちらも `category: 'circulation'`:
>
>  - `stairs-start` (階段 上り口): 通常の床プレートを描き、3D で階段が立ち上がる
>  - `stairs-end` (階段 吹き抜け): 上階に置く想定。3D では床プレートを描かない
>    → 階段が抜けて見える "穴" になる
>
> 実装:
>  - `floorplanToScene`: `room.presetId === 'stairs-end'` の部屋は `floorPlates.push` を skip
>  - `SceneSpec.stairs: Stairs[]` を新設 (`stairs-start` から派生)
>  - `Stairs.direction` は AABB の長辺方向と `room.rotation` から `'+x' | '-x' | '+z' | '-z'`
>    のいずれかを決定
>  - 3D (`Canvas3D.StairsLayer`): 段数 = `max(12, ceil(rise/200))`、踏面 = `length/steps`、
>    蹴上 = `rise/steps`。各段を薄い箱として積み上げる
>
> ### 2. 3D で表示階を任意に絞れるトグル (M99)
>
> `editorStore.visibleFloorIndex: number | null` を新設 (null=全階表示)。
> 3D ビュー右上の HumanToolbar に floors.length > 1 のときだけ
> 「全階 / 1F / 2F …」セレクタを表示。
>
> Canvas3D の `stacked.map((s, idx) => ...)` で `visibleFloorIndex !== null && idx !== visibleFloorIndex`
> なら null を返してその階の壁/床/家具/開口部/階段/人物モデルすべてをスキップ。
>
> ### 3. 切妻屋根の傾斜方向を修正 (M100)
>
> v0.21 (M97) の gable は X 軸 / Z 軸まわりの回転符号が反転していて、
> ridge が中央で 凹む V 字 になっていた (棟が低く、軒が高い)。
>
> 修正:
>  - `ridgeAlongX` (棟が X 軸方向) の場合:
>    - `-Z 側 slab`: `rotation X = -pitchRad` (旧 `+pitchRad`)
>    - `+Z 側 slab`: `rotation X = +pitchRad` (旧 `-pitchRad`)
>  - `ridgeAlongZ` (棟が Z 軸方向) の場合:
>    - `-X 側 slab`: `rotation Z = +pitchRad` (旧 `-pitchRad`)
>    - `+X 側 slab`: `rotation Z = -pitchRad` (旧 `+pitchRad`)
>  - これで slab の eave (軒) が y=0、ridge (棟) が y=rise の正しい山型に
>
> 数学:
>  - rotation X by +θ で local (0, 0, -L/2) → world (0, L/2 sin θ, -L/2 cos θ) は +Y 方向
>  - 「棟側を高く」するためには eave 側 (中心から離れる側) を -Y 方向に押し下げる必要があり、
>    結果として 符号が逆 になる
>
> ### 4. 引き戸アニメーションの単位バグ修正 (M101)
>
> v0.21 (M95) で `isSliding` のスライド lerp を入れたが `g.position.x` (three.js は m) を
> `leftMm + targetSlideX` (mm のまま) と比較していたため、初期位置と目標位置の差分が
> 数百〜数千 m 単位になり、`delta * 1500` でも到達せず実質アニメ無効化状態だった。
>
> 修正:
>  - `baseM = leftMm * MM_TO_M`、`targetM = baseM + targetSlideX * MM_TO_M` に変換
>  - `step = delta * 1.5` (= 1.5 m/s = 典型的な引き戸の手動操作速度)
>  - 到達判定の `<1mm` を `<0.1mm` (1e-4 m) に調整
>
> ### 5. 設計書を `docs/DESIGN/` に集約 (M102)
>
> 旧 `docs/DESIGN.md` および `docs/DESIGN.v0.*.md` を全て `docs/DESIGN/` フォルダに移動。
>
>  - 旧 `docs/DESIGN.md` → `docs/DESIGN/index.md`
>  - 旧 `docs/DESIGN.v0.2.md` 〜 `docs/DESIGN.v0.21.md` → `docs/DESIGN/DESIGN.v0.*.md`
>  - 新規版もこの DESIGN/ フォルダに保存
>  - git mv で履歴を保持
>
> v0.21 以前の §1〜§17 はそのまま継承。
