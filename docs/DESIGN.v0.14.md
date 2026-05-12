# 間取りプランナー Web アプリ 設計書

> Version: **0.14** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v10)
>
> ## v0.13 → v0.14 の主な変更
>
> ### 1. ドアパネルを薄板化して「ドア型の壁穴」を可視化 (M76)
>
> v0.13 (M72) でパネルを `wall.thickness + 20mm` (= 120mm) の貫通厚にしたため、
> 壁の hole (M63 で切る door 形状) が常にパネルで埋まり、
> 「壁にドアの形の穴が開いている」見た目が伝わらなかった。
>
> 修正方針:
>  - パネル厚を **40mm** (実建材ドアの標準厚) に縮小
>  - Z 中心は 0 のまま (壁の真ん中に薄板)
>  - 壁厚 100mm > パネル厚 40mm なので、壁の両面から見て
>    パネルの両脇に「30mm のドア枠の窪み」が見える
>  - lintel (door.height〜top) は引き続き残るので、ドア上方も壁が貫通せず "鴨居" 風
>  - 結果: 壁にはドアの形 (= door.width × door.height) の貫通穴が開き、
>    その中央にやや細い扉が立つ — 玄関ドアの典型表現
>  - ノブ Z 位置も `panelDepth/2 + 8mm` に追従 (旧 wall.thickness 基準から脱却)
>
> ### 2. 3D ズームインの最小距離を 1m → 0.2m に短縮 (M77)
>
> OrbitControls の `minDistance` を `1` (旧) → `0.2` (新) に変更。
> 旧設定だと「家具やドアに顔を近づけたい」「人モデルと並ぶ目線まで降りたい」が
> 出来なかったが、20cm まで詰められるようになった。
> M73 の zoomToCursor と組み合わせると、カーソル位置を起点に床上 20cm まで自然に降下できる。
> (maxPolarAngle は地面下に潜らないよう `π/2.05` を維持。)
>
> ### 3. 人物モデルの一人称視点 (FPV) モードを追加 (M78)
>
> M61 (M62) で配置した人物モデルの「目で見える景色」を確認したいというユーザー要望に対応。
>
> 実装:
>  - `editorStore` に `fpvHumanId: string | null` + `enterFpv(id) / exitFpv()` を追加
>  - `PropertyPanel.HumanProperties` に **「この人の視点で見る (FPV)」** ボタンを追加
>    (3D ビュー時のみ表示。ボタン押下で `enterFpv(h.id)` を呼ぶ)
>  - `Canvas3D` に新規 `CameraRig` を導入し、`fpvHumanId` の有無で切替:
>    - null → 通常の `<OrbitControls>` (M73 / M77 の挙動を保持)
>    - 値あり → `<PointerLockControls>`。useEffect でカメラを目の高さに飛ばす
>      - 位置: `(human.x, human.y_offset + max(800, human.height - 100), human.z)` mm
>      - 視線方向: `(0,0,-1)` を Y 軸まわりに `human.rotation` 回転 → `(-sin, 0, -cos)`
>  - `Humans.tsx` で `fpvHumanId === h.id` の人物だけ非表示 (自分の頭が視界を塞ぐのを防止)
>  - 画面右上に `FpvHud` を出し「ESC で終了 / FPV 終了 ボタン」を提示
>  - PointerLockControls の `onUnlock` で `exitFpv()` を呼ぶので ESC 一発でも抜けられる
>
> 制約 (Phase 3 v0.14 時点):
>  - WASD 等の移動操作は未対応 — その場で振り向くだけ (`PointerLockControls` の標準動作)
>  - 移動は一度 FPV を抜けて 2D / 3D 上で人物をドラッグし直す前提
>  - 階段や吹き抜けの上下移動も無し
>
> 副作用:
>  - FPV モード中は `OrbitControls` がアンマウントされるので OrbitControls の各 prop も無効化
>  - 抜けた瞬間に OrbitControls がデフォルトで target にフォーカスし直す
>    (位置はカメラに残るが視線が target に飛ぶので軽い "ぶれ" が発生)
>
> v0.13 以前の §1〜§17 はそのまま継承。
