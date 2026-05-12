# 間取りプランナー Web アプリ 設計書

> Version: **0.13** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v9)
>
> ## v0.12 → v0.13 の主な変更
>
> ### 1. ドアパネルを壁の中心に置いて壁を貫通させる + クリックで開閉 (M72)
>
> v0.11 (M67) で「ドアパネルを wall.thickness + 20mm の厚みで描画し、wall.thickness/4 だけ片側にずらす」
> 実装を入れたが、ユーザーから「壁の片側にくっついているだけのドアがある」フィードバック。
> オフセットを残したまま厚みを増やしたため、片面は 35mm 出るが反対面は壁の中に
> 15mm しか入らず、視点によって「壁の片側だけのドア」に見える状態だった。
>
> 修正方針 (M72):
>  - オフセット (`offsetZ`) を **0** にして パネル中心を壁の中心と一致させる
>  - 厚み `wall.thickness + 20mm` を維持 → 両面に 10mm ずつ顔を出す
>  - swing direction の見た目ヒントは「内開き/外開き」のクリック時アニメで表現するので
>    "閉じている時の Z オフセット" は廃止
>
> **クリックで開閉 (M72)**:
>  - `DoorPanelsLayer` を以前のループ内 mesh → 子コンポーネント `DoorPanel` に分割
>  - `DoorPanel` は `useState<open>` を持ち、`onPointerDown` で toggle
>  - ヒンジを `wall-local X = left` (ドア左端) に置き、子 mesh を `+widthMm/2` オフセット
>  - 開いた時の目標角度: `swingInward ? -π/2 : +π/2`
>  - `useFrame` で `delta * 8 rad/s` の速度で目標角度に lerp → 約 0.18 秒で滑らかに開閉
>  - ノブ (cfb37a の球体) をドアの先端側 + 壁外側 12mm に描画 (クリックヒント)
>
> 副作用:
>  - 旧バージョンの「閉じてる時に少し片側にずれる」見た目は失う代わりに、視点に依存せず
>    必ずドアが見える
>  - クリックの target はパネル本体 + ノブの両方なので大きく操作しやすい
>
> ### 2. 3D ホイールズームをカーソル位置基準に (M73)
>
> three.js の OrbitControls には `zoomToCursor` プロパティがあるが、drei では既定で false。
> CAD 系の操作感を求めるユーザー要望に応えて `<OrbitControls zoomToCursor>` を有効化。
> マウスポインタの真下の点が固定されたまま zoom in/out が走るので、
> 特定の部屋を拡大する際の作業効率が大きく改善。
>
> ### 3. バルコニーの床をコンクリートに (M74)
>
> v0.12 (M71) で `garden → grass` を導入した時、バルコニーは「将来 deck テクスチャ」と
> コメントを残して木調 (wood) に倒していた。ユーザーフィードバックで
> 「バルコニーは木よりコンクリートのほうが屋外感が出る」とのことで、
> `pickFloorTextureKind` の `entrance` ブランチに `balcony` を追加して
> 既存の concrete テクスチャを流用 (新規テクスチャ追加なし)。
>
> ### 4. 手摺をバルコニーの外側に配置 (M75)
>
> M70 では手摺を壁の中心 (wall-local Z=0) に立てていたため、平面図で見ると
> 「部屋の真ん中を手摺が割っている」見た目になっていた。
> 物理的には手摺は **バルコニー床の外周** に立つべき。
>
> 修正:
>  - `WallBox` に `outsideSign?: -1 | 1` を追加 (railing 専用)
>  - `floorplanToScene.wallToBox` で balcony 外周判定時に
>    部屋中心と壁中心を比較して `outsideSign` を計算
>    - wall-local +Z 方向のワールド表現 = `(-dy/L, dx/L)`
>    - `(roomCenter - wallCenter)` と内積し、+なら部屋が +Z 側 → 外側 = -1
>  - `Railing` コンポーネントの最外 group に
>    `position={[0, 0, outsideSign * (thickness/2 - depth/2) * MM_TO_M]}` を追加
>  - これで手摺がバルコニー床の **外周** にぴたっと張り付き、
>    部屋の中央を分断する見た目が解消
>
> v0.12 以前の §1〜§17 はそのまま継承。
