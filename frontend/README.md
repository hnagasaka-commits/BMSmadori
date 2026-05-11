# 間取りプランナー (Floorplan Planner) — Phase 1

業者打ち合わせの叩き台に使える 2D 間取りエディタ。
設計書: [docs/DESIGN.md](../docs/DESIGN.md)

## Phase 1 で動くもの

- 矩形部屋の追加・移動・90° 回転・リサイズ・削除 + 重なり阻止 + グリッドスナップ
- 自動スナップ・自動ドア配置 (削除した自動ドアは tombstone で再生成抑止)
- 壁種別 5 種の線種出し分け + 種別/ロック編集
- 窓の基本配置と寸法編集 (自由寸法、規格カタログ UI は Phase 2)
- 法規警告 (採光・換気・住戸内廊下・避難経路) + ack 機構 + フィルタ
- 方位設定とコンパス
- localforage 自動保存 / JSON エクスポート・インポート
- 同梱テンプレ 3 種 (平屋 1LDK / 2LDK / 3LDK) と Phase フィルタ
- 復旧プレビューモード M17 (将来 version の JSON / ER3-4)
- PDF / PNG エクスポート (§17、日本語フォント未埋込み)
- アンドゥ / リドゥ
- §3.7 セキュリティ:CSP / 入力サニタイズ / 10MB 上限

## 開発

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # 本番ビルド
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint
npm run test       # Vitest watch
npm run test:run   # Vitest 1 回実行
npm run e2e        # Playwright (要 npm run e2e:install で初回)
```

## テスト構成 (§12)

| 種類 | コマンド | 件数 | 範囲 |
|---|---|---|---|
| Vitest | `npm run test:run` | 177 | 純粋関数 / ストア / 法規 / PDF / テンプレ / パフォーマンス |
| Playwright E2E | `npm run e2e` | 9 | 主要導線 / テンプレ / 復旧プレビュー / 法規 ack / PDF/PNG ダウンロード |
| Playwright a11y | `npm run e2e -- e2e/a11y.spec.ts` | 2 | axe-core で critical 違反 0 |
| Playwright 視覚回帰 | `npm run e2e -- e2e/visual.spec.ts` | 2 | エディタ初期状態 / テンプレロード後 |

## ディレクトリ構成 (§10)

```
src/
├── types/              # §5 全型
├── data/               # 同梱データ (テンプレ / 部屋プリセット / 隣接ルール / 法規ルール / 設定)
├── core/               # ドメインロジック (geometry / walls / rebind / snap / doors / compliance / pdf / png)
├── store/              # Zustand ストア (floorplan / editor / history / compliance)
├── components/         # React 表示 (editor / canvas2d)
└── routes/             # 画面ルーティング (現状 Editor のみ)
```

## Phase 1 完了時のスコープ境界

- `Floorplan.floors.length === 1` を Zod superRefine で強制
- `columns / pipeSpaces / furniture / humanModels / voids` は常に空配列 (Phase 1.5+ で解放)
- 90° 回転のみ。15° スナップと SAT は Phase 2
- 商用テンプレ・複数階・階段・3D ・家具・PDF 日本語フォント埋込みは Phase 2 以降

## 開発時の落とし穴メモ

- Zustand v5 selector が `?? []` で新参照を毎回返すと **無限再レンダー** する。
  `src/store/floorplanStore.ts` の `EMPTY_*` / `CompliancePanel.tsx` の `EMPTY_ACKED` で安定参照を保つ。
- Konva の `onTap` は `KonvaEventObject<TouchEvent>` 型なので、`onClick` ハンドラと型を共有する場合は
  `KonvaEventObject<MouseEvent | TouchEvent>` にする。
- pdf-parse v2 は CJS の default export ではなく `PDFParse` クラスを `new` する API。
