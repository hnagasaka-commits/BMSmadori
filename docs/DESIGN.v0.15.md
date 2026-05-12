# 間取りプランナー Web アプリ 設計書

> Version: **0.15** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v11)
>
> ## v0.14 → v0.15 の主な変更
>
> ### 1. ドラッグ中の部屋に壁・ドア・窓が追従する (M79)
>
> 旧 §M32 の挙動:
>  - 部屋をドラッグ開始すると `setDraggingRoomId(room.id)` で記録
>  - `WallLine` / `DoorMark` / `WindowMark` の各コンポーネントは
>    `wall.sharedBy.includes(draggingRoomId)` の壁を **return null で非表示**
>  - 部屋の Rect の stroke を太め黒色にして「壁の代わり」とする
>
> 問題:
>  - 内部に他の部屋を持たないバルコニーや庭のような外周だけの部屋では、
>    壁が完全に消えて Rect だけが動くため「床と壁がバラバラに見える」報告
>  - ドラッグ中に窓/ドアの記号も消えるので、どこに開口部があったか分かりにくい
>
> 修正方針 (M79):
>  - `editorStore` に `draggingOffset: { dx: number; dy: number } | null` を新設
>  - `RoomShape` の `onDragStart / onDragMove / onDragEnd` で
>    `setDraggingOffset({ dx, dy })` を呼び、現在の Konva 位置から元位置までの mm 単位差分を反映
>  - `WallLine` は draggingOffset を Line.points に加算 → 壁が床と一緒に動く
>  - `DoorMark` / `WindowMark` も同様に wall.from/wall.to にオフセットを足して描画
>  - 旧 「return null による非表示」分岐を撤去
>  - 副作用: ドラッグ中も WallLine の `draggable` (= 共有壁リサイズ) は ON のままだと
>    二重ドラッグになるため `isFollowingDrag` の時は false に倒す
>
> 共有壁の場合 (sharedBy=2 の壁) は、ドラッグ中のどちらか片方の部屋に同期して動く。
> 視覚的には「壁が引き伸ばされる」風に見えるが、ドロップ後に recomputeFloor が
> 部屋形状から壁を再生成するので問題ない (むしろドラッグ中の「無壁」状態より自然)。
>
> ### 2. ドアパネルが壁内に埋もれる不整合を修正 (M80)
>
> v0.14 (M76) でドアパネル厚を 40mm に縮小したことで「壁にドア型の穴が見える」
> 表現を実現したが、`splitWallByOpenings` (M63) と `DoorPanelsLayer` (M67) の
> 「開口を有効と認める最小幅」がずれていたため不整合が出ていた:
>  - `splitWallByOpenings`: clipped width が 50mm 超のみ穴を切る
>  - `DoorPanelsLayer`: clipped width が 10mm 超ならパネルを描画
>  - 結果: clipped width が 10〜50mm の領域では「壁は solid のままパネルだけ描画」
>    → 厚さ 40mm のパネルが厚さ 100mm の壁本体に埋もれて見えない
>
> 修正方針 (M80):
>  - `splitWallByOpenings` の閾値を 50mm → **10mm** に下げ、DoorPanelsLayer と揃える
>  - これで「DoorPanelsLayer が描画するドアには必ず壁に穴が空く」不変条件が成立
>  - 細すぎる開口部 (clipped 10mm 以下) は両者とも skip するので degenerate ケースは安全
>
> 副作用:
>  - 壁端ぎりぎりに置かれたドアでも穴が空くので、ドラッグ後に位置がずれた
>    ドアでも 3D で見える
>  - 既存の 289 unit / 25 e2e は引き続きグリーン
>
> v0.14 以前の §1〜§17 はそのまま継承。
