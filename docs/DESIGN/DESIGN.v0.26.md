# 間取りプランナー Web アプリ 設計書

> Version: **0.26** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v22)
>
> ## v0.25 → v0.26 の主な変更
>
> ### 1. FPV 移動を滑らかに (M110)
>
> v0.23 (M103) で導入した「FPV 中の WASD / 矢印キー移動」は keydown ごとに
> 200mm 離散ステップ + `moveHuman` で履歴をスナップしていたため、
> 連続押下では:
>  - OS auto-repeat の頻度に依存する (= 飛び飛びに見える)
>  - 1 秒 W を押すだけで Undo スタックが 30+ 段消費される
>
> 修正方針:
>  - `keysHeldRef = useRef(new Set<string>())` でキー保持状態を管理
>  - `keydown` / `keyup` / `blur` でセット出し入れ
>  - `useFrame` で毎フレーム `delta * speed` だけカメラ位置を更新 (連続)
>    - 通常 1.4 m/s (歩行)、Shift で 7 m/s (ダッシュ)
>    - 斜め移動は `Math.hypot` で正規化して常に同じ速度
>  - `moveHuman` 呼び出しは **「キーが全部離れた瞬間に 1 回だけ」** に絞る
>    (`needsHumanSyncRef` フラグ)。Undo 1 段で連続移動全体を巻き戻せる
>  - `cameraRef` 経由でカメラを mutate (react-hooks/immutability 警告回避)
>
> ### 2. 家具サイズを cm 単位で編集 (M111)
>
> v0.12 (M69) で導入した「拡大率 0.2〜3.0×」スライダーは "倍率" 表記で
> 直感的でなかった。寸法を直接 cm で指定できるよう UI を置換。
>
>  - PropertyPanel の FurnitureProperties で家具カタログの XYZ ローカル AABB を
>    計算 (`baseMm = mxX-mnX, mxY-mnY, mxZ-mnZ`)
>  - 現在の寸法 = `baseMm[axis] * scale[axis] / 10` cm
>  - 各軸 (横幅 / 高さ / 奥行) に slider + number 入力を並べる
>    - 範囲: 旧 0.2×〜3.0× を cm に変換 (`min = baseCm * 0.2`, `max = baseCm * 3.0`)
>    - 1cm 刻み
>    - 「基準 XX cm」ラベルでカタログ標準寸法を表示
>  - 内部的には `setAxis(axis, newCm * 10 / baseMm[axis])` で旧 scale ベース API に変換
>    (= 保存形式は v0.12 のまま、UI だけ cm に乗せ替え)
>
> ### 3. リサイズで隣の部屋に食い込んだら接する位置で止める (M112)
>
> 旧仕様: `resizeRoom` が `overlapsAny` で重なりを検出すると false を返し、
> ハンドルが元位置に snap back していた → 「もう少し広げたい」が出来なかった。
>
> 修正方針:
>  - `core/collision.ts` に `clampResizeAgainstObstacles(proposed, original, obstacles)`
>    を新設
>    - 提案 AABB と他部屋 AABB が overlap した場合、各方向の食い込み深さ
>      (`depthRight = maxX - other.minX` 等) を計算
>    - **最も浅い方向** = "拡張してぶつかった辺" とみなし、その辺を obstacle の
>      対向辺にスナップ
>    - 旧状態でも overlap していた方向は触らない (= 初期破綻状態を悪化させない)
>  - RoomResizeHandles の `handleDragMove` (live preview) と `handleDragEnd`
>    (commit) 両方に挟む
>  - clamp 後に `MIN_DIMENSION_MM` (= 500mm) を下回らないよう再保証
>  - anchor 種別 (nw/ne/sw/se) で「最小寸法に達した時の固定辺」を選ぶ
>
> 結果として、隣の部屋に向けて拡大しすぎても **その隣の壁に接して止まる**
> (= 共有壁を作る) 操作感になる。
>
> v0.25 以前の §1〜§17 はそのまま継承。
