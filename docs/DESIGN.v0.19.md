# 間取りプランナー Web アプリ 設計書

> Version: **0.19** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v15)
>
> ## v0.18 → v0.19 の主な変更
>
> ### 1. 構造体・設備 / 耐震診断 / 法規警告 UI を撤去 (M87)
>
> ユーザー要望「構造体・設備のセクション・耐震診断・法規警告は不要」に応じて
> 以下の UI を削除した:
>
>  - **構造体・設備セクション** (`Sidebar.tsx` の `<div className="sidebar-section">` 中の
>    「構造体・設備 (Phase 1.5)」h2 とその中の "柱を 910mm グリッドに自動配置" / "PS を追加"
>    ボタン)
>  - **耐震診断パネル** (`SeismicPanel` のマウント、import 削除)
>  - **法規警告パネル** (`CompliancePanel` のマウント、`Editor.tsx` の import 削除)
>
> 撤去後の整理:
>  - `generateColumnsByGrid` / `addPipeSpace` ストアアクションは引き続き残存
>    (テンプレートや i18n の都合で将来戻す可能性あり、データレベルでは破壊しない)
>  - `SeismicPanel.tsx` / `CompliancePanel.tsx` のファイル自体は残し、UI から呼ばれないだけ
>  - 失効した e2e テスト (柱の自動配置 / PS 追加 / 耐震診断パネル / 耐力柱フラグ /
>    採光・換気警告) は削除済み
>  - 視覚スナップショット (`editor-initial.png` / `editor-template-1ldk.png`) を再生成
>
> ### 2. 家具リアルテクスチャを強化 (M88)
>
> v0.18 (M86) の "家具リアル" モードは効果が控えめで「ボタンを押しても見た目が
> 変わらない」というフィードバック。以下を強化:
>
>  - **木目テクスチャ** (`makeFurnitureWoodTexture`)
>    - 256×256 に高解像度化 (旧 128×128)
>    - 板の境目を 4 段明確に (濃い線 alpha 0.6 で板分割)
>    - 縦の木目線を 60→90 本、alpha 0.20〜0.35 で変動
>    - 節 (knot) を 5→14 個に増やし、同心円グレインで囲む
>  - **布テクスチャ** (`makeFurnitureFabricTexture`)
>    - 経緯糸の alpha を 0.20→0.32 に強化
>    - 太めの経緯 (12px 間隔、太さ 2px、alpha 0.2) を追加
>    - 繊維ノイズを 500→900 個、短い線分でフィラメント感を出す
>  - **革テクスチャ** (`makeFurnitureLeatherTexture`、新規)
>    - 暗色 (max(R,G,B) < 70) の家具 (黒革ソファ、TV ボード、ゴミ箱等) 向け
>    - 大きめの mottle (50 個、alpha 0.08〜0.20) + 細かいピンホール
>  - **`pickFurnitureTextureKind`** に `'leather'` の戻り値を追加
>    - 純白 → null、暗色 → leather、茶系 → wood、それ以外 → fabric
>  - **repeat 密度** を 0.4m/タイル → 0.2m/タイル へ。1m サイズの家具で 5×5 タイル
>    並ぶので、肉眼で模様がはっきり見える
>  - **PBR チューニング** (realistic ON 時):
>    - wood: `roughness ≥ 0.6` (マット寄り)
>    - fabric: `roughness ≥ 0.85` (反射を抑える)
>    - leather: `roughness 0.55`, `metalness 0.12` (半光沢)
>
> ### 3. プラン名を編集可能に (M89)
>
> 旧 `TopBar.tsx` の静的 `<h1>間取りプランナー</h1>` を、`Floorplan.metadata.name`
> を編集可能な `<input>` に置換。
>
>  - `useFloorplanStore.updateMetadata({ name })` をオン入力で呼ぶ (debounce 無し、
>    keystroke ごとに snapshotForHistory が走り Undo でも戻せる)
>  - フォーカス時に枠線 (#3b82f6) + 白背景でフィールド化、外したら透明に戻す
>  - `placeholder="プラン名を入力"`、空文字も許容 (一時的な編集中状態のため)
>  - `data-testid="plan-name-input"` を追加 — 旧 h1 ベースの e2e をこの testid に
>    切り替え
>
> v0.18 以前の §1〜§17 はそのまま継承。
