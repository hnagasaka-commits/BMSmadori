# 間取りプランナー Web アプリ 設計書

> Version: **0.6** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強)
>
> ## v0.5 → v0.6 の主な変更
>
> ### 1. 3D ドアの可視化を強化 (M50)
>
> v0.5 までは 3D の `splitWallByOpenings` で「壁を分割して空気の隙間を残す」だけだった。
> 結果: 壁が薄い/ドアが大きい/ドアが端寄りで lintel が出にくいケースでは「ただの欠け」と
> 見分けがつかず、「ドアが反映されていない」とユーザーが感じる問題が頻発。
>
> 修正: ドア開口部に **薄板のドアパネル (10mm × 開口幅 × 開口高)** を描画する。
>  - パネル位置: 開口中心、Y = sillHeight 〜 sillHeight + height
>  - パネル色: 木調 (`#6e4f33`)
>  - `swingInward` を反映して、パネルを壁面の内側 / 外側にオフセット (壁厚の 1/3)
>  - 全ドアに必ず 1 枚パネルが入るので「ドアの存在」が常に視認できる
>
> ### 2. §7 家具カタログ拡充 (M51)
>
> 用途別ユーティリティ家具を追加:
>  - `toilet-detail`: 洋式トイレ詳細 (タンク + 便座) -- 既存 `toilet-tank` の上位互換
>  - `trash-can-small`: 小型ゴミ箱 (キッチン/洗面に置く)
>  - `trash-can-large`: 大型ゴミ箱 (45L 標準サイズ)
>
> ### 3. §5.2.1 家具インスタンスのスケール (M52)
>
> `FurnitureInstance.scale: number` は v0.2 から types/schema にあったが、UI で編集する経路が
> なかった。今回:
>  - PropertyPanel.FurnitureProperties に **「拡大率」スライダ + 数値入力** を追加
>  - `floorplanStore.scaleFurniture(furnitureId, scale)` を新設
>  - FurnitureMark (2D) と Furniture (3D) の双方で `scale` を piece 寸法に乗算
>  - 範囲は `0.4 〜 2.5` でクランプ
>  - 既定値 1.0
>
> 角ドラッグでのリサイズは Phase 3 後半 (M53 以降) で検討。今回は 1 パラメータの「拡大率」
> として明示的に編集する形にとどめる。
>
> ### 内部実装メモ
>
> - `splitWallByOpenings` の戻り値に `panels: Array<{...}>` を追加
> - Canvas3D の WallWithOpenings は panels を別マテリアル (木調) でレンダリング
> - FurnitureInstance に **新フィールドなし**: 既存の `scale` を活用するだけ
> - 旧データ (`scale: undefined`) は 1.0 として扱う
>
> v0.5 以前の §1〜§17 はそのまま継承。
