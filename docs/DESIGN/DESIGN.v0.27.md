# 間取りプランナー Web アプリ 設計書

> Version: **0.27** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v23)
>
> ## v0.26 → v0.27 の主な変更
>
> ### 1. 天井高が 3D に反映されないバグを修正 (M113)
>
> v0.24 (M104) で「StatusBar から階の天井高を編集できる」UI を入れたが、3D 描画に
> 反映されていなかった。原因は `floorplanToScene` の以下の行:
>
> ```ts
> const ceilingHeight = metadata.gridSize > 0 ? DEFAULT_WALL_HEIGHT_MM : DEFAULT_WALL_HEIGHT_MM
> ```
>
> 三項演算子の両側が同じ `DEFAULT_WALL_HEIGHT_MM` (= 2400) で、`floor.ceilingHeight`
> を**全く参照していない**致命的バグ。
>
> 修正:
>  - `floor.ceilingHeight` を優先し、未指定 (古いデータ) 時のみ既定 2400mm にフォールバック
>  - `metadata` 引数は他で使われていないので `void metadata`
>  - 3D の壁高 / lintel / 階層スタッキング全部が新しい数値に追従するように
>
> ### 2. 部屋ごとの壁紙色 (両面マルチ) (M114)
>
> v0.25 (M108) で「Floorplan 全体に適用される壁紙色」を入れたが、今回は
> **共有壁の両側で違う色** を実現するため、`Room.wallpaperColor` (部屋ごとの上書き)
> を追加。
>
> 実装:
>  1. `Room.wallpaperColor?: string` を型定義 + Zod スキーマに追加
>  2. ストアアクション `setRoomWallpaperColor(roomId, color | undefined)` を新設
>  3. `floorplanToScene.wallToBox` で各壁の `sharedBy` を走査し、各部屋中心と
>     wall-local +Z 方向の内積で「+Z 側にいる部屋 / -Z 側にいる部屋」を判定。
>     `WallBox.roomOnPosZ / roomOnNegZ` (`string | null`) に格納
>  4. `WallWithOpenings` で `resolveSideColor(roomId)` を定義:
>     - 部屋 ID が null → exterior 既定 or metadata 既定
>     - 部屋の `wallpaperColor` 設定あり → それ
>     - なし → metadata の wallpaperColor (M108 旧設定) → WALL_MATERIAL 既定
>  5. 各 solid を **「+Z 半分 / -Z 半分」の 2 メッシュ** に分割
>     - half thickness の box を `±wall.thickness/4` オフセット
>     - 各半分が対応する側の色 + 共通の wallpaper texture を使う
>  6. PropertyPanel の RoomProperties に「壁紙」セクション (color input + 戻すボタン)
>
> 結果として:
>  - 部屋 A (赤) と 部屋 B (青) が共有壁で接していると、A 側から見た壁は赤、
>    B 側から見た壁は青に見える
>  - 外壁 (sharedBy が 1 つだけ) の場合、屋外側 (null) は metadata 既定、
>    屋内側は当該部屋の色
>  - メッシュ数は壁あたり 2 倍になるが、shadow / texture は同じ source を共有
>    するので GPU 負荷は軽微
>
> v0.26 以前の §1〜§17 はそのまま継承。
