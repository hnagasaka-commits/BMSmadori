# 間取りプランナー Web アプリ 設計書

> Version: **0.11** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v7)
>
> ## v0.10 → v0.11 の主な変更
>
> ### 1. 人物モデルの向きを 90° 単位で変更可能に (M64)
>
> M61 で導入した人物モデルは `HumanModel.rotation` (rad) を型として持っていたが、
> UI からは変更できなかった。`PropertyPanel.HumanProperties` に家具と同じ
> 「0° / 90° / 180° / 270°」ボタン群を追加し、`rotateHuman(id, rad)` を呼ぶ。
>  - ストア: `floorplanStore.rotateHuman` 新規追加 (snapshot + replaceFloor)
>  - 3D: `Humans.tsx` の group rotation で既に反映済み (今回コード変更不要)
>
> ### 2. バルコニー / 庭プリセットを追加 (M65 / M66)
>
> `ROOM_PRESETS` (`frontend/src/data/roomPresets.ts`) に 2 件追加:
>  - `balcony` (バルコニー): category=outdoor、defaultSize 1820×910、壁あり
>  - `garden` (庭): category=outdoor、defaultSize 3640×3640、**壁なし**
>
> 庭の「壁なし」実装 (M66):
>  - `frontend/src/core/walls.ts` に `isWalllessPreset(presetId)` 判定を追加
>    (現状 `garden` のみ。バルコニーは将来手摺壁の議論があるので除外)
>  - `regenerateWallsFromRooms` のループ先頭で `isWalllessPreset(room.presetId)` なら
>    `continue` し、Room.shape は床プレート用に保持されるが Wall は生成されない
>  - 共有壁判定にも参加しないので、隣の部屋から見ても庭側に壁は立たない
>
> サイドバーは `ROOM_PRESETS.map(...)` をそのまま使うので、追加で UI 変更なし。
>
> ### 3. ドアパネルを独立レイヤー化して必ず描画 (M67)
>
> 経緯:
>  - v0.6 (M50) で「壁の split 結果に doorPanels[] を返す」
>  - v0.8 (M56) で「opWidth=0 でもパネルだけは push する」
>  - v0.9 (M60) で「非表示壁でもドアは出す」
>  - v0.10 (M63) で「splitWallByOpenings を区間 union に置換 → どの開口にも必ず穴」
>  と修正を重ねたが、ユーザーから「**やっぱりまだドアが 3D に出ない**」報告。
>
> 根本原因の認識:
>  - これまでの修正はすべて `splitWallByOpenings` の内側で完結していて、
>    wall の rotation/center group の入れ子に依存していた
>  - panel mesh は wall thickness の 1/3 だけ片側にずらして配置されており、
>    panel z 寸法 30mm に対し wall z 寸法 (100〜180mm) が常に上回って **panel が壁内に埋没**
>  - 開口の hole 切り出しと panel 描画が同じ pipeline にあったため、
>    一方のバグがそのまま panel 非表示に直結
>
> 修正方針 (M67):
>  1. **DoorPanelsLayer** という独立コンポーネントを新設し、`scene.openings` から
>     `kind === 'door'` だけを抜いてワールド座標で直接 mesh を立てる
>  2. wall は id 一致で `scene.walls` から取り出し、ある場合のみ描画 (orphan ドアは黙って捨てる)
>  3. パネルの Z 寸法 = `wall.thickness + 20mm` とし、壁の両面から 10mm ずつ
>     はみ出すようにする → どの視点からも必ずドアが視認できる
>  4. swingInward は中心を `±wallThickness/4` ずらすことで残す
>  5. `WallWithOpenings` 内の doorPanel mesh は撤去 (重複を避ける)
>     ただし `splitWallByOpenings` の hole 切り出しと lintel 描画は維持
>     (壁の穴と lintel は引き続き wall split 経由でできる)
>
> 効果:
>  - splitWallByOpenings の状態に関わらず、`floor.doors` にあれば必ず 3D にパネルが出る
>  - 壁を 2D で削除しても M60 と組み合わさってパネルだけ残る
>  - 既存の 289 unit / 25 e2e は全て通過 (機能の追加のみで既存挙動を壊さない)
>
> ### 4. 家具カタログに 3 段ボックスを追加 (M68)
>
> `frontend/src/data/furnitureCatalog.ts` に `storage-box-3tier` を追加:
>  - displayName: '3 段ボックス'
>  - 外殻 (420 × 900 × 300mm) + 棚板 2 枚 (色違いで段を視認可能)
>  - minRoom: 420 × 320 (子供部屋 / クローゼットにも置けるサイズ)
>
> Sidebar の家具カタログモーダル (M15) からそのまま選択できる。
> 自動配置 (`defaultFurnitureForPreset`) には現状追加していない
> (ユーザーが任意に配置することを想定)。
>
> v0.10 以前の §1〜§17 はそのまま継承。
