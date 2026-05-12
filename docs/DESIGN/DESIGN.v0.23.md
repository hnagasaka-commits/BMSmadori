# 間取りプランナー Web アプリ 設計書

> Version: **0.23** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v19)
>
> ## v0.22 → v0.23 の主な変更
>
> ### 1. FPV モードに十字クロスヘア + キーボード移動 (M103)
>
> v0.14 (M78) で導入した「人物モデルの一人称視点」モードに 3 つの機能を追加:
>
>  - **十字クロスヘア表示**
>    - 画面中央に SVG で +・◯・中央ドットの 3 層レチクルを表示
>    - `pointerEvents: 'none'` でクリックは下の canvas (= 既存 onPointerDown) に通す
>    - 結果として、ドアパネル等の onPointerDown ハンドラ (M72 のクリック開閉) が
>      クロスヘア越しに視線先のオブジェクトに対して発火し、いわば
>      「視線で狙ってクリックでドア開閉」が成立する
>  - **キーボード移動**
>    - ↑↓←→ / WASD で歩く (Shift で 5× = ダッシュ)
>    - 1 押下 200mm (Shift で 1000mm) を camera の forward (XZ 投影) と right ベクトル
>      に分解して加算
>    - 移動後の XZ 位置を `moveHuman(fpvHumanId, [xMm, zMm])` でストアに反映
>    - 人物モデルの位置と camera 位置が常に同期する (= FPV を抜けた瞬間に人物が
>      "歩いた先" にいる)
>  - **FPV エントリ判定の修正**
>    - 旧コードは `useEffect([fpvTarget])` が「fpvTarget が変わるたび」に発火し、
>      キーで移動して store が更新 → fpvTarget の参照が変わる → camera 位置が
>      元の人物座標に戻される、というループになっていた
>    - `lastFpvIdRef` で「fpvHumanId が null→id へ遷移した瞬間」だけ初期位置を
>      セットし、以降はキー & マウスで自由に動かせるように
>  - **HUD の操作ガイド更新**
>    - FPV 終了ボタンの下に「マウス: 視線回転」「↑↓←→ / WASD: 歩く」を併記
>
> 実装ファイル:
>  - `Canvas3D.tsx` の `CameraRig`: lastFpvIdRef + `useEffect` で keydown 登録
>  - `Canvas3D.tsx` 新規 `FpvCrosshair` コンポーネント (Canvas 外の HTML 層)
>  - `Canvas3D.tsx` の `FpvHud`: 操作ガイド説明を追加
>
> 制約 / 既知の挙動:
>  - 縦方向 (Y) の移動は無し。階段や吹き抜けでの上下移動は今のところ階の切替 +
>    再エントリで対応する想定
>  - 連続キーホールド (Hold)は OS の auto-repeat に依存するため、低頻度で離散的に
>    歩く挙動。将来 `useFrame` ループで毎フレーム判定するスムーズ移動に拡張余地あり
>  - ESC でロック解除 → onUnlock → exitFpv が自動で発火する仕組みは継続
>
> v0.22 以前の §1〜§17 はそのまま継承。
