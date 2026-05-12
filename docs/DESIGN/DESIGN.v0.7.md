# 間取りプランナー Web アプリ 設計書

> Version: **0.7** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v3)
>
> ## v0.6 → v0.7 の主な変更
>
> ### 1. 自立壁にも開口部 (ドア/窓) を配置可 (M53)
>
> v0.6 までは `addDoor` / `addWindow` が `floor.walls` (部屋由来の派生壁) のみを `find` して
> いたため、ユーザーが壁ツールで描いた自立壁 (`floor.freestandingWalls`) をターゲットにすると
> `null` を返して開口部が作れなかった。
>
> 修正: 両方の集合を順次検索する。
>
> ```ts
> const wall =
>   floor.walls.find((w) => w.id === input.wallId) ??
>   floor.freestandingWalls?.find((w) => w.id === input.wallId)
> ```
>
> - 2D の `wallById` は既に `[...派生壁, ...自立壁]` を Map 化しているので追加修正不要
> - 3D の `floorplanToScene` も両方の集合を `walls` に積んでいるので開口部レンダリングは
>   自動で動く (M50 のドアパネルもそのまま乗る)
> - 自立壁 (`sharedBy.length === 0`) に置いたドア/窓は所属部屋が無いため、自動ドア抑止
>   tombstone (§6.2) は登録しない — 削除時の挙動も影響なし
>
> ### 2. 非 select ツール中はクリックで部屋・家具・壁・ハンドルが反応しない (M54)
>
> v0.6 までは `tool === 'wall'` (壁を描くモード) でも、既存の部屋や家具をクリックすると
> Konva の onClick が発火して `select` してしまい、壁ドラッグの開始が阻害されていた。
>
> 修正: 子コンポーネントに `tool === 'select'` 以外では一切のインタラクション (selection / drag) を
> 行わないガードを追加する。対象:
>
> - RoomShape (Group の draggable + onClick / onTap)
> - WallLine (onClick の select; window/door ツール時は配置動作のみ許可)
> - FurnitureMark (Group の draggable + onClick / onTap)
> - ColumnMark (onClick)
> - DoorMark / WindowMark (onClick)
> - RoomResizeHandles (Canvas2D で `tool === 'select'` 時のみレンダリング)
>
> 副次効果: 「壁ツール / 描画ツール / 窓ツール / ドアツール」中はキャンバス全体が
> "ツール専用" モードになり、誤クリックでの選択や移動が起きなくなる。
>
> ### 3. 壁ツールのスナップ粒度を細かく (M55)
>
> v0.6 まで `Sidebar` の `gridSize` (既定 910mm = 半間モジュール) で壁の端点をスナップ
> していたため、「もう少しだけ短い壁」「もう少しだけ長い壁」が作れなかった。
>
> 修正: 壁ツール専用に **50mm スナップ** を採用。`gridSize` とは独立に
> `WALL_DRAW_GRID_MM = 50` を Canvas2D に定義し、`wall` ツールの mousedown / mousemove では
> こちらでスナップする。
>
> - 50mm は実務で「メーターモジュール (1000mm) の 1/20」「半間 (910mm) の 1/18」相当
> - 910mm のレールには依然乗りやすいが、それを外して任意の長さを刻める
> - 既存の `gridSize` (グリッド線の表示間隔) は変更しない (見た目の保守性のため)
>
> ### 内部実装メモ
>
> - `floorplanStore.addDoor` / `addWindow` の中の `wall` 検索を 2 段階に
> - `Canvas2D` の wall ツール path で `snapToGridMm(world, gridSize)` →
>   `snapToGridMm(world, WALL_DRAW_GRID_MM)` に置換
> - 各コンポーネントの `draggable` / `onClick` を `tool === 'select'` でガード
> - `Canvas2D` の `<RoomResizeHandles>` レンダリングを `tool === 'select' && selectedRoom != null`
>   に絞る (既存挙動を維持しつつ tool ガードを追加)
>
> v0.6 以前の §1〜§17 はそのまま継承。
