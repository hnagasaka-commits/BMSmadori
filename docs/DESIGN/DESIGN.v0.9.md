# 間取りプランナー Web アプリ 設計書

> Version: **0.9** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v5)
>
> ## v0.8 → v0.9 の主な変更
>
> ### 1. 窓の腰高 (sillHeight) を 3D に反映 (M59)
>
> v0.8 までは `floorplanToScene.windowToOpening` が `sillHeight: DEFAULT_WINDOW_SILL_MM`
> (= 800mm) をハードコードしていた。Window 型自体は `sillHeight: number` を §5.8.3 で
> 必須プロパティとして持っており、PropertyPanel の「腰高」入力 (`updateWindow` 経由) は
> 2D 表示には反映されていたが、**3D 上の sill/lintel/ガラスの Y 位置は常に 800mm 固定**で、
> ユーザー入力が無視されていた。
>
> 修正方針 (M59):
>  - `windowToOpening(w)` で `w.sillHeight` を採用 (有限な 0 以上の値ならそのまま、
>    未定義や負値なら従来どおり 800mm にフォールバック)
>  - `splitWallByOpenings` 側は既に `op.sillHeight` を sill/lintel/glass の Y 位置として
>    使っているので、入力値が opening まで届けば自動で 3D に反映される
>  - 効果: 出窓を低くしたい場合 sillHeight=400、トップライト風の高窓は sillHeight=1800、
>    といった 2D での編集が 3D ビューに即時反映される
>
> ### 2. 非表示壁にぶら下がるドアが 3D に出ない問題を修正 (M60)
>
> v0.6 で M50 が「ドアパネルを必ず 1 枚 push する」、v0.8 で M56 が
> 「複数開口が重なっても各 door に独立パネル」を解決した。
> しかし **「壁を消す」(M30 hiddenWallIds への追加) を行うと、その壁にあったドアも
> 黙って 3D から消える** 問題が残っていた。
> ユーザーから見れば「2D で削除した壁」が消えるのは想定通りだが、
> 壁にぶら下がるドアまで消えてしまうのは「2D に置いたドアが 3D に出ない」
> 不具合として体験される。
>
> 修正方針 (M60):
>  - `WallBox` 型に `hidden?: boolean` フラグを追加
>  - `floorplanToScene` で `hiddenWallIds` に含まれる壁は **walls 配列から除外せず**
>    `hidden=true` でマークだけして残す (openings の wallId マッチに使うため)
>  - `Canvas3D.WallWithOpenings` で `wall.hidden` の場合は壁本体 (solids) と窓ガラス (glass)
>    を非表示にし、**ドアパネルだけは引き続き描画**する
>  - 効果: 壁を 2D で削除しても、ドアは「自立した板」として 3D に残る。
>    ドアそのものを消したい場合は 2D 上でドア記号を選択して削除する従来 UX
>
> ### 3. 3D 上に人物モデルを配置 (M61)
>
> 部屋の広さや家具のサイズ感は、CG 上では伝わりにくい。
> Floor 型には `humanModels: HumanModel[]` が Phase 2 から確保済みで、
> 型 (`{ id, position, rotation, height }`) も Zod スキーマも整っていたが、
> 実際の UI / 3D 描画 / ストアアクションは未実装だった。
>
> 実装内容 (M61):
>  - `floorplanStore` に `addHuman / removeHuman / moveHuman` アクションを追加
>    (家具と同じ snapshot+set パターン、500〜2500mm の身長クランプ付き)
>  - `editorStore.SelectedElement` に `{ kind: 'human'; id }` を追加
>  - `components/canvas3d/Humans.tsx` を新規作成:
>    - 球 (頭) + 円柱 (胴/腰/腕/脚) で構成する単純な人型
>    - Furniture.tsx と同じ XZ 平面ドラッグ (e.ray.intersectPlane + setPointerCapture)
>    - 選択中は emissive ハイライト (家具と同じ視覚言語)
>  - `Canvas3D` に `<Humans humans={s.floor.humanModels} />` を床ごとに描画
>  - 右上に「人を置く」ボタン (`HumanToolbar`) を追加 → クリックで建物中心に新規配置
>
> ### 4. 人物モデルの身長を可変に (M62)
>
> M61 で追加した人物モデルは既定 1700mm だが、ユーザー (子供 / 大柄) のスケール感を
> 個別に確認したいケースに備えて身長を編集可能にする。
>
> 実装内容 (M62):
>  - `floorplanStore.setHumanHeight(id, mm)` アクションを追加 (500〜2500mm でクランプ)
>  - `PropertyPanel` に `HumanProperties` セクションを追加
>    (slider + number input。家具のサイズ拡大率 UI と同じレイアウト)
>  - 3D ジオメトリの縦スケールは `scale={[1, height/1700, 1]}` で適用 (Y 軸のみ)
>    - XZ を等倍にしないとフィギュアが頭でっかちに見える副作用があるため、
>      簡易フィギュアでは Y のみで割り切る
>
> v0.8 以前の §1〜§17 はそのまま継承。
