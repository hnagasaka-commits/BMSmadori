# 間取りプランナー Web アプリ 設計書

> Version: **0.2** (Draft)
> Last Updated: 2026-05-09
> Status: 設計フェーズ
>
> ## v0.1 → v0.2 の主な変更
>
> - **正確性レベルを L2(業者打ち合わせの叩き台)に確定** — 建築士・不動産業者が施主との初期打ち合わせに使える水準
> - **ビジュアル方向性を A+B ハイブリッドに確定** — 2D エディタはミニマル・デジタル(Figma 系)、3D ビューはリッチ・フォトリアル(建築ビジュアライゼーション系)
> - **構造概念の追加** — 壁を 5 種類(外壁/耐力壁/戸境壁/間仕切り壁/非耐力壁)に区別。動かせる壁・動かせない壁を明確に
> - **設備配管の概念** — PS(パイプスペース)エンティティ追加、水回りの配置制約を導入
> - **サッシ規格データ** — 任意サイズではなく規格品ベース(YKK AP / LIXIL 準拠)
> - **法規警告システム** — 採光・換気・廊下幅・避難経路の自動チェック(警告レベル、強制ではない)
> - **方位設定を Phase 1 に繰り上げ** — 「南向きリビング」検証は実用ツールの根幹
> - **§14 UX・モーション設計、§15 3D ビジュアル仕様、§16 3D アセット調達戦略、付録 C 法規参照を新設**
> - **Phase 計画を改訂** — Phase 1 を 8〜10 週に絞り込み、構造制約(柱)と設備系統(PS)を Phase 1.5(+3〜4 週、独立リリース)に分離。詳細は §11

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [機能要件(全フェーズ統合)](#2-機能要件全フェーズ統合)
3. [非機能要件](#3-非機能要件)
4. [技術スタック](#4-技術スタック)
5. [データモデル](#5-データモデル)
6. [コアロジック仕様](#6-コアロジック仕様)
7. [部屋プリセット](#7-部屋プリセット)
8. [隣接ルール](#8-隣接ルール)
9. [画面構成](#9-画面構成)
10. [ディレクトリ構成](#10-ディレクトリ構成)
11. [フェーズ計画](#11-フェーズ計画)
12. [テストケース概要](#12-テストケース概要)
13. [リスク・未決事項](#13-リスク未決事項)
14. [UX・モーション設計](#14-uxモーション設計)
15. [3D ビジュアル仕様](#15-3dビジュアル仕様)
16. [3D アセット調達戦略](#16-3dアセット調達戦略)
17. [PDF 出力](#17-pdf-出力)
18. [付録](#18-付録)

---

## 1. プロジェクト概要

### 1.1 目的

業者と話せる正確性を持ちながら、Figma のような操作感の心地よさと、建築ビジュアライゼーション級の 3D 表現を併せ持つ間取り作成 Web アプリ。

施主が業者・建築士との打ち合わせ前に「こんな間取りにしたい」を具体的なデータとして渡せ、業者側もそれを叩き台として議論を進められる、両者にとって意味のあるツールを目指す。

### 1.2 参考プロダクト

- **drafted.ai** — UX のミニマル感、操作のキレ
- **iCanDesign Room Planner** — 機能設計の参考
- **Lumion / Twinmotion** — 3D ビジュアライゼーションの質感
- **Figma / Linear** — 2D エディタの UX
- **Sweet Home 3D** — 機能比較・差別化のベンチマーク

### 1.3 ターゲットユーザー

**主ペルソナ:** 業者と話す施主
- 30-50 代、住宅取得を真剣に検討中
- マンション購入・注文住宅・リフォームの初期検討段階
- Pinterest / Instagram で間取りを集めるのが好き
- 業者と話す前に自分の希望を整理したい
- 建築の専門知識はないが、寸法や用語は理解したい

**副ペルソナ:** 業界プロ
- 不動産仲介、リフォーム業者、工務店
- 施主との初期打ち合わせで「こんな感じですか?」と即興で形にする
- 詳細図面は別ツール(Jw_cad、ARCHICAD 等)で作成

**副副ペルソナ:** 趣味で間取りを考える人
- 引越し検討、家具配置の検討、純粋な趣味
- ターゲット層からは外れないが、優先順位上は最重要ではない

### 1.4 主要差別化要素

1. **業者と意思疎通できる正確性** — 寸法は柱芯々で正確、PS位置や耐力壁の概念がある、法規警告で「これダメじゃない?」を事前に潰せる
2. **触って楽しい操作感** — Figma 級のスナップ反応速度、慣性、マイクロインタラクション、60fps 死守
3. **建築ビジュアライゼーション級の 3D** — PBR マテリアル、Ambient Occlusion、HDRI 環境光。施主が「住んだ後の自分」を想像できる
4. **学習済みテンプレート** — 完全オリジナル制作 + 公的標準モデル参考のテンプレを 34 種同梱(§7.1)
5. **2D ⇔ 3D シームレス連携** — 同一データから両ビューが生成され、双方向編集可能

### 1.5 プロダクトの非目標

L2 を狙うことで、**やらないことを明確にする**ことが重要。スコープクリープを防ぐ。

- ❌ **建築確認申請対応** — 法規完全準拠は L3 以上の領域。本ツールはあくまで「警告」を出すだけ
- ❌ **構造解析** — 耐力壁の位置は意識するが、構造計算はしない
- ❌ **施工見積もり・部材リスト出力** — 別ツールの領域
- ❌ **CAD レベルの厳密な作図** — レイヤー分け、線種、ハッチングなどは持たない
- ❌ **マルチユーザーリアルタイム共同編集** — Phase 4 以降の検討事項
- ❌ **VR 対応** — Phase 4 以降の検討事項
- ❌ **集合住宅の全体編集** — マンション・アパートは **1 住戸単位** で扱う。建物全体(複数住戸 + 共用部 + 駐車場)の設計はサポート外
- ❌ **建築士による監修** — 個人開発のスコープ外。免責で代替(§1.6 参照)

### 1.6 免責事項とユーザーへの注意喚起

本アプリは**個人開発のオープンソースツール**であり、建築士・専門家による監修は受けていない。
法規データ・寸法基準は建築基準法の条文から直接引用するが、地域差・例外・運用解釈までは
網羅できない。**実際の建築・リフォーム検討には必ず建築士・施工業者の確認を取る**ことを
ユーザーに明確に伝える。

#### 1.6.1 免責文の表示箇所

| 表示箇所 | タイミング | 内容 |
|---|---|---|
| **初回起動時の同意ダイアログ** | アプリ初回起動 1 回のみ | 全文表示 + 「同意して開始」ボタン |
| **設定 → このアプリについて** | 任意 | 全文常設 |
| **法規警告パネルの最下部** | 警告が 1 つでも表示中 | 短縮版「※ 本判定は参考です。詳細は建築士へ」 |
| **PDF 出力時のフッター** | 出力ファイル毎 | 短縮版 + アプリバージョン明記 |
| **エクスポートした JSON の `metadata.disclaimer`** | 保存毎 | 短縮版を埋め込み |

#### 1.6.2 免責文の正式テキスト(全文)

```
本アプリは個人開発のオープンソースツールであり、建築士・建築設計事務所による
監修は受けていません。法規警告は建築基準法の条文を参考にした参考情報であり、
地域条例・特定行政庁の解釈・既存不適格建築物の扱い等までは網羅していません。

本アプリの出力(間取り図・PDF・警告等)は、実際の建築・リフォーム・確認申請に
そのまま使うことはできません。実施段階では必ず一級建築士・二級建築士・木造建築士
または施工業者にご相談ください。

本アプリの利用によって生じたいかなる損害についても、開発者は責任を負いません。
```

#### 1.6.3 開発上の自己レビュー基準

監修者がいない代わりに、**開発者(自分)が以下を継続的にチェック**する:

- [ ] 法規参照(条文番号)は実物の建築基準法・施行令を確認して引用したか
- [ ] severity の振り分けは「叩き台」レベルとして妥当か(過度な warning 連発になっていないか)
- [ ] 同梱テンプレは住宅金融支援機構の標準仕様、設計実務書の概念から逸脱していないか
- [ ] 用語(「居室」「採光」等)は建築基準法施行令の定義に従っているか
- [ ] 寸法プリセット(廊下幅、階段)は建築実務の常識と合うか

更新管理は **ルール単位** で行う(全体一括の「5〜10 年に 1 回」は粗いため):

- 各法規ルールに `sourceUrl` / `lawVersion` / `lastVerifiedAt` / `appRuleVersion` を持たせる(§C.0 `LegalRule` 型が正本)
- `lastVerifiedAt` から **18 ヶ月** 経過したルールは CI で警告し、再確認後に `lastVerifiedAt` を更新
- ロジック式・閾値を変えたら `appRuleVersion` を +1(ack 済み警告は世代で分離、§C.0)
- 広域な法改正イベント(おおむね 5〜10 年に 1 回)時点では、上記チェックリスト全体を再走させる

---

## 2. 機能要件(全フェーズ統合)

### 2.1 描画・編集

| 機能 | フェーズ | 概要 |
|---|---|---|
| 矩形部屋の追加 | 1 | プリセットからドラッグ&ドロップ |
| 部屋の移動・回転(90度単位) | 1 | ドラッグで移動、ボタンで回転 |
| 部屋のリサイズ | 1 | 辺をドラッグして拡縮 |
| 部屋の削除 | 1 | 選択して削除 |
| 自動スナップ | 1 | 近接時に吸着、共有壁を生成 |
| 重なり防止 | 1 | 部屋同士が内部で重なる配置を禁止 |
| グリッドスナップ | 1 | 910mm(尺モジュール)単位 |
| **壁種別の区別・編集** | 1 | 外壁/耐力壁/戸境壁/間仕切り/非耐力壁。動かせる壁と固定壁を明示 |
| **柱の配置と固定** | 1.5 | 柱芯々モジュールに沿った柱位置の表示・固定 |
| **PS(パイプスペース)配置** | 1.5 | マンションは固定、一軒家は配管経路として配置 |
| ドア自動配置 | 1 | 共有壁にドアを自動生成 |
| ドア手動編集 | 1 | 位置・幅・種類の変更 |
| **サッシ規格選択 UI** | 2 | YKK AP / LIXIL の標準サイズから選択(Phase 1 は自由寸法 + 既定サイズのみ。データ同梱は Phase 1、UI は Phase 2。§5.8.1) |
| アンドゥ/リドゥ | 1 | 操作履歴の前後移動 |
| 寸法線表示 | 1 | リアルタイム表示、内寸/壁芯切替 |
| **方位設定** | 1 | 北向きの指定(以前は Phase 2) |
| 部屋形状(L字・凸型) | 2 | ポリゴン部屋 |
| **窓の基本配置・編集** | 1 | 壁に窓を置く・幅/高さ/位置を編集する。採光・換気警告の解除導線として必須 |
| 窓配置(規格品カタログ UI) | 2 | YKK AP / LIXIL の製品コード選択、装飾(カーテン等) |
| 階段 | 3 | 縦動線オブジェクト |
| 複数階対応 | 3 | レイヤー切替 |
| 吹き抜け | 3 | 上下階を貫通する空間 |
| 屋根 | 4 | 3D 表示用 |

### 2.2 テンプレート

| 機能 | 概要 |
|---|---|
| テンプレート読込 | 同梱 `.floorplan.json` テンプレを開く |
| テンプレートカード一覧 | サムネ + LDK + 面積 + tags でフィルタ可能 |
| 住宅テンプレ(一軒家) | **8 パターン**(平屋〜3 階建て、1LDK〜二世帯)|
| 住宅テンプレ(マンション) | **11 パターン**(1R〜4LDK、田の字型・中央リビング型)|
| 住宅テンプレ(アパート) | **3 パターン**(ワンルーム、1K、1DK)|
| 商用テンプレ各種 | **12 パターン**(カフェ、オフィス、コワーキング、クリニック、学童、ホテル等)|

詳細は §7.1 同梱テンプレート一覧を参照。合計 **34 テンプレート**、すべて `license: "original"`。

### 2.3 表示・ビュー

| 機能 | フェーズ | 概要 |
|---|---|---|
| 2D ビュー(ミニマル) | 1 | Figma 級の操作感、グレースケール基調 |
| 面積表示(畳/坪/㎡) | 1 | 部屋ごと・建物全体、内法/壁芯切替 |
| 部屋用途ラベル表示 | 1 | リビング・寝室等のテキスト表示 |
| 総部屋数・LDK 表記 | 1 | 「3LDK」のような自動命名 |
| **方位インジケーター** | 1 | 北向き表示(Phase 2 から繰り上げ) |
| **法規警告パネル** | 1 | サイドバーに常時表示 |
| 3D ビュー(フォトリアル) | 2 | PBR、AO、HDRI 環境光 |
| 3D 内編集モード | 2 | 視点固定後に壁・家具を操作 |
| **日当たりシミュレーション** | 2 | 時刻・季節別の影表示(Phase 4 から繰り上げ) |

### 2.4 オブジェクト配置

| 機能 | フェーズ | 概要 |
|---|---|---|
| 家具カタログ | 2 | 検索・配置 |
| 家具のリアルテクスチャ | 2 | glTF/GLB の 3D モデル(Phase 3 から繰り上げ) |
| 人物モデル | 2 | 1700mm 標準身長 |
| 家電配置 | 2 | テレビ・冷蔵庫等 |
| 水回り設備 | 2 | バスタブ・便器・シンク |
| 商用什器 | 3 | レジ、棚、テーブル等 |

### 2.5 保存・入出力

| 機能 | フェーズ | 概要 |
|---|---|---|
| ローカル保存 | 1 | localforage(IndexedDB) |
| JSON エクスポート | 1 | プロジェクトファイル |
| JSON インポート | 1 | エクスポートファイルの読込 |
| **2D 図面 PDF 出力** | 1 | 業者打ち合わせ用、寸法線・方位記号付き(L2 の評価軸として Phase 1 必須) |
| **2D 平面図 PNG 出力** | 1 | PDF と同じ平面図を PNG として書き出し(メール添付・チャット用) |
| **3D レンダリング画像** | 2 | 高品質 PNG(2K/4K) |
| 3D モデル(glTF) | 4 | 外部ツール連携用 |

### 2.6 補助機能

| 機能 | フェーズ | 概要 |
|---|---|---|
| **法規警告システム** | 1 | 採光、換気、廊下幅、寝室の避難経路 |
| **構造整合性チェック** | 1.5 | 耐力壁を抜いていないか、柱位置の整合 |
| **設備系統チェック** | 1.5 | PS から水回りまでの距離、配管経路の妥当性 |
| 連結性チェック | 1 | 孤立部屋の検出 |
| 隣接警告 | 1 | トイレ⇔ダイニング等 |
| ショートカットキー | 1 | W=壁、D=ドア等 |
| チュートリアル | 2 | 初回起動時のガイド |
| 検索可能な家具カタログ | 2 | 家具数増加時の探索性 |

---

## 3. 非機能要件

### 3.1 パフォーマンス

- 部屋 50 個までの間取りで操作レイテンシ **< 16ms**(60fps 死守、v0.1 の 100ms から強化)
- 初回ロード < 3 秒
- 3D ビュー切替 < 1 秒(クロスフェード演出込み)
- 3D 描画は WebGL 上で 30fps 以上(モバイルでも)
- 30 部屋未満の通常ケースは同一スレッドで処理(Worker 起動コストが上回るため)。30 部屋以上または `runLegalChecks` が 80ms を超え始めたケースに限り、スナップ判定・法規チェックを Web Worker にオフロードする(§6.6.3)

### 3.2 ブラウザ対応

- Chrome / Edge / Safari / Firefox の最新 2 バージョン
- モバイル Safari, Chrome for Android(タブレット推奨)
- WebGL 2.0 必須(Phase 2 以降の 3D 機能)

### 3.3 アクセシビリティ

- キーボード操作対応(Tab、矢印キー、Enter、Esc)
- カラーコントラスト WCAG AA 準拠
- スクリーンリーダー対応(主要操作のみ)
- 色覚多様性配慮(色だけに依存しない情報伝達)
- prefers-reduced-motion 対応

### 3.4 国際化

- Phase 1: 日本語のみ
- Phase 3 以降: 英語対応(畳/坪は㎡/sqftに自動切替、サッシ規格は地域別)

### 3.5 オフライン対応

- ローカル保存方針のため、オフラインでも起動・編集・保存が可能
- Service Worker によるキャッシュ戦略を Phase 2 で導入

### 3.6 寸法精度

- 内部計算は **整数 mm** で統一
- 表示は単位に応じて小数点 2 桁
- 壁芯と内寸を明確に区別、UI で切替可能

### 3.7 セキュリティ・プライバシー

ローカル保存中心 / 個人開発・OSS という前提でも、`.floorplan.json` のインポート、テンプレ・
家具マニフェストの読込、PDF 出力時のメタデータ、自由入力テキストの DOM レンダリングは
**信頼境界の外側からの攻撃面**。最低限の方針を §3.7 で固定する。

#### 3.7.1 入力サニタイズ

| 入力源 | 検証 / サニタイズ |
|---|---|
| `.floorplan.json` インポート | **詳細手順は §5.1.2 の 8 ステップ(version 生比較 → モード分岐 → migrate → strip → `ensureEdgeIds` → Zod → 整合性チェック → ストア反映)に従う**。本表は概念のみ。**Zod 検証前にいかなる属性も DOM に流さない** ことだけはここで強制 |
| プラン名 / カスタム部屋名 / タグ | プレーンテキストのみ。HTML は **テキストノードとして挿入**(`textContent` / React JSX 既定)、`dangerouslySetInnerHTML` は禁止 |
| `metadata.template.thumbnail` の `dataURL` | 許可スキームは `data:image/png;base64,` / `data:image/jpeg;base64,` / `data:image/webp;base64,` のみ。SVG dataURL は **拒否**(SVG 内に script を持ち込めるため) |
| `metadata.template.thumbnail` の相対パス | `templates/thumbs/...` 配下のみ許可。`../` / 絶対 URL / `javascript:` / `data:text/html` は拒否 |
| マテリアル / 家具マニフェスト | 同梱アセット(`public/...`)以外の URL を参照しない。リモートからの外部読込は **行わない** |

#### 3.7.2 ファイルサイズ・リソース上限

| 対象 | 上限 | 動作 |
|---|---|---|
| `.floorplan.json` インポート | 10 MB | 超過は `ER3` 系モーダルで拒否(§9.9.6 と整合) |
| `Floor.rooms` 配列長 | 500 | 超過は警告し、500 件で打ち切り読み込み |
| サムネ `dataURL` のデコード後サイズ | 2 MB | 超過は破棄してフォールバック画像 |
| インポート全体の処理時間 | 5 秒(タイムアウト) | 超過は中断 |

#### 3.7.3 CSP(Content Security Policy)

`index.html` の `<meta http-equiv="Content-Security-Policy">` で設定する初期値:

```
default-src 'self';
img-src 'self' data: blob:;
font-src 'self';
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'self';
frame-ancestors 'none';
form-action 'none';
base-uri 'self';
object-src 'none';
```

- `style-src 'unsafe-inline'` は CSS 変数注入と framer-motion インライン style のため。
  Phase 2 で nonce 化を検討
- `connect-src 'self'` で外部 API 呼び出しを禁止(完全ローカル動作)
- 将来クラウド同期を入れるとき(Phase 4)は `connect-src` を限定 URL で開ける

#### 3.7.4 プライバシー

- プラン名 / カスタム部屋名には個人名・住所が混入しうる前提で、**外部送信は一切行わない**
- PDF 出力時のメタデータ `Author` は **既定で空**。設定 → エクスポートで「自分の名前を PDF に含める」を opt-in でオンにしたときだけ記入(§17.6 参照)
- `Floorplan.metadata.disclaimer` は短縮版テンプレートのみを埋め込む(ユーザー入力を結合しない)
- localforage に保存されるデータは **同一オリジン内**。ブラウザ標準のサンドボックスに依存

#### 3.7.5 残存リスク(明示的に受容)

- ブラウザ拡張による DOM 改変・データ抽出: 個人開発の OSS では対処不能、§1.6 免責で言及
- ユーザーが自分で作った `.floorplan.json` を SNS に上げて漏洩する事故: アプリの責任外。
  ただし PDF メタデータ Author 既定空で誤公開リスクを下げる

---

## 4. 技術スタック

### 4.1 フロントエンド

| 領域 | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript | 型安全性 |
| ビルド | Vite | 軽量・高速 |
| UI フレームワーク | React 18 | エコシステム |
| 2D 描画 | Konva.js + react-konva | レイヤー管理が強い |
| 3D 描画 | Three.js + React Three Fiber + drei | 業界標準、宣言的 API |
| **3D ポストプロセス** | **@react-three/postprocessing** | **AO、Bloom、Tone Mapping(フォトリアル必須)** |
| 状態管理 | Zustand | 軽量 |
| **アニメーション** | **framer-motion** | **マイクロインタラクション、ページ遷移** |
| **UI プリミティブ** | **Radix UI + shadcn/ui** | **アクセシブル、ミニマルデザインに親和的** |
| スタイリング | Tailwind CSS | プロトタイピング高速 |
| ストレージ | localforage | localStorage の容量制限を回避 |
| アイコン | lucide-react | デザイン統一感 |
| **フォント(数値)** | **JetBrains Mono** | **寸法表示の品位** |
| **フォント(UI)** | **Inter** | **ミニマル UI 標準** |
| Web Worker | Comlink | スナップ・法規チェックをバックグラウンド処理 |
| **PDF 出力** | **jsPDF** | **クライアント完結、PWA 対応、§17 で詳細** |
| **ランタイム検証** | **Zod** | **保存ファイルのスキーマ検証(§5.1.2)** |
| **太陽位置** | **suncalc** | **日当たりシミュレーション(§6.9)** |
| テスト | Vitest + Testing Library | Vite 統合 |

### 4.2 開発・運用

| 領域 | 採用技術 |
|---|---|
| エディタ | VSCode + Claude Code |
| バージョン管理 | Git / GitHub |
| CI | GitHub Actions |
| ホスティング | Vercel |
| Linter / Formatter | ESLint + Prettier |
| パフォーマンス計測 | Web Vitals + custom benchmark |

### 4.3 バックエンド

**Phase 1〜2 では不要**(ローカル保存のみ、認証なし)
Phase 3 以降でクラウド機能が必要になった時点で Supabase 等を検討。

---

## 5. データモデル

### 5.1 トップレベル構造

保存ファイル形式と同梱テンプレ形式は **完全統一**。同じ `Floorplan` 型をシリアライズすれば
そのまま `.floorplan.json` ファイルになる。テンプレ固有情報は `metadata.template?` を
optional として持つ(普通のユーザー保存ファイルでは省略)。

```typescript
type Floorplan = {
  version: SchemaVersion;        // 例: "1.0"。マイグレータが旧版→新版変換
  metadata: FloorplanMetadata;
  floors: Floor[];
  building: BuildingProperties;
};

// Phase ごとに段階的に union を広げる:
// - Phase 1   : "1.0" のみ
// - Phase 1.5 : "1.1" を追加(templateOrigin の保存と PS 同梱許容、§6.4.3)
// - Phase 3   : "1.2" を追加予定(複数階対応で floors の length 制約を緩める)
// 本書は Phase 1.5 までを型に反映。Phase 3 時点で "1.2" を追加する。
type SchemaVersion = "1.0" | "1.1";

type BuildingType =
  | "single-family"     // 一軒家(平屋〜3 階建て)
  | "condo-unit"        // マンション 1 住戸の専有部分(玄関ドア内側)
  | "apartment-unit"    // アパート 1 住戸の専有部分
  | "hotel"             // ホテル基準階 1 ユニット or 全館
  | "office"            // オフィス
  | "retail"            // 店舗
  | "mixed";            // 複合用途

type FloorplanMetadata = {
  name: string;
  buildingType: BuildingType;
  unit: "mm";
  gridSize: number;              // 初期値 910
  orientation: number;           // 北からの角度(0-359)、必須
  siteArea?: number;
  createdAt: string;
  updatedAt: string;
  template?: TemplateMetadata;   // 同梱テンプレ・配布物にだけ存在(普通の保存ファイルでは省略)
  /**
   * テンプレ起点で作成されたプランの由来情報(§6.4.3 PS 追加マイグレーションで使用)。
   * ユーザーが「ゼロから描く」を選んだ場合は undefined。一度設定したら以降は変更しない。
   */
  templateOrigin?: {
    templateId: string;          // §7.1 の id(例: "condo-3ldk-70")
    templateVersion: string;     // 取り込み時のテンプレバージョン
  };
  /**
   * ユーザーが ack した法規警告 ID のリスト(§5.9.2)
   * 同じ違反でも ID は決定論的なので、ack はファイル間で共有・移植可能
   */
  acknowledgedWarnings?: string[];
  /**
   * §1.6.1 に基づき、エクスポート時に短縮版免責文を埋め込む。
   * インポート時は読み飛ばし(信頼境界の外で書き換えられる前提)。
   * 値は §1.6.2 短縮版テンプレートとアプリバージョンを含む。
   */
  disclaimer?: string;
};

// 同梱テンプレ・配布用のメタデータ
type TemplateMetadata = {
  id: string;                    // §7.1 の id(例: "condo-3ldk-70")。`metadata.templateOrigin.templateId` と突合する
  version: string;               // テンプレ本体のバージョン(SemVer 推奨、例 "1.0.0")。PS 追加等の更新で +1
  description: string;           // 「3LDK 南向き、共働き向け」など
  thumbnail?: string;            // dataURL または相対パス("templates/thumbs/3ldk-south.png")
  license: TemplateLicense;
  designer?: string;             // "間取りプランナー チーム" など
  area: number;                  // 延床面積(検索用、自動計算と一致するように保つ)
  bedrooms?: number;             // "3LDK" の "3"。検索フィルタ用
  tags: string[];                // ["南向き","共働き","二世帯","平屋"]
  recommendedBuildingType?: BuildingType;
};

type TemplateLicense =
  | "CC0"
  | "CC-BY"
  | "MIT"
  | "original"        // 自社オリジナル(再配布可)
  | "reference-only"; // 書籍参照、参考のみ(再配布不可)

// 建物全体のプロパティ
type BuildingProperties = {
  structureType: "wood" | "steel" | "rc" | "src"; // 木造/鉄骨/RC/SRC
  isExistingBuilding: boolean;  // 既存建物のリフォーム想定か
  // マンションの場合は外周壁・戸境壁が固定される
};
```

#### 5.1.1 保存ファイル形式と拡張子

- 拡張子: **`.floorplan.json`**
- MIME: `application/json`
- 文字コード: UTF-8、BOM なし
- インデント: 2 スペース(エクスポート時)
- 改行: LF

#### 5.1.2 バリデーションとマイグレーション

ランタイム検証には **Zod** を使う(TypeScript と統合性が高く、エラーメッセージが日本語化可能)。
**読み込みモードによって使う Zod スキーマを分岐する**:

| モード | Zod スキーマ | strip / superRefine | 保存・PDF |
|---|---|---|---|
| normal | `FloorplanSchema`(`SchemaVersion` を `"1.0" | "1.1"` で絞る、`superRefine` で Phase 不変条件) | 適用 | 有効 |
| readonly(将来 version) | `TolerantFloorplanSchema`(`version: z.string()` / 各フィールドは shape ゆるめ) | **適用しない**(将来の合法フィールドを潰さないため) | 全て無効(§M17) |

```typescript
// 将来 version 用の寛容なスキーマ。形が大きく崩れている場合のみ拒否する。
export const TolerantFloorplanSchema = z.object({
  version: z.string(),
  metadata: z.object({ name: z.string().optional() }).passthrough(),
  floors: z.array(z.object({ id: z.string(), rooms: z.array(z.unknown()) }).passthrough()),
  building: z.unknown(),
}).passthrough();
```

インポート時の処理順序(**順序が重要、勝手に入れ替えない**):

1. **JSON.parse** で構文エラー検出
2. **`version` フィールドを raw string として読み取り**(`SchemaVersion` 型に絞り込まない。
   将来の `"1.2"` 等は `SchemaVersion` 型の union に入っていない可能性があるため)
3. **`chooseLoadMode(version)` でモード決定**:
   将来 version なら **読み取り専用モード**(§M17)に分岐し、以降は `TolerantFloorplanSchema` で
   検証する。これにより Phase 1.5 アプリで将来の 1.2 ファイルを開いても、`FloorplanSchema` の
   厳しい union による拒否を踏まずに readonly に逃げられる
4. **`migrate(rawData, fromVersion, toVersion)`**(readonly モードでは **migrate も呼ばない**:
   将来 version の意味は不明なので解釈しないのが安全)
5. **`stripDisallowedForPhase(rawData)`** で Phase 別の禁止フィールドを除去
   (Phase 1 で `furniture` / `pipeSpaces` 等を含む JSON が読まれた場合に必要、§下記)。
   readonly モードでは **strip もスキップ**(剥がしてしまうと将来の合法データが消える)
5a. **`ensureEdgeIds(rawData)`** で `Shape.edgeIds` の欠落を補完(§5.2.1 と §5.2 EdgeKey の前提)。
   旧テンプレ・旧保存ファイルや手書き JSON では `edgeIds` がないことがあるため、Zod 検証より
   **前** に shallow に走り、各 `Room.shape` に対して `edgeIds.length === edges 本数` を満たすよう
   `crypto.randomUUID()` で発行する。**この処理は normal / readonly どちらでも実行する**
   (readonly でも図面描画と再バインドの整合に必要)。

   > **`Wall.id` と `EdgeId` は別の名前空間に保つ**(混ぜると `Door.wallId` の意味がぶれる):
   >
   > - `EdgeId` は **形状の辺** に紐づく永続 ID(`Shape.edgeIds[i]`)
   > - `Wall.id` は **物理エンティティ(線分)** の ID で、`Door.wallId` / `Window.wallId` /
   >   `WallFinish.wallId` の参照先。再生成で新 ID が振られる可能性がある
   > - 両者の橋渡しは `EdgeKey`(§5.2):`(roomId, edgeId)` の組から `Wall` を引く

   **補完アルゴリズム:**

   1. 各 `Room.shape` について、`edgeIds.length === expected` を満たさない / 値が string でないものは
      新規 UUID で発行(`Wall.id` を流用しない)
   2. `ensureEdgeIds` の完了時点で **`Shape.edgeIds` は埋まっているが、まだ `Wall.id` との対応は確定していない**
   3. 対応付けは **整合性チェック段階(手順 7)** の §5.2「壁再生成と Door / Window / WallFinish の
      再バインド規約」に従って実行される:
      - 旧 `Floor.walls` の各 `Wall` について `findEdgeId` で対応する `EdgeId` を特定
      - そこから `EdgeKey` を作り、新規生成された `walls` の中で同じ `EdgeKey` を持つ壁に
        **旧 `Wall.id` を引き継がせる**(`Door.wallId` などの参照が生き残る)
      - マッチしない旧 `Wall` は失効リスト、参照していた `Door` / `Window` / `WallFinish` は ER5

   この役割分担により、`ensureEdgeIds` は **形状側の補完だけ** を担い、`Wall` の同一性追跡は §5.2 が
   担う。`Door.wallId` は常に **物理壁の ID** を指し、`EdgeId` と取り違えない。

   `strip` と同じく `unknown` を受け、`Array.isArray` で守る:

   ```typescript
   export function ensureEdgeIds(raw: unknown): { data: unknown; generated: number } {
     if (!raw || typeof raw !== "object") return { data: raw, generated: 0 };
     const plan = raw as Record<string, unknown>;
     const floors = plan.floors;
     if (!Array.isArray(floors)) return { data: raw, generated: 0 };
     let generated = 0;
     for (const f of floors) {
       if (!f || typeof f !== "object") continue;
       const rooms = (f as Record<string, unknown>).rooms;
       if (!Array.isArray(rooms)) continue;
       for (const r of rooms) {
         const shape = (r as Record<string, unknown>)?.shape as Record<string, unknown> | undefined;
         if (!shape || typeof shape !== "object") continue;
         const expected = shape.kind === "rect" ? 4
           : (Array.isArray(shape.points) ? shape.points.length : 0);
         const existing = Array.isArray(shape.edgeIds) ? shape.edgeIds : [];
         if (existing.length === expected && existing.every(x => typeof x === "string")) continue;
         shape.edgeIds = Array.from({ length: expected }, (_, i) =>
           typeof existing[i] === "string" ? existing[i] : crypto.randomUUID()
         );
         generated += expected - existing.filter(x => typeof x === "string").length;
       }
     }
     return { data: raw, generated };
   }
   ```

   旧ファイルを開いた直後の保存で `edgeIds` が永続化されるため、`Door` / `Window` / `WallFinish`
   の再バインドが次回以降も安定する
6. **Zod スキーマで構造検証**: normal は `FloorplanSchema`、readonly は `TolerantFloorplanSchema`
7. **整合性チェック**(壁参照・部屋プリセット存在・`edgeKey` 再バインド等、§5.2 参照)。
   readonly モードでは `edgeKey` 再バインドの失効分も「警告のみ」で削除しない(表示用)
8. **ストアに反映**(読み取り専用モードなら保存・PDF/PNG 出力 UI を非表示)

```typescript
// src/data/schemas.ts
import { z } from "zod";

export const FloorplanSchema = z.object({
  version: z.union([z.literal("1.0"), z.literal("1.1")]),  // Phase 1.5 で "1.1" を解放
  metadata: FloorplanMetadataSchema,
  // Phase 1: floors.length === 1 を強制(§11 不変条件)。
  // Phase 3 で複数階対応する際は .min(1).max(3) など Phase 別ビルドで切り替える。
  floors: z.array(FloorSchema).length(1),
  building: BuildingPropertiesSchema,
}).superRefine((plan, ctx) => {
  // §11 Phase 1 / 1.5 の空配列制約をスキーマレベルで強制(currentPhase はビルド時定数)。
  for (const [i, f] of plan.floors.entries()) {
    if (currentPhase === "1") {
      // Phase 1: columns / pipeSpaces / furniture / humanModels / voids すべて空
      for (const k of ["columns", "pipeSpaces", "furniture", "humanModels", "voids"] as const) {
        if (f[k].length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["floors", i, k],
            message: `Phase 1 では ${k} は空配列でなければなりません(§11)`,
          });
        }
      }
    } else if (currentPhase === "1.5") {
      // Phase 1.5: furniture / humanModels / voids のみ空(columns / pipeSpaces は許容)
      for (const k of ["furniture", "humanModels", "voids"] as const) {
        if (f[k].length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["floors", i, k],
            message: `Phase 1.5 では ${k} は空配列でなければなりません(§11)`,
          });
        }
      }
    }
  }
});

// インポート時の防御層: Zod 検証より **前** に走る shallow sanitizer。
// 信頼境界の外側(壊れた JSON、欠損配列、型不一致)を想定し、`unknown` を受けて
// `Array.isArray` で守りながら、Phase で禁止された配列フィールドだけを潰す。
// 形が崩れていても TypeError を投げず、`stripped` 件数だけ ER5 トーストに渡す。
const PHASE_FORBIDDEN: Record<string, readonly string[]> = {
  "1":   ["columns", "pipeSpaces", "furniture", "humanModels", "voids"],
  "1.5": ["furniture", "humanModels", "voids"],
  "2":   ["voids"],
  "3":   [],
};

export function stripDisallowedForPhase(
  raw: unknown,
  phase: keyof typeof PHASE_FORBIDDEN,
): { data: unknown; stripped: number } {
  const forbidden = PHASE_FORBIDDEN[phase] ?? [];
  if (!raw || typeof raw !== "object") return { data: raw, stripped: 0 };
  const plan = raw as Record<string, unknown>;
  const floors = plan.floors;
  if (!Array.isArray(floors)) return { data: raw, stripped: 0 };

  let stripped = 0;
  for (const f of floors) {
    if (!f || typeof f !== "object") continue;
    const floor = f as Record<string, unknown>;
    for (const k of forbidden) {
      const arr = floor[k];
      if (Array.isArray(arr) && arr.length > 0) {
        stripped += arr.length;
        floor[k] = [];
      } else if (arr !== undefined && !Array.isArray(arr)) {
        // 配列でない不正値は Zod に渡さず空配列に正規化
        floor[k] = [];
      }
    }
  }
  return { data: raw, stripped };
}

// src/data/migrations.ts
export type Migrator = (data: unknown, from: string) => unknown;

// CURRENT_SCHEMA_VERSION は Phase ごとに進める:
// - Phase 1:   "1.0"
// - Phase 1.5: "1.1"  (templateOrigin の保存と PS 同梱許容を導入。§6.4.3)
// - Phase 3:   "1.2"  (複数階対応で floors.length === 1 制約を緩める。Phase 3 時点で SchemaVersion 型に "1.2" を追加する)
// 1.0 → 1.1 / 1.1 → 1.2 はいずれも minor 互換更新で migrator 不要。Major 更新は当面想定なし。
export const CURRENT_SCHEMA_VERSION: SchemaVersion = "1.0"; // Phase 1.5 リリース時に "1.1" に上げる

export const migrators: Record<string, Migrator> = {
  // "0.9": migrateFrom0_9,  // 将来の旧版マイグレーション例
};

export function migrate(data: unknown, fromVersion: string): unknown {
  // minor 互換更新は migrator なしで Zod 検証を通る前提。
  // major 互換破壊が発生した場合のみ migrator を経由する。
  let current = data;
  let v = fromVersion;
  while (v !== CURRENT_SCHEMA_VERSION && migrators[v]) {
    current = migrators[v](current, v);
    v = nextVersion(v);
  }
  return current;
}
```

**読み込み・書き戻しの規約:**

- 古い `version` を持つファイル(例: Phase 1.5 で 1.0 を開く)は **minor 互換ならそのまま読める**(`migrate()` は素通し)
- アプリは **保存時に `CURRENT_SCHEMA_VERSION` を書き込む**(= Phase 1.5 で 1.0 を開いて保存すると 1.1 に上がる)
- ユーザーが古い `version` のまま保存し続けたいケースは想定しない(1.1 で追加した optional フィールドは 1.0 では単に無視される後方互換性のため、戻し書きは不要)

**新しい `version` の読み込み(ダウングレード防止):**

- `parseFloat(version) > parseFloat(CURRENT_SCHEMA_VERSION)` のファイル(例: Phase 1 アプリで 1.1 ファイルを開く)は **通常モードでは開かない**
- §9.9.6 ER3 経由で「このファイルはより新しいバージョン(1.1)で作成されています」モーダルを表示し、復旧プレビュー(§M17 = 読み取り専用・保存と PDF/PNG 出力すべて無効)でのみ開ける
- 復旧プレビューで `CURRENT_SCHEMA_VERSION` を **書き戻すことは禁止**(M17 の保存非表示で物理的に防ぐ)。これにより 1.1 データが 1.0 と名乗って壊れるダウングレードを排除
- 判定例(`parseFloat` だと `"1.10"` < `"1.2"` を誤判定するので、整数の major.minor で比較する):

  ```typescript
  // "1.2.0" や "1.10" を受けても順序を間違えない最小限の比較関数。
  // patch 以降は無視(本仕様では minor 互換のみを使うため)。
  function compareSchemaVersion(a: string, b: string): number {
    const parse = (v: string): [number, number] => {
      const [maj, min = "0"] = v.split(".");
      return [parseInt(maj, 10) || 0, parseInt(min, 10) || 0];
    };
    const [aMaj, aMin] = parse(a);
    const [bMaj, bMin] = parse(b);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  }

  // 引数は raw string(SchemaVersion 型に絞らない、§5.1.2 手順 2 参照)
  function chooseLoadMode(fileVersion: string): "normal" | "readonly" {
    return compareSchemaVersion(fileVersion, CURRENT_SCHEMA_VERSION) > 0 ? "readonly" : "normal";
  }
  ```

#### 5.1.3 バージョン更新ルール

- **Patch (1.0 → 1.0)**: フィールド追加のみ(後方互換あり)。マイグレータ不要。
- **Minor (1.0 → 1.1)**: 既存フィールドの意味変更なし、新フィールド追加・既存フィールドが optional 化。マイグレータ不要だが、検証スキーマは更新。
- **Major (1.x → 2.0)**: フィールドの削除・型変更・意味変更。マイグレータ必須、変換テスト必須。

### 5.2 フロア構造

`Floor` 型は **本書の正本**。仕上げ材・装飾(§5.10)、家具・人物・吹き抜け(Phase 2 以降で本格使用)、
窓(Phase 1 から基本配置可能、§5.8 参照)などすべてのフロアレベル要素はここに集約する。

```typescript
type Floor = {
  id: string;
  level: number;
  name: string;
  ceilingHeight: number;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];                       // Phase 1 から基本配置可能(§5.8 参照)
  columns: Column[];                       // 柱
  pipeSpaces: PipeSpace[];                 // PS
  furniture: FurnitureInstance[];          // Phase 2(空配列で出荷可)
  humanModels: HumanModel[];               // Phase 2(空配列で出荷可)
  voids: Void[];                           // Phase 3(吹き抜け)
  // 仕上げ材・装飾(§5.10)。データの正本はここで、§5.10 は型定義のみ。
  roomFinishes: RoomFinish[];
  wallFinishes: WallFinish[];
  windowDecorations: WindowDecoration[];   // Phase 2 から実値が入る(§5.10)
  doorDecorations: DoorDecoration[];       // Phase 2 から実値が入る
  // 自動ドアの再生成抑止(§6.2)。ユーザーが削除した自動ドアの tombstone。
  suppressedAutoDoors: AutoDoorSuppression[];
};
```

部屋・壁・面積の **正本ルール**:

- 部屋の形状の正本は `Room.shape`(§5.6)。`Floor.walls` は **shape から派生して計算される共有壁の物理エンティティ**。
- リサイズ・移動は `Room.shape` を更新 → 影響する `Wall` を再生成・マージする。逆方向(壁を直接動かして shape を再計算)はしない(共有壁の整合が壊れるため)。
- 壁単独の追加・削除(間仕切り壁)は、両側の `Room.shape` のエッジが合うように同時更新する。

**永続化と再構築の責務:**

- ファイルは `Room.shape` と `Floor.walls` の **両方をシリアライズ**する。`walls` は派生だが、
  毎回再計算するとコストが高い + ユーザーが付与した属性(`wallType` / `isLocked` /
  `WallFinish` 参照キー = `Wall.id`)を失うため。
- インポート時の処理(§5.1.2 ステップ 5「整合性チェック」の具体化):
  1. `Room.shape` から **期待される壁の集合** を再計算する(共有壁マージ後の物理エンティティ)
  2. ファイル内の `Floor.walls` と突合
     - **形状が一致** する壁: ファイル側の属性(`wallType` / `isLocked` / `id`)を採用
     - **shape からは存在するがファイルにない壁**: 既定値(`partition`、`isLocked: false`)で生成
     - **ファイルにあるが shape からは派生しない壁**: 不整合として捨てる + `ER5` 経由で
       「壁参照: N 件」のトーストに加算
  3. `WallFinish` / `Door` / `Window` が捨てられた壁を参照していたら、それらも合わせて削除
- 結果として **`Room.shape` が常に勝ち**、`walls` はあくまで「装飾としての属性持ち越し」に使う。
- このルールにより、ズレた JSON を開いたときに「アプリの中の世界では `shape` から計算された壁だけが存在する」状態に正規化される。

**壁再生成と Door / Window / WallFinish の再バインド規約:**

リサイズ・共有壁マージ・インポート整合性チェックで `Wall.id` が再採番されると、
`Door.wallId` / `Window.wallId` / `WallFinish.wallId` の参照が切れる。これを防ぐため、
壁の **論理キー(`edgeKey`)** を別途計算し、再生成前後で同じキーを持つ壁に再バインドする。

論理キーは **`Shape.edgeIds` に保存された辺 ID** で構成する。これは「部屋を移動・リサイズしても
辺の identity は変わらない」「同じ id は保存ファイルにも残る」ことに依存する設計で、座標
(`position`)や `edgeIndex`(配列インデックスは形状編集で揺らぐ)に依存する案より頑健:

```typescript
type EdgeRef = { roomId: string; edgeId: EdgeId };  // EdgeId は §5.2.1 Shape を参照

// 壁の論理キー。
// - 外周壁(片側のみ): 長さ 1 の配列
// - 共有壁(両側): 長さ 2 の配列。順序非依存のため (roomId, edgeId) の組をソート
// - sharedBy.length === 0 の自由壁は EdgeKey の対象外(下記参照)
type EdgeKey = readonly [EdgeRef] | readonly [EdgeRef, EdgeRef];

function edgeKeyOf(wall: Wall, rooms: Room[]): EdgeKey | null {
  // sharedBy が空 = どの部屋にも属さない自由壁。本仕様では「壁は必ず 1 つ以上の部屋に
  // 紐づく」前提なので、ここに来るのは破損データ。null を返してインポート側で ER5 に分類。
  if (wall.sharedBy.length === 0) return null;

  // 各 roomId について、その部屋の shape の edgeIds の中で wall に対応する edgeId を逆引きする。
  // findEdgeId は見つからない場合 null を返すので、その壁も ER5 に分類して捨てる。
  const refs: EdgeRef[] = [];
  for (const roomId of wall.sharedBy) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return null;
    const edgeId = findEdgeId(room, wall);
    if (edgeId == null) return null;
    refs.push({ roomId, edgeId });
  }
  refs.sort((a, b) =>
    a.roomId.localeCompare(b.roomId) || a.edgeId.localeCompare(b.edgeId)
  );
  return refs.length === 1 ? [refs[0]] : [refs[0], refs[1]];
}
```

**`findEdgeId` の照合規約(回転対応・壁芯座標):**

`Wall.from / to` も `Room.shape` の辺もすべて **壁芯(centerline)座標**で持つ(§5.3 座標系の正本ルール)。
`findEdgeId` はこの **同じ壁芯座標系** で照合するため、厚みや内寸変換を挟まない。

`Room.shape` の `edgeIds[i]` は **部屋ローカル座標** の辺に紐づく(rect なら N/E/S/W = 0/1/2/3、
polygon なら `points[i] → points[(i+1)%n]` の辺)。`Room.rotation` と平行移動を適用して
**ワールド座標の辺セグメント**を計算し、`wall.from / wall.to` と比較する:

1. `Room.shape` から各 `edgeId` のローカル座標辺(始点・終点)を取り出す
2. `Room.rotation`(0 / 90 / 180 / 270、Phase 2 以降は任意)を部屋中心まわりに適用
3. 部屋の位置オフセットを足してワールド座標に変換
4. `wall.from / wall.to` と「2 点が(順序非依存で)1mm 以内に一致」する辺を探して `edgeId` を返す
5. 見つからなければ `null`(`edgeKeyOf` 側で ER5 に流す)

> **照合は常に「壁再生成前の Room 状態」で行う。** `Room.shape` を更新した後で旧 `wall.from/to` を
> 照合すると、座標がズレて 1mm マッチが失敗する。再生成手順 1 のインデックス化はこのスナップショットを使う。

Phase 1 は 90° 倍数限定(§6.3 / §9.5.4)なので 1mm 厳格マッチで十分。Phase 2 で任意回転を許す
ときは、`Math.round` で 1mm に量子化してから比較する。

これにより:

- **部屋移動・拡縮で座標が変わっても `edgeKey` は不変**(`edgeIds` が形状側で永続化されているため)
- **同じ `roomPair` に複数の分離壁がある L 字部屋でも衝突しない**(各辺が別の `edgeId`)
- **保存・再読込で `edgeIds` を失わない**(ファイル形式の一部として書き出される)
- **新規辺の id は `crypto.randomUUID()`**、削除した辺の id は再利用しない

再生成手順(**順序が重要、特にスナップショットの取得タイミング**):

1. **「変更を適用する前の `Room.shape` 状態」をスナップショットとして保持**(`prevRooms`)。これに対して
   旧 `walls` を走査し、`edgeKeyOf(wall, prevRooms)` で `EdgeKey` を計算して
   **`edgeKey → wallId` インデックス**を作る。同時に **「片側 `EdgeRef` → wallId」インデックス**も作る
   (共有壁化/分離で `EdgeKey` の長さが変わる遷移に対応するため。下記フォールバック規則を参照)
2. `Room.shape` を **新しい状態に更新**
3. 新しい状態の `Room.shape` から壁集合を再計算し、各新壁の `EdgeKey` を求める
4. 新壁の引き継ぎ判定は **以下の優先順位** で行う(片側フォールバックを含む):
   - **(a) 完全一致**: 新 `EdgeKey` が旧 `edgeKey → wallId` インデックスにあれば、旧 `wallId` を引き継ぐ
   - **(b) 片側一致(外周壁 → 共有壁化)**: 新 `EdgeKey` が長さ 2(共有壁化)で、その 2 つの
     `EdgeRef` のいずれかが旧「片側 EdgeRef → wallId」インデックスにあれば、その旧 `wallId` を引き継ぐ
     (両方が片側インデックスにある場合は **辞書順で先に来る方** を採用、決定論的に揃える)
   - **(c) 片側一致(共有壁 → 外周壁化)**: 新 `EdgeKey` が長さ 1(分離)で、その `EdgeRef` が
     旧「片側 EdgeRef → wallId」インデックスにあれば、その旧 `wallId` を引き継ぐ
   - **(d) いずれにもマッチしない**: 新 ID(`crypto.randomUUID()`)
5. 旧 wallId のうち新集合に出てこなかったものを **失効リスト**にし、参照していた `Door` / `Window` /
   `WallFinish` は **`positionRatio` の比率を保ったまま** (a)〜(c) の引き継ぎを再試行
6. それでも再バインド先がない `Door` / `Window` は **削除**(ER5 整合性に件数を加算)、
   `WallFinish` は親 `Room.defaultWallMaterialId` にフォールバック

「ドアを置いた壁を間取り変更で消してしまった」ケースは削除で正しい挙動(壁ごと消えるので)。
「リサイズで壁が伸びた」「部屋を動かした」ケースは `edgeKey` 完全一致で参照が生き残る。
「外周壁が共有壁になった/共有壁が分離した」ケースは **片側 `EdgeRef` 一致のフォールバック** で参照が生き残る。

#### 5.2.1 サブ型定義

```typescript
// 部屋形状。Phase 1 は矩形(rect)のみ運用、Phase 2 でポリゴン(polygon)を許す。
//
// 各辺には **永続化される安定 ID(`EdgeId`)** を持たせる(§5.2 EdgeKey の前提)。
// - rect の `edgeIds[0..3]` は N / E / S / W に対応(順序固定)
// - polygon の `edgeIds[i]` は `points[i] → points[(i+1) % n]` の辺に対応(順序は points と一致)
// - 部屋の移動・拡縮では `edgeIds` は変えない
// - 頂点の挿入・削除では、不変だった辺の id を保ち、新規辺だけ新 id を発行する
// - rect ↔ polygon の変換(L 字化など)時も、共通する辺は id を保ち持ち越す
//
// 保存ファイルにもこの `edgeIds` が含まれる。インポート時に欠落していたら、
// その部屋の辺 id を生成し直し、`Door` / `Window` / `WallFinish` は ER5 経由で再バインドを試みる。
type EdgeId = string;
type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; edgeIds: [EdgeId, EdgeId, EdgeId, EdgeId] }
  | { kind: "polygon"; points: [number, number][]; edgeIds: EdgeId[] /* length === points.length */ };

// 家具インスタンス(Phase 2 から本格運用)
type FurnitureInstance = {
  id: string;
  catalogId: string;            // public/furniture/manifest.json の ID
  position: [number, number];   // mm、床面 (0,0) 基準
  rotation: number;             // 0-359°
  scale?: number;               // 既定 1.0(均等スケールのみ)
};

// 人物モデル(Phase 2、サイズ感の確認用)
type HumanModel = {
  id: string;
  position: [number, number];
  rotation: number;
  height: number;                // mm、既定 1700
};

// 吹き抜け(Phase 3、複数階対応とセット)
type Void = {
  id: string;
  shape: Shape;                  // 上下階を貫通する領域
  fromLevel: number;             // 起点フロア
  toLevel: number;               // 抜ける先のフロア
};
```

### 5.3 壁(大幅更新)

> **編集可否の正本ルール:**
> `wallType` は **役割の分類のみ** を表す(寸法既定値・線種・凡例の出し分けに使う)。
> **編集可否は `isLocked` だけが決める**。`exterior` でも `isLocked: false` なら編集可
> (例: §6.4.4 アパートの外周壁)。逆に `partition` でも `isLocked: true` なら編集不可。
> UI・テスト・ロジックは常に `isLocked` を見ること。
>
> 既定値の対応関係(新規プラン作成・テンプレ起点での初期値):
>
> | wallType | 既定 isLocked | 用途 |
> |---|---|---|
> | `exterior` | true(一軒家)/ false(アパート) | 外壁。アパートは編集を許す |
> | `load-bearing` | true | 耐力壁。原則固定 |
> | `shared` | true | マンション戸境壁。固定 |
> | `partition` | false | 間仕切り壁。可動 |
> | `non-bearing` | false | 非耐力壁(構造上不要)。可動 |

> **座標系の正本ルール(壁芯):**
> `Wall.from` / `Wall.to` と `Room.shape` の辺 / `Column.position` / `PipeSpace.position` はすべて
> **壁芯(centerline)座標** で持つ。`thickness` から内寸 / 外形を計算するのは派生計算であり、
> 永続データには含めない(§3.6 「壁芯と内寸を明確に区別、UI で切替可能」と整合)。
>
> したがって §5.2 EdgeKey の `findEdgeId` 照合(Shape 辺 ↔ `Wall.from/to`)は **同じ壁芯座標どうしの
> 1mm マッチ**で成立する。共有壁マージは `sharedBy` を増やすだけで `from` / `to` の座標値は
> 変えないため、マージ前後でも `EdgeKey` が一貫する。

```typescript
type WallType =
  | "exterior"        // 外壁(役割分類)
  | "load-bearing"    // 耐力壁
  | "shared"          // 戸境壁(マンション)
  | "partition"       // 間仕切り壁
  | "non-bearing";    // 非耐力壁

type Wall = {
  id: string;
  from: [number, number]; // 壁芯座標(mm、整数)。Room.shape の辺と同じ系
  to: [number, number];   // 同上
  thickness: number;      // mm。外壁150 / 耐力壁180 / 戸境壁180 / 間仕切り100
  wallType: WallType;     // 分類のみ。編集可否は isLocked が正
  isLocked: boolean;      // true なら編集禁止(物理ロック)
  sharedBy: string[];     // Room IDs(0〜2 個)
  height?: number;
};
```

### 5.4 柱(新規)

```typescript
type Column = {
  id: string;
  position: [number, number];   // 柱芯位置
  size: { w: number; h: number }; // 通常 105×105mm(木造)、150×150mm(鉄骨)等
  isLocked: boolean;            // マンションは true
  loadBearing: boolean;         // 耐力柱かどうか
};
```

### 5.5 PS(新規)

```typescript
type PipeSpace = {
  id: string;
  position: [number, number];   // PS の中心位置
  size: { w: number; h: number }; // 典型: 300×300〜600×600
  systems: PipeSystem[];        // 通る系統
  isLocked: boolean;            // マンションは true
};

type PipeSystem =
  | "water-supply"   // 給水
  | "drainage"       // 排水
  | "gas"            // ガス
  | "vent"           // 換気
  | "electrical";    // 電気主幹

// マンションの場合、水回り(キッチン・浴室・トイレ・洗面)は
// 同じ PS から給排水経路上 8m 以内に配置することを推奨。
// この距離を超えると警告。
```

### 5.6 部屋

```typescript
type Room = {
  id: string;
  presetId: string;
  customName?: string;
  shape: Shape;
  rotation: number;
  // 新規: 設備要件のオーバーライド
  equipmentOverride?: {
    requiresPipeSpace?: boolean;
  };
};
```

### 5.7 ドア(変更なし、再掲)

```typescript
type Door = {
  id: string;
  wallId: string;
  positionRatio: number;
  width: number;
  type: "single-swing" | "double-swing" | "sliding" | "folding" | "opening";
  swingDirection?: "left" | "right";
  swingTo?: string;
};
```

### 5.8 窓・サッシ(Phase 段階で運用切替)

#### 5.8.1 Phase ごとのポリシー

採光・換気警告の解除導線を Phase 1 から確保するため、窓は **Phase 1 では自由寸法も許す**。
規格カタログは Phase 1 でデータだけ同梱し、UI(製品コードからの選択・装飾)は Phase 2。

| Phase | 配置方法 | width / height | type | 装飾 |
|---|---|---|---|---|
| Phase 1 | 壁にクリック → 既定 1690×1170mm の引違いを置く / 寸法を直接編集 | 自由寸法可(50mm 単位) | dropdown(`fixed` / `sliding-2` / `casement`) | なし |
| Phase 2+ | 規格カタログから選択(`sashId` 指定)、自由寸法も引き続き可 | 規格選択 or 自由寸法 | 規格に紐付き | カーテン等(§5.10) |

#### 5.8.2 型定義

```typescript
type Window = {
  id: string;
  wallId: string;
  positionRatio: number;
  // Phase 1 は sashId 省略・自由寸法を許す。Phase 2 で sashId 指定が可能になる。
  sashId?: string;          // 規格品 ID(Sash テーブル参照)。Phase 2+ で本格運用
  width: number;            // mm(常に必須、§5.8.3 展開保存ルール)
  height: number;           // mm(常に必須)
  type: WindowType;         // 常に必須。採光・換気の補正係数選定に使う
  sillHeight: number;       // 窓台の高さ(床から、mm)
};

type WindowType =
  | "fixed"        // FIX 窓(換気面積に算入しない)
  | "sliding-2"    // 引違い 2 枚
  | "sliding-4"    // 引違い 4 枚
  | "casement"     // 片開き・上げ下げ等の開放系
  | "bay";         // 出窓

// サッシ規格マスター(別ファイル: src/data/sashes.ts)。Phase 1 でデータ同梱、UI は Phase 2。
type Sash = {
  id: string;              // "ykk-ap-2603"
  manufacturer: "ykk-ap" | "lixil" | "sankyo-tateyama";
  productCode: string;     // "APW330" など
  width: number;           // mm
  height: number;          // mm
  type: WindowType;
  glass: "single" | "double" | "triple";
  category: "small" | "medium" | "large" | "balcony"; // 掃き出し窓等
};
```

#### 5.8.3 sashId と寸法の展開保存ルール

`sashId` 指定時の寸法は **「展開保存」(コピー)方式** で持つ。`Window.width / height / type` は
常に必須で、`sashId` がある場合でも値を保存する。

| 規約 | 動作 |
|---|---|
| 規格選択時の生成 | `sashId` を入れた瞬間に `Sash.width` / `Sash.height` / `Sash.type` を `Window.{width,height,type}` に **コピー**(参照のみにしない) |
| 保存ファイル | `Window.{width,height,type}` を必ず書き出す(規格マスター無しでも面積計算が可能になるため) |
| 自由寸法編集 | `Window.{width,height}` を編集したら **`sashId` を `undefined` に外す**(参照と寸法の不一致を作らない) |
| インポート時のバリデーション | `sashId` が指定されていて、`Sash` テーブルが見つからない / 寸法が一致しない場合 → `sashId` を **`undefined` に落とし**、`Window.{width,height,type}` の値を採用(ER5 にカウント、トーストで「規格参照: N 件」と通知) |
| 採光・換気の計算 | 常に `Window.{width,height,type}` を直接読む(`sashId` を都度 lookup しない) |

これにより、サッシ規格マスターの追加・改名・廃止が起きても保存ファイルの面積計算結果が変わらない。

### 5.9 法規警告(新規)

```typescript
type ComplianceWarning = {
  id: string;             // 安定 ID:`${category}-${affectedRoomId}-${rule}` 等で決定論的に生成
  severity: ComplianceSeverity;
  category: ComplianceCategory;
  affectedRoomIds?: string[];
  affectedWallIds?: string[];
  message: string;          // ユーザー向け表示
  suggestion?: string;      // 改善案
  rule: string;             // "建築基準法第28条 採光" 等の参照
};

/**
 * severity は 2 段階運用(error は使わない)
 * - warning: ほぼ確実に違反、ユーザーに強く知らせる(赤系下線)
 * - info:    条件次第で違反になりうる、推奨レベル(黄系下線、軽め)
 *
 * 法規チェックでは決して "error" を返さない:
 * 地域差・例外があり、アプリが配置を強制阻止すべきでないため。
 * 配置を阻止すべき制約(重なり、耐力壁削除等)は別ルートで同期チェックする。
 */
type ComplianceSeverity = "warning" | "info";

type ComplianceCategory =
  | "lighting"        // 採光
  | "ventilation"     // 換気
  | "circulation"     // 廊下幅・通路
  | "fire-egress"     // 避難経路
  | "structure"       // 構造(耐力壁の連続性)
  | "equipment"       // 設備配管経路
  | "adjacency";      // 隣接ルール
```

#### 5.9.1 警告の安定 ID(`id` フィールド)

ack 機構が機能するため、同じ違反は何度再計算しても同じ ID を返す必要がある。生成規則:

```
id = `${category}:${affectedRoomIds.join(",")}:${rule}`
```

例: `"lighting:r5:建築基準法第28条第1項"` → 部屋 r5 の採光違反。
壁が対象なら部屋 ID の代わりに壁 ID を使う。

#### 5.9.2 ack(承認)機構

`Floorplan.metadata.acknowledgedWarnings: string[]` に ack した警告 ID を保存(§5.1 参照)。
ack 済み警告は一覧から非表示(または別タブに分離表示)、ファイル単位で永続。
ack を取り消す UI(履歴復元)も提供。

### 5.10 仕上げ材(新規)

3D 内編集モード(§15.6)で選択された床・壁・天井の仕上げ材を保存する。

```typescript
type RoomFinish = {
  roomId: string;
  floorMaterialId?: MaterialId;
  ceilingMaterialId?: MaterialId;
  /** 部屋全周一括指定(壁単位の上書きがあれば WallFinish が優先) */
  defaultWallMaterialId?: MaterialId;
};

type WallFinish = {
  wallId: string;
  /** 壁の表裏。共有壁の場合 inside / outside で別々のマテリアルを持てる */
  side: "inside" | "outside";
  materialId: MaterialId;
};

type WindowDecoration = {
  windowId: string;
  curtain?: CurtainStyle;        // null / undefined ならカーテンなし
};

type CurtainStyle = {
  type: "drape" | "lace" | "blind" | "roll";
  color: string;                 // HEX
};

type DoorDecoration = {
  doorId: string;
  styleId?: DoorStyleId;         // 例: "wood-flat-natural", "glass-frame-aluminum"
};

/** §15.2 のマテリアルマスター(public/materials/manifest.json)のID */
type MaterialId = string;
type DoorStyleId = string;
```

仕上げ材は `Floor.roomFinishes` / `Floor.wallFinishes` / `Floor.windowDecorations` /
`Floor.doorDecorations` として保存される(正本は §5.2 の `Floor` 定義)。
天井は `RoomFinish.ceilingMaterialId` で表現するため、独立した `CeilingFinish` 型は **持たない**。

設計判断:
- マテリアル ID 文字列で参照する **間接参照方式**。マテリアル本体は static アセットとして
  `public/materials/manifest.json` で一元管理(将来追加・改名・廃止に対応しやすい)
- マテリアルが見つからない場合、各部位の **デフォルト**(床 = `floor-oak-light` 等)に
  フォールバックして警告ログ
- 部屋削除時は紐づく `RoomFinish` も自動削除(参照整合性)
- 壁削除時は紐づく `WallFinish` も自動削除

### 5.11 設計判断(更新含む)

**1. 部屋と壁を分離管理する理由(変更なし)**
共有壁を 1 本の実体として扱うため。

**2. 座標は整数 mm(変更なし)**
浮動小数点誤差を避ける。

**3. ドアは positionRatio で持つ(変更なし)**
壁長変化への追従性。

**4. floors を配列(変更なし)**
複数階対応への布石。

**5. 壁を 5 種類に区別する理由(新規)**
動かせる壁と動かせない壁を UI 上明示するため。マンションのリフォームを想定すると、外周壁と戸境壁は触れない。これを「物理的に動かせない」として実装することで、施主が「夢を見ない」リアルな間取り検討ができる。これが L2 を達成する核心的なデータ設計。

**6. PS を独立エンティティにする理由(新規)**
水回り部屋の配置制約を表現するため。マンションでは PS 位置が固定で、給排水管の距離制約がある。これを表現できるかが「業者と話せる」かの分水嶺。

**7. サッシを規格品で持つ理由(新規)**
任意サイズの窓は施工不可能。Phase 1 は YKK AP の APW シリーズの主要規格を 30〜50 種類同梱予定。

---

## 6. コアロジック仕様

### 6.1 スナップ検出

ドラッグ中の部屋(または壁)が他の壁から `SNAP_THRESHOLD = 200mm` 以内に入り、
かつ重なり率が `OVERLAP_RATIO_MIN = 0.5` 以上のときに吸着判定する。

判定ステップ:

1. ドラッグ中の各エッジ(部屋なら矩形/ポリゴンの全辺)について、`floor.walls` の中から
   平行・かつ垂直距離 ≤ `SNAP_THRESHOLD` のものを候補に選ぶ
2. 候補ごとに、エッジを壁に投影したときの重なり長さ÷エッジ長さを計算し、
   `OVERLAP_RATIO_MIN` 以上ならスナップ確定
3. 確定後、ドラッグ位置を壁に貼り付ける(整数 mm に丸める)
4. スナップ後、両側の `Room.shape` が辺を共有する場合は **共有壁にマージ**(`Wall.sharedBy` に
   両方の Room ID を入れ、重複した壁実体を削除)

**スナップ対象の制約:** `isLocked: false` の壁同士のみ吸着判定する。`isLocked: true`
(マンション戸境壁・耐力壁等)は **吸着先にはなるが、ドラッグ側にはなれない**(=動かない)。
`wallType` ではなく `isLocked` で判定する(§5.3 参照)。

### 6.2 ドア自動配置

部屋を新規追加し、別部屋と共有壁が生成されたタイミングで、共有壁の中央に **片開きドア
(幅 800mm、`positionRatio: 0.5`)** を自動生成する。既にその共有壁にドアがある場合は何もしない。
玄関側の壁はドア自動生成対象外(玄関ドアはユーザーが配置)。

#### 再生成抑止 tombstone

「ドアが消えている = 未生成」と「ドアが消えている = ユーザーが削除済み」を区別するため、
削除履歴の **正本を `Floor.suppressedAutoDoors` に持つ**(以下を `Floor` 型に追加):

```typescript
type Floor = {
  // ...既存...
  suppressedAutoDoors: AutoDoorSuppression[];
};

// tombstone キーは「どの部屋ペアの、どの辺の組」かを一意に表す必要がある。
// L 字・ポリゴン部屋で同じ 2 部屋が複数の共有壁を持つ場合、roomPair 単位だと別の共有壁の
// 自動ドアまで巻き添えで抑止されるため、§5.2 の EdgeKey を tombstone のキーに使う。
type AutoDoorSuppression = {
  // §5.2 の EdgeKey と同じ正規化(roomId, edgeId の組をソート済み)で持つ。
  // 共有壁は常に長さ 2(自動ドアは共有壁にだけ生成されるため)。
  edgeKey: readonly [EdgeRef, EdgeRef];
  removedAt: string;             // ISO8601、UI で「いつ削除したか」を出すため
};
```

判定ルール:

- 共有壁の生成検出時、その壁の `edgeKey` を計算して `suppressedAutoDoors` を線形検索
  (`edgeKey` 等価判定は両 `EdgeRef` の `roomId` / `edgeId` がそれぞれ一致するか。ソート済みなので
  順序依存はない)→ ヒットしたら自動ドアは **生成しない**
- ユーザーが手動でドアを削除したら、削除直前の壁の `edgeKey` を tombstone に追加
- **`Room` が削除された**ら、その `roomId` を `edgeKey` に含む tombstone を削除
- **`Shape` の辺が削除された**(ポリゴン頂点を間引いた等)ら、その `edgeId` を含む tombstone も削除
- `Room.skipAutoDoor` のような部屋単位フラグは使わない(複数の隣接部屋を区別できないため)

### 6.3 重なり判定

ドラッグ確定の前後で、`Room.shape` 同士のジオメトリ交差を判定する。
**1mm でも内部で重なれば配置不能**(共有壁での隣接は重なりとしない)。

**判定方式は SAT(分離軸定理)に統一**(rect / polygon / 回転後形状すべてを同じパスで扱う):

- 軸並行の矩形(`rect` かつ `rotation === 0`)は AABB の高速パスで先に判定し、
  そこで非交差が確定したら SAT を呼ばない(性能最適化のためのショートカットのみ、
  正解は常に SAT に任せる)
- それ以外(`rotation !== 0` の rect、polygon)は **OBB / ポリゴン同士の SAT** で判定する。
  `rect` は回転後の 4 頂点に展開してから SAT に渡す
- 「axis-aligned 判定で済ませる」運用は禁止(回転矩形を AABB で見ると誤判定する)

**回転 UI と判定の整合(Phase 別の制約):**

| Phase | 許容する回転刻み | 判定方式 |
|---|---|---|
| Phase 1 | **90° のみ**(0 / 90 / 180 / 270)。`Shift + 1°` 自由回転は無効化 | rect は AABB ショートカット(回転後も軸並行に戻るため) |
| Phase 2 以降 | 15° スナップ + `Shift` で 1° 自由回転 | 任意回転は OBB / SAT で判定 |

Phase 1 で 90° 限定にしておくことで、SAT 実装を Phase 2 まで遅らせても安全に運用できる。
§9.5.4 の回転 UI もこの方針に従う。

判定タイミング:
- ドラッグ中の各フレーム: 阻止系として **同期で** 判定し、重なる位置にスナップさせない
  (§6.6.1 阻止系)。半透明赤のフィードバックを表示
- ドロップ確定時: 最終位置で再判定し、重なる場合は元位置に戻す

### 6.4 構造整合性チェック(新規)

```
function checkStructuralIntegrity(floor):
    warnings = []

    // 耐力壁を勝手に削除していないか
    for each wall in floor.walls:
        if wall.wallType == "load-bearing" && !wall.isLocked:
            warnings.push("耐力壁が削除可能状態です")

    // 柱位置の整合(910 グリッド上にあるか)
    for each column in floor.columns:
        if !isOnGrid(column.position, GRID_SIZE):
            warnings.push("柱がグリッドから外れています")

    return warnings
```

#### 6.4.1 編集対象は「建物単位」ではなく「住戸単位」

本アプリは **集合住宅全体(複数住戸 + 共用部)を編集対象としない**。マンション・アパートは
すべて **1 住戸の専有部分** として扱う(§1.5 非目標、§5.1 BuildingType の注釈と整合)。

| BuildingType | 編集範囲 | 構造体の扱い |
|---|---|---|
| `single-family` | 一軒家全体(1〜3 階) | 在来工法の柱・耐力壁を持つ。910mm グリッドに整列推奨 |
| `condo-unit` | マンション 1 住戸の専有部分(玄関ドア内側) | 外周壁・戸境壁が **存在する場合は固定**、無い場合はゼロから描く |
| `apartment-unit` | アパート 1 住戸の専有部分 | 軽量鉄骨想定。外周壁の固定は任意 |
| `hotel` | ホテル基準階 1 ユニット or 全館 | 商用、構造体はテンプレ依存 |
| `office` / `retail` / `mixed` | 全体 or フロア | 構造体はテンプレ依存 |

#### 6.4.2 一軒家の構造柱(自動配置 + 手動編集)

新規プラン作成時、ダイアログで「柱を 910mm グリッドに自動配置する」をデフォルト ON。

- ON → グリッド交点に柱(105×105mm)を一括生成、`isLocked: false` で個別編集可
- OFF → 柱なしで開始(玄人モード)
- 自動配置後の編集: 個別削除・追加・サイズ変更・移動が自由

```typescript
function generateColumnsByGrid(
  bbox: BoundingBox,
  gridSize: number = 910, // mm(尺モジュール)
): StructuralColumn[] {
  const columns: StructuralColumn[] = [];
  for (let x = bbox.x; x <= bbox.x + bbox.w; x += gridSize) {
    for (let y = bbox.y; y <= bbox.y + bbox.h; y += gridSize) {
      columns.push({
        id: `col-${x}-${y}`,
        position: [x, y],
        size: { w: 105, h: 105 },
        isLocked: false,
      });
    }
  }
  return columns;
}
```

**構造警告**(`category: "structure"`、すべて severity `info`):

| チェック | 適用 |
|---|---|
| 柱間隔(梁スパン)> 1820mm | 一軒家のみ。L3 アプリでは warning 相当だが本アプリは info |
| 外壁の角に柱がない | 一軒家のみ |
| 柱がグリッドから外れている(910 の倍数でない) | 一軒家のみ。任意配置は許容するが情報として提示 |
| 通し柱(2 階建ての 4 隅)が 1F・2F で揃っていない | 2 階建て一軒家のみ。**Phase 3**(複数階対応とセット) |

#### 6.4.3 マンション 1 住戸の起点(2 系統)

新規プランで `condo-unit` を選択した場合、起点を 2 つから選べる:

##### A. 躯体テンプレから始める(推奨デフォルト)

§7.1 のマンションテンプレ(11 種)から選択。**Phase 1 では住戸の外周・戸境壁のみ固定**
(`pipeSpaces` は空配列)、**Phase 1.5 以降は PS 位置も固定された状態で読込**(下記注意書きと
§11 Phase 境界に従う)。固定壁は `isLocked: true` で動かそうとすると振動アニメで拒否。

> **Phase 1 ではテンプレに PS を含めない**(Phase 1 不変条件 `pipeSpaces = []` を保つため、
> §11 / §5.2.1 と整合)。Phase 1 のマンションテンプレ 11 種は **外周・戸境壁のみ固定で、
> PS は空配列**で出荷する。**Phase 1.5 のマイナーリリースで同じテンプレに PS を追加**する。
>
> **既存ファイルへの PS 追加は自動マイグレーションしない**。理由は `metadata.template?` が
> 通常保存ファイルでは省略可能(§5.1)で、どのテンプレ由来かを後から確実に判別できないため。
> 代わりに以下を行う:
>
> - **テンプレ起点情報を保存**: テンプレから新規プランを作成した時点で
>   `metadata.templateOrigin = { templateId, templateVersion }` を必ず保存する(§5.1
>   `FloorplanMetadata` に追加。Phase 1 から導入)
> - **Phase 1.5 のローダー**: 開いたファイルが Phase 1 由来かつ `templateOrigin` を持ち、
>   かつ対応テンプレに PS 定義がある場合のみ、エディタ内に **「PS 追加候補があります」バナー** を
>   出して **ユーザーの明示的な許可で**(ボタン押下で)PS を付与する。自動書き換えはしない
> - `templateOrigin` がない / 不明なファイルは、ユーザーが手動で PS を配置するまで `pipeSpaces` は空のまま
> - `SchemaVersion = "1.1"` は **`templateOrigin` フィールドの追加と PS 同梱許容** のために
>   minor 互換更新する(`metadata.templateOrigin` は optional、データ書式は後方互換)

##### B. ゼロから描く(自由モード)

ユーザーが住戸の外形を 1 から描画する。動作:

1. 「住戸外形描画モード」に入る → 矩形ツール / ポリゴンツールで住戸外形を描く
2. 描いた外形は自動的に `wallType: "exterior"`(外周壁、`isLocked: true`)として登録
3. ユーザーは描画後に右クリックで個別の壁種別を変更可能(例: 戸境壁 = `wallType: "shared"`)
4. 内部はゼロから自由に間仕切り
5. グリッドは尺モジュール(910mm)に縛られない。**50mm 単位の自由グリッド**(マンションは
   尺モジュールに縛られないため。設定で変更可)
6. 柱は不要(マンションの柱は躯体に含まれ、住戸内には基本的にない)。
   ただしユーザーが意図的に柱を配置することは可能(構造柱が住戸内に出る間取りの再現用)。
7. PS は手動配置。既存配管は外周や戸境壁沿いに置くのが現実的、という UI ヒントを表示

##### マンション住戸の構造警告

| チェック | severity | 適用 |
|---|---|---|
| 外周壁・戸境壁を動かそうとする | (即時阻止、警告ではない) | A モードのテンプレ起点のみ |
| 水回り(キッチン・バス・トイレ)が外周壁から 4m を超えて遠い | info | 両モード共通(配管経路) |

> 共用廊下(1200mm 規定)は本アプリのスコープ外。住戸が共用廊下に面しているかどうかは
> 入力に持たない(§1.5 非目標)。住戸内廊下の推奨幅 780mm は §6.6 で `info` 警告として扱う。

#### 6.4.4 アパート 1 住戸

`apartment-unit` は軽量鉄骨想定。マンションよりも構造制約が緩い。

- 起点: §7.1 アパート 3 種(ワンルーム・1K・1DK)から選択 or ゼロから描画
- 外周壁は `wallType: "exterior"` だが `isLocked: false`(編集可)
- 戸境壁の概念なし(戸建のように扱う)
- 910mm グリッドではなく 50mm 自由グリッドが既定

#### 6.4.5 商用(office / retail / hotel / mixed)

スケルトン渡し前提。テンプレから開始(§7.1 商用 12 種)。
柱・PS・主要設備系統はテンプレに含まれる。
ユーザーは内装(間仕切り・什器)を自由に編集。
構造体(外周・主要柱)は `isLocked: true`。

### 6.5 設備系統チェック(新規、**Phase 1.5 から有効**)

> §11 に従い、PS の配置と本チェックは **Phase 1.5 で初めて有効化**される。Phase 1 の
> `Floor.pipeSpaces` は常に空配列で、`checkEquipment` は呼ばない(§6.6.1 の警告系から除外)。

必要な系統は **`RoomPreset.utilityRequirements`(§7)** から取る。preset ごとに宣言型で
持たせることで、IH キッチン(`["water-supply", "drainage"]`)とガス併設キッチン
(`["water-supply", "drainage", "gas"]`)を別 preset として使い分けでき、固定の `if/switch` で
不必要な警告(IH なのに gas 必須など)が出るのを防ぐ。

```
function checkEquipment(floor):
    warnings = []

    for each room in floor.rooms:
        preset = getPreset(room.presetId)
        if !preset.requiresPipeSpace: continue                  // 水回り以外は対象外
        required = preset.utilityRequirements ?? []
        if required.length == 0:
            // 必要系統が宣言されていない preset は PS との関係を強制しない(警告対象外)
            continue

        eligiblePS = floor.pipeSpaces.filter(ps =>
            required.every(sys => ps.systems.includes(sys))
        )
        nearestPS = findNearest(room, eligiblePS)
        if nearestPS == null:
            warnings.push(`${preset.displayName} が必要とする系統(${required.join(",")})を持つ PS が見つかりません`)
            continue

        distance = pipeRoutingDistance(room.shape.center, nearestPS.position)
        if distance > 8000:  // 8m 以上は配管推奨外
            warnings.push(`${room.presetId} から PS まで ${distance/1000}m あり、配管が困難です`)

    return warnings
```

### 6.6 法規チェック(新規)

> **スコープ注:** 本アプリは §1.5 の通り **1 住戸単位**で扱うため、ここでチェックする `hallway`
> プリセットは **住戸内廊下** を指す。集合住宅の **共用廊下**(1200mm 規定)は本アプリの編集対象外で、
> 警告も出さない。住戸内廊下幅は推奨値 780mm を `info` で出すのみ(§6.6.4)。

```
function checkCompliance(floorplan, floor):
    warnings = []
    buildingType = floorplan.metadata.buildingType

    // 1. 採光面積チェック(居室のみ)
    for each room in floor.rooms:
        preset = getPreset(room.presetId)
        if !preset.requiresWindow: continue

        // §6.6.0 と一致。採光と換気で関数を分離(共通の sumWindowArea は使わない)
        lightArea = sumLightingArea(room, floor.windows, floor.walls)
        floorArea = calculateRoomArea(room)
        if lightArea < floorArea / 7:
            warnings.push({
                category: "lighting",
                severity: "warning",
                message: `${preset.displayName}の採光面積が床面積の1/7未満です`,
                rule: "建築基準法第28条第1項"
            })

    // 2. 換気面積チェック(1/20 を閾値)
    for each room in floor.rooms:
        preset = getPreset(room.presetId)
        if preset.minVentilationRatio == null: continue

        ventArea = sumVentilationArea(room, floor.windows, floor.walls)
        if ventArea < calculateRoomArea(room) * preset.minVentilationRatio:
            warnings.push({ category: "ventilation", severity: "warning", ... })

    // 3. 住戸内廊下幅チェック(共用廊下はスコープ外)
    for each hallway in floor.rooms.filter(r => r.presetId == "hallway"):
        minWidth = getMinWidth(hallway.shape)
        if minWidth < 780:
            warnings.push({
                category: "circulation",
                severity: "info",
                message: "住戸内廊下幅が780mm未満です(推奨値)",
                rule: "実務推奨(法定義務ではない)"
            })

    // 4. 寝室の避難経路チェック
    // 寝室から玄関まで、扉を経由できる経路があるか

    return warnings
```

#### 6.6.0 採光・換気の有効面積計算

採光と換気は計算式が違う。両者を共通の `sumWindowArea` で済ませず、別関数に分ける。

```typescript
// 採光有効面積
function sumLightingArea(room, windows, walls): number {
  let total = 0;
  for (const w of windowsOnRoomWalls(room, windows, walls)) {
    const rawArea = (w.width * w.height) / 1_000_000; // mm² → m²
    const k = lightingCorrection(w);                  // 採光補正係数
    total += rawArea * k;
  }
  return total;
}

// 換気有効面積。FIX 窓は算入しない、引違いは半分、片開きは全部
function sumVentilationArea(room, windows, walls): number {
  let total = 0;
  for (const w of windowsOnRoomWalls(room, windows, walls)) {
    const rawArea = (w.width * w.height) / 1_000_000;
    total += rawArea * openableRatio(w.type);
  }
  return total;
}

function openableRatio(type: WindowType): number {
  switch (type) {
    case "fixed":     return 0;    // FIX は換気に効かない
    case "sliding-2": return 0.5;  // 引違い 2 枚は片側分
    case "sliding-4": return 0.5;  // 引違い 4 枚も同等扱い(中央 2 枚で開放面積≈半分)
    case "casement":  return 1.0;  // 片開き・上げ下げは全開可
    case "bay":       return 0.5;  // 出窓は実勢として 0.5
  }
}

function lightingCorrection(w: Window): number {
  // Phase 1 では一律 1.0(付録 C.1 の方針に従う)。
  // Phase 2 で隣地距離・庇深さ・道路斜線等を加味して 0.7〜1.0 に拡張。
  return 1.0;
}
```

`Floorplan` 側に **採光補正係数のメタを保存しない**(Phase 2 で `Floorplan.lightingContext`
として隣地距離等を入れる前提のフィールドを後付け)。Phase 1 は計算式の中だけで完結する。

#### 6.6.1 再計算タイミング(同期 vs debounce の二段構成)

警告と阻止を分け、計算負荷とフィードバック速度のバランスを取る。

| 種別 | 例 | タイミング | 実装 |
|---|---|---|---|
| **阻止系**(配置を妨げる) | 重なり判定、スナップ吸着、耐力壁削除阻止、外周壁ドラッグ阻止 | **同期・即時** | ドラッグ中の各フレームで判定 |
| **警告系**(警告表示のみ) | 採光・換気・廊下幅・天井高、設備配管距離、隣接ルール違反 | **debounce 300ms** | 操作停止 300ms 後に再計算 |
| **構造警告**(削除直後) | 柱削除・耐力壁削除直後の関連警告 | **debounce バイパス**(即時) | 削除確定時に即計算 |

```typescript
// ストア(Zustand)のミドルウェアで実装
import { debounce } from "lodash";

const debouncedRunLegalChecks = debounce(
  (floorplan: Floorplan) => {
    const warnings = runLegalChecks(floorplan);
    setWarnings(warnings);
  },
  300, // ms
);

// 操作種別ごとに呼び分け
function onMoveRoom(roomId: string, dx: number, dy: number) {
  // 阻止系: 同期で衝突判定
  if (isOverlapping(...)) return;

  applyMove(roomId, dx, dy);

  // 警告系: debounce
  debouncedRunLegalChecks(getFloorplan());
}

function onDeleteWall(wallId: string) {
  // 構造警告: バイパスで即時
  applyDelete(wallId);

  // 削除後の最新状態でチェックする必要があるので、debounce.flush() は使わない。
  // flush() は待機中の引数(削除前の floorplan)を再評価してしまうため。
  debouncedRunLegalChecks.cancel();           // 待機中のタイマーをクリア
  const warnings = runLegalChecks(getFloorplan()); // 削除後の状態で同期実行
  setWarnings(warnings);
}
```

#### 6.6.2 ユーザー設定で頻度カスタマイズ

設定パネルで以下から選べるようにする(デフォルト: 300ms):

| 設定値 | 用途 |
|---|---|
| `realtime`(0ms) | 軽い間取り、ハイエンド PC |
| `300ms` | デフォルト |
| `1000ms` | 大きな間取り(100 部屋〜) |
| `manual` | 確定時のみ。「再チェック」ボタンを別途表示 |

設定は `localStorage.complianceCheckMode` に保存。

#### 6.6.3 パフォーマンス目標

§3.1 と一貫:

- 50 部屋・通常 PC で `runLegalChecks()` 1 回 < 80ms(60fps の 1 フレーム時間 = 16ms × 5)
- 超えそうな場合は Web Worker 化を検討(全部屋並列バッチ計算)
- ただし Worker 起動コストもあるので、< 30 部屋では同一スレッドで十分

#### 6.6.4 各チェックの severity 振り分け

§5.9 で `error` を使わず `warning` / `info` の 2 段階運用と決めた。具体的な振り分けは以下:

| カテゴリ | チェック | severity | 根拠 |
|---|---|---|---|
| lighting | 採光面積不足(< 床面積 × 1/7) | **warning** | 建築基準法第28条 第1項(法定基準) |
| lighting | 居室で窓ゼロ | **warning** | 同上 |
| ventilation | 換気面積不足(< 床面積 × 1/20) | **warning** | 建築基準法第28条 第2項 |
| ventilation | 機械換気必要室で換気設備未設置 | **warning** | 同上(**Phase 3**:設備配置の `mechanical-ventilation` 導入とセット。Phase 1 / 1.5 では出さない) |
| circulation | 住戸内廊下幅 < 780mm | info | 推奨値、法定義務ではない(§1.5 により共用廊下はスコープ外) |
| circulation | 階段踊場 < 750mm | **warning** | 建築基準法施行令第23条(**Phase 3 階段機能とセットで実装**) |
| circulation | 階段蹴上 > 230mm(住宅) | **warning** | 同上(**Phase 3**) |
| circulation | 階段踏面 < 150mm(住宅) | **warning** | 同上(**Phase 3**) |
| circulation | 階段幅 < 750mm(住宅) | **warning** | 同上(**Phase 3**) |
| structure | 居室の天井高 < 2100mm | **warning** | 建築基準法施行令第21条 |
| structure | 居室の天井高 < 2400mm | info | 一般推奨水準 |
| fire-egress | 寝室から玄関まで経路なし | **warning** | 安全要件、強い指摘 |
| fire-egress | 2 階以上で避難用窓なし(寝室) | **warning** | 火災時避難の観点 |
| equipment | 水回り→ PS の配管距離 > 8m | info | 排水勾配の推奨値、施工で吸収可能 |
| equipment | 水回り部屋に PS が無いフロア | **warning** | 配管不能 |
| adjacency | トイレ⇔キッチン直接隣接 | info | 衛生面の配慮、必須ではない |
| adjacency | LDK のドア接続なし | info | 慣例、必須ではない |

#### 6.6.5 ack(承認)機構

§5.9.2 の方針を実装側に落とす:

```typescript
// 表示時、ack 済みの警告をフィルタ
function visibleWarnings(
  warnings: ComplianceWarning[],
  acked: string[],          // floorplan.metadata.acknowledgedWarnings
  filterMode: "all" | "warning-only" | "none",
): ComplianceWarning[] {
  return warnings.filter((w) => {
    if (acked.includes(w.id)) return false;        // 個別 ack
    if (filterMode === "none") return false;        // 一括非表示
    if (filterMode === "warning-only" && w.severity === "info") return false;
    return true;
  });
}

// ユーザーアクション
function ackWarning(id: string) { /* metadata.acknowledgedWarnings に追加 */ }
function unackWarning(id: string) { /* 削除 */ }
function ackAll(category?: ComplianceCategory) { /* カテゴリ単位で一括 */ }
```

UI 仕様(§9 関連):

- 警告パネル左サイドに **「現在の警告」(未 ack)** と **「ack 済み履歴」** の2タブ
- 各警告カード右端に「了解する」ボタン → ack
- ack 済み履歴の各カードには「再表示」ボタン → unack
- ヘッダーに **フィルタトグル**: `すべて表示 / 警告のみ / 非表示`
- 「すべての info を一括 ack」ボタン(危険操作なので確認ダイアログ)

### 6.7 連結性チェック(変更なし)

### 6.8 面積計算(更新)

内部計算は変更なしだが、表示時に**内寸/壁芯**を切替可能にする:

```
function calculateRoomArea(room, mode: "inner" | "centerline"):
    if mode == "centerline":
        // 壁芯々の面積(建築面積算定はこちら)
        return shapeArea(room.shape)
    else:
        // 内寸面積(室内有効面積)
        // 各壁の thickness の半分を内側にオフセットして再計算
        return shapeArea(insetShape(room.shape, walls))
```

### 6.9 日当たりシミュレーション(新規、Phase 2)

```
function simulateSunlight(floor, dateTime, orientation):
    sunPosition = calculateSunPosition(latitude, dateTime)
    sunVector = sunPositionToVector(sunPosition)

    // 各壁・窓・障害物から影をレイトレーシング
    for each room in floor.rooms:
        sunlitArea = rayTrace(room, sunVector, floor.walls)
        room.sunlitRatio = sunlitArea / room.area

    return floor
```

詳細は §15.4(3D ライティング)とも連動。

---

## 7. 部屋プリセット

部屋プリセットは `src/data/roomPresets.ts` に置く。本書を正本として、ファイルは `RoomPreset[]` を
そのまま export する形にする(リテラル定義 + 型注釈)。

```typescript
type RoomPreset = {
  id: string;                        // "living", "bedroom", "kitchen" 等
  displayName: string;               // 「リビング」
  category: RoomCategory;            // 居室・水回り・動線 etc.
  defaultSize: { w: number; h: number }; // mm
  defaultWallType: WallType;         // 既定の周囲壁(通常 "partition")
  requiresWindow: boolean;           // 居室は true(採光・換気警告の対象になる)
  requiresPipeSpace: boolean;        // 水回りは true(§6.5 設備チェックの対象)
  // §6.5 設備チェックで PS に要求する系統。preset ごとに固定値を持たせず、ここで宣言する。
  // 例: ガス併設キッチン = ["water-supply", "drainage", "gas"]、IH キッチン = ["water-supply", "drainage"]
  // 既定で IH キッチンとし、別途「ガス併設」プリセットを用意する想定。
  utilityRequirements?: PipeSystem[];
  preferredWallTypes: WallType[];    // 推奨される周囲壁種別(複数候補)
  minLightingRatio?: number;         // 最小採光比(居室は 1/7)。null なら採光チェック対象外
  minVentilationRatio?: number;      // 最小換気比(居室は 1/20)
};

type RoomCategory =
  | "living-room"   // 居室
  | "wet"           // 水回り
  | "entrance"      // エントランス
  | "circulation"   // 動線
  | "storage"       // 収納
  | "outdoor"       // 屋外
  | "hotel"         // ホテル
  | "office"        // オフィス
  | "retail"        // 店舗
  | "common";       // 商用共用
```

カテゴリ別の同梱内訳:

| カテゴリ | 内容 | 件数 |
|---|---|---|
| 居室 | リビング、ダイニング、寝室、子供部屋、和室、書斎 | 8 |
| 水回り | キッチン、浴室、洗面所、トイレ、ランドリー | 5 |
| エントランス | 玄関、玄関ホール、土間 | 3 |
| 動線 | 廊下、階段 | 2 |
| 収納 | クローゼット、WIC、納戸 | 3 |
| 屋外 | バルコニー、テラス、ガレージ、庭 | 4 |
| ホテル | 客室、ロビー、フロント、レストラン、宴会場 | 6 |
| オフィス | 執務、会議室、役員室、受付、給湯、サーバー、ブース | 7 |
| 店舗 | 売場、試着室、レジ、バックヤード、カフェ席 | 5 |
| 商用共用 | エントランス、エレベーター、共用トイレ、駐車場、機械室 | 6 |

### 7.1 同梱テンプレート一覧

合計 **34 テンプレート**。すべて `license: "original"`、`designer: "間取りプランナー チーム"`。
寸法と構成は住宅金融支援機構「フラット 35 対応住宅」標準仕様、国交省標準モデルプラン、
および建築設計実務書(『コンパクト住宅の解剖図鑑』『間取りの方程式』ほか)を参考に、
特定物件を模倣せず再構築。description には「○○年代の標準的な〜」等を明記。

| カテゴリ | 件数 | 同梱開始 Phase |
|---|---|---|
| 一軒家(**平屋のみ** 3 種) | 3 | Phase 1 |
| 一軒家(2 階建・3 階建 5 種) | 5 | **Phase 3**(複数階対応とセット。Phase 1 の UI からは到達しない) |
| マンション 1 住戸 | 11 | Phase 1 |
| アパート 1 住戸 | 3 | Phase 1 |
| 商用(店舗・オフィス・ホテル・複合等) | 12 | **Phase 3**(同梱はするが Phase 1 の UI からは到達しない) |

各ファイルは `public/templates/<category>/<id>.floorplan.json` として配置。
サムネは `public/templates/thumbs/<id>.png`(2D 描画から自動書き出し、512×512)。

#### 一軒家(8 種)

| id | 名称 | 延床 | LDK | 階数 | ターゲット | tags | 同梱開始 Phase |
|---|---|---|---|---|---|---|---|
| `house-flat-1ldk-20` | 平屋 1LDK 20 坪 | 66㎡ | 1 | 1 | シニア・終の棲家 | 平屋,コンパクト,バリアフリー | Phase 1 |
| `house-flat-2ldk-25` | 平屋 2LDK 25 坪 | 83㎡ | 2 | 1 | 夫婦・リタイア | 平屋,夫婦 | Phase 1 |
| `house-flat-3ldk-30-villa` | 平屋 3LDK 30 坪 別荘風 | 99㎡ | 3 | 1 | 週末住宅・郊外 | 平屋,別荘,広土間 | Phase 1 |
| `house-2f-3ldk-28` | 2階建 3LDK 28 坪 | 92㎡ | 3 | 2 | ファミリー狭小地 | 狭小,3LDK | **Phase 3** |
| `house-2f-3ldk-30-south` | 2階建 3LDK 30 坪 南向き | 99㎡ | 3 | 2 | ファミリー王道 | 南向き,3LDK,定番 | **Phase 3** |
| `house-2f-4ldk-35` | 2階建 4LDK 35 坪 | 116㎡ | 4 | 2 | 子育て世代 | 4LDK,収納充実 | **Phase 3** |
| `house-2f-twogen-40` | 2階建 二世帯 40 坪 | 132㎡ | 5 | 2 | 二世帯 | 二世帯,完全分離 | **Phase 3** |
| `house-3f-3ldk-25-urban` | 3階建 3LDK 25 坪 都市型 | 83㎡ | 3 | 3 | 都市部狭小 | 都市型,狭小,3階 | **Phase 3** |

#### マンション(11 種、専有面積)

| id | 名称 | 専有 | LDK | tags |
|---|---|---|---|---|
| `condo-1r-18` | 1R 18㎡ | 18㎡ | 0 | 単身,投資用 |
| `condo-1k-22` | 1K 22㎡ | 22㎡ | 1 | 単身,標準 |
| `condo-1dk-28` | 1DK 28㎡ | 28㎡ | 1 | 単身,広め |
| `condo-1ldk-38` | 1LDK 38㎡ | 38㎡ | 1 | 単身,カップル |
| `condo-2k-35` | 2K 35㎡ | 35㎡ | 2 | 単身〜ルームシェア |
| `condo-2dk-42` | 2DK 42㎡ | 42㎡ | 2 | 二人暮らし,昭和型 |
| `condo-2ldk-55-tanoji` | 2LDK 55㎡ 田の字型 | 55㎡ | 2 | 二人暮らし,定番 |
| `condo-2ldk-60-center` | 2LDK 60㎡ 中央リビング型 | 60㎡ | 2 | 二人暮らし,角部屋風 |
| `condo-3ldk-70` | 3LDK 70㎡ 田の字型 | 70㎡ | 3 | ファミリー定番 |
| `condo-3ldk-75-corner` | 3LDK 75㎡ 角部屋 | 75㎡ | 3 | ファミリー,2 面採光 |
| `condo-4ldk-85` | 4LDK 85㎡ ファミリー | 85㎡ | 4 | ファミリー,広め |

#### アパート(3 種、軽量鉄骨想定)

| id | 名称 | 専有 | LDK | tags |
|---|---|---|---|---|
| `apt-room-18` | ワンルーム 18㎡ | 18㎡ | 0 | 賃貸,学生 |
| `apt-1k-22` | 1K 22㎡ 標準 | 22㎡ | 1 | 賃貸,社会人 |
| `apt-1dk-28` | 1DK 28㎡ | 28㎡ | 1 | 賃貸,カップル |

#### 商用(12 種)

| id | 名称 | 床面積 | tags |
|---|---|---|---|
| `shop-cafe-50` | 小規模カフェ 50㎡ | 50㎡ | 飲食,客席+厨房 |
| `shop-bakery-60` | ベーカリーショップ 60㎡ | 60㎡ | 飲食,作業場 |
| `shop-salon-40` | 美容室 40㎡ | 40㎡ | サービス,セット面 |
| `shop-retail-100` | 物販店舗 100㎡ | 100㎡ | 物販,試着室,バックヤード |
| `office-small-80` | スモールオフィス 80㎡ | 80㎡ | 執務,会議室1 |
| `office-mid-200` | 中規模オフィス 200㎡ | 200㎡ | 受付,大小会議室,休憩室 |
| `office-coworking-150` | コワーキング 150㎡ | 150㎡ | オープン席,集中ブース,カフェ |
| `hotel-guesthouse-100` | ゲストハウス 1F 100㎡ | 100㎡ | 共用ラウンジ,客室4 |
| `hotel-room-twin` | ホテル客室基準階 1 ユニット | 28㎡ | ツイン,バス,クローゼット |
| `clinic-private-120` | 個人クリニック 120㎡ | 120㎡ | 待合,診察,処置 |
| `welfare-afterschool-80` | 学童保育施設 80㎡ | 80㎡ | 活動室,静養室 |
| `studio-fitness-100` | フィットネススタジオ 100㎡ | 100㎡ | スタジオ,ロッカー |

### 7.2 テンプレ作成・収集の方針

すべての同梱テンプレは **完全オリジナル制作**。手順:

1. 各テンプレを「教科書的にバランスの良い間取り」として一から作図
2. 寸法は住宅金融支援機構「フラット 35 対応住宅」標準仕様、国交省標準モデルプラン、
   建築設計実務書を参考に校正(特定物件の模倣ではない)
3. `metadata.template.license = "original"` で全件配布可能
4. `description` には「○○年代に多い〜」「定番の〜」等の **概念的説明** を入れ、
   特定物件名を出さない
5. 著作権チェックリスト:
   - [ ] 特定のハウスメーカー・設計事務所の作例を直接トレースしていない
   - [ ] 寸法・部屋構成は標準的な範囲内
   - [ ] 写真や独自意匠を流用していない
   - [ ] description に出典明記(参考文献の概念ベース)

ユーザーが新しいテンプレを共有したい場合の二次配布ガイドラインは、Phase 2 以降のコミュニティ機能で別途策定。

---

## 8. 隣接ルール

`src/data/adjacencyRules.ts` に `AdjacencyRule[]` として定義する。

```typescript
type AdjacencyRule = {
  id: string;                 // "toilet-kitchen-direct"
  pair: [string, string];     // RoomPreset.id × 2(順不同)
  relation: "direct-adjacent" | "shared-wall" | "door-connected";
  severity: ComplianceSeverity; // §5.9。基本 "info"
  message: string;            // ユーザー向け文言
  rule?: string;              // 出典(あれば)
};
```

判定:

- `direct-adjacent`: 2 部屋が共有壁を持つ(=境界が接する)。例: トイレ⇔キッチン直接隣接で `info`
- `shared-wall`: 共有壁でかつ間にドアがない。例: 寝室⇔玄関直接で `info`(緩衝が望ましい)
- `door-connected`: 共有壁でかつドアがある。例: LDK ドア接続なしのチェック等

評価結果は §5.9 `ComplianceWarning` に変換し、`category: "adjacency"` で集約する。

---

## 9. 画面構成

> **画面要素の Phase 出し分け:** 本章は **完成形(Phase 3 以降)を含む全体仕様**を記述する。
> 実際の UI に出すかは `featureFlag` でビルド時 / 実行時に切り替える:
>
> | 要素 | 表示開始 Phase |
> |---|---|
> | 部屋・壁・ドア・窓・寸法線・方位・PDF/PNG 出力・法規警告(採光/換気/廊下/避難) | Phase 1 |
> | 柱・PS のツールバーボタン / Properties セクション / 構造警告・設備警告のフィルタチップ | Phase 1.5 |
> | 2D/3D 切替ボタン・3D ビュー・3D 内編集モード・モーション仕上げ | Phase 2 |
> | 階数 spin・複数階タブ(1F/2F/3F)・階段ツール・商用テンプレ | Phase 3 |
>
> 各 §9.x のサブ仕様で個別の Phase 注記がある場合はそちらが正本。

### 9.1 画面一覧

| 画面 | パス | 役割 |
|---|---|---|
| ホーム | `/` | プロジェクト選択・新規作成 |
| テンプレート選択 | `/templates` | カード形式のテンプレ一覧 |
| 新規プラン作成ダイアログ | (モーダル) | プラン種別 → 起点 → 詳細オプションの 3 ステップ |
| エディタ | `/editor` | メイン編集画面 |
| 設定 | `/settings` | 単位、グリッドサイズ等 |

#### 9.1.1 新規プラン作成ダイアログ(3 ステップ)

「ホーム → 新しいプラン」から起動。§6.4 と整合した起点選択フロー。

**ステップ 1: プラン種別**

カードグリッドから 1 つ選択:

| カード | 内部 BuildingType | 表示開始 Phase |
|---|---|---|
| 🏠 一軒家 | `single-family` | Phase 1 |
| 🏢 マンション 1 住戸 | `condo-unit` | Phase 1 |
| 🏘 アパート 1 住戸 | `apartment-unit` | Phase 1 |
| 🏪 店舗 | `retail` | Phase 3 |
| 🏢 オフィス | `office` | Phase 3 |
| 🏨 ホテル(基準階 1 ユニット) | `hotel` | Phase 3 |
| 🏗 複合用途 | `mixed` | Phase 3 |

> Phase 1 の新規プラン作成ダイアログでは **住宅 3 種のみ表示**。商用 4 種(`retail` / `office` /
> `hotel` / `mixed`)は Phase 3 で開放する。これは §1.4 のターゲット(住宅検討者中心)と
> §11 のフェーズ計画と整合させるため。

**ステップ 2: 起点**

種別ごとに分岐:

- **一軒家**: 「テンプレから始める(8 種)」 / 「ゼロから描く」
- **マンション 1 住戸**: 「躯体テンプレから始める(11 種)」 / 「ゼロから描く(住戸外形をユーザー描画)」
- **アパート 1 住戸**: 「テンプレから始める(3 種)」 / 「ゼロから描く」
- **商用各種**: 「テンプレから始める」 / 「ゼロから描く」

ゼロから描くを選んだ場合、エディタに入った直後は「外形描画モード」になり、住戸 / 建物外形を
矩形ツール or ポリゴンツールで描く。描画完了後、自動的に通常編集モードに戻る。

**ステップ 3: 詳細オプション**

種別ごとの追加設定:

| 種別 | 設定項目 | 既定値 |
|---|---|---|
| 一軒家 | 階数 | **Phase 1 は 1 階固定**。Phase 3 で 2〜3 階建てを開放 |
| 一軒家 | 構造 | 木造在来 |
| 一軒家 | 柱を自動配置(910mm グリッド) | ON |
| マンション 1 住戸 | グリッドサイズ | 50mm 自由グリッド |
| アパート 1 住戸 | グリッドサイズ | 50mm 自由グリッド |
| 全種別 | プラン名 | (空欄) |
| 全種別 | 北方位の角度 | 0°(画面上が北) |

### 9.2 エディタ画面レイアウト(改訂、ミニマル方向)

```
┌─────────────────────────────────────────────────────────────┐
│  ◇ Plan                                       [2D] [3D] [⋯] │  ← トップバー
├─────────┬───────────────────────────────────┬───────────────┤
│         │                                   │               │
│  P L A N│                                   │  Properties   │
│  ───    │                                   │               │
│         │         Canvas                    │  ▎リビング     │
│  ▢ 部屋  │         (Konva)                  │     16.5 ㎡   │
│  /  壁   │                                   │   ┌────┐     │
│  ⌂ ドア  │                                   │   │ 🪟 │     │
│  ⊞ PS   │                                   │   └────┘     │
│  ─       │                                   │               │
│  Presets│                                   │  Floor        │
│  Living │                                   │   3LDK        │
│  Bedroom│                                   │   75.2 ㎡    │
│  ...    │                                   │               │
│         │                                   │  Compliance   │
│         │                                   │   ⚠ 1 warning │
├─────────┴───────────────────────────────────┴───────────────┤
│  Grid 910mm   Unit mm     N↑                          100% │
└─────────────────────────────────────────────────────────────┘
```

**ミニマル方向のポイント:**
- 装飾を排除、線・余白・タイポで構造化
- アイコンは lucide-react、線が細いもの
- アクセント色は1つだけ(青系を想定、`#3B82F6` 系)
- 警告は赤ではなく **琥珀色** を使う(主張しすぎない)
- パネル背景は `#FAFAFA`、選択は `#F0F0F0`、線は `#E5E5E5`
- 数値は JetBrains Mono、ラベルは Inter

### 9.3 主要インタラクション

| 操作 | 動作 |
|---|---|
| 左サイドバーの部屋プリセットをドラッグ | キャンバスに新規部屋を配置 |
| 部屋をクリック | 選択、右サイドバーにプロパティ表示 |
| 部屋をドラッグ | 移動、リアルタイムでスナップ候補表示 |
| 部屋の辺をドラッグ | リサイズ |
| 部屋を右クリック | コンテキストメニュー |
| `Ctrl+Z` / `Ctrl+Shift+Z` | アンドゥ / リドゥ |
| `Delete` キー | 選択中要素を削除 |
| マウスホイール | ズーム |
| 中クリックドラッグ / Space + ドラッグ | パン |
| **`G`** | グリッド ON/OFF |
| **`N`** | 方位設定モード |
| **`W`** | 壁モード(壁種別を順に切替) |
| **`Tab`** | 2D/3D 切替 |

### 9.4 3D ビューレイアウト

```
┌─────────────────────────────────────────────────────────────┐
│  ◇ Plan                                       [2D] [3D] [⋯] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                  3D Viewport                                │
│              (Three.js Canvas)                              │
│                                                             │
│                                                             │
│                                                             │
│  ┌───────────┐                                             │
│  │ Camera    │                              ┌────────────┐ │
│  │ Walk      │                              │ Sun        │ │
│  │ Orbit     │                              │ ▶ 14:00   │ │
│  │ Top       │                              │ ▶ Spring   │ │
│  └───────────┘                              └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

3D モードでは UI を最小化、フローティングコントロールに集約。

---

### 9.5 操作フロー詳細(全 15 操作)

実装に必要な操作の遷移を体系化。各操作は同じ枠組みで記述:
**トリガー → 進行中(中間状態)→ 確定 → キャンセル → エッジケース**。

#### 9.5.1 部屋を新規配置(プリセットからドラッグ&ドロップ)

| フェーズ | 動作 |
|---|---|
| トリガー | 左サイドの部屋プリセットアイコンを **mousedown** |
| 進行中 | ゴーストプレビュー(半透明 60%、preset の `defaultSize`)がカーソルに追従。グリッド ON 時は 910mm にスナップ表示。他部屋との重なりは半透明赤、非重なりは半透明アクセント色 |
| 確定 | キャンバス内で **mouseup** + 重なりなし → 部屋確定、選択状態に。スナップ候補があれば 120ms オーバーシュートで吸着 |
| キャンセル | キャンバス外で mouseup / Esc キー → 配置取消、ゴースト消滅 |
| エッジケース | 重なり位置で mouseup → ゴーストが元のプリセット位置に 200ms ease-out で戻る、トースト「重なる位置には配置できません」 |

#### 9.5.2 部屋を移動(既存部屋のドラッグ)

| フェーズ | 動作 |
|---|---|
| トリガー | 部屋本体を **mousedown**(辺の 8px 内側は対象外、辺はリサイズ用) |
| 進行中 | 部屋にソフトシャドウ(blur 8px、opacity 0.15)、半透明 80%。スナップ候補は薄破線でプレビュー、寸法ガイドが他部屋との距離を表示 |
| 確定 | mouseup → 重なりなしで確定、スナップがあれば 120ms 吸着 |
| キャンセル | Esc キー → 元位置に 200ms ease-out で戻る |
| エッジケース | 固定壁(`isLocked`)を含む部屋はドラッグ不可。ドラッグ試行時は壁が振動アニメ(80ms × 3 回、±2px)で拒否を表現 |

#### 9.5.3 部屋をリサイズ(辺ドラッグ)

| フェーズ | 動作 |
|---|---|
| トリガー | 部屋の辺(8px 内側 + 外側)を **mousedown**。カーソルが `ew-resize` / `ns-resize` に変わる |
| 進行中 | 辺がアクセント色にハイライト、変更中の寸法値が辺の中央に追従表示。最小サイズ(`preset.minSize`)に達するとそれ以上縮まない(視覚的にロック表示)|
| 確定 | mouseup → スナップ吸着、`runLegalChecks()` debounce 起動 |
| キャンセル | Esc キー → 元寸法に戻る |
| エッジケース | 共有壁を持つ辺をドラッグ → 隣接部屋の壁も連動して動く(伝播)。連動先の部屋が `minSize` を割る場合は伝播を止め、「隣接部屋がこれ以上縮められません」のヒント表示 |

#### 9.5.4 部屋を回転

| フェーズ | 動作 |
|---|---|
| トリガー | 選択中の部屋の四隅外側に表示される回転ハンドル(円形)を **mousedown** |
| 進行中 | カーソル位置と部屋中心を結ぶ角度で回転。**Phase 1 は 90° スナップのみ**(0 / 90 / 180 / 270、`Shift` 自由回転は無効化)。**Phase 2 以降は 15° スナップ + `Shift` で 1° 自由回転**(§6.3 の判定が SAT/OBB に切り替わるのとセット) |
| 確定 | mouseup |
| キャンセル | Esc キー |
| エッジケース | 回転後に他部屋と重なる場合 → 半透明赤で警告。mouseup で重なりが残る場合は元の角度に戻す。Phase 1 では SAT を呼ばずに AABB で済むよう、回転角を 90° 倍数に正規化してから判定する |

#### 9.5.5 要素を削除

| フェーズ | 動作 |
|---|---|
| トリガー | 選択中に **Delete / Backspace** キー、またはコンテキストメニュー「削除」 |
| 進行中 | (なし、即時)|
| 確定 | 即削除。アンドゥ可能。共有壁の場合は隣接部屋の壁を再生成(connectivity 再計算) |
| キャンセル | Ctrl+Z |
| エッジケース | 構造柱・耐力壁の削除時 → 確認ダイアログ「この耐力壁を削除すると構造警告が出ます。続けますか?」(Cancel / 削除する)。マンション固定壁は削除不可、振動アニメで拒否 |

#### 9.5.6 壁を直接描く(壁ツール)

| フェーズ | 動作 |
|---|---|
| トリガー | 左ツールバー「壁」を選択 → カーソルが十字に変わる |
| 進行中 | 1 回目クリック = 始点。マウス移動でラバーバンド(始点 → カーソル)を表示。グリッド・既存壁端点に 8px 内でスナップ。続けてクリックすると折れ線で繋がる |
| 確定 | ダブルクリック / Enter / 既存壁端点クリック → 描画完了、ツール継続 |
| キャンセル | Esc → 描画中の線を破棄、ツールから抜ける |
| エッジケース | 壁交差時は自動で頂点を分割。同位置の重複壁は警告し、後勝ちで採用 |

#### 9.5.7 住戸外形を描く(マンション 1 住戸ゼロ起点モード)

| フェーズ | 動作 |
|---|---|
| トリガー | 新規プラン作成で「マンション 1 住戸 → ゼロから描く」選択 → エディタ起動と同時に外形描画モードに入る |
| 進行中 | 矩形ツール(既定)/ ポリゴンツールを選べる。矩形は 2 点クリックで対角指定。ポリゴンは複数クリックで頂点指定。50mm 自由グリッドにスナップ |
| 確定 | 矩形は 2 点目クリックで確定。ポリゴンは始点に戻るか Enter で閉路化。閉じた形状のすべての辺が `wallType: "exterior"` の固定壁として登録 |
| キャンセル | Esc → 外形描画モードを抜けて空キャンバスに戻る(再度モードに入るには `9.1.1` から) |
| エッジケース | 自己交差ポリゴンは確定不可、最後のクリックを取消して再試行を促す。3 点未満で Enter は無視 |

#### 9.5.8 ドアを配置

| フェーズ | 動作 |
|---|---|
| トリガー | 左ツールバー「ドア」を選択 → カーソルがドアアイコンに |
| 進行中 | 壁にホバー → 壁の中央にドア候補プレビュー(`defaultWidth: 800mm`、開閉軌跡 1/4 円)。マウス移動で壁上を滑り、ホバー中は壁色アクセント |
| 確定 | クリック → ドア確定。`positionRatio` は壁長に対する比率で保存(壁長変化に追従) |
| キャンセル | Esc / 別ツール選択 |
| エッジケース | 既存ドアと 200mm 以内の位置はクリック無効(警告ヒント)。壁長 < 800mm の壁にはドアを置けない(壁が薄赤フィードバック) |

#### 9.5.9 窓を配置

ドア配置(9.5.8)と同型のフロー。差分のみ:

- **Phase 1**: 既定サイズ 1690×1170mm の引違い 2 枚を置く。配置直後の Properties では
  `width / height / type / sillHeight` を **数値・dropdown で直接編集**(規格選択 UI は出さない)
- **Phase 2 から**: 既定サイズは §5.8 の主要サッシ規格(YKK AP / LIXIL)から最大フィットを
  自動選択。配置直後、Properties パネルで **サッシ規格(製品コード)を変更可能** になる
- 外周壁(`wallType: "exterior"`)以外には警告(間仕切り壁の窓は info 警告)

#### 9.5.10 柱を配置・削除(**Phase 1.5 から有効**)

| フェーズ | 動作 |
|---|---|
| トリガー | 左ツールバー「柱」を選択 |
| 進行中 | カーソルに柱(105×105mm)プレビューが追従。910mm グリッド交点に 50px 内でスナップ |
| 確定 | クリック → 柱確定 |
| キャンセル | Esc |
| 削除 | 配置済み柱をクリック選択 → Delete。一軒家の隅・耐力壁交点の柱削除時は構造 info 警告 |

#### 9.5.11 PS を配置(**Phase 1.5 から有効**)

| フェーズ | 動作 |
|---|---|
| トリガー | 左ツールバー「PS」を選択 |
| 進行中 | カーソルに PS(既定 600×600mm)プレビュー。50mm 自由グリッドにスナップ |
| 確定 | クリック → PS 確定。Properties パネルでサイズ・接続系統(給水/排水/ガス/換気)を選択 |
| キャンセル | Esc |
| エッジケース | 部屋の内部に PS を置こうとすると半透明赤(部屋外周への配置を促す)|

#### 9.5.12 寸法値を編集(直接入力)

| フェーズ | 動作 |
|---|---|
| トリガー | 寸法線の数値テキストを **ダブルクリック** |
| 進行中 | 数値が input フィールドに変わる、現在値を全選択状態でフォーカス |
| 確定 | Enter / Tab / フィールド外クリック → 入力値を `parseInt` し、対応する辺・部屋の寸法を更新。連動寸法は伝播(§9.5.3 と同じ伝播ルール) |
| キャンセル | Esc → 元の値に戻す |
| エッジケース | 入力値が `minSize` を下回る or 整数でない → 入力フィールドが赤枠、確定不可。最大値は建物外形を超えない範囲 |

#### 9.5.13 複数選択

| フェーズ | 動作 |
|---|---|
| トリガー | 空白部からドラッグ → 矩形選択。または `Shift + クリック` で個別追加 |
| 進行中 | 矩形選択中は破線の選択ボックスを表示、中に完全に含まれる要素がプレビューハイライト |
| 確定 | mouseup → ボックス内の全要素を選択状態に |
| 解除 | 空白クリック / Esc |
| エッジケース | 部分的に重なる要素は選択しない(完全包含のみ)。`Shift + ドラッグ` で既存選択に追加 |

#### 9.5.14 コピー & ペースト

| フェーズ | 動作 |
|---|---|
| トリガー | 選択中に `Ctrl+C` / `Cmd+C` → クリップボード(アプリ内、JSON シリアライズ)に保存 |
| ペースト | `Ctrl+V` → カーソル位置に複製、新 ID 採番、選択状態でドラッグ追従(配置確定は 9.5.1 と同じ) |
| 切り取り | `Ctrl+X` → コピー + 元削除 |
| エッジケース | 共有壁を含む部屋のコピーは、共有壁を独立壁(`partition`)に変換してから複製。固定壁(マンション戸境壁等)はコピー対象外、警告ヒント |

#### 9.5.15 整列・配置揃え

| フェーズ | 動作 |
|---|---|
| トリガー | 複数選択中にコンテキストメニュー「整列」、または右ペインの整列ボタン群 |
| 種類 | 左揃え / 右揃え / 上揃え / 下揃え / 水平中央 / 垂直中央 / 等間隔水平 / 等間隔垂直 |
| 確定 | クリック → 即時適用(プレビューなし)、120ms ease-out で位置が動く |
| キャンセル | Ctrl+Z |
| エッジケース | 整列後に重なりが発生する場合 → 整列を打ち消し、トースト「整列できませんでした(重なりが発生します)」 |

---

### 9.6 左サイドバー(ツールバー)全アイテム

幅 240px の固定パネル。**ツール / プリセット / 表示切替** の 3 段構成。

#### 9.6.1 ツールセクション(上段、約 50px)

10 個のツール。アイコンは **lucide-react** から選定(§14.7 参照)。クリック or ショートカットでアクティブ化。

| # | ツール | アイコン | ショートカット | 動作 | 関連フロー |
|---|---|---|---|---|---|
| T1 | 選択 | `MousePointer2` | `V` | 既定。要素の選択・移動・リサイズ | §9.5.2〜5 |
| T2 | 部屋(プリセット適用) | `Square` | `R` | 部屋プリセットを適用してドラッグ配置 | §9.5.1 |
| T3 | 壁 | `Slash` | `W` | フリー壁描画(直線・折れ線) | §9.5.6 |
| T4 | 外形 | `Square` 太線 | `Shift+W` | 矩形 / ポリゴンで建物外形描画 | §9.5.7 |
| T5 | ドア | `DoorOpen` | `D` | 壁にドア配置 | §9.5.8 |
| T6 | 窓 | `RectangleHorizontal` | `X` | 壁に窓配置 | §9.5.9 |
| T7 | 柱 | `Square` 塗 | `C` | 柱配置 | §9.5.10 |
| T8 | PS | `Box` | `P` | パイプスペース配置 | §9.5.11 |
| T9 | 寸法 | `Ruler` | `M` | 寸法線追加(ユーザー指定の 2 点間)| 詳細は §9.6.3 |
| T10 | パン | `Hand` | `H` / `Space` 押下 | キャンバス移動 | (常時 Space ホールドで一時的に有効) |

選択中のツールは **アクセント色背景 + アイコン色反転** で視覚化。Esc で T1(選択)に戻る。

#### 9.6.2 プリセットセクション(中段、可変高さ)

T2(部屋ツール)が選択中、または T1 状態でも常時表示される **部屋プリセットギャラリー**。

| 要素 | 仕様 |
|---|---|
| 検索ボックス | 上部、`MagnifyingGlass` アイコン、placeholder「部屋を検索」、インクリメンタルフィルタ |
| カテゴリタブ | 横並び、活性 1 つのみ。`居室 / 水回り / 動線 / 収納 / 屋外 / 商用` の 6 タブ(§7 のカテゴリを統合) |
| プリセットカード | 横 2 列グリッド。各カードは 96×64px、上部にミニアイコン(畳・浴槽など)、下部に名前と既定サイズ |
| ドラッグ起動 | カードを mousedown → §9.5.1 の新規配置フローに入る |
| ホバー | 200ms 遅延でツールチップ「リビング / 4550×3640mm / 16.5㎡」 |

#### 9.6.3 表示切替セクション(下段、約 36px × N)

トグルスイッチ群。状態は `localStorage.viewSettings` に永続化。

| # | 切替 | アイコン | ショートカット | 既定 | 効果 |
|---|---|---|---|---|---|
| V1 | グリッド表示 | `Grid3x3` | `G` | ON | 背景グリッド線(§5.1 `gridSize` で間隔)|
| V2 | スナップ吸着 | `Magnet` | `S` | ON | スナップ判定の有効化(OFF で 1mm 自由配置) |
| V3 | 寸法表示 | `Ruler` | `Shift+D` | ON | 部屋・壁・開口部の寸法線 |
| V4 | 部屋名表示 | `Type` | `Shift+L` | ON | 部屋中央のラベル |
| V5 | 壁種別カラー | `Layers` | `Shift+W` | ON | 5 種の壁色を §14.3 の `--line-wall-*` で塗分 |
| V6 | 警告表示 | `AlertTriangle` | `Shift+1` | ON | 法規警告の下線・アイコン |
| V7 | 方位グリッド | `Compass` | `Shift+N` | OFF | 太陽方向の影グリッド(Phase 2 連動)|
| V8 | 仕上げ色プレビュー | `Palette` | `Shift+M` | OFF | 2D でも床・壁仕上げの色を簡易表示 |

寸法ツール(T9)の追加仕様: 任意の 2 点をクリックで結ぶカスタム寸法線を追加できる。要素削除時はリンクされた寸法線も連動削除。

---

### 9.7 右サイドバー(Properties パネル)全項目

幅 280px の固定パネル。**選択中の要素種別** に応じて内容が動的に切り替わる。
複数選択時は共通プロパティのみ編集可、種別が混在する場合は集計表示。

#### 9.7.1 何も選択していない時(プラン全体)

| セクション | 項目 | 編集 |
|---|---|---|
| **基本情報** | プラン名 | inline edit |
|  | 種別(BuildingType) | 表示のみ(変更は新規プラン作成から) |
|  | 構造(`structureType`) | dropdown(木造/鉄骨/RC/SRC) |
|  | 階数 | **Phase 1 は 1 階固定**(spin disabled)。Phase 3 で 1〜3 階(住宅)/ 最大 5 階(商用)に開放 |
| **寸法** | 延床面積 | 表示(自動計算)、㎡/坪/帖の3表示切替 |
|  | LDK 表記 | 表示(自動) |
|  | 建物外接矩形 | 表示(`w × h mm`) |
| **方位** | 北方位角 | スライダー(0〜359°)+ 数値入力 |
| **グリッド** | グリッドサイズ | dropdown(910 / 455 / 50mm 自由) |
|  | 表示単位 | dropdown(mm / 帖 / ㎡ / 坪) |
| **法規警告サマリ** | 件数 | 「⚠ 3 warnings, 5 info」※ §6.6.5 のフィルタ反映 |
|  | カテゴリ別 | 折りたたみリスト(クリックで該当要素にパン) |

#### 9.7.2 部屋を選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **基本** | プリセット | dropdown(変更可、`utilityRequirements`等が連動更新) |
|  | カスタム名(任意)| inline edit、空欄ならプリセット名 |
| **位置** | x, y | 数値入力(整数 mm)|
|  | 回転 | **Phase 1: セグメント選択(0 / 90 / 180 / 270 の 4 ボタン)**。Phase 2 以降: スライダー(0〜359°、15° スナップ)+ 数値入力 |
| **寸法** | 幅 × 奥行 | 数値入力 + ロック(リサイズ時の比率固定)|
|  | 面積(壁芯) | 表示 |
|  | 面積(内法) | 表示 |
|  | 単位切替 | ㎡ / 帖 / 坪 |
| **仕上げ材**(§5.10) | 床 | パレット選択(`MaterialId`)|
|  | 天井 | 同上 |
|  | 壁(部屋全周一括) | 同上、壁単位の上書きあれば「カスタム」表示 |
| **隣接** | 隣接部屋一覧 | リスト(クリックで隣接要素にパン)|
| **設備**(**Phase 1.5 から表示**) | PS までの距離 | 表示(水回り部屋のみ、`equipment` チェック連動)。Phase 1 ではセクションごと非表示 |
| **アクション** | 複製 | ボタン(Ctrl+D) |
|  | 削除 | ボタン(赤文字) |

#### 9.7.3 壁を選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **種別** | `wallType` | radio(exterior / load-bearing / shared / partition / non-bearing)|
|  | `isLocked` | toggle(マンション固定壁は readonly) |
| **寸法** | 厚み | 数値入力(初期値は壁種別ごと: 外壁 150 / 耐力 120 / 間仕切 100mm) |
|  | 長さ | 表示(自動) |
|  | 始点 / 終点 | 数値入力(整数 mm)|
| **仕上げ**(§5.10) | 内側 | パレット選択 |
|  | 外側 | 同上(`isExterior` のみ) |
| **共有関係** | 共有先部屋 | リスト(共有壁のみ)|
| **アクション** | 反転(裏表入れ替え) | ボタン |
|  | 削除 | ボタン(耐力壁・固定壁削除時は §9.5.5 の確認) |

#### 9.7.4 ドアを選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **基本** | 種類 | dropdown(片開き / 両開き / 引戸 / 折戸 / 自動扉) |
|  | 幅 | 数値入力(規格: 600/700/750/800/850/900mm の dropdown + 自由)|
|  | 高さ | 数値入力(既定 2000mm)|
| **位置** | 設置壁 | 表示(壁 ID)|
|  | 壁上の位置(中央 / 左 / 右 / 比率) | スライダー or 数値入力(`positionRatio`)|
| **開き方** | 開閉方向 | 矢印クリックで切替(壁の表/裏 + 左/右の 4 通り)|
|  | 開閉軌跡半径 | 自動(幅と同値)|
| **意匠**(§5.10 DoorDecoration) | スタイル | パレット選択(木フラット / ガラス框 / 引戸格子 等) |
| **アクション** | 削除 | ボタン |

#### 9.7.5 窓を選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **規格(§5.8 SashStandard)**(**Phase 2 から表示**)| メーカー | dropdown(YKK AP / LIXIL / Sankyo Tateyama)。Phase 1 はセクションごと非表示 |
|  | 製品コード | dropdown(規格表から選択)|
|  | 種類 | 表示(引違い / 片開き / 上げ下げ / FIX、規格に紐付き)|
| **寸法**(Phase 1 から表示) | 種類(`type`) | dropdown(`fixed` / `sliding-2` / `casement` 等)|
|  | 幅 × 高さ | Phase 1: 数値入力(50mm 単位)。Phase 2: 規格選択で自動、自由値入力時は規格外として警告 + `sashId` を外す(§5.8.3) |
|  | 腰高(`sillHeight`)| 数値入力 |
| **位置** | 設置壁 | 表示 |
|  | 壁上の位置 | `positionRatio` |
| **意匠**(§5.10 WindowDecoration)(**Phase 2 から表示**)| カーテン | dropdown(なし / ドレープ / レース / ブラインド / ロール)+ 色 |
| **法規連動** | 採光有効面積 | 表示(`runLegalChecks` 出力)|
|  | 換気有効面積 | 表示 |
| **アクション** | 削除 | ボタン |

#### 9.7.6 柱を選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **基本** | 寸法(w × h) | dropdown(105×105 / 120×120 / 150×150)|
|  | 位置 | 数値入力 |
|  | `isLocked` | toggle(マンション躯体由来は readonly)|
| **属性** | 通し柱フラグ | toggle(2 階建ての一軒家のみ。**Phase 3 から表示**、複数階対応とセット)|
|  | 構造 | 表示(`single-family`なら木造、`condo-unit`なら RC など)|
| **アクション** | 削除 | ボタン(構造 info 警告連動) |

#### 9.7.7 PS を選択時

| セクション | 項目 | 編集 |
|---|---|---|
| **基本** | 寸法(w × h) | 数値入力(既定 600×600mm、最小 300×300mm)|
|  | 位置 | 数値入力 |
|  | `isLocked` | toggle |
| **接続系統** | 給水 | toggle |
|  | 排水 | toggle |
|  | ガス | toggle |
|  | 換気(共通排気)| toggle |
|  | 電気幹線 | toggle |
| **連動表示** | 接続される水回り部屋 | リスト(8m 以内、`equipment` チェック連動)|
| **アクション** | 削除 | ボタン |

#### 9.7.8 複数選択時

| セクション | 項目 |
|---|---|
| **集計** | 部屋 N 個 / 壁 M 本 / 窓 K 個 ... の内訳 |
| **共通編集**(同種別のみ)| 種別が揃っている場合は共通プロパティを inline edit |
| **整列・配置揃え** | §9.5.15 のボタン群(8 種) |
| **アクション** | グループ化(将来拡張) / 複製 / 一括削除 |

#### 9.7.9 オーバーレイ:法規警告詳細

警告アイコンクリックで右ペインに **詳細パネルがオーバーレイ**(§6.6.5 の 2 タブ「現在 / ack 履歴」)。

| 項目 | 内容 |
|---|---|
| カテゴリアイコン + severity 色 | アイコン(lighting=`Sun` / ventilation=`Wind` / circulation=`ArrowRight` ...) |
| メッセージ | `"主寝室の採光面積が不足しています"` |
| 詳細 | `"建築基準法第28条第1項。床面積 13.2㎡ × 1/7 = 1.89㎡ 必要、現状 1.20㎡"` |
| 改善案 | `"窓を 0.7㎡ 拡張するか、開口部追加を検討してください"` |
| アクション | `[了解する(ack)] [該当要素にパン]` |

---

### 9.8 全画面 ASCII レイアウト

エディタ以外の画面を網羅。各画面は最大幅 1280px を基準にデスクトップレイアウトで設計、
タブレットへの圧縮ルールは §9.9(後述)で別途定義。

#### 9.8.1 ホーム画面 `/`

```
┌─────────────────────────────────────────────────────────────────┐
│  ◇ 間取りプランナー                              [⚙] [?] [👤] │  ← トップバー
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   こんにちは。今日は何を作りましょう。                            │  ← 大見出し(48px Inter 600)
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐    │
│   │   ＋     │  │   📁     │  │   🏠   テンプレから始める  │    │
│   │ 新しい   │  │ 開く     │  │   34 種類のテンプレート     │    │
│   │ プラン   │  │ (.json)  │  │   →                         │    │
│   └──────────┘  └──────────┘  └──────────────────────────┘    │
│                                                                 │
│ ─────────────────────────────────────────────────────────────  │
│                                                                 │
│   最近のプラン                                       [すべて表示]│  ← セクション(14px、uppercase、grayer)
│                                                                 │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│   │ サムネ │ │ サムネ │ │ サムネ │ │ サムネ │                │
│   │ 田中邸 │ │ 3LDK南 │ │ 平屋   │ │ 一人暮 │                │
│   │ 3LDK   │ │ 99㎡  │ │ 66㎡  │ │ 38㎡  │                │
│   │ 5/9    │ │ 5/8    │ │ 5/2    │ │ 4/15   │                │
│   └────────┘ └────────┘ └────────┘ └────────┘                │
│                                                                 │
│ ─────────────────────────────────────────────────────────────  │
│                                                                 │
│   始めるためのヒント                                              │
│   ・ 一軒家は柱の自動配置を使うと早い                            │
│   ・ マンションはテンプレから始めると躯体が固定される             │
│   ・ Tab キーで 2D/3D 切替                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**要素仕様:**
- カード 3 つ(新規 / 開く / テンプレ): 同じ高さ、ホバーで影が浮く
- 最近のプラン: 4 列グリッド(縦 2 行で最大 8 件表示、それ以上は「すべて表示」へ遷移)
- サムネは `Konva.toDataURL` で保存時に自動生成
- 空状態(プラン 0 件)では「最近のプラン」セクションを非表示、代わりにテンプレ提案を強調

#### 9.8.2 テンプレ選択画面 `/templates`

> **Phase 別の絞り込み(必須):** §11 Phase 1 不変条件(`floors.length === 1`)を破らないために、
> テンプレリストはアプリ層で **Phase 別にフィルタしてからレンダリング**する。
> Phase 1 で表示するテンプレは **`templates.filter(t => isPhaseEnabled(t, currentPhase))`** で絞り、
> Phase 3 以前のテンプレが UI に出現しない:
>
> | currentPhase | 表示するカテゴリ |
> |---|---|
> | Phase 1 / 1.5 | 一軒家(**平屋 3 種のみ**)+ マンション 11 種 + アパート 3 種 = **17 種** |
> | Phase 2 | 上記 + 一軒家の 2 階建・3 階建は **依然非表示**(複数階対応は Phase 3) |
> | Phase 3 | すべて(34 種、商用 + 2 階建以上の一軒家を含む) |
>
> サイドバーのカテゴリ件数(下図の「一軒家 (8)」等)は **絞り込み後の件数を表示**する
> (Phase 1 なら「一軒家 (3)」「商用」カテゴリは非表示)。`floors.length > 1` のテンプレを
> ロード経路から物理的に排除することで、Zod の `.length(1)` バリデーション失敗(§5.1.2)を
> ユーザーが踏まないようにする。

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  テンプレートから始める                            [✕]       │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│ カテゴリ     │  [🔍 検索]                                       │
│              │                                                  │
│ 🏠 一軒家(3) │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ 🏢 マンショ  │  │  サムネ  │ │  サムネ  │ │  サムネ  │        │
│   ン (11)   │  │          │ │          │ │          │        │
│ 🏘 アパー   │  │ 平屋1LDK│ │ 平屋2LDK│ │ 平屋3LDK│        │
│   ト (3)    │  │ 20坪    │ │ 25坪    │ │ 30坪    │        │
│              │  │ 66㎡   │ │ 83㎡   │ │ 99㎡   │        │
│ ─────────── │  │ 平屋    │ │ 平屋    │ │ 別荘風  │        │
│              │  └──────────┘ └──────────┘ └──────────┘        │
│ フィルタ     │                                                  │
│              │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ □ 平屋      │  │  ...     │ │  ...     │ │  ...     │        │
│              │  └──────────┘ └──────────┘ └──────────┘        │
│ LDK 数       │                                                  │
│ □ 1〜2      │                                                  │
│ □ 3〜4      │                                                  │
│ □ 5+         │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

> 上図は **Phase 1 / 1.5 の状態**。商用カテゴリは非表示、一軒家は平屋 3 種、
> 「2 階建て」「3 階建て」フィルタも非表示。Phase 3 で商用 12 種・2 階建以上の一軒家 5 種を解放し、
> 「一軒家 (8)」「商用 (12)」が出るようになる。

**要素仕様:**
- 左ペイン 240px 固定 + 右コンテンツ可変
- 検索: 名前 / tags / description にマッチ(インクリメンタル)
- カードクリック: プレビュー大表示モーダル(後述 §9.8.7)、確定で `/editor` に遷移
- カテゴリアイコンの数字は **Phase フィルタ後の同梱件数**(`templates.filter(isPhaseEnabled).length`)

#### 9.8.3 設定画面 `/settings`

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  設定                                              [完了]    │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│ 一般         │  単位                                             │
│ ▸ 表示      │   ○ メートル法(mm / ㎡)                         │
│   外観      │   ○ 帖中心(寸法 mm、面積 帖)                    │
│              │                                                  │
│ 編集         │  グリッドサイズ(既定値)                         │
│ ▸ 操作      │   [910mm ▼]   半間モジュール / 自由など           │
│   スナップ  │                                                  │
│              │  数値入力ステップ                                 │
│ 法規         │   [50mm ▼]                                       │
│ ▸ 警告      │                                                  │
│   再計算    │                                                  │
│              │ ─────────────────────────────────────────────── │
│ 3D ビュー   │                                                  │
│ ▸ 品質      │  外観テーマ                                       │
│   ライト   │   ○ ライト(既定)                                │
│              │   ○ ダーク(Phase 2)                            │
│ データ       │   ○ システムに合わせる                            │
│ ▸ 保存      │                                                  │
│   バックア  │                                                  │
│   ップ      │                                                  │
│              │                                                  │
│ アプリ情報   │                                                  │
│ ▸ ヘルプ    │                                                  │
│   このアプ  │                                                  │
│   リについ  │                                                  │
│   て        │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**設定項目の網羅:**

| カテゴリ | 設定 | UI |
|---|---|---|
| 一般 | 言語 | dropdown(日本語 / English [将来]) |
|  | 単位 | radio(mm / 帖優先 / 坪優先) |
| 表示 | グリッドサイズ既定値 | dropdown |
|  | 数値ステップ | dropdown |
|  | 寸法表示の桁 | dropdown(0 / 1 / 2 桁) |
|  | 部屋名のフォントサイズ | スライダー |
| 編集 | スナップ吸着距離 | スライダー(50〜400mm)|
|  | グリッド既定 ON/OFF | toggle |
|  | 警告再計算 | radio(`realtime / 300ms / 1000ms / manual`、§6.6.2)|
| 法規 | severity フィルタ既定 | radio(すべて / 警告のみ / 非表示)|
|  | ack 履歴の最大件数 | spin |
| 3D | 影の品質 | radio(低 / 中 / 高、Phase 2)|
|  | アンチエイリアス | toggle |
|  | ポストプロセス | toggle |
|  | 太陽位置の既定 | dropdown(春分 12:00 等)|
| データ | 自動保存間隔 | dropdown(無効 / 1 分 / 5 分)|
|  | プラン履歴上限 | spin |
|  | 全データを書き出し | ボタン |
|  | 全データを削除 | ボタン(赤、確認 2 段階)|
| アプリ情報 | バージョン | 表示 |
|  | このアプリについて | リンク → §9.8.5 |
|  | 免責事項を表示 | リンク → §1.6.2 全文 |
|  | ヘルプ | リンク → §9.8.4 |
|  | クレジット | リンク(3D アセット出典等) |

#### 9.8.4 ヘルプ画面 `/help`

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  ヘルプ                                            [✕]       │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│ ▸ はじめに   │  キーボードショートカット                          │
│  ▸ ツアー    │                                                  │
│              │  ┌────────────────────┬─────────────────────┐   │
│ ▸ 操作       │  │ ツール選択         │                     │   │
│  ▸ 部屋      │  ├────────────────────┼─────────────────────┤   │
│  ▸ 壁        │  │ V                  │ 選択ツール          │   │
│  ▸ ドア・窓 │  │ R                  │ 部屋ツール          │   │
│  ▸ 柱・PS   │  │ W                  │ 壁ツール            │   │
│              │  │ D                  │ ドアツール          │   │
│ ▸ ショート   │  │ X                  │ 窓ツール            │   │
│   カット     │  │ ...                │ ...                 │   │
│              │  └────────────────────┴─────────────────────┘   │
│ ▸ 法規       │                                                  │
│  ▸ 採光      │  編集                                             │
│  ▸ 換気      │  Ctrl+Z      アンドゥ                            │
│  ▸ 廊下幅   │  Ctrl+Shift+Z  リドゥ                            │
│              │  Ctrl+C       コピー                              │
│ ▸ 出力       │  Ctrl+V       ペースト                            │
│  ▸ PDF       │  Ctrl+S       保存                                │
│  ▸ 画像     │  ...                                              │
│              │                                                  │
│ ▸ よくある   │                                                  │
│   質問      │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**コンテンツ構成:**
- 左ペイン 240px のツリーナビゲーション、選択章をハイライト
- 右コンテンツは Markdown ベースの静的ドキュメント
- ショートカット一覧は §9.6.1 / §9.5 から自動生成
- 各章末に「関連: 〜」のリンクで章間を結ぶ
- ⌘+/ で検索ボックスにフォーカス

#### 9.8.5 About / アプリについて(モーダル)

```
        ┌─────────────────────────────────────┐
        │  間取りプランナー                   │
        │  v1.0                               │
        ├─────────────────────────────────────┤
        │                                     │
        │  ロゴ                                │
        │                                     │
        │  個人開発のオープンソース             │
        │  間取り設計ツール                     │
        │                                     │
        │  [ライセンス] [ソースコード]         │
        │                                     │
        │  ─────────────────────────────────  │
        │                                     │
        │  免責事項                           │
        │                                     │
        │  本アプリは個人開発のオープンソース │
        │  ツールであり、建築士・建築設計事務 │
        │  所による監修は受けていません。     │
        │  ...(§1.6.2 全文)                 │
        │                                     │
        │  ─────────────────────────────────  │
        │                                     │
        │  クレジット                         │
        │  ・ 3D アセット: Poly Haven 他      │
        │  ・ アイコン: lucide                │
        │  ...                                │
        │                                     │
        │                            [閉じる] │
        └─────────────────────────────────────┘
```

#### 9.8.6 エクスポート / インポートダイアログ(モーダル)

##### エクスポート

```
        ┌─────────────────────────────────────┐
        │  エクスポート                  [✕] │
        ├─────────────────────────────────────┤
        │                                     │
        │   ◯ プラン全体(.floorplan.json)   │  ← ラジオ
        │     互換: バージョン 1.0            │
        │                                     │
        │   ◯ PDF                            │
        │     [A3 横 ▼] [縮尺 自動 ▼]       │
        │     ✓ 平面図(全階) ✓ 警告サマリ │
        │     □ 3D ビューを含める            │
        │                                     │
        │   ◯ 画像(PNG、現在のビュー)       │
        │     [4x ▼] 高解像度                │
        │                                     │
        ├─────────────────────────────────────┤
        │              [キャンセル] [書き出す]│
        └─────────────────────────────────────┘
```

##### インポート

```
        ┌─────────────────────────────────────┐
        │  インポート                    [✕] │
        ├─────────────────────────────────────┤
        │                                     │
        │   ┌─────────────────────────────┐  │
        │   │                             │  │
        │   │      ファイルをドロップ     │  │
        │   │      または                 │  │
        │   │      [ファイルを選ぶ]      │  │
        │   │                             │  │
        │   └─────────────────────────────┘  │
        │                                     │
        │   .floorplan.json のみ対応          │
        │                                     │
        │   ─────────────────────────────    │
        │                                     │
        │   検証中...(プログレスバー)        │
        │   1. JSON 構文        ✓             │
        │   2. スキーマ検証     ✓             │
        │   3. マイグレーション  ✓ (1.0 のまま) │
        │   4. 整合性チェック    ⚠ (警告 2 件) │
        │                                     │
        ├─────────────────────────────────────┤
        │                            [開く]   │
        └─────────────────────────────────────┘
```

#### 9.8.7 テンプレートプレビュー(モーダル)

```
        ┌────────────────────────────────────────────┐
        │  平屋 3LDK 30 坪 別荘風                [✕] │
        ├────────────────────────────────┬───────────┤
        │                                │           │
        │                                │  情報     │
        │       大きなプレビュー         │           │
        │       (2D 平面図)             │  延床: 99㎡│
        │                                │  LDK: 3LDK│
        │                                │  階数: 1階│
        │                                │  ─────── │
        │                                │           │
        │                                │  ◯ 南向き │
        │                                │  ◯ 平屋  │
        │                                │  ◯ 別荘  │
        │                                │  ◯ 広土間 │
        │                                │           │
        │                                │  説明     │
        │                                │           │
        │                                │  週末住宅・│
        │                                │  郊外向け  │
        │                                │  の平屋。  │
        │                                │  広土間と │
        │                                │  ...      │
        │                                │           │
        ├────────────────────────────────┴───────────┤
        │              [キャンセル] [このテンプレで開始] │
        └────────────────────────────────────────────┘
```

#### 9.8.8 起動・ローディング

##### スプラッシュ画面(初回起動 or 大規模ファイル読込時)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                                                             │
│                       ◇                                     │
│                                                             │
│                  間取りプランナー                            │
│                                                             │
│                                                             │
│                                                             │
│              [────────────────●─────] 読み込み中...        │
│              プリセットを読み込んでいます                    │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

進捗ステップ表示:
- プリセットを読み込んでいます…
- 隣接ルールを読み込んでいます…
- 過去のプランを確認しています…
- 準備が整いました

通常起動時(2 秒未満で完了)は省略。500ms 以上かかった場合のみ表示し、Skeleton UI を経由してフェードアウト。

#### 9.8.9 初回同意ダイアログ(§1.6.1 連動)

```
        ┌─────────────────────────────────────┐
        │  はじめに                           │
        ├─────────────────────────────────────┤
        │                                     │
        │  間取りプランナーは個人開発の        │
        │  オープンソースツールです。          │
        │                                     │
        │  ▸ 法規警告は参考情報です           │
        │  ▸ 実施には建築士の確認を要します   │
        │  ▸ 利用による損害の責任は負いません │
        │                                     │
        │  全文を表示する ▾                   │
        │                                     │
        ├─────────────────────────────────────┤
        │                  [同意して開始]     │
        └─────────────────────────────────────┘
```

同意状態は `localStorage.disclaimerAcceptedAt` に保存。バージョン更新で免責文が変わった場合は再表示。

---

### 9.9 状態のバリエーション(画面・要素ごと)

UI は文脈で見た目が変わる。各状態の見た目とユーザーへのメッセージを統一して定義する。

#### 9.9.1 エディタキャンバスの 12 状態

| # | 状態 | キャンバスの見た目 | カーソル | 補助 UI |
|---|---|---|---|---|
| S1 | 空キャンバス | グリッド線のみ。中央にプレースホルダー「左サイドからドラッグするか、`R` キーで部屋ツール」 | default | 中央にゴーストアウトラインで「クリックで配置」のヒント |
| S2 | 部屋ドラッグ配置中 | プリセットのゴーストがカーソル追従、半透明 60% | grabbing | スナップ候補は破線、重なりは半透明赤、寸法が他要素との距離を出す |
| S3 | 単一要素選択中 | 選択要素にアクセント色アウトライン(2px 実線)、リサイズハンドル表示 | default | 右ペインが該当 §9.7.2〜7 に変化 |
| S4 | 複数選択中 | 全選択要素にアウトライン、外接矩形が薄破線 | default | 右ペインが §9.7.8 集計に変化 |
| S5 | 移動ドラッグ中 | 選択要素半透明 80% + ソフトシャドウ | grabbing | スナップ候補プレビュー、寸法ガイド |
| S6 | リサイズ中 | 操作中の辺がアクセント色強調、寸法値が辺の中央に追従 | ew/ns-resize | minSize 到達でロックアイコン表示 |
| S7 | 回転中 | 元の位置にゴースト、回転後の位置をアクセント色で表示 | grabbing | 角度値を中央に大表示。**Phase 1 は 0 / 90 / 180 / 270 の段階表示**、Phase 2 以降は 0〜359°・15° スナップで微振動 |
| S8 | 壁にホバー(壁モード時) | 壁が薄くハイライト、長さラベルが追従 | crosshair | ステータスバーに「クリックで開口部配置」 |
| S9 | スナップ吸着可能 | 吸着先の壁がアクセント色で太く強調、対応する自分の辺が呼応強調 | grabbing | 吸着位置に薄破線で「スナップ後の形」プレビュー |
| S10 | 警告表示中 | 該当要素にカテゴリアイコンのバッジ、severity 色の下線(warning=琥珀 / info=灰)| - | 右ペインの法規警告サマリで件数バッジ |
| S11 | パン中 | キャンバスはそのまま、視点だけ移動。グリッド原点が動く | grab | ステータスバーに座標表示が追従 |
| S12 | ロード中 | スケルトン UI(部屋形状のシルエットのみグレーで)→ 順次フェードイン | progress | ローディングスピナーが右下に小さく |

#### 9.9.2 ホーム画面の状態

| # | 状態 | 表示内容 |
|---|---|---|
| H1 | 初回起動(プラン 0 件 + 同意未完了)| 同意ダイアログを最初に出す(§9.8.9)、その後ホーム画面 + 「最近のプラン」セクションは非表示、テンプレ提案を強調 |
| H2 | 初回後・プラン 0 件 | 「最近のプラン」非表示、空状態の励まし「最初のプランを作りましょう」 |
| H3 | 通常(1 件以上) | §9.8.1 の標準レイアウト |
| H4 | ロード中(プラン一覧取得) | カードのスケルトン(4 つのプレースホルダー、shimmer アニメ) |
| H5 | データ取得失敗 | エラーカード「最近のプランを取得できませんでした」 + リトライボタン |

#### 9.9.3 Properties パネルの状態

| # | 状態 | 見た目 |
|---|---|---|
| P1 | 何も選択していない | プラン全体情報(§9.7.1) |
| P2 | 単一選択(部屋・壁・等)| 該当する §9.7.2〜7 |
| P3 | 複数選択(同種別)| §9.7.8 + 共通プロパティ編集可 |
| P4 | 複数選択(混在)| §9.7.8 集計のみ、共通プロパティ非表示 |
| P5 | 警告詳細表示中 | §9.7.9 がオーバーレイ、× で元の P1〜P4 に戻る |
| P6 | プロパティ計算中 | 値が `−` → ローディングスピナー → 確定値にフラッシュ(150ms)|

#### 9.9.4 法規警告パネルの状態

| # | 状態 | 表示 |
|---|---|---|
| W1 | 警告 0 件 | 「すべて適合しています」+ チェックマーク(緑系)|
| W2 | warning が 1 件以上 | カテゴリ別カード、severity 色のバッジ |
| W3 | info のみ | 控えめな表示、サマリは折りたたみ |
| W4 | フィルタで 0 件 | 「フィルタ条件に一致する警告はありません」+ フィルタ解除ボタン |
| W5 | ack 履歴タブ | ack 済みカード、各カードに「再表示」ボタン |
| W6 | 計算中 | サマリの数値が `−`、再計算スピナー(右上)|

#### 9.9.5 保存状態(全画面共通インジケータ)

ヘッダーの右上に小さいインジケータを常時表示。

| 状態 | アイコン | テキスト | 動作 |
|---|---|---|---|
| 保存済み | `Check` 緑 | "保存済み (HH:MM)" | 静的 |
| 未保存の変更あり | `Edit3` グレー | "未保存" | 5 秒以上未保存だと点滅(微細) |
| 自動保存中 | `Loader2` 回転 | "保存中..." | スピナー、500ms 以上で表示 |
| 自動保存失敗 | `AlertCircle` 警告色 | "保存できません" | クリックで詳細モーダル(§9.9.6 ER1) |
| オフライン | `WifiOff` グレー | "オフライン" | localforage は機能継続、クラウド同期(将来)は休止 |

#### 9.9.6 エラー状態(モーダル / トースト)

| ID | 状況 | 表示形式 | 文言例 | 復旧アクション |
|---|---|---|---|---|
| ER1 | localforage への保存失敗(容量不足等)| モーダル | "保存できませんでした。ブラウザの空き容量を確認してください。" | [詳細を見る] / [JSON で書き出す] / [閉じる] |
| ER2 | ファイルインポートで JSON 構文エラー | モーダル | "ファイルが破損しているようです。JSON 構文を解析できませんでした。" | [閉じる] |
| ER3 | スキーマ検証失敗 | モーダル | "ファイル形式が認識できません。バージョン: 不明" | [閉じる] / [復旧プレビュー(読み取り専用)] |
| ER4 | マイグレーション失敗 | モーダル | "古いバージョンからの変換に失敗しました。" | [閉じる] / [復旧プレビュー(読み取り専用)] |
| ER5 | 整合性チェック失敗(壁参照不整合等)| モーダル | "ファイル内のデータに不整合があります(壁参照: 3 件)。続行できますが一部要素が表示されない可能性があります。" | [そのまま開く] / [閉じる] |
| ER6 | 配置不能(重なり)| トースト下中央 | "重なる位置には配置できません" | (3 秒で自動消滅)|
| ER7 | 整列不能 | トースト | "整列できませんでした(重なりが発生します)" | (3 秒で自動消滅)|
| ER8 | スナップ無効化中の操作 | トースト | "スナップが無効です(`S` キーで再度有効化)" | (5 秒で自動消滅)|
| ER9 | アンドゥ可能限界 | トースト | "これ以上戻せません" | (3 秒で自動消滅)|
| ER10 | 3D アセット読込失敗 | キャンバス内に小バナー | "一部の家具モデルを読み込めませんでした" | [リトライ] / [閉じる] |
| ER11 | PDF 出力失敗 | モーダル | "PDF を生成できませんでした。プランが大きすぎる可能性があります。" | [画像で書き出す] / [閉じる] |

トーストは画面下中央、最大 3 件まで縦に積む。`prefers-reduced-motion` の場合はスライド省略。

#### 9.9.7 トースト・通知の種類

| 種別 | 色 | アイコン | 用途 | 自動消滅 |
|---|---|---|---|---|
| 成功 | success(`#059669`) | `CheckCircle2` | 保存完了、書き出し完了 | 2 秒 |
| 情報 | info(`--accent-500`)| `Info` | ヒント、軽い通知 | 3 秒 |
| 警告 | warning(`#D97706`) | `AlertTriangle` | 配置不能、整列不能等 | 3 秒 |
| エラー | error(`#DC2626`) | `XCircle` | ER6〜ER9 系 | 5 秒 |
| 進行 | grey | `Loader2` | 「PDF 生成中…」等 | 完了で自動消滅 |

トーストは積み上がっても最新のみ操作可能(古いものは半透明)。

#### 9.9.8 空状態のメッセージ集

| 場所 | メッセージ |
|---|---|
| 空キャンバス | "左サイドから部屋をドラッグするか、`R` キーで配置を始めましょう" |
| ホーム(プラン 0 件)| "最初のプランを作りましょう。テンプレから始めるのが早道です" |
| テンプレ検索ノーヒット | "条件に一致するテンプレが見つかりません。フィルタを調整してください" |
| 警告 0 件 | "すべて適合しています(現在のチェック範囲)" |
| ack 履歴 0 件 | "ack 済み警告はまだありません" |
| 部屋一覧 0 件(プラン情報パネル)| "部屋を配置すると、ここに一覧が出ます" |

---

### 9.10 モーダル・ダイアログカタログ

アプリ全体で発生する **18 種のモーダル/ダイアログ** を統一カタログ化。
レイアウトは §9.8.5 / §9.8.6 / §9.8.7 / §9.8.9 のスタイルを基準とする。

#### 9.10.1 共通仕様

| 項目 | 仕様 |
|---|---|
| 出現アニメ | overlay は 200ms ease-out、本体は 250ms cubic-bezier(0.4,0,0.2,1) で scale 0.96 → 1.0 + opacity |
| 消滅アニメ | overlay は 150ms、本体は scale 1.0 → 0.98 + opacity 0 |
| Esc キー | 既定で **dismiss(キャンセル相当)**、ただし破壊的操作は無効化(ER1, M1〜M3) |
| Enter キー | 既定で **primary ボタン実行**、ただし破壊的操作はフォーカス必須(M1〜M3) |
| 背景クリック | dismiss(破壊的操作のモーダルは無効) |
| 最大幅 | 480px(標準)/ 720px(複雑な内容)/ 880px(プレビュー系) |
| 高さ | 内容に従って可変、ビューポート 90vh を超えるとスクロール |
| ボタン配置 | **右下に primary、その左に secondary**(macOS 系)、危険操作は primary を赤系 |
| ボタンの数 | 最大 3 個(それ以上はラジオ選択 + 単一 primary)|
| タイトル | 動詞含み(「○○を削除しますか?」「○○を書き出す」) |
| メッセージ | 1〜3 行が目安、それ以上は折りたたみ |
| 二段階確認 | 大規模破壊操作のみ、入力フィールドで「削除」と入力 |

#### 9.10.2 確認ダイアログ(Confirm)

##### M1: 部屋・壁・要素の単純削除

```
        ┌─────────────────────────────────────┐
        │ この部屋を削除しますか?             │
        ├─────────────────────────────────────┤
        │                                     │
        │  「主寝室 12.0㎡」を削除します。     │
        │  この操作は元に戻せます(Ctrl+Z)。│
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [削除する]   │
        └─────────────────────────────────────┘
```

- primary: 赤系(`--error: #DC2626`)、ラベル「削除する」
- 既定フォーカス: キャンセル(誤操作防止)
- Esc: キャンセル / Enter: 必須でキャンセルにフォーカス時は中止

##### M2: 耐力壁・構造柱の削除(警告同時表示)

```
        ┌─────────────────────────────────────┐
        │ ⚠ 耐力壁を削除しますか?             │
        ├─────────────────────────────────────┤
        │                                     │
        │  この壁は耐力壁です。削除すると      │
        │  構造の info 警告が出ます。          │
        │                                     │
        │  ▸ 周囲の柱の梁スパンが 1820mm を   │
        │    超える可能性があります            │
        │                                     │
        │  実際の建築では建築士の確認が       │
        │  必要です。                         │
        │                                     │
        ├─────────────────────────────────────┤
        │       [キャンセル] [それでも削除]   │
        └─────────────────────────────────────┘
```

- 黄色アイコン、primary は赤
- メッセージで影響と免責(§1.6)を明示
- ボタンラベルは「それでも削除」(承知の上での選択を表現)

##### M3: 全データ削除(設定画面の危険操作)

```
        ┌─────────────────────────────────────┐
        │ ⚠ すべてのプランを削除しますか?     │
        ├─────────────────────────────────────┤
        │                                     │
        │  保存されているすべてのプランと      │
        │  設定がこの端末から削除されます。     │
        │                                     │
        │  この操作は元に戻せません。          │
        │                                     │
        │  続行するには「削除」と入力してくだ │
        │  さい。                              │
        │                                     │
        │  [_______________]                  │
        │                                     │
        ├─────────────────────────────────────┤
        │ [キャンセル]   [すべてを削除する] (灰)│
        └─────────────────────────────────────┘
```

- 二段階確認: テキスト入力で「削除」と入力するまで primary は灰でクリック不可
- 入力一致で primary が赤に変化、押下可能
- Esc / Enter は無効化

##### M4: 未保存変更がある状態でのナビゲート

```
        ┌─────────────────────────────────────┐
        │ 変更が保存されていません            │
        ├─────────────────────────────────────┤
        │                                     │
        │  このプランには未保存の変更があり   │
        │  ます。どうしますか?                │
        │                                     │
        ├─────────────────────────────────────┤
        │ [キャンセル] [破棄して移動] [保存して移動]│
        └─────────────────────────────────────┘
```

- 3 ボタン構成。primary は「保存して移動」、危険操作「破棄」は中央
- ホーム遷移、別プランを開く、ブラウザの戻る等で発火
- `beforeunload` イベントで OS 標準ダイアログも併用(タブ閉じ・ブラウザ閉じ)

##### M5: 3D 編集中に構造変更要求(§15.6.2)

```
        ┌─────────────────────────────────────┐
        │ 2D で編集できます                   │
        ├─────────────────────────────────────┤
        │                                     │
        │  この操作は 2D ビューでのみ可能      │
        │  です。2D に切り替えますか?          │
        │                                     │
        │  ▸ 該当要素はハイライトされます      │
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [2D で開く]  │
        └─────────────────────────────────────┘
```

- primary は青系(危険操作ではないため)
- OK で 2D 切替 + 該当要素にパン + ハイライト

##### M6: テンプレからプラン作成の確認

```
        ┌─────────────────────────────────────┐
        │ このテンプレで新しいプランを作成?  │
        ├─────────────────────────────────────┤
        │                                     │
        │  「平屋 3LDK 30 坪 別荘風」を       │
        │  ベースに新しいプランを作ります。    │
        │                                     │
        │  □ プラン名を後で設定する            │
        │                                     │
        │  プラン名:                          │
        │  [新しいプラン________________]      │
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [作成する]   │
        └─────────────────────────────────────┘
```

##### M7: 法規警告の一括 ack 確認

```
        ┌─────────────────────────────────────┐
        │ info 警告をすべて了解しますか?      │
        ├─────────────────────────────────────┤
        │                                     │
        │  以下の 5 件の info 警告を一括で    │
        │  「了解」しますか?                  │
        │                                     │
        │  ▸ 廊下幅 < 780mm(住戸内)         │
        │  ▸ トイレ⇔キッチン直接隣接         │
        │  ▸ ...                              │
        │                                     │
        │  この操作は履歴から個別に取消できます。│
        │                                     │
        ├─────────────────────────────────────┤
        │       [キャンセル] [すべて了解する]  │
        └─────────────────────────────────────┘
```

##### M8: アンドゥ履歴のクリア

```
        ┌─────────────────────────────────────┐
        │ アンドゥ履歴をクリアしますか?       │
        ├─────────────────────────────────────┤
        │                                     │
        │  これ以降、現在の状態より前には     │
        │  戻せなくなります。                 │
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [クリアする] │
        └─────────────────────────────────────┘
```

#### 9.10.3 入力フォーム系(Form)

##### M9: プラン名の変更

```
        ┌─────────────────────────────────────┐
        │ プラン名を変更                  [✕] │
        ├─────────────────────────────────────┤
        │                                     │
        │  プラン名                           │
        │  [田中邸_3LDK_南向き___________]    │
        │                                     │
        │  説明(任意)                       │
        │  [.................................│
        │  .................................]│
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [保存する]   │
        └─────────────────────────────────────┘
```

##### M10: プランの複製

```
        ┌─────────────────────────────────────┐
        │ プランを複製                    [✕] │
        ├─────────────────────────────────────┤
        │                                     │
        │  新しいプラン名                     │
        │  [田中邸_コピー_______________]      │
        │                                     │
        │  ✓ 仕上げ材を含めて複製             │
        │  ✓ 配置済み家具を含めて複製         │
        │  □ 法規警告の ack 履歴を引き継ぐ     │
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [複製する]   │
        └─────────────────────────────────────┘
```

##### M11: 現在プランをテンプレ化(§7 連動)

```
        ┌─────────────────────────────────────┐
        │ テンプレートとして保存          [✕] │
        ├─────────────────────────────────────┤
        │                                     │
        │  名前   [3LDK_南向き_自作_____]      │
        │  説明   [.....................]      │
        │  tags   [南向き] [3LDK] [+ 追加]    │
        │  ライセンス  [original ▼]            │
        │                                     │
        │  ※ 公式同梱テンプレとして配布        │
        │     する場合は §7.2 の著作権         │
        │     チェックリストを確認             │
        │                                     │
        ├─────────────────────────────────────┤
        │           [キャンセル] [保存する]   │
        └─────────────────────────────────────┘
```

##### M12: PDF 出力オプション(§9.8.6 エクスポートの PDF 詳細)

§9.8.6 と同じレイアウトを採用。PDF を選択した時の詳細展開部分:

```
   ◯ PDF
     用紙: ○ A3 横(既定) ○ A4 縦 ○ A4 横
     縮尺: ○ 自動推奨 ○ 1/50 ○ 1/100 ○ 1/200
     ✓ 平面図(全階)
     ✓ 警告サマリ
     □ 3D ビューを含める
        画角: [Walk ▼]
     □ 仕上げ表(将来)
```

#### 9.10.4 情報・通知系(Info / Alert)

##### M13: 初回同意(§9.8.9 既出、再掲)

§9.8.9 のレイアウトを使用。

##### M14: バージョンアップ通知

```
        ┌─────────────────────────────────────┐
        │ ✨ アップデートがあります            │
        ├─────────────────────────────────────┤
        │                                     │
        │  間取りプランナー v1.1 が利用可能    │
        │                                     │
        │  ▸ 3D 内編集モードの追加            │
        │  ▸ PDF 出力の改善                   │
        │  ▸ ...                              │
        │                                     │
        │  リロードして適用しますか?          │
        │                                     │
        ├─────────────────────────────────────┤
        │       [後で] [今すぐリロード]       │
        └─────────────────────────────────────┘
```

- PWA の Service Worker 更新検知時に自動表示
- 「後で」を選んでも次回起動時に適用

##### M15: 免責事項を再表示(設定 → 免責事項を表示)

§1.6.2 の全文を表示する Info モーダル。閉じるのみ。

#### 9.10.5 エラーリカバリ系(§9.9.6 連動)

##### M16: ER1 保存失敗

```
        ┌─────────────────────────────────────┐
        │ 保存できませんでした                │
        ├─────────────────────────────────────┤
        │                                     │
        │  ブラウザの空き容量が不足している    │
        │  可能性があります。                  │
        │                                     │
        │  原因: QuotaExceededError           │
        │  使用量: 約 95%                     │
        │                                     │
        │  対処方法:                          │
        │  ▸ 不要なプランを削除する           │
        │  ▸ JSON ファイルとして書き出して     │
        │    バックアップ                     │
        │                                     │
        ├─────────────────────────────────────┤
        │ [JSON で書き出す] [古いプランを削除] [閉じる]│
        └─────────────────────────────────────┘
```

##### M17: ER3 スキーマ検証失敗

```
        ┌─────────────────────────────────────┐
        │ ⚠ ファイル形式が認識できません       │
        ├─────────────────────────────────────┤
        │                                     │
        │  バージョン: 不明                    │
        │  検出された問題: floors 配列が空     │
        │                                     │
        │  このファイルは間取りプランナーで    │
        │  生成されたものではない可能性があり │
        │  ます。                              │
        │                                     │
        │  「復旧プレビュー」は読み取り専用で  │
        │  開きます(編集・保存・PDF 出力は    │
        │  すべて無効、§3.7.2 の上限を適用)。│
        │                                     │
        ├─────────────────────────────────────┤
        │  [閉じる]    [復旧プレビューで開く]  │
        └─────────────────────────────────────┘
```

##### M17 復旧プレビューモードの仕様

セキュリティ方針(§3.7)と整合させるため、`ER3` / `ER4` の「強制オープン」は **復旧プレビュー** に置き換える:

| 項目 | 仕様 |
|---|---|
| ローダー | §5.1.2 手順を **readonly モード**で実行(`TolerantFloorplanSchema` を使用、`migrate` と `strip` はスキップ、`ensureEdgeIds` のみ実行)。失敗フィールドはデフォルト値で埋める |
| サニタイズ | §3.7.1 を全面適用。`thumbnail` の SVG dataURL、`../` パス、未知スキームは破棄 |
| 上限 | §3.7.2 の上限を **そのまま適用**(超過は復旧プレビューでも開かない) |
| エディタ操作 | すべての編集アクションを disabled。アンドゥ/リドゥもなし |
| 保存 | 「上書き保存」「JSON エクスポート」「PDF/PNG 書き出し」をすべて非表示 |
| 表示 | 上部に固定バナー「復旧プレビュー(読み取り専用)」、操作ボタンとして「JSON ソースを表示」「閉じる」のみ |
| 描画 | **主表示は JSON ソースペイン**(整形表示)。図面描画は **`SafeFloorplanSchema` で `safeParse` を通った要素だけ**を **薄いオーバーレイ**として表示する。`safeParse` 失敗の `Room` / `Wall` / `Door` / `Window` は描画から除外(空欄で表示し、行頭に「⚠ schema 不一致のためスキップ」を出す)。**通常 renderer に未検証データを渡すことは禁止**(将来 schema の不正フィールドで renderer がクラッシュするのを防ぐ) |
| 終了 | 通常モードに戻る導線は「閉じる」のみ。同じファイルを通常モードで開き直す UI は出さない |

**`SafeFloorplanSchema` の定義(復旧プレビュー描画専用):**

```typescript
// 復旧プレビューの薄いオーバーレイ描画にだけ使う、要素単位の安全スキーマ集合。
// FloorplanSchema をそのまま流用すると `superRefine` の Phase 不変条件で落ちるため、
// renderer が必要とする最小フィールドだけを採用する。
export const SafeFloorplanSchema = {
  // 描画には Floor 配列が要る。version の union 制約は外して将来 version を許容。
  plan: z.object({
    version: z.string(),
    floors: z.array(z.unknown()).min(1),
  }).passthrough(),

  // Room: 描画には id / shape / rotation だけあれば足りる。presetId は表示ラベル用 optional。
  room: z.object({
    id: z.string(),
    shape: z.union([
      z.object({ kind: z.literal("rect"), x: z.number(), y: z.number(),
                 w: z.number().positive(), h: z.number().positive() }).passthrough(),
      z.object({ kind: z.literal("polygon"),
                 points: z.array(z.tuple([z.number(), z.number()])).min(3) }).passthrough(),
    ]),
    rotation: z.number().optional(),
    presetId: z.string().optional(),
  }).passthrough(),

  // Wall: 線分を引ければよい。thickness / wallType も描画に効くが optional 扱い。
  wall: z.object({
    id: z.string(),
    from: z.tuple([z.number(), z.number()]),
    to: z.tuple([z.number(), z.number()]),
    thickness: z.number().positive().optional(),
    wallType: z.string().optional(),
  }).passthrough(),

  // Door / Window: 壁参照と位置比率があれば JIS 記号が描ける。
  door: z.object({
    id: z.string(),
    wallId: z.string(),
    positionRatio: z.number().min(0).max(1),
    width: z.number().positive().optional(),
  }).passthrough(),
  window: z.object({
    id: z.string(),
    wallId: z.string(),
    positionRatio: z.number().min(0).max(1),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }).passthrough(),
};
```

| 観点 | `FloorplanSchema`(normal) | `TolerantFloorplanSchema`(readonly ローダー) | `SafeFloorplanSchema`(readonly 描画) |
|---|---|---|---|
| 用途 | 通常の読み書き | 復旧プレビューの **構造受け入れ**(ローダー段で 1 回だけ通す) | 復旧プレビューの **要素ごとの描画判定**(`safeParse` を要素単位で繰り返す) |
| version | `"1.0" | "1.1"` の union | `z.string()`(任意) | `z.string()`(任意) |
| Phase 不変条件(`superRefine`) | あり(`columns` 空など) | なし | なし |
| 必須フィールド | 全フィールド厳格 | `floors / rooms` 配列があること | 要素ごとに renderer が必要な最小セット(上記) |
| 落とす扱い | Zod 失敗 = ER3 で復旧プレビューに分岐 | 構造が壊れていなければ通る | `safeParse` 失敗の要素は **描画から除外**(他要素は描画) |
| `passthrough` | しない | する | する(将来フィールドを残す) |

判定タイミング:

- ローダー段では `TolerantFloorplanSchema` で plan 全体を 1 回検証
- 描画段では `SafeFloorplanSchema.{room|wall|door|window}` を **要素ごとに `safeParse`** し、
  success のものだけ renderer に渡す。失敗要素は「⚠ schema 不一致のためスキップ」を一覧に出す
- どちらも `safeParse` で投げない / クラッシュしない、を保証

**参照整合性の二段階フィルタ(描画段で必須):**

`SafeFloorplanSchema.door` / `.window` は `wallId` の文字列形 / `positionRatio` の数値範囲しか
検証しない。参照先の `Wall` が同じファイル内に存在しない可能性があるため、`safeParse` 成功後に
**参照先ルックアップ**を行い、参照先がないものは描画から除外する:

```typescript
function renderableDoorsAndWindows(
  plan: unknown,
): { doors: SafeDoor[]; windows: SafeWindow[]; skipped: { kind: "door" | "window"; reason: string }[] } {
  const result = { doors: [], windows: [], skipped: [] };
  const floors = (plan as { floors?: unknown[] }).floors ?? [];
  for (const floor of floors) {
    const walls = (floor as { walls?: unknown[] }).walls ?? [];
    // safeParse を通った wall だけ id -> wall の Map を作る
    const wallMap = new Map<string, SafeWall>();
    for (const w of walls) {
      const parsed = SafeFloorplanSchema.wall.safeParse(w);
      if (parsed.success) wallMap.set(parsed.data.id, parsed.data);
    }

    for (const d of ((floor as { doors?: unknown[] }).doors ?? [])) {
      const parsed = SafeFloorplanSchema.door.safeParse(d);
      if (!parsed.success) { result.skipped.push({ kind: "door", reason: "schema 不一致" }); continue; }
      if (!wallMap.has(parsed.data.wallId)) {
        result.skipped.push({ kind: "door", reason: `参照先 wall ${parsed.data.wallId} がない` });
        continue;
      }
      result.doors.push(parsed.data);
    }
    // window も同様
  }
  return result;
}
```

- **段 1: 要素単位 `safeParse`** で schema 違反を除外
- **段 2: 参照整合性チェック** で `wallId` の参照先が存在しないものを除外。
  「⚠ 参照先 wall N 件不在」を一覧に追加

##### M18: ER11 PDF 生成失敗

```
        ┌─────────────────────────────────────┐
        │ PDF を生成できませんでした          │
        ├─────────────────────────────────────┤
        │                                     │
        │  プランが大きすぎる、または描画に    │
        │  時間がかかりすぎた可能性があります。│
        │                                     │
        │  対処方法:                          │
        │  ▸ 用紙サイズを A3 に変更する       │
        │  ▸ 縮尺を 1/200 に固定する          │
        │  ▸ 画像形式で書き出す               │
        │                                     │
        ├─────────────────────────────────────┤
        │       [画像で書き出す] [閉じる]     │
        └─────────────────────────────────────┘
```

#### 9.10.6 ダイアログ実装の共通ルール

| ルール | 説明 |
|---|---|
| アクセシビリティ | role="dialog"、aria-modal="true"、フォーカストラップ実装 |
| フォーカス | 開いた瞬間、推奨ボタン or 入力欄に focus |
| 戻るキー | ブラウザの戻る で dismiss(履歴を汚さない、`history.replaceState`)|
| ネスト | 同時に 2 つ以上の dialog を開かない、必要なら順次表示 |
| トースト併用 | dialog 表示中は新規トースト抑制 |
| z-index | 100(overlay)/ 110(本体)/ 1000(toast)/ 5000(critical alert)|
| ローディング | 内部処理に 500ms 以上かかる場合は本体内にスピナー、ボタンを disable |
| 入力検証 | フォーム系は入力中にリアルタイム検証、primary ボタンの disable で誘導 |

---

### 9.11 保存・読込・エラー UX フロー(状態遷移)

データ操作のフローを **状態遷移チャート** で明示する。
各遷移でユーザーが見る UI(トースト、インジケータ、モーダル)もマッピング。

#### 9.11.1 自動保存フロー(エディタ常時)

```
   [idle]
     │
     │ ユーザー編集発生
     ↓
   [dirty]──────────────────────────┐
     │                              │
     │ 5 秒経過(設定可能)         │ さらなる編集
     ↓                              │
   [saving]                         │
     │                              │
     ├── 成功 ───→ [saved]──────────┘
     │              │
     │              │ "保存済み (HH:MM)"
     │
     └── 失敗 ───→ [save-error]
                    │
                    │ M16 モーダル(§9.10.5)
                    ↓
                  [recovering]
                    │
                    ├── JSON 書き出し → ダウンロードして [idle] へ
                    ├── 古いプラン削除 → 再保存試行 → [saving]
                    └── 閉じる → [dirty] のまま継続
```

**インジケータ表示:**

| 状態 | 右上インジケータ |
|---|---|
| `idle` | "保存済み (HH:MM)" 緑チェック |
| `dirty` | "未保存" 灰、5 秒以上で微細点滅 |
| `saving` | "保存中..." スピナー(500ms 以上で表示)|
| `saved` | "保存済み (HH:MM)" 緑チェック、500ms フラッシュ |
| `save-error` | "保存できません" 警告色、クリック可 |

**自動保存設定**(§9.8.3 設定):
- 無効 / 1 分(既定) / 5 分から選択
- 無効時は `dirty` のまま留まり、Ctrl+S で手動保存のみ

#### 9.11.2 手動保存フロー(Ctrl+S)

```
   [any] ── Ctrl+S ──→ [saving]
                         │
                         ├── 成功 ─→ トースト「保存しました」(2 秒)→ [saved]
                         └── 失敗 ─→ M16 モーダル → [recovering]
```

トーストは画面下中央、`CheckCircle2` 緑アイコン。

#### 9.11.3 プラン新規作成フロー(§9.1.1 連動)

```
   [/] ホーム
     │
     │ 「新しいプラン」クリック
     ↓
   [step1] 種別選択
     │
     │ カード選択
     ↓
   [step2] 起点選択
     │
     ├── テンプレ起点 → [step3] 詳細オプション
     ├── ゼロ起点 → [step3] 詳細オプション
     └── キャンセル → [/]
     │
     │ 詳細入力 + 「作成」
     ↓
   [creating] 約 200ms スピナー
     │
     ├── ゼロ起点 → エディタ起動 + 外形描画モード(§9.5.7)
     └── テンプレ起点 → エディタ起動 + テンプレ読込
            │
            ├── 成功 → [editor]
            └── 失敗 → ER10 系トースト + ホームに戻る
```

#### 9.11.4 既存プラン読込フロー(ホームから選択)

```
   [/] ホーム
     │
     │ 最近のプランカードをクリック
     ↓
   [loading] ロード中
     │
     │ localforage から取得
     ↓
   [validating] 検証
     │
     ├── スキーマ NG → M17 モーダル
     ├── 整合性 NG → トースト「警告: 一部要素が表示されない可能性」+ 続行
     └── OK → [editor]
            │
            │ サムネ更新
            └→ [/] に戻った時に最新サムネ表示
```

**読込時間の指針:**
- < 100ms: スピナー非表示(瞬時に切替)
- 100〜500ms: スケルトン UI(キャンバスにシルエットのみ)
- 500ms 〜 2s: スケルトン + 進捗テキスト「読み込み中...」
- 2s 以上: スプラッシュ画面(§9.8.8)

#### 9.11.5 ファイルインポートフロー(§9.8.6)

```
   [import-modal] ファイル選択中
     │
     │ ドロップ or ファイル選ぶ
     ↓
   [reading] ファイル読込
     │
     ├── 100KB 超 → プログレスバー表示
     └→ JSON.parse
         ├── 構文 NG → M ER2(§9.10.5) → [import-modal]
         └── OK
             ↓
           [version-check] バージョン確認
             ├── 不明 → M17 → 復旧プレビュー or 閉じる
             ├── 旧版 → [migrating]
             └── 現行版 → [validating]
             ↓
           [migrating] マイグレーション(§5.1.2)
             ├── 失敗 → M ER4 → [import-modal]
             └── 成功 → [validating]
             ↓
           [validating] Zod スキーマ検証
             ├── 失敗 → M17 → 復旧プレビュー or 閉じる
             └── 成功 → [integrity-check]
             ↓
           [integrity-check] 整合性チェック(壁参照、部屋プリセット存在等)
             ├── 不整合 → M ER5 確認モーダル → そのまま開くか閉じる
             └── 一貫 → [editor] へ遷移
```

検証ステップは UI 上にチェックマーク列で進捗を見せる(§9.8.6 のインポートモーダル下部)。

#### 9.11.6 エクスポートフロー(JSON / PDF / 画像)

```
   [export-modal] 形式選択
     │
     │ 「書き出す」クリック
     ↓
   [exporting]
     │
     ├── JSON: シリアライズ → Blob → ダウンロード(< 100ms)
     │           │
     │           └→ トースト「書き出しました」 + ファイル名
     │
     ├── PDF: jsPDF 生成
     │     ├── 平面図キャプチャ(Konva.toDataURL)
     │     ├── PDF 構築(§17 仕様)
     │     └── ダウンロード
     │           │
     │           ├── 成功(2〜10 秒)→ トースト「書き出しました」
     │           └── 失敗 → M18(§9.10.5)
     │
     └── 画像: Konva.toDataURL → ダウンロード(< 500ms)
             └→ トースト「書き出しました」
```

PDF 生成中は **モーダル内に進捗** を表示:

```
        ┌─────────────────────────────────────┐
        │ PDF を生成中...                     │
        ├─────────────────────────────────────┤
        │                                     │
        │  1F 平面図を描画中...              │
        │  [████████████░░░░░░░] 60%         │
        │                                     │
        │             [キャンセル]            │
        └─────────────────────────────────────┘
```

10 秒を超えたら「時間がかかっています…」のヒント追加、30 秒で M18 自動表示。

#### 9.11.7 オフライン・接続復帰フロー

```
   [online]
     │
     │ navigator.onLine = false
     ↓
   [offline]
     │
     │ ヘッダーに "オフライン" バッジ(§9.9.5)
     │ localforage 保存は継続(全機能動作)
     │ 3D アセット未読み込みのものは取得不可、トースト ER10
     │
     │ navigator.onLine = true
     ↓
   [online-recovered]
     │
     │ トースト「オンラインに復帰しました」(2 秒)
     │ 失敗していた 3D アセット読込を自動リトライ
     ↓
   [online]
```

クラウド同期(将来)実装時は、復帰時にキューに溜まった保存を flush するフローを追加。

#### 9.11.8 セッション復元フロー(クラッシュ・タブ閉じ)

```
   [起動]
     │
     │ localforage.getItem("session.lastEditState")
     ↓
   [check-session]
     ├── 該当なし → [/]
     └── 存在 + 24 時間以内
            ↓
         [restore-prompt] バナー表示
           "前回の編集が残っています(○○、5/9 14:32)"
           [復元する] [破棄する]
            │
            ├── 復元 → [editor] にロード
            └── 破棄 → セッション削除 → [/]
```

セッション保存の頻度:
- 編集ごとに **debounce 1 秒** で `session.lastEditState` を上書き(自動保存とは別軸)
- ブラウザ閉じる検出時(`pagehide`)に強制 flush
- 24 時間経過したセッションは自動で破棄

#### 9.11.9 アンドゥ・リドゥの状態管理

```
   操作実行
     │
     │ 状態を [past, present, future] スタックに push
     │ future はクリア
     ↓
   [present 更新]
     │
     │ Ctrl+Z
     ↓
   [past から取り出し]
     │ present を future に push
     │ past の最新を present に
     ↓
   [更新表示] 該当変更を 200ms ハイライト(§14.4)
     │
     │ Ctrl+Shift+Z
     ↓
   [リドゥ実行]
     │ future の最新を present に
     │ past に push
     ↓
   [更新表示]
```

**履歴上限:** 50 操作(§9.8.3 設定で 20〜200 から選択可)。
上限到達時は古いものから自動削除、ユーザー通知なし。
M8 で全クリア可能。

#### 9.11.10 ボタン disable と loading の使い分け

非同期操作中の UI ガイドライン:

| 状況 | disable | loading 表示 |
|---|---|---|
| 押下後 100ms 未満で完了 | しない | しない |
| 押下後 100ms〜500ms | する | しない |
| 押下後 500ms 以上 | する | スピナーをボタン内 or モーダル内 |
| 失敗後の再試行待ち(指数バックオフ)| する | "再試行中... 3/5" |

---

### 9.12 オンボーディング

最初の体験で **「何ができるか」「最初の 3 分で何をすればいいか」** が伝わらないと
離脱する。3 つのレイヤーで段階的に学ばせる。

#### 9.12.1 初回ツアー(全 5 ステップ、同意後に自動起動)

§9.8.9 の同意ダイアログ閉じ → ホーム画面に **半透明オーバーレイ + スポットライト** で起動。
スキップ可能、最後まで完了で `localStorage.tourCompletedAt` 記録。

```
   ステップ 1: ホームの「新しいプラン」を強調
     ┌─────────────────┐
     │ ◎ Step 1/5      │
     ├─────────────────┤
     │ まずはここから  │
     │ プランの種類を   │
     │ 選びます         │
     │                 │
     │ [スキップ] [次へ]│
     └─────────────────┘

   ステップ 2: プラン種別カードを開いた状態を見せる
     「8 種の建物タイプから選べます」

   ステップ 3: エディタに切り替わって、左サイドの部屋プリセットを強調
     「左から部屋をドラッグして配置します」
     → 自動でデモの「リビング」配置を再生(2 秒)

   ステップ 4: 法規警告パネルを強調
     「採光・換気・廊下幅などを自動チェック」

   ステップ 5: 2D/3D 切替ボタンを強調
     「Tab キーで 3D ビューに切り替えできます」
     → 「触ってみましょう」で完了
```

**ツアーオーバーレイ仕様:**
- 背景: `rgba(0,0,0,0.5)` の半透明
- スポットライト: 強調要素を抜いた円形 / 矩形マスク(blur 8px)
- カード: 強調要素から少し離れた位置に出す、矢印で接続
- 画面遷移付きの場合は遷移後に自動で次ステップ
- ESC・スキップで終了し、`localStorage.tourCompletedAt = "skipped:DATE"` 記録
- 設定 → ヘルプ → 「ツアーを再起動」で再表示可能

#### 9.12.2 コンテキストヒント(右下フローティングカード)

ツアー完了後でも、**初めての操作** に遭遇したらヒントを出す。
各ヒントは 1 度だけ表示され、`localStorage.hintsShown[]` に記録。

| ヒント ID | トリガー | 内容 |
|---|---|---|
| `H-first-room` | 部屋を初めて配置した直後 | "やった!\nこの部屋は左ドラッグで移動、辺ドラッグでリサイズできます" |
| `H-first-snap` | 初めてスナップが発生 | "壁同士が吸着しました(スナップ)。`S` キーで ON/OFF 切替できます" |
| `H-first-warning` | 初めて法規警告が出た | "警告は色だけでなくアイコンも併用しています。クリックで詳細・了解できます" |
| `H-first-3d` | 初めて 3D ビューに切替 | "WASD で歩き回れます。マウスドラッグで視線回転" |
| `H-first-undo` | 初めて Ctrl+Z を押した | "アンドゥは 50 回まで遡れます(設定で変更可能)" |
| `H-first-template` | 初めてテンプレを開いた | "テンプレの外周壁は固定されています。動かそうとすると振動で拒否されます" |
| `H-first-pdf` | 初めて PDF 書き出し | "PDF には免責文が自動で入ります。詳細は設定 → 免責事項を表示" |
| `H-first-zero-condo` | マンションをゼロ起点で開始 | "まず外形を矩形 or ポリゴンで描いてください。50mm 自由グリッドです" |

```
                          ┌──────────────────┐
                          │ 💡 ヒント         │
                          ├──────────────────┤
                          │ やった!           │
                          │ この部屋は左ドラ  │
                          │ ッグで移動、辺で  │
                          │ リサイズできます  │
                          │                  │
                          │ [今後表示しない] │
                          │           [了解] │
                          └──────────────────┘
                              ↑ 右下に出現
```

**動作仕様:**
- 出現アニメ: 250ms cubic-bezier(0.4,0,0.2,1) で右下から slide-up
- 自動消滅なし、ユーザーが閉じるまで表示
- 「今後表示しない」で全ヒント抑止(`localStorage.hintsDisabled = true`)
- 設定 → ヘルプ → 「ヒントをリセット」で再表示

#### 9.12.3 空状態のプレースホルダー

§9.9.8 で文言は定義済み。**ビジュアル仕様** をここで詰める。

##### 空キャンバス(プラン作成直後・部屋ゼロ)

```
   ┌─────────────────────────────────────────────────┐
   │ ・  ・  ・  ・  ・  ・  ・  ・  ・  ・            │
   │                                                 │
   │              ╔═══════════════════╗              │
   │              ║                   ║              │
   │              ║   👋 はじめよう    ║              │  ← 半透明 40% のゴーストアウトライン
   │              ║                   ║              │
   │              ║   左サイドから    ║              │
   │              ║   部屋をドラッグ  ║              │
   │              ║                   ║              │
   │              ║   または `R` キー  ║              │
   │              ║                   ║              │
   │              ╚═══════════════════╝              │
   │                                                 │
   │ ・  ・  ・  ・  ・  ・  ・  ・  ・  ・            │
   └─────────────────────────────────────────────────┘
```

- ゴーストの矩形は `defaultSize` 程度のサイズ、点線アウトライン(opacity 0.3)
- 中央に Inter 14px のテキスト + lucide `Hand` アイコン
- 部屋を 1 個でも置いたら fade-out で消滅

##### 空のホーム画面(プラン 0 件、初回後)

```
   ┌─────────────────────────────────────────────────┐
   │                                                 │
   │   こんにちは。今日は何を作りましょう。            │
   │                                                 │
   │   ┌──────────┐  ┌──────────┐  ┌──────────┐    │
   │   │ 新しい   │  │ 開く     │  │ テンプレ │    │
   │   │ プラン   │  │          │  │ から     │    │
   │   └──────────┘  └──────────┘  └──────────┘    │
   │                                                 │
   │   ┌─────────────────────────────────────────┐  │
   │   │                                         │  │
   │   │   📐 最初のプランを作りましょう         │  │
   │   │                                         │  │
   │   │   テンプレートから始めると、一軒家・    │  │
   │   │   マンション・店舗などすぐに描き始め   │  │
   │   │   られます。                            │  │
   │   │                                         │  │
   │   │           [テンプレを見る]              │  │
   │   │                                         │  │
   │   └─────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────┘
```

- 「最近のプラン」セクションを非表示
- 大きな促しカードでテンプレ選択へ誘導

##### 空のテンプレ検索結果

```
   ┌─────────────────────────────────────────────────┐
   │                                                 │
   │            🔍                                    │
   │                                                 │
   │   条件に一致するテンプレが見つかりません        │
   │                                                 │
   │   フィルタを調整するか、検索ワードを変更        │
   │   してください                                  │
   │                                                 │
   │           [フィルタを解除]                       │
   │                                                 │
   └─────────────────────────────────────────────────┘
```

##### 空の警告パネル(警告 0 件)

```
   ┌─────────────────────────────────────────────────┐
   │                                                 │
   │            ✓                                     │
   │                                                 │
   │   すべて適合しています                          │
   │                                                 │
   │   現在のチェック範囲では問題は見つかり          │
   │   ませんでした                                  │
   │                                                 │
   └─────────────────────────────────────────────────┘
```

- 緑系チェックマーク
- ただし「※ 本判定は参考です」が下に小さく付随(§1.6 連動)

#### 9.12.4 プログレッシブディスクロージャー

慣れたユーザーには UI を簡素化:

| 慣れの指標 | 隠す UI |
|---|---|
| ツアー完了 | ツアー再起動ボタン以外のチュートリアル要素 |
| 5 プラン以上作成 | ホームの「ヒント」セクション |
| 100 操作以上実行 | コンテキストヒントの自動表示停止 |
| 全ヒント表示完了 | ヒント機構を完全非表示(リセットで復活) |
| Ctrl+S を 10 回以上使った | 「`Ctrl+S` で保存できます」のサジェスト非表示 |

慣れの指標は `localStorage.userMaturity` に保存:
```typescript
type UserMaturity = {
  tourCompletedAt: string | null;
  plansCreated: number;
  totalOperations: number;
  hintsShown: string[];
  shortcutsUsed: Record<string, number>;
};
```

#### 9.12.5 ヘルプセンターへの導線

オンボーディングを離脱したユーザーへの安全網。

| 場所 | 導線 |
|---|---|
| ヘッダー右上 | `?` アイコン → §9.8.4 ヘルプ画面 |
| エディタ何もない時 | 中央プレースホルダー下に「ヘルプを見る」リンク |
| 法規警告詳細 | 「この警告について詳しく」リンク → ヘルプの該当章 |
| エラーモーダル | 「対処方法」リンク → ヘルプ FAQ |
| 設定画面 | 「初回ツアーを再開する」「ヒントをリセット」 |

#### 9.12.6 オンボーディングのコピー方針

| 原則 | 例 |
|---|---|
| 命令ではなく招待 | ✕「クリックしてください」 / ◯「クリックしてみましょう」 |
| 専門用語は最小限 | ✕「BuildingType を選択」 / ◯「建物の種類を選びます」 |
| 進捗を示す | ✕「次のステップ」 / ◯「Step 2 / 5」 |
| 失敗の許容 | ✕「正しく入力してください」 / ◯「あとで変更できます」 |
| 達成感 | 部屋配置成功時 ◯「やった!」、最初の保存 ◯「保存できました」 |
| 短い | 1 メッセージ 2〜3 行まで |

---

### 9.13 3D ビュー UI 詳細

§9.4 と §15.6 で大枠を定義済み。ここではフローティングコントロール・カメラ操作・
太陽スライダー・マテリアルパレット・家具カタログ・ミニマップの **UI レベルの詳細** を詰める。

#### 9.13.1 3D ビュー画面の全体レイアウト

```
┌─────────────────────────────────────────────────────────────────┐
│  ◇ プラン名                       [2D] [3D ●] [家具] [マテ] [⋯] │  ← トップバー
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                                                                 │
│                  3D Viewport (Three.js)                         │
│                                                                 │
│                                                                 │
│  ┌──────────┐                                  ┌─────────────┐ │
│  │ Camera   │                                  │ Sun         │ │
│  │ ▶ Walk   │                                  │ ●─────────  │ │
│  │ Orbit    │                                  │ 14:00       │ │
│  │ Top      │                                  │ Spring ▼    │ │
│  │ Section  │                                  │ Tokyo ▼     │ │
│  └──────────┘                                  └─────────────┘ │
│                                                                 │
│                                                                 │
│  ┌──────────┐                                  ┌─────────────┐ │
│  │ Layers   │                                  │ Quality     │ │
│  │ ✓ 家具   │                                  │ ✓ AO        │ │
│  │ ✓ 影     │                                  │ ✓ Bloom     │ │
│  │ ✓ 人物   │                                  │ Med ▼       │ │
│  └──────────┘                                  └─────────────┘ │
│                                                                 │
│  [📍 ミニマップ]                                  [📷 視点保存] │
│  ┌────┐                                                        │
│  │平面│                                                        │
│  │📍  │                                                        │
│  └────┘                                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- 通常時、フローティングコントロールは半透明 80%、ホバーで 100%
- 3 秒間操作なしで自動的に半透明 50% にフェード(没入感のため)
- マウス移動で再表示

#### 9.13.2 カメラモード詳細

##### Walk モード(室内ウォークスルー)

| 操作 | キー / マウス | 動作 |
|---|---|---|
| 前進 | `W` | カメラの向きに 1.4 m/s で進む |
| 後退 | `S` | 後ろに同速で進む |
| 左に歩く | `A` | 左にストレイフ |
| 右に歩く | `D` | 右にストレイフ |
| 走る(2 倍速) | `Shift` 押下 + WASD | 2.8 m/s |
| 視線回転 | マウスドラッグ | カメラ回転(感度設定可能)|
| 視点高さ変更 | `R` / `F` | カメラ高さ ±100mm(既定 1700mm 身長視点)|
| 屈む | `C` 押下 | 高さ 1200mm に一時降下、離すと戻る |
| 階段昇降 | 自動 | 階段の段に近づくと自動でカメラ高さが追従 |
| 壁に当たる | 自動 | コリジョン検出で壁を貫通しない、200mm 手前で停止 |
| ドアを開ける | `E` | 目の前にドアがあれば開閉アニメ(2D データには反映しない、3D 視覚のみ)|
| FOV 変更 | `+` / `-` | 60° 〜 90°(既定 75°)|

##### Orbit モード(対象物中心の回転)

| 操作 | キー / マウス | 動作 |
|---|---|---|
| 回転 | 左ドラッグ | 注視点を中心に回転 |
| パン | 中ドラッグ / `Shift` + 左ドラッグ | 注視点ごと平行移動 |
| ズーム | ホイール | 注視点に近付く/離れる |
| 注視点リセット | `Space` | プラン中央に注視点を戻す |
| 注視点を要素に | 要素クリック | クリック対象を注視点に |
| 一周回転 | `1` 〜 `4` | プリセット視点(45° / 135° / 225° / 315°)|

##### Top モード(真上から俯瞰)

| 操作 | キー / マウス | 動作 |
|---|---|---|
| パン | 左ドラッグ | 平行移動 |
| ズーム | ホイール | 高さの調整(2m 〜 50m 範囲)|
| 回転(画面回転) | `Q` / `E` | 90° 回転、北方位は固定 |
| 2D ビューに切替 | `Tab` | 通常の 2D ビューへ |

##### Section モード(断面表示、将来拡張)

| 操作 | 動作 |
|---|---|
| 断面高さスライダー | 床から 0〜3000mm |
| 断面方向 | 水平のみ(縦断面は将来)|
| 断面より上を非表示 | toggle |

設計書時点では UI 仕様のみ定義、実装は後続フェーズ。

#### 9.13.3 太陽位置スライダー(右上)

```
   ┌────────────────────────────────────┐
   │ 太陽                            [✕] │
   ├────────────────────────────────────┤
   │                                    │
   │ 時刻                                │
   │ ●─────────────────────             │
   │ 06:00      ▲ 14:00          18:00  │
   │                                    │
   │ 季節  [春分 ▼]                      │
   │       春分 / 夏至 / 秋分 / 冬至     │
   │                                    │
   │ 場所  [東京(35.68N, 139.65E)▼]    │
   │                                    │
   │ ─────────────────────────────────── │
   │                                    │
   │ 高度: 65°                           │
   │ 方位: 230°(南西)                  │
   │                                    │
   │ ☀ 直射 ▶ ON                         │
   │ ☁ 曇天 □ OFF(直射 OFF + 拡散光)   │
   │                                    │
   └────────────────────────────────────┘
```

**スライダー仕様:**
- 時刻: 5:00 〜 19:00、15 分刻み
- 季節: 4 つの基準日(春分 3/20、夏至 6/21、秋分 9/22、冬至 12/22)
- 場所: 主要都市プリセット 8 カ所(札幌・仙台・東京・名古屋・大阪・広島・福岡・那覇)+ カスタム緯度経度入力
- 高度・方位は suncalc(§6.9)で自動計算、表示のみ
- 影の更新は 100ms debounce(過度な再計算防止)

#### 9.13.4 レイヤートグル(左下)

```
   ┌──────────────┐
   │ 表示          │
   ├──────────────┤
   │ ✓ 家具        │
   │ ✓ 仕上げ材    │
   │ ✓ 人物モデル  │
   │ ✓ 影          │
   │ □ 構造体      │  (柱・梁を可視化)
   │ □ ワイヤー    │  (デバッグ用)
   │ ✓ HDR 環境光  │
   │ ✓ 天井        │  (OFF にすると上から見やすい)
   └──────────────┘
```

各トグルは `localStorage.viewSettings3D` に永続化。

#### 9.13.5 品質設定(右下)

```
   ┌──────────────┐
   │ 品質          │
   ├──────────────┤
   │ プリセット   │
   │ ○ 低         │  (モバイル想定、影 OFF、AA OFF)
   │ ● 中(既定)│
   │ ○ 高         │  (シャドウ 4096、Bloom、SSAO)
   │              │
   │ 個別設定     │
   │ ✓ AO         │
   │ ✓ Bloom      │
   │ ✓ Tone Map   │
   │ ✓ AA         │
   │              │
   │ 影解像度     │
   │ [2048 ▼]     │  (1024 / 2048 / 4096)
   └──────────────┘
```

低スペック端末で fps が 30 を下回ったら、自動で「中」→「低」を提案するダイアログを表示。

#### 9.13.6 マテリアルパレット(オーバーレイ)

§15.6 で 3D 内編集モードの仕様を定義済み。UI の見た目を詰める:

```
   ┌────────────────────────────────────────┐
   │ 床材を選ぶ                          [✕]│
   ├────────────────────────────────────────┤
   │                                        │
   │ カテゴリ                                │
   │ [すべて][木材][畳][タイル][塩ビ][石]   │
   │                                        │
   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
   │ │サムネ│ │サムネ│ │サムネ│ │サムネ│         │
   │ │オーク│ │ウォル│ │メープ│ │和畳   │         │
   │ │ライト│ │ナット│ │ル     │ │縁あり │         │
   │ └────┘ └────┘ └────┘ └────┘         │
   │                                        │
   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
   │ │サムネ│ │サムネ│ │サムネ│ │サムネ│         │
   │ │ ...   │ │ ...   │ │ ...   │ │ ...   │         │
   │ └────┘ └────┘ └────┘ └────┘         │
   │                                        │
   │ ─────────────────────────────────────  │
   │ 選択中: オーク ライト                    │
   │ メーカー: (一般)  色温度: 暖色系        │
   │ ロール:                                 │
   │ [リビング・ダイニング・寝室]            │
   │                                        │
   ├────────────────────────────────────────┤
   │            [キャンセル] [この材で確定]  │
   └────────────────────────────────────────┘
```

**マテリアルカード仕様:**
- サムネ 96×96px、PBR レンダリング済みの正方形プレビュー
- ホバーで拡大プレビュー、リアルタイムレンダリングで光環境変化(2 秒のループ)
- ダブルクリックで即適用 + パレット閉じる
- 1 クリック選択で右側の詳細を更新、「確定」ボタンで適用

部位ごとに表示するマテリアルは絞り込み:
- 床: 木材 / 畳 / タイル / 塩ビ / 石
- 壁: クロス / 塗り壁 / タイル / レンガ / コンクリート
- 天井: クロス / 木天井 / 化粧梁 / 塗装

#### 9.13.7 家具カタログ(右ペイン or 全画面)

```
   ┌────────────────────────────────────────┐
   │ 家具                                [✕]│
   ├────────────────────────────────────────┤
   │ [🔍 検索]                               │
   │                                        │
   │ カテゴリ                                │
   │ ▸ ソファ(12)                          │
   │ ▸ チェア(18)                          │
   │ ▸ ダイニング(8)                       │
   │ ▸ ベッド(10)                          │
   │ ▸ デスク・棚(15)                       │
   │ ▸ キッチン家電(6)                       │
   │ ▸ 浴室什器(4)                          │
   │ ▸ ライト(7)                           │
   │ ▸ 観葉植物(5)                          │
   │ ─────────────────────                  │
   │                                        │
   │ ┌─────────┐ ┌─────────┐               │
   │ │  サムネ  │ │  サムネ  │               │
   │ │          │ │          │               │
   │ │ 2人掛け │ │ コーナー  │               │
   │ │ ソファA │ │ ソファB  │               │
   │ │ 1800×850│ │ 2400×1600│               │
   │ └─────────┘ └─────────┘               │
   │                                        │
   │ ┌─────────┐ ┌─────────┐               │
   │ │  ...      │ │  ...      │               │
   │ └─────────┘ └─────────┘               │
   │                                        │
   └────────────────────────────────────────┘
```

**操作:**
- カードを 3D ビューにドラッグ&ドロップで配置(§15.6.1)
- カードホバーで詳細(寸法・メーカー・ライセンス)
- 検索: 名前・カテゴリ・寸法レンジでフィルタ
- 配置済み家具は別タブ「使用中」で一覧 + クリックでフォーカス

#### 9.13.8 視点プリセット(右下「📷 視点保存」)

```
   ┌─────────────────────────┐
   │ 視点                [✕] │
   ├─────────────────────────┤
   │                         │
   │ ✓ 玄関入り口             │
   │   Walk, 高さ 1700        │
   │                         │
   │ ✓ リビング全景           │
   │   Orbit, 距離 4.5m       │
   │                         │
   │ ✓ 上から俯瞰             │
   │   Top, 高さ 8m           │
   │                         │
   │ + 現在の視点を保存       │
   │                         │
   │ ───────────────────     │
   │                         │
   │ ▸ プリセット             │
   │   ▸ 玄関視点             │
   │   ▸ 全景俯瞰             │
   │   ▸ 部屋ごとに自動       │
   │                         │
   └─────────────────────────┘
```

- 保存した視点はファイルに永続化(`Floorplan.metadata.savedViews?: SavedView[]`、optional)
- PDF 出力(§17)で「3D ビューを含める」オプション選択時、保存視点から選んで埋め込む
- 「部屋ごとに自動」: 各部屋の中央 1500mm 高さに視点を自動生成

データ構造:
```typescript
type SavedView = {
  id: string;
  name: string;
  mode: "walk" | "orbit" | "top" | "section";
  position: [number, number, number];  // mm
  target: [number, number, number];    // mm(注視点)
  fov?: number;                        // walk のみ
  createdAt: string;
};
```

#### 9.13.9 ミニマップ(左下)

```
   ┌──────────┐
   │ ┌──────┐ │
   │ │      │ │  ← 平面図縮小版(全プラン)
   │ │ ▣📍  │ │     現在のカメラ位置 = 📍
   │ │      │ │     視野方向 = 三角錐
   │ └──────┘ │
   │ 1F  ▲    │
   └──────────┘
```

- 200×200px、平面図のシルエットのみ表示
- 現在のカメラ位置を青いドットで示し、視野方向を扇形で表現
- ミニマップ内クリックでその位置に Walk テレポート(モーダル確認なし)
- 階層タブで 1F / 2F / 3F 切替

#### 9.13.10 3D ビュー特有のステータスバー

通常のステータスバー(§9.2 のフッター)に追加情報:

```
   FPS 60   Triangles 124K   Mode Walk   Pos 4.5m, 1.7m, 6.2m   Sun 14:00
```

- FPS が 30 を下回ると赤字 + 品質設定の自動降格を提案するトースト
- Triangles はシーン全体の三角形ポリゴン数(50 万超でアラート)

---

### 9.14 タブレット・タッチ対応

「業者打ち合わせの叩き台」を **iPad で見せる** 用途を想定。タブレットは
**主要編集デバイスの一つ**、スマートフォンは閲覧と軽い修正のみとする。

#### 9.14.1 デバイス対応マトリクス

| デバイス | 対応度 | 主用途 |
|---|---|---|
| デスクトップ(マウス + キーボード)| 完全対応 | 編集メイン |
| **タブレット 横向き(iPad Air 以上、≥ 820px)** | **完全対応** | 編集 + 業者見せ |
| タブレット 縦向き(≥ 768px) | 完全対応 | 同上、レイアウト圧縮 |
| 大きめスマホ(≥ 414px、横向き) | 閲覧 + 軽編集 | プレゼン・確認 |
| スマホ(< 414px) | 閲覧のみ | プラン確認のみ、編集ロック |

スマホ縦向きで `< 414px` の場合、エディタを開くと「編集はタブレット以上のデバイスを推奨」のバナー
が出る(無視して編集を続けることは可能、ただし操作精度を保証しない)。

#### 9.14.2 ブレークポイント

```css
/* mobile-first */
:root {
  --bp-tablet:  768px;   /* タブレット縦から */
  --bp-desktop: 1024px;  /* デスクトップ・タブレット横から */
  --bp-wide:    1440px;  /* ワイドモニタ */
}
```

| 幅 | 名称 | 主な変化 |
|---|---|---|
| < 768px | スマホ | 1 カラム、サイドバー → ボトムシート、タブで切替 |
| 768〜1023px | タブレット縦 | 左右パネルを最小化(64px のアイコン列のみ) + スワイプで展開 |
| 1024〜1439px | タブレット横 / 通常 PC | §9.2 標準レイアウト(左 240 / 中央可変 / 右 280) |
| ≥ 1440px | ワイド PC | 左右パネル拡張(左 280 / 右 320)、より多くの情報表示 |

#### 9.14.3 タッチジェスチャー全般

| ジェスチャー | デスクトップ相当 | 動作 |
|---|---|---|
| **タップ** | クリック | 要素選択、ボタン押下 |
| **ダブルタップ** | ダブルクリック | 寸法値編集(§9.5.12)、要素にズーム |
| **長押し(500ms)** | 右クリック | コンテキストメニュー表示 |
| **ドラッグ** | ドラッグ | 部屋移動、辺リサイズ |
| **2 本指ピンチ** | ホイール | キャンバスズーム |
| **2 本指パン** | 中ドラッグ / Space ドラッグ | キャンバス移動 |
| **2 本指ロタート** | (なし)| 部屋を回転。**Phase 1: 90° スナップ**(0/90/180/270 に量子化)/ Phase 2 以降: 15° スナップ |
| **3 本指タップ** | Esc | 操作キャンセル / メニュー閉じる |
| **3 本指スワイプ右** | Ctrl+Z | アンドゥ |
| **3 本指スワイプ左** | Ctrl+Shift+Z | リドゥ |
| **エッジスワイプ右** | (なし)| Properties パネルを引き出す(タブレット縦)|
| **エッジスワイプ左** | (なし)| ツールバーを引き出す(タブレット縦)|

タップ判定とドラッグ判定の閾値: **5px 以内 + 200ms 以内 = タップ**、それ以外はドラッグ。

#### 9.14.4 タブレット縦向きレイアウト(768〜1023px)

```
┌─────────────────────────────────────────┐
│ ◇ Plan                  [2D] [3D] [⋯]  │  ← トップバー(変更なし)
├─┬─────────────────────────────────────┬─┤
│T│                                     │P│  ← 左ツールバー64px、右パネル64px
│ │                                     │ │     (アイコンのみ、タップで展開)
│V│                                     │ │
│R│                                     │ │
│W│         Canvas                      │ │
│D│                                     │ │
│X│                                     │ │
│C│                                     │ │
│P│                                     │ │
│M│                                     │ │
│H│                                     │ │
├─┴─────────────────────────────────────┴─┤
│  Grid 910mm   Unit mm     N↑      100% │
└─────────────────────────────────────────┘
```

- 左ツールバー: 縦 64px に圧縮、アイコンのみ。タップ → 一時的に右へ 240px 展開、操作完了で自動収納
- 右パネル: 縦 64px、Properties 状態を 1〜2 行のサマリで表示。タップ → 右から 280px 展開
- プリセットギャラリーは左ツールバー展開時のみ表示

#### 9.14.5 スマホ・モバイル横向きレイアウト(< 768px)

```
┌─────────────────────────────────────────┐
│  ◇         [2D] [3D]              [⋯]  │  ← 縮小ヘッダー
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              Canvas                     │
│                                         │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ [配置] [編集] [プロパ] [警告] [⚙]      │  ← ボトムタブ
└─────────────────────────────────────────┘
```

- ボトムタブで **配置 / 編集 / プロパティ / 警告 / 設定** を切替
- 各タブは下から **ボトムシート** で展開(画面の 60% 高さまで)
- スマホ縦向きはエディタを開くと「タブレット以上推奨」バナー、無視可

#### 9.14.6 タッチ操作のフィードバック

タッチ操作は **マウスホバーが存在しない** ので、ホバーに頼らない設計が必要。

| 操作 | フィードバック |
|---|---|
| タップ開始 | 接触点に 8px の波紋(80ms)、要素は 50% 透明度に |
| 長押し開始 | 接触点に同心円の進行表示(0〜500ms)、500ms で振動 + メニュー表示 |
| ドラッグ開始 | 要素全体が浮く(影 + 半透明)|
| ピンチ操作 | キャンバス中央に倍率表示「100% → 150%」 |
| スナップ | 触覚フィードバック(`navigator.vibrate(20)`、対応端末のみ)|
| 配置成功 | 短い触覚フィードバック(20ms)|
| 配置失敗 | 強めの触覚(60ms × 2)|

#### 9.14.7 タッチでの 3D ビュー操作

##### Walk モード

| 操作 | 動作 |
|---|---|
| 1 本指ドラッグ(画面中央)| 視線回転 |
| 1 本指ドラッグ(左下)| 仮想ジョイスティック → 移動 |
| 2 本指ピンチ | FOV 調整 |
| 2 本指ロタート | カメラの傾き(将来)|
| ダブルタップ | その方向にテレポート(壁・家具の手前)|

仮想ジョイスティックは画面左下の半透明円(直径 120px、不透明 30%)。
ドラッグ開始位置を中心に追従、ドラッグ距離が速度に比例。

##### Orbit モード

| 操作 | 動作 |
|---|---|
| 1 本指ドラッグ | 注視点を中心に回転 |
| 2 本指ピンチ | ズーム |
| 2 本指パン | 注視点ごと平行移動 |
| ダブルタップ | クリック対象を新しい注視点に |

##### Top モード

| 操作 | 動作 |
|---|---|
| 1 本指ドラッグ | パン |
| 2 本指ピンチ | 高さ調整 |
| 2 本指ロタート | 画面回転 |

#### 9.14.8 ペン入力対応(Apple Pencil 等)

ペンは **より高精度の入力デバイス** として扱う。

| 操作 | 動作 |
|---|---|
| ペン先タップ | 高精度クリック相当(指よりも狭いヒット領域 = 4px)|
| ペンサイドボタン押下 + タップ | 右クリック相当 |
| ペン圧 | 寸法ツール(M)使用時、強い筆圧で長く線を引ける(将来拡張)|
| ペンホバー(Pencil 2)| ホバー検出可能 → 通常のホバー UI を表示 |

ペン使用時は左ツールバーに「ペンモード」トグルが出現し、誤ってタッチで操作することを防ぐ
(指のタップを無視、ペンのみ受け付ける)。

#### 9.14.9 キーボードがない時の代替

タッチデバイスで 主要キーボードショートカットを補う UI:

| ショートカット | タッチでの代替 |
|---|---|
| Ctrl+Z / Ctrl+Shift+Z | 3 本指スワイプ、または右上の小さな ↶ ↷ ボタン |
| Delete | 選択時に表示される 🗑 ボタン |
| Esc | 3 本指タップ、またはツールバー「選択」(`V`) |
| Tab(2D/3D)| トップバーの `[2D] [3D]` ボタン |
| Ctrl+S | トップバー「保存」ボタン(常時表示)|
| Ctrl+C / V | 長押しメニュー → コピー / ペースト |
| 矢印キー(細かい移動)| 選択時に表示される +/-1mm ボタン群 |

#### 9.14.10 iOS Safe Area とランドスケープ対応

```css
.app {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

- ノッチ・ホームバー・サイドカーブをすべて回避
- ランドスケープ時はステータスバーが横にあるので、左右の safe-area を考慮
- フルスクリーン化時に navigator.standalone を見て iOS の制御

#### 9.14.11 タッチ向けの UI サイズ要件

| 要素 | 最小サイズ |
|---|---|
| ボタン・タップ可能領域 | **44×44px**(iOS HIG 準拠) |
| 寸法線・壁などのキャンバス上ヒット領域 | 線の見た目は細くても **タップ判定は 16px 幅** |
| トグル・スイッチ | 高さ 28px 以上 |
| カードのタップ領域 | 全面(余白含む)|

ヒット領域とビジュアルを分けて、見た目はミニマルに保ちつつ操作しやすくする。

---

### 9.15 アプリ内ヘルプ・ツールチップ

「業者打ち合わせの叩き台」として信頼を得るには、**判断の根拠を常に見せられる** ことが重要。
ユーザーが疑問に思った瞬間、すぐにアクセスできる 5 種の説明階層を用意する。

#### 9.15.1 説明階層(5 段)

| 階層 | トリガー | 出現速度 | 内容の深さ |
|---|---|---|---|
| **L1: ホバー・ツールチップ** | 200ms ホバー | 即時 | 1 行(ボタン名・機能の要約)|
| **L2: インライン `?` ポップオーバー** | `?` アイコンクリック | 即時 | 2〜5 行 + リンク |
| **L3: 法規警告詳細** | 警告クリック | 即時 | カテゴリ説明 + 条文 + 改善案 |
| **L4: ヘルプ画面 `/help`** | `?` メニューや警告から「詳しく」 | 1 アクション | 章立てされた解説 |
| **L5: 外部リンク** | 「公式条文を見る」 | 新タブ | e-Gov 法令検索など |

#### 9.15.2 ツールチップ(L1)

##### 仕様

- 200ms ホバーで遅延表示、移動で即追従、外れて 100ms で消滅
- 最大幅 280px、フォント Inter 12px、`--gray-700` 背景 + 白文字 + 4px 角丸
- ボタン真下中央が既定位置。画面端で位置反転(下→上)
- ショートカットがあれば `kbd` 表示で併記:

```
   ┌─────────────────────────────────┐
   │ 部屋ツール  ⌘R                  │
   └─────────────────────────────────┘
```

##### ツールチップを付ける要素(全 UI 統一)

| 要素 | 例 |
|---|---|
| アイコンのみのボタン | "部屋ツール ⌘R" |
| 数値表示 | "壁芯面積 16.5㎡" + ホバー時に "(内法: 15.8㎡、10 帖)" |
| 警告アイコン | "lighting / warning / 主寝室の採光不足" |
| マテリアルサムネ | "オーク ライト / 床材" |
| プリセットカード | "リビング / 4550×3640mm / 16.5㎡" |
| キャンバス上の壁 | "壁(間仕切り)/ 3640mm" |

##### タッチでのツールチップ

タッチ環境はホバーが存在しないため:
- 長押し(500ms)で表示 → 離して消滅
- 大量に表示する画面では 1 度長押しした要素は **その後タップで再表示可能**(状態保持 30 秒)

#### 9.15.3 インライン `?` ポップオーバー(L2)

「もう少し詳しく知りたい」をその場で。

```
   面積:  16.5 ㎡    [?]
                     ↑
                ┌──────────────────────┐
                │ 面積の計算方法       │
                ├──────────────────────┤
                │ 壁芯計算(既定)       │
                │ → 壁の中心線で囲んだ │
                │   矩形面積            │
                │                      │
                │ 内法計算              │
                │ → 内壁の内側で囲ん   │
                │   だ面積              │
                │                      │
                │ 帖換算: 1帖 = 1.62㎡│
                │ 坪換算: 1坪 = 3.31㎡│
                │                      │
                │   [詳しく] [単位設定] │
                └──────────────────────┘
```

##### 配置箇所(全 21 箇所)

| 場所 | 説明内容 |
|---|---|
| Properties → 面積 | 壁芯/内法、㎡/帖/坪、計算式 |
| Properties → 寸法 | 壁の中心線基準であること、誤差の扱い |
| Properties → 採光有効面積 | 「サッシ枠を除いた開口部の面積 × 0.7」等 |
| Properties → 換気有効面積 | 「開閉できる部分の面積」等 |
| Properties → 廊下幅 | 「壁芯間の距離。建築基準法は 780mm 以上推奨」 |
| Properties → 配管距離 | 「PS 中心 → 部屋中心の直線距離 8m まで」 |
| Properties → 通し柱 | 「2 階建てで 1F・2F の同位置にある柱」 |
| Properties → 壁種別 | 5 種別と動かせる/動かせないの説明 |
| 法規警告 各カテゴリ | 条文と現在値の差 |
| 設定 → グリッド | 910mm = 半間 = 尺モジュール |
| 設定 → 警告再計算 | 各モードのトレードオフ |
| 設定 → 単位 | mm / 帖 / ㎡ / 坪の関係 |
| 新規プラン → 構造 | 木造在来・鉄骨・RC・SRC の違い |
| 新規プラン → 北方位 | 「北を画面のどの方向にするか」 |
| マテリアルパレット → 色温度 | 暖色 / 寒色の意味 |
| 太陽スライダー → 場所 | 「日本 8 都市プリセット、緯度経度」 |
| 太陽スライダー → 季節 | 春分・夏至・秋分・冬至の意味 |
| ホーム → テンプレ | 「同梱 34 種、すべて original ライセンス」 |
| エクスポート → 縮尺 | 「1/100 = 図面 1mm が実物 100mm」 |
| インポート → スキーマ検証 | 「Zod でランタイム検証、§5.1.2」 |
| 免責 → 全文 | §1.6.2 の全文 |

##### ポップオーバーの挙動

- `?` クリックで開く、もう一度クリックまたは外側クリックで閉じる
- Esc で閉じる
- 中の「詳しく」リンクは新しいタブの代わりに **モーダルでヘルプ章を表示** (L4 へ)
- 閉じても再度開けば同じ位置に再表示

#### 9.15.4 法規警告詳細(L3)

§6.6.5 と §9.7.9 で骨格を定義済み。**条文解説の見せ方** をここで詰める:

```
        ┌──────────────────────────────────────────┐
        │ ⚠ 採光面積不足                       [✕] │
        ├──────────────────────────────────────────┤
        │                                          │
        │  対象: 主寝室(2F、12.0㎡)              │
        │                                          │
        │  ▸ 必要な採光面積: 1.71㎡(床×1/7)     │
        │  ▸ 現状の窓有効面積: 1.20㎡             │
        │  ▸ 差: 0.51㎡ 不足                       │
        │                                          │
        │ ─────────────────────────────────────    │
        │                                          │
        │  根拠条文                                │
        │  建築基準法 第28条 第1項                 │
        │                                          │
        │  「居室には、採光のための窓その他の      │
        │   開口部を設け、その採光に有効な部       │
        │   分の面積は、その居室の床面積に対し     │
        │   て、住宅の居住のための居室にあっ       │
        │   ては7分の1...」                        │
        │                                          │
        │  e-Gov 法令検索で全文を見る ▸           │
        │                                          │
        │ ─────────────────────────────────────    │
        │                                          │
        │  改善案                                  │
        │  ▸ 既存の窓を 0.7㎡ 拡張する             │
        │  ▸ 別の壁に窓を追加する                  │
        │  ▸ サッシ規格 16515 を 165mm 拡張        │
        │                                          │
        ├──────────────────────────────────────────┤
        │  [了解する] [この警告について詳しく]    │
        └──────────────────────────────────────────┘
```

- 「対象」「数値の差」「条文」「改善案」の 4 ブロック構成
- 条文は **抜粋(40〜80 字)** とし、外部リンクで全文へ誘導
- 改善案は §6 の補助ロジックで自動生成可能なものは自動、それ以外はカテゴリ別の汎用テキスト
- 「詳しく」で L4 ヘルプ画面の該当章を開く

#### 9.15.5 ヘルプ画面の章構成(L4)

§9.8.4 で骨格は示した。**実コンテンツの目次** を確定する:

```
1. はじめに
   1.1 このアプリでできること
   1.2 「叩き台」レベルとは
   1.3 免責事項

2. ツアー
   2.1 5 ステップで覚える基本操作
   2.2 一軒家を作る
   2.3 マンション住戸を作る
   2.4 商用物件を作る

3. 操作
   3.1 部屋を配置する(§9.5.1)
   3.2 壁を引く(§9.5.6)
   3.3 ドア・窓を配置する(§9.5.8〜9)
   3.4 柱・PS を配置する(§9.5.10〜11)
   3.5 寸法値を編集する(§9.5.12)
   3.6 整列・配置揃え(§9.5.15)

4. 表示
   4.1 2D ビュー
   4.2 3D ビュー(§9.13)
   4.3 仕上げ材を変える(§15.6)
   4.4 家具を置く

5. 法規
   5.1 採光チェック(§6.6.4)
   5.2 換気チェック
   5.3 廊下幅・階段
   5.4 天井高
   5.5 警告の severity と ack

6. 出力
   6.1 PDF を書き出す(§17)
   6.2 画像を書き出す
   6.3 JSON を書き出す
   6.4 別の人に渡す

7. 設定
   7.1 単位とグリッド
   7.2 警告再計算のタイミング
   7.3 3D 品質
   7.4 データの管理

8. ショートカット一覧
   (§9.15.6 で詳細)

9. よくある質問(FAQ)
   (§9.15.7 で詳細)

10. 用語集
    (§17 付録 A 連動)
```

各章の URL は `/help#3.1` のようなアンカー形式。L2 / L3 から「詳しく」で該当アンカーへ。

#### 9.15.6 ショートカット一覧オーバーレイ(`?` キー)

`?` キー or `Cmd+/` で **検索可能なショートカット一覧オーバーレイ** を全画面に表示。

```
        ┌────────────────────────────────────────────┐
        │ ショートカット                          [✕] │
        ├────────────────────────────────────────────┤
        │                                            │
        │  [🔍 検索]                                 │
        │                                            │
        │  ─ ツール ─                                │
        │  V              選択                        │
        │  R              部屋                        │
        │  W              壁                          │
        │  Shift+W        外形                        │
        │  D              ドア                        │
        │  X              窓                          │
        │  C              柱                          │
        │  P              PS                          │
        │  M              寸法                        │
        │  H              パン                        │
        │                                            │
        │  ─ 編集 ─                                  │
        │  Ctrl+Z         アンドゥ                   │
        │  Ctrl+Shift+Z   リドゥ                     │
        │  Ctrl+C         コピー                     │
        │  Ctrl+V         ペースト                   │
        │  Ctrl+X         切り取り                   │
        │  Delete         削除                        │
        │  Ctrl+S         保存                        │
        │  ...                                       │
        │                                            │
        └────────────────────────────────────────────┘
```

- 検索: ショートカット名 / 機能名どちらでもマッチ
- 全項目は §9.5 / §9.6.1 / §9.6.3 から自動生成
- macOS では `Ctrl` を `⌘` で表示
- 「印刷可能」ボタンで A4 1 枚の表に書き出し可能

#### 9.15.7 FAQ(L4 章 9)

最初の 20 件は固定。コミュニティから追加されたものは Phase 拡張で追加検討。

| Q | A の要約 |
|---|---|
| 法規警告は完全に法的に正確? | ✕(§1.6 免責) |
| 建築確認申請に使える? | ✕(§1.5 非目標) |
| 印刷した PDF を業者に渡せる? | △ 叩き台として有用、最終図面ではない |
| マンションの全体を描きたい | サポート外。1 住戸単位で扱う(§1.5) |
| 階数を増やしたい | 設定で 1〜3 階(住宅)、5 階(商用) |
| 自由なグリッドで描きたい | 設定 → グリッドサイズ → 50mm 自由 |
| 海外向けに使いたい | 単位は mm 固定、英語 UI は将来検討 |
| ファイルが開けない | スキーマ検証エラーの可能性、§9.10.5 |
| 過去のバージョンに戻したい | 自動マイグレーションが基本、ロールバックは未対応 |
| 3D で家具を置けない | カテゴリを開いてドラッグ。3D ビューモードに切替してから(§15.6) |
| 採光が満たないと配置できない? | できる。警告は出るが阻止しない(§6.6) |
| ack した警告を再表示したい | 警告パネル「ack 履歴」タブ |
| 自分のテンプレを共有できる? | JSON 書き出し → 相手にメール |
| プランを別端末でも開ける? | JSON 書き出し → インポート(自動同期は将来) |
| 自動保存はどれくらい? | 既定 1 分。設定で変更可 |
| データが消えたら? | 自動保存は localforage(IndexedDB)。ブラウザのデータ削除で消える |
| アンドゥの上限は? | 50 操作(設定で 20〜200) |
| キーボードがないと使えない? | タブレットは長押しメニュー等で代替(§9.14) |
| 商用利用は? | OSS、自由(同梱アセットの個別ライセンスは §16) |
| バグ報告はどこへ? | GitHub Issues(README.md にリンク) |

各 Q をクリックで詳細ページに展開。

#### 9.15.8 用語集(`/help#10` で表示、§17 付録 A 連動)

§17 付録 A の表をそのまま表示 + アルファベット / 五十音インデックス。
各エントリには「関連: ○○」のクロスリンク。

#### 9.15.9 検索

ヘルプ画面と全アプリで **`Cmd+K` のコマンドパレット** が起動可能。

```
        ┌────────────────────────────────────────────┐
        │ 🔍 [検索 / コマンド] (Cmd+K)             │
        ├────────────────────────────────────────────┤
        │                                            │
        │  操作                                       │
        │  → 部屋を配置する                         │
        │  → 壁を引く                               │
        │                                            │
        │  ヘルプ                                     │
        │  → 採光チェックについて                   │
        │  → ショートカット一覧                     │
        │                                            │
        │  プラン                                     │
        │  → 田中邸 3LDK を開く                     │
        │  → 平屋 1LDK を開く                       │
        │                                            │
        │  設定                                       │
        │  → 警告再計算のタイミング                  │
        │                                            │
        └────────────────────────────────────────────┘
```

- 検索ソース: ヘルプ章、ツール、設定項目、最近のプラン、テンプレ
- 入力 → ファジーマッチでスコアリング
- Enter で実行(該当アクションに飛ぶ)、Esc で閉じる
- アプリ習熟者向けの **キーボード中心の操作** 入り口

---

### 9.16 コピー文言ガイドライン

「叩き台」を信頼してもらうには、UI 文言の一貫性と品位が効く。
**Voice(声)は変えない、Tone(トーン)は文脈で調整する** という Mailchimp 系の方針を採用。

#### 9.16.1 Voice(全体を貫く声)

3 つの原則:

1. **誠実** — 法的助言ではないことを隠さない、できないことは「できない」と言う
2. **簡潔** — 1 文 30 字以内を目指す。冗長な敬語は使わない
3. **ポジティブ寄り** — 否定形より肯定形(「保存できません」よりも「空き容量を確認してください」)

#### 9.16.2 Tone のグラデーション

| 文脈 | トーン | 例 |
|---|---|---|
| 通常の UI ラベル | フラット | "プラン名"、"延床面積" |
| 軽い案内 | 親しみ | "やった!最初の部屋を置けました" |
| 確認ダイアログ | 丁寧・中立 | "この部屋を削除しますか?" |
| 危険操作の確認 | 慎重 | "この操作は元に戻せません" |
| エラー | 解決志向(自分を責めない) | "保存できませんでした。空き容量を確認してください" |
| 警告(法規) | フォーマル | "建築基準法第28条第1項。床面積×1/7 が必要です" |
| ヘルプ・ツアー | 招待 | "クリックしてみましょう" |
| 成功(達成感) | 控えめに祝う | "保存しました" |

#### 9.16.3 文体ルール

| ルール | OK 例 | NG 例 |
|---|---|---|
| 基本は **です・ます調** | "保存できませんでした" | "保存に失敗" |
| 命令形を避ける(招待形に)| "クリックしてみましょう" | "クリックしてください" |
| 過度な謙譲語を避ける | "保存できませんでした" | "誠に申し訳ございませんが、保存致しかねます" |
| 主語は省略可 | "保存しました" | "間取りプランナーがプランを保存しました" |
| 体言止めはボタン・タイトルのみ | (タイトル) "プランの保存" / (本文) "保存しました" | 本文で "プランの保存" |
| 句読点は `、` `。`(中黒は併記時のみ)| "保存して、次に進む" | "保存して　次に進む" |
| カタカナ語の長音 | "コンピュータ" / "プリンター" は分野の慣例に従う | (混在禁止)|

#### 9.16.4 ボタンラベルのルール

| 種類 | 形式 | 例 |
|---|---|---|
| 主アクション(primary) | 動詞 + 名詞、または「○○する」 | "保存する"、"削除する"、"作成する" |
| 副アクション(secondary)| 短い | "キャンセル"、"閉じる"、"後で" |
| 危険操作 | 動詞を明示 | "削除する"(✕「OK」)|
| トグル系 | ON/OFF を明示 | "表示中"(クリックで非表示へ)|
| ナビゲーション | 矢印 + 行先 | "← 戻る"、"次へ →" |

NG 例:
- ✕ "OK"(何が OK か曖昧)
- ✕ "送信"(何を送信するのか不明)
- ✕ "Yes / No"(動詞で具体的に)

#### 9.16.5 エラーメッセージのフォーマット

```
[タイトル]   何が起きたか(過去形 + 結果)
[本文]       なぜ起きたか / 状況の補足(技術的すぎない)
[アクション] どうすればよいか(箇条書き)
```

例:

```
タイトル: 保存できませんでした
本文:    ブラウザの空き容量が不足している可能性があります。
        現在の使用量: 約 95%
アクション:
  ▸ 不要なプランを削除する
  ▸ JSON ファイルとしてバックアップする
```

##### NG パターン

- ✕ "エラーが発生しました"(具体性ゼロ)
- ✕ "Error 500: Internal Server Error"(技術用語そのまま)
- ✕ "失敗しました。もう一度お試しください"(原因も対処もない)
- ✕ "申し訳ございません。○○できませんでした"(謝罪が先で、解決が後回し)

##### OK パターン

- ◯ "保存できませんでした" + 原因 + 対処
- ◯ "ファイル形式が認識できません(バージョン不明)" + 復旧プレビュー(読み取り専用)で開くオプション
- ◯ "プランが大きすぎて PDF を生成できませんでした" + 用紙サイズの提案

#### 9.16.6 確認ダイアログのフォーマット

§9.10 で定義済み、文言ルール:

| 要素 | 形式 |
|---|---|
| タイトル | 動詞含み、疑問形(「○○しますか?」) |
| 本文 | 1〜3 行、結果の説明 + アンドゥ可否 |
| primary ボタン | 動詞 + 「する」(削除する / 保存する)|
| secondary ボタン | "キャンセル"(統一)|

例(良い):

```
タイトル: この部屋を削除しますか?
本文:    「主寝室 12.0㎡」を削除します。
         この操作は元に戻せます(Ctrl+Z)。
ボタン:  [キャンセル] [削除する]
```

例(悪い):

```
タイトル: 確認
本文:    削除しますか?
ボタン:  [いいえ] [はい]
```

#### 9.16.7 警告メッセージ(法規)のフォーマット

```
[何が]    対象 + 違反内容
[なぜ]    根拠条文
[どれだけ] 数値の差(必要 vs 現状)
[どうする] 改善案(複数提示)
```

例:

```
何が:      主寝室の採光面積が不足しています
なぜ:      建築基準法第28条第1項
どれだけ:  必要 1.71㎡ / 現状 1.20㎡ / 差 0.51㎡
どうする:  ・既存の窓を 0.7㎡ 拡張する
          ・別の壁に窓を追加する
          ・サッシ規格 16515 → 16515H に変更
```

#### 9.16.8 成功メッセージ

短く、控えめに祝う。

| 文脈 | OK | NG |
|---|---|---|
| 保存完了 | "保存しました" | "正常に保存処理が完了しました" |
| 書き出し完了 | "書き出しました" + ファイル名 | "ファイルのエクスポートに成功しました" |
| 配置完了(オンボーディング) | "やった!" | "部屋の配置が完了しました" |
| 警告 ack | "了解しました" | "警告の承認処理が完了しました" |
| インポート完了 | "開きました" | "ファイルが正常に読み込まれました" |

#### 9.16.9 空状態のメッセージ

§9.9.8 で表に挙げたものに加え、文体は **招待形 + ヒント** で統一:

| 場所 | 文言 |
|---|---|
| 空キャンバス | "左から部屋をドラッグするか、`R` キーで配置を始めましょう" |
| ホーム空 | "最初のプランを作りましょう。テンプレから始めるのが早道です" |
| 検索ノーヒット | "条件に一致するテンプレが見つかりません" |
| 警告 0 件 | "すべて適合しています(現在のチェック範囲)" |
| ack 履歴 0 件 | "ack 済み警告はまだありません" |

#### 9.16.10 プレースホルダー文言

入力欄の placeholder:

| 種類 | 例 |
|---|---|
| プラン名 | "例: 田中邸_3LDK_南向き" |
| プラン説明 | "例: 共働き家族向け、収納多め" |
| 検索 | "プラン・テンプレを検索" |
| タグ入力 | "例: 南向き、3LDK、ファミリー" |
| 数値 | "0"(初期値)、または単位付き "0 mm" |

#### 9.16.11 用語の統一(混在を防ぐ用語表)

このプロジェクト全体で **同じものは同じ言葉で呼ぶ**。

| 推奨用語 | 用途 | NG / 同義語 |
|---|---|---|
| **プラン** | アプリ内のデータ単位 | 設計、図面、ファイル(技術文脈以外で) |
| **間取り** | プランの内容を指す日常語 | レイアウト |
| **部屋** | Room エンティティ | 部分、エリア |
| **住戸** | マンション・アパート 1 戸 | 部屋(混乱)、ユニット |
| **物件** | (使わない、不動産用語混入を避ける) | ─ |
| **建物** | BuildingType の単位(一軒家・マンション全体)| 家、ハウス |
| **寸法** | 長さ・幅・高さ | サイズ、大きさ |
| **面積** | 床面積等 | 広さ(本文では避ける、ヘルプの平易な説明では可)|
| **採光** | 法規用語 | 明るさ、光取り |
| **換気** | 法規用語 | 風通し |
| **居室** | 法規用語(建築基準法施行令第1条第1項6号 定義)| 部屋(混乱) |
| **柱** | 構造柱 | 支柱、コラム |
| **PS** | パイプスペース(略称で統一)| パイプシャフト、配管スペース |
| **戸境壁** | 隣戸との境界壁(マンション)| 隔壁、隣戸壁 |
| **外周壁** | 建物外側の壁 | 外壁(これは仕上げ材文脈で使う、要注意)|
| **耐力壁** | 構造を支える壁 | 構造壁 |
| **間仕切り壁** | 動かせる内壁 | 仕切り壁 |
| **了解する** | ack 操作 | 承認、確認、同意(これは初回同意専用)|
| **同意する** | 免責への同意 | 受諾、承諾 |
| **保存する** | 永続化 | セーブ |
| **書き出す** | エクスポート | 出力、エクスポート(機能名のみ可)|
| **読み込む** | インポート | 取り込む、インポート(機能名のみ可)|
| **配置する** | 要素を置く | 設置、設ける |
| **削除する** | 消す | 取り消す(これはアンドゥ専用)|

#### 9.16.12 数値・単位の表記

| 数値 | 表記 |
|---|---|
| 寸法 | "3640 mm"(数字 + 半角スペース + mm)|
| 面積 | "16.5 ㎡"、"10.0 帖"、"5.0 坪" |
| 角度 | "90°"(スペースなし)|
| パーセント | "60%"(スペースなし)|
| 桁区切り | 4 桁以上は `,` (例: "1,234 mm"、"12,345 ㎡")|
| 小数点 | 日本語環境でも半角ピリオド ".",カンマと混同しない |
| 通貨 | (使わない、アプリ内で金額表示しない)|
| 数値の丸め | 寸法は整数 mm、面積は小数第 1 位、角度は整数 |

文中での表記: "床面積 16.5㎡(10 帖、5 坪)" のように本文では **スペースなし圧縮形**、
プロパティパネル等のラベル付き数値では **スペースあり** で読みやすく。

#### 9.16.13 日付・時刻のフォーマット

| 文脈 | 形式 | 例 |
|---|---|---|
| プラン作成日(一覧)| YYYY/M/D | "2026/5/9" |
| 編集時刻(インジケータ)| HH:MM | "14:32" |
| 詳細(ホバー)| YYYY 年 M 月 D 日 HH:MM | "2026 年 5 月 9 日 14:32" |
| 相対時刻(最近のプラン)| 5 分以内: "○○分前" / 24 時間以内: "○○時間前" / それ以外: 上記日付形式 | "30 分前"、"3 時間前"、"昨日"、"2026/5/8" |
| ファイル名 | YYYYMMDD | "田中邸_20260509.pdf" |

#### 9.16.14 タイポグラフィ細則

| ルール | 例 |
|---|---|
| 句読点は半角 / 全角の混在禁止 | 全文を全角 `、` `。` で統一 |
| 英数字は半角 | "3LDK" / "3 階建て" / "iPad" |
| 全角・半角の境界に空白を入れない | "3LDK南向き" (NG: "3LDK 南向き")、ただし読みやすさ優先で例外可 |
| 鍵括弧 | `「○○」` を使用、`""` は引用やコード片のみ |
| 中黒 | 並列のみ "ドア・窓"、文中では `、` を優先 |

#### 9.16.15 文言の英語化(将来の i18n 準備)

Phase 1 は日本語のみ提供だが、後の英語化に備えて:

- 文言はすべて `i18n/ja.json` に集約(ハードコード禁止、§10 ディレクトリ構成参照)
- キー命名は `screen.section.element` 形式: `editor.toolbar.tool.room`
- プレースホルダー埋め込みは ICU MessageFormat: `"{count} 個の警告"`
- 単位は別キー: `unit.area.sqm = "㎡"`、英語化時に `"sqm"` などに置換

---

### 9.17 アイコン割当一覧(lucide-react 対応表)

UI 全体で使うアイコンを **lucide-react v0.383+** から統一選定。実装時は
`import { IconName } from "lucide-react"` でツリーシェイク前提。

#### 9.17.1 命名・サイズ規則

| ルール | 値 |
|---|---|
| ライブラリ | `lucide-react`(細線、ミニマル UI と親和) |
| 既定サイズ | 16px(本文・小ボタン)、20px(ツールバー)、24px(タイトル)|
| ストローク幅 | 1.5(既定 2 より細く設定)|
| 色 | `currentColor`、CSS で制御(§14.3) |
| カスタム化 | アプリ独自のアイコンが必要な場合は `src/components/icons/*` に SVG として個別実装 |

`<Icon name="Sofa" size={20} strokeWidth={1.5} />` のような薄いラッパーを `src/components/Icon.tsx` に作成し、サイズと strokeWidth を統一。

#### 9.17.2 ツール(§9.6.1 連動)

| 機能 | アイコン | 備考 |
|---|---|---|
| 選択(V) | `MousePointer2` | 既定ツール |
| 部屋(R) | `Square` | プリセット連動 |
| 壁(W) | `Slash` | 斜線で「線を引く」を表現 |
| 外形(Shift+W) | `SquareDashedBottom` | 太破線で外形 |
| ドア(D) | `DoorOpen` | |
| 窓(X) | `RectangleHorizontal` | 横長矩形 = 引違い窓のメタファ |
| 柱(C) | `Square` 塗りつぶし | カスタム CSS で fill |
| PS(P) | `Box` | パイプスペース = 立体 |
| 寸法(M) | `Ruler` | |
| パン(H) | `Hand` | Space ホールドのアイコン |

#### 9.17.3 部屋プリセット(§7 連動)

`RoomPreset.icon` フィールドに割り当てる lucide 名:

| プリセット | アイコン |
|---|---|
| リビング | `Sofa` |
| ダイニング | `Utensils` |
| キッチン | `ChefHat` |
| 寝室 | `Bed` |
| 子供部屋 | `Baby` |
| 書斎 | `BookOpen` |
| 和室 | `Square`(枠線、アプリ側で「畳」テクスチャ追加表現)|
| トイレ | `Toilet` (lucide 標準にない場合は自作 SVG: `src/components/icons/Toilet.tsx`) |
| 浴室 | `Bath` |
| 洗面所 | `ShowerHead` |
| ランドリー | `WashingMachine` |
| 玄関 | `DoorOpen`(色で区別)|
| 玄関ホール | `Footprints` |
| 土間 | `Grid` |
| 廊下 | `MoveHorizontal` |
| 階段 | `MoveUp` |
| クローゼット | `Archive` |
| WIC | `Shirt` |
| 納戸 | `Package` |
| バルコニー | `TreePalm` |
| テラス | `Sunset` |
| ガレージ | `Car` |
| 庭 | `TreeDeciduous` |
| ホテル客室 | `BedDouble` |
| ロビー | `Coffee` |
| フロント | `Bell` |
| レストラン | `UtensilsCrossed` |
| 宴会場 | `PartyPopper` |
| 執務室 | `Briefcase` |
| 会議室 | `Users` |
| 役員室 | `UserCog` |
| 受付 | `MessageSquare` |
| 給湯 | `Coffee` |
| サーバー | `Server` |
| ブース | `Lamp` |
| 売場 | `ShoppingBag` |
| 試着室 | `Shirt` |
| レジ | `Scan` |
| バックヤード | `Boxes` |
| カフェ席 | `Coffee` |

#### 9.17.4 表示切替・グリッド(§9.6.3 連動)

| 機能 | アイコン |
|---|---|
| グリッド(G) | `Grid3x3` |
| スナップ(S) | `Magnet` |
| 寸法表示(Shift+D) | `Ruler` |
| 部屋名表示(Shift+L) | `Type` |
| 壁種別カラー(Shift+W) | `Layers` |
| 警告表示(Shift+1) | `AlertTriangle` |
| 方位グリッド(Shift+N) | `Compass` |
| 仕上げ色プレビュー(Shift+M) | `Palette` |
| 北方位 | `Compass` |
| ズーム比 | `Search` |

#### 9.17.5 ナビゲーション・全般 UI

| 機能 | アイコン |
|---|---|
| ホーム | `Home` |
| 戻る | `ArrowLeft` |
| 進む | `ArrowRight` |
| メニュー | `Menu` |
| 閉じる | `X` |
| 検索 | `Search` |
| フィルタ | `Filter` |
| ソート | `ArrowUpDown` |
| 設定 | `Settings` |
| ヘルプ | `HelpCircle` |
| ユーザー | `User` |
| その他メニュー | `MoreHorizontal` |
| 折りたたみ展開 | `ChevronDown` / `ChevronRight` |
| カラム並べ替え | `GripVertical` |
| 全画面 | `Maximize2` |
| 全画面解除 | `Minimize2` |

#### 9.17.6 法規警告(category 別、§6.6.4 連動)

| カテゴリ | アイコン |
|---|---|
| lighting(採光)| `Sun` |
| ventilation(換気)| `Wind` |
| circulation(廊下幅・階段)| `MoveRight` |
| fire-egress(避難経路)| `Flame` |
| structure(構造)| `Construction` |
| equipment(設備配管)| `Wrench` |
| adjacency(隣接)| `Link2` |

severity 区別はアイコンの色で:
- warning → `--warning`(琥珀)+ アイコンに小バッジ `AlertTriangle`
- info → `--info`(青)+ 軽量表示

#### 9.17.7 仕上げ材

| カテゴリ | アイコン |
|---|---|
| 床 | `Square` 横線テクスチャ(カスタム SVG)|
| 壁 | `Brick`(lucide なし → カスタム)or `LayoutGrid` |
| 天井 | `SquareStack` |
| 木材 | `TreePine` |
| 畳 | `LayoutGrid` |
| タイル | `Grid2x2` |
| クロス | `Layers` |
| 塗装 | `Brush` |
| ガラス | `Square` 透過 |
| 金属 | `Triangle`(無機質感)|
| カーテン(WindowDecoration)| `Blinds` |
| ドアスタイル | `DoorOpen` 派生 |

#### 9.17.8 ファイル操作

| 操作 | アイコン |
|---|---|
| 保存 | `Save` |
| 開く | `FolderOpen` |
| 新規プラン | `FilePlus2` |
| 複製 | `Copy` |
| 書き出す(エクスポート) | `Download` |
| 読み込む(インポート) | `Upload` |
| PDF | `FileText` |
| 画像 | `ImageIcon` |
| JSON | `FileJson` |
| 削除 | `Trash2` |
| アーカイブ | `Archive` |

#### 9.17.9 編集操作

| 操作 | アイコン |
|---|---|
| アンドゥ | `Undo2` |
| リドゥ | `Redo2` |
| コピー | `Copy` |
| ペースト | `Clipboard` / `ClipboardPaste` |
| 切り取り | `Scissors` |
| すべて選択 | `BoxSelect` |
| 反転 | `FlipHorizontal2` |
| 回転 | `RotateCw` / `RotateCcw` |
| ロック | `Lock` |
| ロック解除 | `Unlock` |
| グループ化 | `Group` |
| グループ解除 | `Ungroup` |
| 表示 | `Eye` |
| 非表示 | `EyeOff` |

#### 9.17.10 整列・配置揃え(§9.5.15 連動)

| 機能 | アイコン |
|---|---|
| 左揃え | `AlignLeft` |
| 右揃え | `AlignRight` |
| 上揃え | `AlignStartHorizontal` |
| 下揃え | `AlignEndHorizontal` |
| 水平中央 | `AlignCenterHorizontal` |
| 垂直中央 | `AlignCenterVertical` |
| 等間隔水平 | `AlignHorizontalSpaceAround` |
| 等間隔垂直 | `AlignVerticalSpaceAround` |

#### 9.17.11 ビュー切替・カメラ

| 機能 | アイコン |
|---|---|
| 2D ビュー | `Square` |
| 3D ビュー | `Box` |
| 切替 | `Repeat2` |
| カメラ Walk | `PersonStanding` |
| カメラ Orbit | `Orbit` |
| カメラ Top | `LayoutTop`(lucide にない場合 `ChevronDown` で代替)or `MoveDownIcon` |
| カメラ Section | `Slice` |
| ズームイン | `ZoomIn` |
| ズームアウト | `ZoomOut` |
| パン | `Hand` |
| 視点保存 | `Camera` |
| 視点ピン留め | `Pin` |
| ミニマップ | `Map` |

#### 9.17.12 ステータス(§9.9.5〜7 連動)

| 状態 | アイコン |
|---|---|
| 成功 | `CheckCircle2` |
| 情報 | `Info` |
| 警告 | `AlertTriangle` |
| エラー | `XCircle` |
| 進行中 | `Loader2`(回転アニメ)|
| 保存済み | `Check` |
| 未保存 | `Edit3` |
| 保存中 | `Loader2` |
| 保存失敗 | `AlertCircle` |
| オンライン | `Wifi` |
| オフライン | `WifiOff` |

#### 9.17.13 建物要素(Properties パネル等)

| 要素 | アイコン |
|---|---|
| 部屋 | `Square` |
| 壁 | `Slash` |
| 共有壁 | `SeparatorHorizontal` |
| 耐力壁 | `Wall`(lucide なし → カスタム SVG。代替 `Square` 太線)|
| 外周壁 | `Square` 二重線 |
| 戸境壁 | `Equal` |
| 間仕切り壁 | `Minus` |
| 柱 | `Square` 塗 |
| PS | `Box` |
| ドア | `DoorOpen` |
| 窓 | `RectangleHorizontal` |
| 階段 | `MoveUp` |
| 開口部 | `RectangleHorizontal` 透過 |

#### 9.17.14 太陽・環境(§9.13.3 連動)

| 機能 | アイコン |
|---|---|
| 太陽 | `Sun` |
| 直射光 | `Sun` |
| 拡散光 | `Cloud` |
| 月(将来夜景)| `Moon` |
| 日の出 | `Sunrise` |
| 日没 | `Sunset` |
| 春 | `Flower2` |
| 夏 | `Sun` |
| 秋 | `Leaf` |
| 冬 | `Snowflake` |

#### 9.17.15 lucide にない場合のフォールバック

以下のアイコンは lucide v0.383 時点で **存在しない or 不適切**。カスタム SVG として
`src/components/icons/*` に実装する必要がある:

| カスタム必要 | 用途 |
|---|---|
| `Toilet` | 西洋便器のシルエット |
| `Wall` | 「壁」の概念図 |
| `Tatami` | 畳の網目模様 |
| `Brick` | レンガ |
| `LayoutTop` | 平面図(俯瞰)アイコン |
| `Sash` | サッシ規格 |
| `JIS-Door` | JIS 製図記号のドア(PDF 出力用) |
| `JIS-Stair` | JIS 製図記号の階段 |
| `JIS-Compass` | JIS 製図記号の方位 |

カスタムアイコンも 24×24 viewBox、`stroke="currentColor"` で統一。
ファイル: `src/components/icons/{name}.tsx` でエクスポート。

#### 9.17.16 アイコン使用ガイドライン

| ルール | 説明 |
|---|---|
| アイコン単独で意味を伝えない | 必ずラベル or ツールチップ併用(§14.6 アクセシビリティ) |
| 同じ機能には同じアイコン | 削除は常に `Trash2`、設定は常に `Settings` 等 |
| 新規追加時の確認 | この §9.17 表に追記してから実装(設計書を真とする) |
| サイズ統一 | 16/20/24 の 3 段階以外を使わない |
| 色 | アクセシブルなコントラスト確保(WCAG AA)|
| アニメーション | `Loader2` のみ回転、その他は静止 |

## 10. ディレクトリ構成

```
floorplan-app/
├── DESIGN.md
├── DESIGN-v0.1-archive.md          # 旧設計書アーカイブ
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── public/
│   ├── templates/                  # 同梱テンプレート JSON
│   ├── sashes/                     # サッシ規格画像
│   ├── furniture/                  # 家具モデル(Phase 2)
│   ├── textures/                   # マテリアル(Phase 2)
│   └── hdri/                       # 3D 用環境光マップ(Phase 2)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── routes/
    │   ├── Home.tsx
    │   ├── Templates.tsx
    │   └── Editor.tsx
    ├── components/
    │   ├── editor/
    │   │   ├── Toolbar.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── PropertyPanel.tsx
    │   │   ├── CompliancePanel.tsx     # 新規
    │   │   ├── OrientationCompass.tsx  # 新規
    │   │   └── StatusBar.tsx
    │   ├── canvas2d/                   # 2D 描画
    │   │   ├── Canvas2D.tsx
    │   │   ├── RoomShape.tsx
    │   │   ├── WallLine.tsx            # 壁種別で見た目を変える
    │   │   ├── ColumnMark.tsx          # 新規
    │   │   ├── PipeSpaceMark.tsx       # 新規
    │   │   ├── DoorMark.tsx
    │   │   ├── WindowMark.tsx
    │   │   └── DimensionLine.tsx
    │   ├── canvas3d/                   # 3D 描画
    │   │   ├── Canvas3D.tsx
    │   │   ├── Wall3D.tsx
    │   │   ├── Room3D.tsx
    │   │   ├── Furniture3D.tsx
    │   │   ├── Lighting.tsx
    │   │   ├── PostProcessing.tsx
    │   │   └── CameraControls.tsx
    │   ├── ui/                         # 共通 UI(Radix/shadcn ベース)
    │   │   ├── Button.tsx
    │   │   ├── Tooltip.tsx
    │   │   └── ...
    │   └── motion/                     # framer-motion ラッパー
    │       └── Transitions.tsx
    ├── core/                           # ドメインロジック
    │   ├── snap.ts
    │   ├── walls.ts
    │   ├── doors.ts
    │   ├── columns.ts                  # 新規
    │   ├── pipeSpaces.ts               # 新規
    │   ├── collision.ts
    │   ├── connectivity.ts
    │   ├── area.ts
    │   ├── ldk.ts
    │   ├── compliance/                 # 新規(法規チェック群)
    │   │   ├── lighting.ts
    │   │   ├── ventilation.ts
    │   │   ├── circulation.ts
    │   │   └── fireEgress.ts
    │   ├── structure.ts                # 新規(構造整合性)
    │   ├── equipment.ts                # 新規(設備系統)
    │   ├── sunlight.ts                 # 新規(Phase 2)
    │   └── __tests__/
    ├── store/
    │   ├── floorplanStore.ts
    │   ├── editorStore.ts
    │   ├── historyStore.ts
    │   └── complianceStore.ts          # 新規
    ├── types/
    │   └── index.ts
    ├── data/
    │   ├── roomPresets.ts
    │   ├── adjacencyRules.ts
    │   ├── sashes.ts                   # 新規:サッシ規格
    │   └── compliance/                 # 新規:法規定義
    │       └── building-standards-jp.ts
    ├── workers/                        # 新規:Web Worker
    │   ├── snap.worker.ts
    │   └── compliance.worker.ts
    ├── styles/                         # 新規
    │   ├── tokens.css                  # CSS 変数(色・タイポ・余白)
    │   └── globals.css
    └── utils/
        ├── units.ts
        ├── id.ts
        └── geometry.ts                 # 新規(幾何計算)
```

---

## 11. フェーズ計画

### Phase 1: 2D 入力 + 法規警告 + PDF/画像出力 (8〜10 週)

**目標:** 「業者に渡せる叩き台 PDF が出る」状態の最低ライン。L2 の評価軸 = 2D 入力の正確さと、
PDF 出力で打ち合わせの土台になること。**PS / 設備チェックと構造制約(柱)は Phase 1.5 に分離**、
3D・家具・装飾は Phase 2 以降。

**スコープ境界(Phase 1 不変条件):**
- `Floorplan.floors.length === 1`(Zod スキーマでも 1 固定。Phase 3 でこの制約を緩める)
- `Floor.windows` は配置・編集可、`Floor.columns` / `pipeSpaces` / `furniture` /
  `humanModels` / `voids` は **常に空配列**(Phase 1.5 で `columns` / `pipeSpaces` を解放)
- 階段プリセット(動線カテゴリ)は同梱しない、階段関連の法規警告も Phase 3

含むもの:
- 矩形部屋の追加・移動・回転(90 度)・リサイズ・削除
- 自動スナップ・ドア自動配置・重なり防止
- グリッドスナップ、寸法線、アンドゥ/リドゥ
- 部屋用途プリセット(**住宅系のみ:一軒家・マンション・アパート**)、隣接警告
- 面積表示(畳/坪/㎡、内寸/壁芯切替)、LDK 表記
- **壁種別の区別と表示**(線種で 5 種を判別。**`isLocked` の編集は可、自動配置・整合性チェックは Phase 1.5**)
- **方位設定とコンパス表示**
- **法規警告(採光・換気・住戸内廊下幅・避難経路)**
- **窓の基本配置・編集**(採光・換気警告の解除導線。自由寸法可。§5.8 参照)
- **サッシ規格データ同梱**(規格カタログ UI は Phase 2、データだけ Phase 1)
- localforage 保存、JSON エクスポート/インポート
- 同梱テンプレート: **一軒家 平屋 3 種 + マンション 11 種 + アパート 3 種 = 17 種**(2 階建以上の一軒家と商用は Phase 3 で同梱開始、§7.1)
- **2D 平面図 PDF 出力**(寸法線・凡例・方位・スケール・法規警告サマリ・免責フッター。§17)
- **2D 平面図 PNG 出力**(同じ平面図を PNG で書き出し、メール添付・チャット用)
- 最低限の UI(操作可能であること優先)

含まないもの(Phase 1.5 以降):
- **柱の配置・自動配置・構造整合性チェック**(Phase 1.5)
- **PS の配置・設備系統チェック**(Phase 1.5)
- 3D ビュー / 3D 内編集モード / 日当たりシミュレーション(Phase 2)
- 家具カタログ・配置・人物モデル(Phase 2)
- ポリゴン部屋(L 字)、複数階、階段、吹き抜け(Phase 2 / 3)
- 商用テンプレ(店舗・オフィス・ホテル・複合)(Phase 3)
- ミニマル UI の演出仕上げ(framer-motion マイクロインタラクション → Phase 2)

### Phase 1.5: 構造制約 + 設備系統 (3〜4 週)

**目標:** Phase 1 の「叩き台 PDF」に **「マンションリフォームでは触れない柱・壁」「水回りと PS の配管制約」** という L2 のリアリティを追加する。Phase 1 のリリース後、ユーザーフィードバックを受けてから着手する独立リリース。

含むもの:
- **柱(`Column`)の配置・固定・サイズ編集**
- **柱の 910mm グリッド自動配置**(一軒家、§6.4.2)
- **構造整合性チェック**(耐力壁の連続性、柱間隔、柱位置 — すべて severity `info`。**通し柱整合は複数階前提なので Phase 3** へ、§6.4.2 と整合)
- **PS(`PipeSpace`)の配置・固定・系統指定**
- **設備系統チェック**(水回り → PS 距離、§6.5)
- マンション住戸の構造警告(§6.4.3 マンションテンプレ起点に対応)
- PDF への柱・PS 記号追加(§17.2)、構造警告サマリ追加
- テスト: TC-L(構造制約) / TC-N(設備系統)

含まないもの:
- 3D 化・家具(Phase 2)、複数階・階段(Phase 3)

### Phase 2: 3D ビュー + 家具 + UI 仕上げ + 日当たり (10〜14 週)

**目標:** 建築ビジュアライゼーション級の 3D が見られる、家具を配置できる、日当たりが分かる、
Phase 1 の 2D UI に Figma 級の操作感を仕上げる。

含むもの:
- 3D ビュー(フォトリアル、PBR + AO + HDRI 環境光)
- 3D 内編集モード
- 家具カタログと配置(**最低ライン 15 点 / 通常ライン 30 点 / Stretch 50 点(PoC 達成時)**、§16 と一致)
- 人物モデル
- 窓の規格カタログ UI(YKK AP / LIXIL 製品コード選択、装飾。基本配置は Phase 1)
- ポリゴン部屋(L 字等)
- **日当たりシミュレーション(時刻・季節別の影)**
- ミニマル UI 演出仕上げ(framer-motion マイクロインタラクション、§14 モーション仕様)
- 3D レンダリング画像出力(2K/4K PNG)
- PDF への 3D アングル画像合成(オプション)

### Phase 3: 商用建物 + 複数階 (12〜16 週)

含むもの:
- 階段、複数階対応、吹き抜け
- 商用建物テンプレ(店舗、オフィス、ホテル、コワーキング、クリニック、学童、フィットネス、複合用途)
  → Phase 1 の新規プラン作成ダイアログでは **住宅 3 種のみ表示**、商用カードは Phase 3 で開放
- リアル家具テクスチャ拡充(**Phase 2 の PoC で品質 / 描画コストが許容できると分かったケースに限り** 150 点目標まで拡張、§16)

### Phase 4: 高度機能(優先度未確定)

- 屋根、3D モデルエクスポート(glTF)
- AR/VR 対応
- リアルタイム共同編集
- クラウド保存・共有

### 期間合計の目安

個人開発・週末ベース(週 10-15 時間)で:
- Phase 1: 8-10 週(約 2〜2.5 ヶ月)
- Phase 1.5: +3〜4 週
- Phase 1〜2 完了: 約 6-7 ヶ月(Phase 1.5 込み)
- Phase 1〜3 完了: 約 11-12 ヶ月
- フル: 1.5 年強

Claude Code の併用で短縮の可能性あり。

---

## 12. テストケース概要

| テストファイル | 担当範囲 | フェーズ |
|---|---|---|
| `snap.test.ts` | TC-A: 基本スナップ判定 / TC-B: 共有壁マージ | 1 |
| `doors.test.ts` | TC-C: ドア自動配置 | 1 |
| `collision.test.ts` | TC-D: 重なり防止 | 1 |
| `propagation.test.ts` | TC-E: 移動・削除・回転の波及 | 1 |
| `grid.test.ts` | TC-F: グリッドスナップ | 1 |
| `complex.test.ts` | TC-G: ポリゴン形状 / TC-H: 多部屋配置 | 2 |
| `multifloor.test.ts` | TC-I: 複数階対応 | 3 |
| `commercial.test.ts` | TC-J: 商用建物特有 | 3 |
| `sync3d.test.ts` | TC-K: 2D-3D 双方向同期 | 2 |
| **`structure.test.ts`** | **TC-L: 構造制約(耐力壁、柱位置)** | **1.5** |
| **`compliance.test.ts`** | **TC-M: 法規警告(採光、換気、廊下幅、避難)** | **1** |
| **`equipment.test.ts`** | **TC-N: 設備系統(PS、水回り配置)** | **1.5** |
| **`motion.test.ts`** | **TC-O: モーション仕様(イージング、デュレーション)** | **2** |
| **`sunlight.test.ts`** | **TC-P: 日当たりシミュレーション** | **2** |
| **`schema-migration.test.ts`** | **TC-Q: スキーマ移行 v0.x → v1.0(往復シリアライズ)** | **1** |
| **`import-fuzz.test.ts`** | **TC-R: インポート異常系(壊れた JSON、サイズ超過、`data:text/html`、`../` パス、非配列フィールド等)** | **1** |
| **`pdf-render.test.ts`** | **TC-S: PDF/PNG レンダリング基本(凡例・寸法・方位・スケール・免責)** | **1** |
| **`a11y.test.ts`** | **TC-T: アクセシビリティ(キーボード操作・ARIA・コントラスト)** | **1** |
| **`perf.test.ts`** | **TC-U: パフォーマンスバジェット(50 部屋で `runLegalChecks` < 80ms 等)** | **1** |
| **`e2e.spec.ts`** (Playwright) | **TC-E2E: ユーザーフロー(新規 → 配置 → 警告 → 解除 → PDF 出力)** | **1** |
| **`visual.spec.ts`** (Playwright + 画像比較) | **TC-V: 視覚回帰(主要画面・PDF プレビュー)** | **2** |

### 12.1 テスト戦略

| レイヤ | 道具 | 対象範囲 |
|---|---|---|
| **単体テスト** | Vitest | 純粋関数(幾何計算、`runLegalChecks`、`sumLightingArea`、マイグレータ) |
| **統合テスト** | Vitest + jsdom + Zustand ストア | ストア更新・debounce・ack 機構 |
| **E2E** | Playwright(Chromium / WebKit) | クリック → 配置 → 警告 → 窓追加で解除 → PDF 出力までの主要導線 |
| **視覚回帰** | Playwright スクリーンショット + pixelmatch(閾値 0.1%) | Phase 1: エディタ初期状態、警告パネル、PDF プレビュー / Phase 2 で追加: 3D ビュー切替・3D 内編集モード |
| **PDF レンダリング** | jsPDF を Node 環境で実行し pdf-parse でテキスト抽出 | 凡例・寸法値・方位記号・スケールバー・免責フッターの存在検証 |
| **アクセシビリティ** | `@axe-core/playwright` | WCAG AA、キーボード操作のみで主要操作完了するか |
| **パフォーマンス** | Vitest + `performance.now()` | 各部屋数(10 / 30 / 50)で `runLegalChecks` の p95 をバジェット内に |
| **スキーマ移行** | Vitest + 旧版テンプレ JSON 同梱 | `migrate()` 通過後 Zod 検証通過、往復で fingerprint 一致 |
| **インポート異常系(fuzz)** | Vitest + 手書きの破損サンプル + ランダム mutation | クラッシュしない、`ER2`〜`ER5` のいずれかに分類される |

### 12.2 テストデータと基準

- **ゴールデン JSON**: 各 Phase の主要シナリオを `tests/fixtures/golden/*.floorplan.json` に保管。
  スキーマ変更時は `pnpm test:update-golden` で再生成し PR 差分でレビュー
- **視覚回帰のベースライン**: macOS Chromium 固定。CI で OS / ブラウザを揃える
- **パフォーマンスのバジェット**: §3.1 の数値(60fps、`runLegalChecks` < 80ms 等)を `perf.test.ts`
  でアサート。退化が出たら CI を赤にする

### TC-L: 構造制約(主要ケース)

- TC-L-01: 耐力壁を選択して削除しようとする → 警告ダイアログで阻止
- TC-L-02: マンションテンプレで外周壁を移動 → 動作不可
- TC-L-03: 柱を 910 グリッドから外れた位置に置く → 警告
- TC-L-04: 木造一軒家で柱間隔が 1820mm を超える → 警告(構造的に推奨外)

### TC-M: 法規警告(主要ケース)

- TC-M-01: 寝室(8畳)に窓がない → 採光警告(床面積 13.2㎡ × 1/7 = 1.89㎡ 必要)
- TC-M-02: 寝室の窓面積が床面積の 1/7 未満 → 採光警告
- TC-M-03: 住戸内廊下幅が 700mm → 住戸内廊下幅 info 警告(共用廊下はスコープ外)
- TC-M-04: 寝室から玄関までドアを経由した経路がない → 避難経路警告
- TC-M-05: 採光警告が出ている部屋で窓を追加 → 警告自動解除

### TC-N: 設備系統(主要ケース)

- TC-N-01: マンション PS から浴室まで 5m → 警告なし
- TC-N-02: マンション PS から浴室まで 10m → 距離警告
- TC-N-03: 一軒家でキッチンを配置、PS 未設定 → PS 配置を促す通知
- TC-N-04: PS から離れた位置にトイレを配置 → 経路を視覚化、距離表示

### TC-O: モーション仕様(主要ケース)

- TC-O-01: 部屋ドラッグ開始時の影 → 200ms で出現、cubic-bezier(0.4, 0, 0.2, 1)
- TC-O-02: スナップ確定時 → 100ms で位置補正、ピタッと音(オプション)
- TC-O-03: 2D ⇔ 3D 切替 → 400ms クロスフェード
- TC-O-04: 警告パネル出現 → 250ms スライドイン

---

## 13. リスク・未決事項

### 13.1 技術リスク

| リスク | 対応案 |
|---|---|
| スナップアルゴリズムの複雑度 | TDD で段階的実装、TC-A〜B から |
| **3D 家具モデルのライセンス・調達** | **§16 で別途戦略策定** |
| Konva と Three.js の状態同期パフォーマンス | Phase 2 着手前に PoC を作る |
| **法規データの正確性・地域差** | 建築士監修を立てない代わりに **§1.6 免責文の各箇所表示 + 開発者の自己レビュー基準** で対応 |
| **Phase 1 のスコープが大きすぎる** | **§11 で対応済み。柱・構造整合性チェックと PS・設備系統チェックを Phase 1.5(独立リリース、3〜4 週)に分離。Phase 1 は寸法・壁種別・法規警告・PDF/PNG に集中** |
| 60fps 維持の難しさ(50 部屋以上で重い) | スナップ判定を Web Worker 化、React 再描画の memoization 徹底 |
| サッシ規格データの調達 | YKK AP / LIXIL の公式カタログから Phase 1 で 30〜50 種同梱 |

### 13.2 設計上の未決事項

#### 解決済み

- [x] **#1 テンプレート JSON の正式スキーマ確定** → §5.1 へ反映済み
  - 同梱テンプレ・ユーザー保存ファイルともに `Floorplan` 型で完全統一
  - テンプレ固有メタは `metadata.template?` を optional として持つ
  - Zod ランタイム検証 + 旧版マイグレータ関数 `migrate()` を採用
  - 拡張子 `.floorplan.json`、UTF-8 / LF / 2 スペースインデント
  - バージョン更新ルール(patch / minor / major)を §5.1.3 に明記
- [x] **#2 「実在する間取り」テンプレ収集方法** → §7.1, §7.2 へ反映済み
  - 完全オリジナル制作 + 公的標準モデル + 設計実務書を概念参考
  - 一軒家 8 種、マンション 11 種、アパート 3 種、商用 12 種(計 34)
  - すべて `license: "original"`、特定物件の模倣は明確に避ける
  - 著作権チェックリストを §7.2 に明記
- [x] **#5 マンションテンプレのリアリズム** → §7.2 著作権チェックリストへ統合
  - #2 と同じ完全オリジナル方針を適用
  - 「田の字型」「中央リビング型」等の **構成パターン名** は一般用語として使用可
  - 特定マンションの間取り図トレース、ブランド名・物件名の使用は禁止
- [x] **#3 法規チェックの再計算タイミング** → §6.6.1〜6.6.3 へ反映済み
  - **二段構成**: 阻止系(重なり・スナップ・構造)は同期・即時、警告系は debounce 300ms
  - 構造変更後の警告は debounce バイパスで即時。実装は **`debouncedRunLegalChecks.cancel()` した上で
    削除後の `getFloorplan()` を `runLegalChecks()` に渡して同期実行**(`flush()` は使わない:
    待機中の引数=削除前 floorplan を再評価してしまうため)
  - ユーザー設定で `realtime / 300ms / 1000ms / manual` を選択可能(`localStorage` 保存)
  - パフォーマンス目標: 50 部屋で `runLegalChecks` 1 回 < 80ms、30 部屋未満は同一スレッド処理、
    超過時のみ Web Worker 化(§3.1 / §6.6.3 と整合)
- [x] **#4 法規警告の severity 切り分け方針** → §5.9, §6.6.4, §6.6.5 へ反映済み
  - `error` は使わず **warning / info の 2 段階運用** を §5.9 で型レベルから保証
  - 各チェックの severity 振り分け表を §6.6.4 に確定
  - 警告 ID は決定論的(`category:roomIds:rule`)で再計算しても同じ
  - ack 機構: `Floorplan.metadata.acknowledgedWarnings: string[]` に永続保存
  - UI: 「現在の警告」「ack 履歴」の 2 タブ + フィルタトグル + カテゴリ一括 ack
- [x] **#6 建築士の監修体制** → §1.5, §1.6 へ反映済み(監修なし方針で確定)
  - 個人開発スコープを越えるため **建築士監修は立てない**
  - 代わりに **§1.6 免責事項** で全方位カバー
    - 初回起動時の同意ダイアログ、設定画面、警告パネル下部、PDF フッター、
      JSON `metadata.disclaimer` の 5 箇所で繰り返し注意喚起
  - 開発者の **自己レビュー基準**(条文照合・severity 妥当性・テンプレ確認等)を §1.6.3 に明記
  - §13.1 の技術リスク表も更新
- [x] **#7 構造柱の自動配置 + 住戸モード** → §6.4.1〜6.4.5, §9.1.1 へ反映済み
  - 一軒家は **910mm グリッドに自動配置**(デフォルト ON、個別編集可)
  - マンション・アパートは **「1 住戸単位」として扱う**(集合住宅全体は §1.5 非目標)
  - マンション 1 住戸は **躯体テンプレ起点 / ゼロ起点** の 2 系統対応
    - ゼロ起点では尺モジュールに縛られない 50mm 自由グリッド
    - 外周壁・戸境壁は描画後に右クリックで種別変更可
  - 構造警告(柱間隔・柱位置等)はすべて severity `info`(本アプリは「叩き台」レベル)。通し柱整合は複数階前提のため Phase 3 へ分離(§6.4.2 / §11)
  - `BuildingType` を `condo-unit` / `apartment-unit` 等に整理(§5.1 反映済み)
  - 新規プラン作成ダイアログ(3 ステップ: 種別 → 起点 → 詳細)を §9.1.1 に明記
- [x] **#8 3D 内編集モードの編集粒度** → §15.6, §5.10 へ反映済み
  - レベル C: **家具配置 + 仕上げ材変更** に限定。構造編集は 2D に誘導
  - 家具: 配置・移動(XZ 平面拘束)・回転(15° スナップ)・差し替え
  - 壁/床/天井のマテリアル変更、窓カーテン、ドア材質変更
  - 家具スナップ: 壁に 50mm 以内で吸着、家具同士は自由配置
  - 構造変更操作 → 「2D で編集できます」ダイアログ → 自動切替 + 該当要素ハイライト
  - データモデルに `RoomFinish` / `WallFinish` / `WindowDecoration` / `DoorDecoration` 追加
  - マテリアルは `MaterialId` 文字列で間接参照、`public/materials/manifest.json` で一元管理
- [x] **#9 PDF 出力レイアウト** → §17 として独立章で明記
  - 用紙: **A3 横(既定) / A4 縦 / A4 横** の 3 種選択
  - JIS 図面記号: ドア・窓・階段・柱・寸法線・方位記号・スケールバー(設備記号は不採用)
  - レイアウト: メイン平面図 + 右ペイン(プラン情報・部屋一覧) + 免責フッター
  - スケール自動推奨: 1/50, 1/100, 1/200 から最大フィットを選択、手動固定可
  - ライブラリ: **jsPDF + Konva の `toDataURL`(pixelRatio: 4)で高解像度 PNG 埋込**
  - PDF メタデータ(Title / Author / Producer 等)、ファイル名命名規則も明記

### 13.3 主要未決事項は解決済み

§13.2 の解決済みリストを参照。主要 9 項目はすべて本書の関連セクションへ反映され、設計フェーズの
中核は完了。直後の「派生で残っている軽微項目」(部屋名のローカライズ戦略、商用テンプレ用の家具
カテゴリ分割方針、ドア開閉アニメーション、アンドゥ履歴の上限)は **意図的に未決のまま**残す。
実装着手後に新たに浮上した論点は、本書を直接更新するかチケット管理ツールで追跡する。



#### 派生で残っている軽微項目

- [ ] 部屋名のローカライズ戦略
- [ ] 商用テンプレ用の家具カテゴリ分割方針
- [ ] ドアの開閉アニメーション(2D で表現するか、3D のみか)
- [ ] アンドゥ履歴の上限

---

## 14. UX・モーション設計

### 14.1 デザイン哲学

> **「正確性をまとった軽やかさ」**

業者と話せる正確性を内に秘めながら、操作するときは Figma のように軽く触れる。重厚な建築 CAD の対極。

3 つの原則:
1. **線で構造を作る** — 装飾的な塗りや影に頼らず、線・余白・タイポグラフィで情報階層を構築
2. **動きで反応を伝える** — クリック・ドラッグ・スナップ、すべての操作にミリ秒単位のフィードバック
3. **数値が美しい** — 寸法・面積・座標は等幅フォントで整然と並び、それ自体が美しい情報

### 14.2 タイポグラフィ

| 用途 | フォント | サイズ | ウェイト |
|---|---|---|---|
| UI 一般 | Inter | 13-14px | 400 / 500 |
| ボタン・ラベル | Inter | 13px | 500 |
| 見出し(プロパティパネル) | Inter | 11px | 500、`text-transform: uppercase`、letter-spacing 0.05em |
| 数値表示(寸法・面積) | JetBrains Mono | 12-14px | 400 |
| キーボードショートカット | JetBrains Mono | 11px | 400 |
| ロゴ | Inter | 16px | 600 |

### 14.3 カラーシステム

CSS 変数で管理(`src/styles/tokens.css`)。ダークモードは Phase 2 で検討。

```css
:root {
  /* 基本グレー */
  --gray-50:  #FAFAFA;  /* 背景 */
  --gray-100: #F5F5F5;  /* セクション背景 */
  --gray-200: #E5E5E5;  /* 罫線 */
  --gray-300: #D4D4D4;  /* 弱い罫線 */
  --gray-400: #A3A3A3;  /* 補助テキスト */
  --gray-500: #737373;  /* セカンダリテキスト */
  --gray-600: #525252;  /* 主要テキスト・薄 */
  --gray-700: #404040;  /* 主要テキスト */
  --gray-900: #171717;  /* 濃いテキスト・タイトル */

  /* アクセント(1色のみ) */
  --accent-50:  #EFF6FF;
  --accent-500: #3B82F6;  /* 選択、強調 */
  --accent-600: #2563EB;  /* ホバー */

  /* セマンティック */
  --info:    #3B82F6;
  --warning: #D97706;  /* 琥珀色、赤を避ける */
  --error:   #DC2626;
  --success: #059669;

  /* 線・寸法 */
  --line-wall-exterior:    #171717;  /* 外壁:濃い */
  --line-wall-load-bearing: #525252; /* 耐力壁:中 */
  --line-wall-shared:      #737373;  /* 戸境壁:中 */
  --line-wall-partition:   #A3A3A3;  /* 間仕切り:薄 */
  --line-wall-non-bearing: #D4D4D4;  /* 非耐力:極薄 */
  --line-dimension:        #737373;
  --line-grid:             #F5F5F5;
}
```

**色覚多様性配慮:** 警告は色だけでなく必ずアイコンと文言を併用。線種(実線/破線/点線)で壁種別を補助的に区別。

### 14.4 モーション仕様

すべてのアニメーションに明確な目的とタイミングを定義する。

| 操作 | デュレーション | イージング | 内容 |
|---|---|---|---|
| ボタンホバー | 100ms | ease-out | 背景色 fade |
| ボタンクリック | 80ms | ease-out | scale 0.97 → 1.0 |
| 部屋ドラッグ開始 | 150ms | cubic-bezier(0.4, 0, 0.2, 1) | 影が薄く出現、半透明化 |
| 部屋ドラッグ中 | リアルタイム | - | カーソル追従、スナップ候補プレビュー |
| スナップ確定 | 120ms | cubic-bezier(0.34, 1.56, 0.64, 1) | 位置補正、わずかなオーバーシュート |
| スナップ解除 | 100ms | ease-out | 影が消える |
| 部屋選択 | 80ms | ease-out | アクセント色のアウトライン出現 |
| パネル開閉 | 250ms | cubic-bezier(0.4, 0, 0.2, 1) | スライド + fade |
| 警告出現 | 250ms | cubic-bezier(0.4, 0, 0.2, 1) | 上から slide-down |
| 2D ⇔ 3D 切替 | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | クロスフェード + わずかなズーム |
| アンドゥ/リドゥ | 200ms | ease-out | 該当変更を一瞬ハイライト |
| ツールチップ | 200ms / 100ms | ease-out | 出現遅延 / 即時消滅 |

### 14.5 マイクロインタラクション

「触っていて気持ちいい」を支える要素:

- **ホバー時の壁ハイライト** — マウスが壁の上に来たら、その壁が薄くハイライト + 長さ表示
- **ドラッグ中の影** — 部屋に薄いソフトシャドウ(blur 8px、opacity 0.15)
- **スナップ候補プレビュー** — 吸着可能な位置に薄い破線で「スナップ後の形」を表示
- **数値変更時のフラッシュ** — 面積や LDK 表記が変わる瞬間、その数値が一瞬アクセント色に
- **キーボード操作のフィードバック** — Tab で要素移動時、フォーカスリングが滑らかに移動
- **遅延読み込みの示唆** — 3D ビュー切替時、最初は wireframe で表示し、テクスチャが順次ロード

### 14.6 アクセシビリティ

- 全操作がキーボードで完結可能(Tab、矢印キー、Enter、Esc)
- フォーカスリング常時表示(キーボード操作時のみ)
- ARIA ラベル徹底
- カラーコントラスト WCAG AA 準拠
- prefers-reduced-motion 対応(モーションを最小化するモード)
- スクリーンリーダーで部屋・寸法・警告が読み上げ可能

---

## 15. 3D ビジュアル仕様

> **PoC ゲート(2026 年中):** 本章は **Phase 2 の設計上限**。実装着手前に PoC で
> 「Web 上で 60fps が出るか」「家具モデル 30 点同時で破綻しないか」「モバイルで実用域か」を
> 計測し、達成できなかった項目は **Phase 2 ではスコープから外す**(目標品質を「中ランクに迫る」
> から「明らかに 3D で見られる」レベルまで段階的に下げる判断を許す)。
> §16 の 50 点 / 150 点目標も同じく PoC 結果でゲートする。

### 15.1 レンダリング方針

**目標品質(PoC 後の上限):** Lumion / Twinmotion / Enscape の中ランクに迫る、Web で実現可能な範囲のフォトリアリズム
**Phase 2 リリース最低ライン:** PBR + 平行光源 + 影 + ToneMapping(ACES) のみで「3D ビュー切替が成立する」

**実現手段:**
- React Three Fiber + drei + @react-three/postprocessing
- PBR(物理ベースレンダリング)マテリアル
- HDRI 環境光マップ(屋内・屋外で切替)
- Screen Space Ambient Occlusion (SSAO)
- Bloom(微弱)
- Tone Mapping(ACES Filmic)
- カスケードシャドウマップ(屋外光源)

**割り切り:**
- リアルタイムレイトレーシングは不採用(ブラウザでは重すぎる)
- グローバルイルミネーションはベイクで対応(Phase 3 検討)
- モバイルでは品質設定を下げる(LOD、シャドウ無効化等)

### 15.2 マテリアル

材質ごとに PBR テクスチャを用意:

| 材質 | ベースカラー | ラフネス | メタリック | ノーマル |
|---|---|---|---|---|
| 木フローリング | テクスチャ | 0.7 | 0 | 弱 |
| 畳 | テクスチャ | 0.9 | 0 | 中 |
| タイル(浴室) | テクスチャ | 0.3 | 0 | 弱 |
| クロス壁(白) | #F5F5F5 | 0.95 | 0 | 微弱 |
| クロス壁(色付き) | プリセット | 0.95 | 0 | 微弱 |
| 木製ドア | テクスチャ | 0.6 | 0 | 中 |
| 窓ガラス | 透明 + 屈折 | 0.05 | 0 | - |
| ステンレス | グレー | 0.2 | 1.0 | 弱 |

テクスチャ解像度: 1024×1024 ベース、近接時 2048。
配置は `public/textures/` に格納。

### 15.3 ライティング

3 灯方式:

1. **直射日光(Directional Light)** — 太陽光、影あり、強度 2.0
2. **環境光(HDRI)** — Poly Haven の HDRI を採用、強度 0.8
3. **室内補助光(Spot Light)** — 各部屋に天井ライトを 1 つ、強度 1.0

時刻・季節に応じて太陽位置を計算(§6.9 連動)。

### 15.4 カメラ・コントロール

| モード | 用途 | コントロール |
|---|---|---|
| **Orbit**(Phase 2 必須) | オブジェクト中心の回転 | マウスドラッグで回転、ホイールでズーム |
| **Top**(Phase 2 必須) | 真上から俯瞰 | 2D ビューに近い、3D マテリアルで表示 |
| **Walk**(Phase 2 任意) | 室内をウォークスルー | WASD + マウスルック、人物視点(身長 1700mm)。**PoC で操作違和感が許容できた場合のみ採用、家具との衝突判定は Phase 3 へ後送り** |
| **Section** | 断面表示 | Phase 3:任意の高さで水平断面を切る |

### 15.5 家具モデル要件

- フォーマット: glTF 2.0 (.glb)
- ポリゴン数: モバイル考慮で 1 モデル 5 万ポリゴン以下を目安
- テクスチャ: 1024 ベース、PBR 標準(BaseColor / Roughness / Metallic / Normal / AO)
- スケール: メートル単位
- 原点: モデルの底面中央に配置(配置時の計算が簡単になる)
- 命名: `furniture/{category}/{product-id}.glb`

カテゴリ:
- ソファ(`sofa`), 椅子(`chair`), ダイニングテーブル(`dining-table`)
- ベッド(`bed`), デスク(`desk`), 収納(`storage`)
- キッチン家電(`kitchen-appliance`), 浴室什器(`bath-fixture`)
- ライト(`lighting`), 観葉植物(`plant`)

詳細な調達戦略は次章 §16。

### 15.6 3D 内編集モード

3D ビューでは **意匠決定(家具配置 + 仕上げ材)に専念** させる。
構造的な編集(壁・部屋・窓・ドアの追加削除)はすべて 2D に誘導する設計判断。

#### 15.6.1 編集できる操作

| 操作 | 対象 | UI |
|---|---|---|
| 家具配置 | カタログから選んでドラッグ | 右ペインに家具カタログ、3D 空間にドラッグ&ドロップ |
| 家具移動 | 床面に拘束された XZ 平面移動 | クリック → 矢印ギズモ |
| 家具回転 | Y 軸回転(15° スナップ) | クリック → 円形ギズモ |
| 家具差し替え | 同カテゴリ内の別モデル | 右クリック → 「別のソファに変える」 |
| 床材変更 | 部屋単位 | 部屋床をクリック → マテリアルパレット |
| 壁材変更 | 壁面 or 部屋単位 | 壁面をクリック → マテリアルパレット |
| 天井材変更 | 部屋単位 | 天井をクリック → マテリアルパレット |
| 窓カーテン | 窓単位 | 窓をクリック → カーテンパレット |
| ドア材質 | ドア単位 | ドアをクリック → ドアスタイルパレット |
| 照明配置 | 天井・壁面 | カタログから配置(明るさ固定値、リアルタイム影は将来) |

#### 15.6.2 2D に誘導する操作

| 操作 | 動作 |
|---|---|
| 壁の追加・削除 | 「2D で編集できます。切り替えますか?」ダイアログ |
| 部屋の追加・削除・サイズ変更 | 同上 |
| 窓・ドアの位置・サイズ変更 | 同上 |
| 柱・PS の追加・削除 | 同上 |
| 階の追加 | 同上 |

OK 押下で 2D に切替し、該当要素を **ハイライト + パンしてフォーカス**。

#### 15.6.3 家具配置のスナップとフィードバック

| ルール | 動作 |
|---|---|
| 壁に 50mm 以内で接近 | 壁にスナップ(背面が壁に密着) |
| 家具同士の接近 | スナップなし(自由配置) |
| 部屋外への配置 | 半透明赤で「配置不可」フィードバック、離すと元位置に戻る |
| 床への拘束 | 常に床面 Y = 0 に配置、空中浮遊不可 |

机上のオブジェクト(花瓶・本等)は将来の拡張カテゴリ(`tabletop`)として別途扱う。

#### 15.6.4 マテリアル変更のデータ保存

仕上げ材の選択は **永続データとして `Floorplan` に保存される**(次回開いても再現)。
型定義は **§5.10 が正本**、保存場所は `Floor.roomFinishes` / `Floor.wallFinishes`(§5.2 参照)。
天井は独立型ではなく `RoomFinish.ceilingMaterialId` で表現する。

マテリアルパレットには §15.2 の有限セットを表示(木フローリング 5 種、畳 2 種、
タイル 4 種、クロス壁 8 種、コンクリート打ちっぱなし 1 種、塗り壁 3 種、ガラス、
ステンレス、人工大理石、塗装木材、レンガ等)。

#### 15.6.5 編集モード切替の状態保持

- 2D ↔ 3D の切替時、選択中の要素・カメラ位置・ズーム倍率を保持
- 3D で配置した家具・仕上げ材は 2D ビューでも反映される(2D は簡略表示、家具は上面アイコンで)
- ただし 2D で削除した部屋に紐づく家具・仕上げ材は自動削除(整合性維持)

---

## 16. 3D アセット調達戦略

**位置づけ:** Phase 2 着手前(=Phase 1 完了直前)に決着が必要な、最大級のリスク項目。
フォトリアル 3D を諦めるとプロジェクトの差別化要素が大幅に弱まるが、**PoC 結果次第では家具点数を縮小、品質を下げる判断を許す**(§15.1 PoC ゲート参照)。

| 段階 | 同梱点数の目標 | PoC 達成条件 |
|---|---|---|
| Phase 2 リリース最低ライン | **15 点**(主要家具のみ:ソファ・ダイニング・ベッド・デスク等) | PBR + 影 + 30fps |
| Phase 2 通常ライン | **30 点** | 上記 + Tone Mapping + AO |
| Phase 2 ストレッチ | 50 点 | 上記 + HDRI 切替 + 60fps |
| Phase 3 拡充 | 150 点 | Phase 2 ストレッチ達成後にだけ目指す |

### 16.1 候補ソース

| ソース | ライセンス | 質 | コスト | 数 |
|---|---|---|---|---|
| **Poly Haven** | CC0 | 高 | 無料 | 数百 |
| **Sketchfab CC0/Free** | 様々 | 中〜高 | 無料(要確認) | 数千 |
| **Sketchfab Pro Subscription** | 商用可 | 高 | 月 $79〜 | 数万 |
| **TurboSquid** | 商用可(個別) | 高 | 1 モデル $5〜100 | 多数 |
| **CGTrader** | 同上 | 高 | 1 モデル $1〜50 | 多数 |
| **IKEA 公式 3D ライブラリ** | 商用要相談 | 高 | 無料(要申請) | 数百 |
| **無印良品** | 同上 | 高 | - | (調査中) |
| **オリジナル制作** | 自社 | 任意 | 1 モデル数千〜数万円(外注) | 任意 |

### 16.2 戦略案

§16 冒頭の点数ラダー(15 / 30 / 50 / 150)と整合させる。**50 点は Stretch 扱い**であり、
Phase 2 リリースの必達ラインではない。

**Phase 2 リリース最低ライン(15 点)の構成:**
- Poly Haven CC0: 12 点(主要家具のみ:ソファ・ダイニング・ベッド・デスク等)
- Sketchfab CC0 or オリジナル: 3 点(差別化となる代表家具)

**Phase 2 通常ライン(30 点)の構成:**
- Poly Haven CC0: 22 点
- Sketchfab CC0: 6 点
- オリジナル / IKEA 申請: 2 点

**Phase 2 Stretch(50 点)の構成 ※ PoC で 60fps + HDRI 切替が許容できた場合のみ目指す:**
- Poly Haven CC0: 30 点
- Sketchfab CC0: 15 点
- オリジナル / IKEA 申請: 5 点

**Phase 3 拡充(150 点)の構成 ※ Phase 2 Stretch を達成後にだけ目指す:**
- Poly Haven 追加: 60 点
- Sketchfab Pro 月額契約で拡充: 70 点
- オリジナル制作: 20 点(主要家具メーカーの代表モデル風)

### 16.3 制作品質基準

すべての家具モデルは以下を満たすこと:
- ポリゴン数 5 万以下
- PBR テクスチャ完備
- スケール正確(メートル単位)
- 原点が底面中央
- 透過テクスチャは事前にチェック(WebGL での描画コスト)

### 16.4 ライセンス管理

`public/furniture/LICENSES.md` にすべてのモデルの出典・ライセンス・URL を記録。
商用 OK でも著作者表記が必要なものは UI の「クレジット」画面に表示。

---

## 17. PDF 出力

業者打ち合わせの叩き台として持参・送付できる PDF を出力する。
JIS A 0150「建築製図通則」の **必須記号のみ** をサポートし、L2 レベルに見合うシンプルさを保つ。

### 17.1 用紙サイズと向き

ユーザーが書き出し時に選択(既定 A3 横):

| ID | サイズ | 用途 |
|---|---|---|
| `a3-landscape`(既定) | 420 × 297 mm | 業者持参用、現場標準 |
| `a4-portrait` | 210 × 297 mm | メール送付・家庭印刷 |
| `a4-landscape` | 297 × 210 mm | 横長間取り向け、家庭印刷 |

### 17.2 JIS 図面記号(採用範囲)

L2 レベルに必要な記号のみ採用。設備記号・通り芯記号・仕上げ表は不採用(§1.5 非目標と整合)。

| 記号 | 採用 | 描画仕様 |
|---|---|---|
| ドア(片開き・両開き) | ◯ | 開閉軌跡を 1/4 円弧で表記 |
| ドア(引戸) | ◯ | 二重平行線 + 移動方向矢印 |
| ドア(折戸) | ◯ | 折れ線 + 軌跡円弧 |
| 窓(引違い) | ◯ | 二重線 + 中央サッシ |
| 窓(片開き・上げ下げ・FIX) | ◯ | 開閉方向の細線 |
| 階段 | ◯ | 上り矢印「UP」+ 段数表記、踏面分割線 |
| 構造柱 | ◯ | 黒塗り正方形 105×105mm |
| 寸法線 | ◯ | 矢印 + 寸法値(mm)、外周は通り寸法 |
| 部屋名・面積 | ◯ | 部屋中央に「リビング 18.0㎡(10.9 帖)」 |
| 方位記号 | ◯ | 北矢印(右上配置) |
| スケールバー | ◯ | 1m / 5m / 10m の物理寸法線 |
| 設備記号(コンセント・スイッチ等) | ✕ | L2 ではノイズ、Phase 拡張で再検討 |
| 通り芯記号(X1, Y1) | ✕ | 構造設計の領域 |
| 仕上げ表 | ✕ | 別ページ案、現時点では非対応 |

### 17.3 ページレイアウト(A3 横の例 / Phase 3 完成形)

> 下図は Phase 3 完成形(複数階対応後)の例。**Phase 1 では「階数: 1 階」/「1F:」のみ**となり、
> 2F・3F の行と「Page 1/2」の複数ページ表記は出ない。

```
┌─────────────────────────────────────────────────────────┐
│ 間取りプラン: ○○邸 3LDK 南向き             2026-05-09 │  ← ヘッダー(プラン名 + 日付)
├──────────────────────────────────┬──────────────────────┤
│                                  │  ◯ プラン情報         │
│                                  │   延床: 99㎡(30坪)  │
│                                  │   構造: 木造在来      │
│                                  │   階数: 2 階建て      │
│       1F 平面図                  │                       │
│       (主要図面)                │  ◯ 部屋一覧          │
│                                  │   1F:                 │
│                                  │   ・LDK 18.0㎡       │
│                                  │   ・キッチン 4.5㎡    │
│  ↑N  📏 1m  5m  10m              │                       │
│                                  │   2F:                 │
│  縮尺 1/100                      │   ・主寝室 12.0㎡    │
│                                  │   ・子供部屋 6.0㎡   │
│                                  │                       │
├──────────────────────────────────┴──────────────────────┤
│ 免責: 本アプリの出力は参考です。実施には建築士の確認を要します。 │  ← フッター(§1.6 短縮版)
│ Generated by 間取りプランナー v1.0      Page 1/2          │
└─────────────────────────────────────────────────────────┘
```

#### ページ構成

**Phase 1(`floors.length = 1` 固定):**

| ページ | 内容 |
|---|---|
| 1 | 平面図 + プラン情報 + 部屋一覧 + 方位 + スケール |
| 末尾 | 法規警告サマリ(ack 含めず未承認警告のみ列挙)|

**Phase 3 以降(複数階対応・階段機能とセット):**

| ページ | 内容 |
|---|---|
| 1 | 1F 平面図 + プラン情報 + 部屋一覧 + 方位 + スケール |
| 2 | 2F 平面図 + 部屋一覧(2F 分)|
| 3 | 3F 平面図(あれば)|
| 末尾 | 法規警告サマリ(ack 含めず未承認警告のみ列挙)|
| 末尾(オプション、Phase 2 以降) | 3D ビュー静止画(ユーザーが選んだアングル 1〜3 枚)|

#### A4 縦の場合

横スペースが狭いので、右ペインを「下ペイン」に変更:

```
┌─────────────────────────┐
│ ヘッダー                │
├─────────────────────────┤
│                         │
│      1F 平面図          │
│                         │
├─────────────────────────┤
│ プラン情報 / 部屋一覧   │
├─────────────────────────┤
│ 免責 / フッター         │
└─────────────────────────┘
```

### 17.4 スケール(縮尺)選定

実装ロジック:

```typescript
function selectScale(
  paperRect: { w: number; h: number },     // 用紙の有効描画領域(mm)
  planBbox: { w: number; h: number },      // 間取りの外接矩形(mm)
): number {                                // 戻り値: 縮尺の分母 (50, 100, 200)
  const candidates = [50, 100, 200];
  for (const denom of candidates) {
    const scaledW = planBbox.w / denom;
    const scaledH = planBbox.h / denom;
    if (scaledW <= paperRect.w && scaledH <= paperRect.h) {
      return denom;  // 用紙に収まる最も大きいスケール
    }
  }
  return 200;  // 最大プランでも 1/200 で収まらない場合の fallback(警告ログ)
}
```

ユーザーは 1/50, 1/100, 1/200 のいずれかに **手動固定可**(自動推奨が気に入らない場合)。
固定値が用紙に収まらない場合は警告 + プレビューで切り抜けを表示。

### 17.5 実装方針

| 項目 | 採用 |
|---|---|
| ライブラリ | **jsPDF**(クライアント完結、PWA で動く) |
| 図面ベクター | **Konva の `toDataURL({ pixelRatio: 4 })`** で高解像度 PNG → PDF に貼り込み |
| テキスト・記号 | jsPDF のベクターテキストで描画(検索可能 PDF) |
| フォント | Noto Sans JP を埋め込み(日本語文字化け防止) |
| 日本語縦書き | 不要(間取り図に縦書きは出てこない) |

ベクター完全ではないが、Konva ステージを高解像度 PNG にして埋め込む方式で **印刷品質は十分**。
真のベクター PDF が必要なら svg-to-pdf 系のライブラリを Phase 拡張で検討。

### 17.6 出力後のメタデータ

PDF の `Subject` / `Author` / `Producer` フィールドに以下を埋め込み(§3.7.4 プライバシーと整合):

| フィールド | 既定値 | opt-in で追加される値 |
|---|---|---|
| Title | プラン名(空ならファイル名) | - |
| Subject | "間取りプラン - 業者打ち合わせ用" | - |
| Author | **空** | 設定 → エクスポートで「自分の名前を PDF に含める」を ON にした時のみ、ユーザーが入力した名前 |
| Producer | "間取りプランナー v1.0" | - |
| Keywords | プラン種別、tags(`recommendedBuildingType` 等) | - |
| CreationDate | 出力時刻 | - |

> **既定値の理由:** `Author` を既定で埋めると、PDF を業者やチャットに送ったときに本名や
> アプリ環境名が意図せず漏れる事故が発生しうる。プライバシーは opt-in 側に倒す。
> ユーザーがオンにした時の入力値は localStorage(`pdfAuthor`)に保存。

ファイル名命名: `<プラン名>_<YYYYMMDD>.pdf`(例: `田中邸_20260509.pdf`)

---

## 18. 付録

### 付録 A: 用語集

| 用語 | 意味 |
|---|---|
| 共有壁 (shared wall) | 2 つの部屋にまたがる壁 |
| スナップ (snap) | ドラッグ中に近接する壁同士をぴったり接合させる動作 |
| 尺モジュール | 日本の建築標準寸法。910mm = 半間 |
| 居室 | 採光・換気が必要な部屋(寝室・リビング等)。建築基準法用語 |
| 開口部 (opening) | ドアのない通り抜け空間 |
| **耐力壁** | **建物を支える構造上の壁。撤去できない** |
| **戸境壁** | **マンションで隣戸との境界となる壁。撤去できない** |
| **間仕切り壁** | **部屋を仕切る非構造壁。撤去・移動可能** |
| **PS** | **パイプスペース。給排水・ガス管の縦シャフト** |
| **柱芯々(壁芯)** | **柱の中心線で測る寸法。建築面積の計算基準** |
| **内寸(有効寸法)** | **壁の内側で測る室内有効寸法** |
| **PBR** | **Physically Based Rendering。物理ベースレンダリング** |
| **AO** | **Ambient Occlusion。環境光遮蔽。陰影を強化する 3D 技法** |
| **HDRI** | **High Dynamic Range Image。3D 環境光マップ** |

### 付録 B: 参考リンク

- 参考プロダクト: iCanDesign Room Planner / [drafted.ai](https://www.drafted.ai/)
- Konva.js: https://konvajs.org/
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/
- @react-three/drei: https://github.com/pmndrs/drei
- @react-three/postprocessing: https://github.com/pmndrs/postprocessing
- framer-motion: https://www.framer.com/motion/
- Radix UI: https://www.radix-ui.com/
- shadcn/ui: https://ui.shadcn.com/
- Poly Haven: https://polyhaven.com/
- Inter: https://rsms.me/inter/
- JetBrains Mono: https://www.jetbrains.com/lp/mono/

### 付録 C: 法規参照(新設)

本ツールが警告として出す法規項目の参照元と要件。

> **重要:** 本ツールの法規警告は**目安であり、実設計時には必ず建築士・専門家の確認を要する**。地域条例、用途地域、特定行政庁の運用差異により、実際の適用は異なる場合がある。

#### C.0 法規ルールのデータモデル

§1.6.3 の「5〜10 年に 1 回チェック」では実装時に粒度が粗い。各法規ルールに以下のメタを必ず持たせ、
警告メッセージ・付録 C・PDF サマリで参照する。

```typescript
// src/data/legalRules.ts
type LegalRule = {
  id: string;                      // "lighting-min-1over7"
  category: ComplianceCategory;    // §5.9
  title: string;                   // 「居室の採光面積(住宅)」
  ruleCitation: string;            // 「建築基準法第28条第1項」(警告 message に出す)
  sourceUrl: string;               // e-Gov の法令 URL(現行版)
  lawVersion: string;              // 参照した法令の改正版識別子(例 "令和6年6月1日施行")
  lastVerifiedAt: string;          // ISO8601。最後に開発者が条文を見て突き合わせた日
  appRuleVersion: number;          // 本アプリ実装側のロジック世代。閾値や式を変えたらインクリメント
  severity: ComplianceSeverity;    // §5.9
};
```

運用ルール:

- `lastVerifiedAt` から **18 ヶ月** が経過したルールは CI で警告(自動的に `forge_self_check` の
  類似で開発者にチェック依頼)
- ロジック式・閾値を変えたら `appRuleVersion` を +1。`Floorplan.metadata.acknowledgedWarnings` に
  ack 済み警告がある場合、`appRuleVersion` 変化後の警告は **自動 ack を引き継がない**(ID に
  `appRuleVersion` を含めることで決定論的に分離する)
- §1.6.3 の「5〜10 年に 1 回」は **ルール単位の `lastVerifiedAt` で代替**。広域な法改正イベントは
  別途リリースノートに残す

警告 ID 生成式の更新(§5.9.1 の補足):

```
id = `${rule.id}@v${rule.appRuleVersion}:${affectedRoomIds.join(",")}`
```


#### C.1 採光(建築基準法第28条第1項)

| メタ | 値 |
|---|---|
| `id` | `lighting-min-1over7` |
| `sourceUrl` | https://laws.e-gov.go.jp/law/325AC0000000201 |
| `lawVersion` | (実装時に確認した最新施行版を記入) |
| `lastVerifiedAt` | (実装時に記入) |
| `appRuleVersion` | 1 |

居室には、採光のための窓その他の開口部を設け、その採光に有効な部分の面積は、当該居室の床面積に対して、住宅にあっては 1/7 以上としなければならない。

実装での扱い(§6.6.0 の `sumLightingArea` と一致):
- `requiresWindow: true` のプリセット(リビング、寝室、子供部屋等)に対し、当該部屋の床面積 × 1/7 と窓有効面積を比較
- 窓有効面積 = 窓面積 × 採光補正係数(隣地までの距離に応じて 0.7〜1.0 を目安)
- Phase 1 では補正係数を 1.0 固定とし、警告精度を Phase 2 で向上(`appRuleVersion` を +1 して切替)

#### C.2 換気(建築基準法第28条第2項)

| メタ | 値 |
|---|---|
| `id` | `ventilation-min-1over20` |
| `sourceUrl` | https://laws.e-gov.go.jp/law/325AC0000000201 |
| `lawVersion` | (実装時に確認した最新施行版を記入) |
| `lastVerifiedAt` | (実装時に記入) |
| `appRuleVersion` | 1 |

居室には換気のための窓その他の開口部を設け、その換気に有効な部分の面積は、その居室の床面積に対して、1/20 以上としなければならない。

実装(§6.6.0 と一致):
- 開放可能率は窓種別ごとに `openableRatio(type)` を適用
  - `fixed` = 0(FIX 窓は換気面積に算入しない)
  - `sliding-2` / `sliding-4` / `bay` = 0.5
  - `casement` = 1.0
- 居室床面積 × `preset.minVentilationRatio`(居室は 1/20)と `sumVentilationArea` を比較
- 機械換気の有無は Phase 1 では考慮しない(設備配置の `mechanical-ventilation` は Phase 3 で導入予定)

#### C.3 廊下幅(建築基準法施行令第119条)

| メタ | 値 |
|---|---|
| `id` | `circulation-corridor-shared`(参照のみ。本アプリでは警告対象外) |
| `sourceUrl` | https://laws.e-gov.go.jp/law/325CO0000000338 |
| `lawVersion` | (実装時に確認した最新施行版を記入) |
| `lastVerifiedAt` | (実装時に記入) |
| `appRuleVersion` | 1(本アプリでは警告を出さない) |

別途、住戸内廊下の info 警告(§6.6.4):

| メタ | 値 |
|---|---|
| `id` | `circulation-corridor-in-unit-780` |
| `sourceUrl` | (実務推奨。法令引用なし) |
| `lawVersion` | n/a |
| `lastVerifiedAt` | (実装時に記入) |
| `appRuleVersion` | 1 |

共同住宅の住戸の床面積の合計が 100m² を超える階の共用廊下:両側に居室がある場合 1.6m 以上、その他の場合 1.2m 以上

実装:
- 本アプリは §1.5 により **1 住戸単位** での編集に限定し、**共用廊下はスコープ外**(法令の参照のみ記載)
- 警告として出すのは住戸内廊下の推奨値 780mm のみ(§6.6.4 で `info` 扱い)

#### C.4 寝室の避難経路

(法令ではないが推奨される設計原則)寝室は、火災時に廊下経由で玄関まで到達できる経路を確保すべき

実装:
- 寝室から玄関まで、ドア・開口部経由のグラフ探索で到達可能か判定

#### C.5 階段寸法(建築基準法施行令第23条)

| メタ | 値 |
|---|---|
| `id` | `stair-dimensions-residential` |
| `sourceUrl` | https://laws.e-gov.go.jp/law/325CO0000000338 |
| `lawVersion` | (実装時に確認した最新施行版を記入) |
| `lastVerifiedAt` | (実装時に記入) |
| `appRuleVersion` | 1 |

住宅の階段:踏面 15cm 以上、蹴上げ 23cm 以下、幅 75cm 以上

(Phase 3 階段機能で実装)
