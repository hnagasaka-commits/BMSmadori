# 間取りプランナー Web アプリ 設計書

> Version: **0.31** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (BMS 10 施設タイプ テンプレ + 事前配置設備)
>
> ## v0.30 → v0.31 の主な変更
>
> 用途モード (住宅 / BMS) の分離 (v0.30) を実装したので、BMS 側のテンプレートを
> 10 種類同梱する。各テンプレは **典型的な部屋構成 + 必要最低限の点検設備
> (照明 / 感知器 / スプリンクラー / 誘導灯 / 消火栓 / 分電盤 / 受信機 / 送水口など)** を
> 事前配置済の状態で開く。
>
> ### M136 builder.ts に furniture / usageMode / structureType を受け口追加
>
> 旧 `buildTemplateFloorplan(rooms, options)` を以下に拡張:
>
> ```ts
> buildTemplateFloorplan(
>   rooms: RoomSeed[],
>   options: TemplateOptions,            // + usageMode, structureType, isExistingBuilding, ceilingHeight
>   furniture: FurnitureSeed[] = [],     // §M136 v0.31: 事前配置設備
> ): Floorplan
> ```
>
>  - `FurnitureSeed = { catalogId, position, rotation?, mountTo? }`
>  - `RoomSeed.customName?` を追加 (= 「サーバー室」「処置室」など preset.displayName を上書き)
>  - options で `usageMode`, `structureType`, `isExistingBuilding`, `ceilingHeight` を制御
>  - 既存の住宅 3 テンプレは挙動変わらず (furniture 未指定 → 空配列)
>
> ### M137 BMS テンプレ 10 種を `data/templates/bms.ts` に同梱
>
> | id | displayName | 概算延床 | 主な部屋 | 主な設備 |
> |---|---|---|---|---|
> | bms-office-building | オフィスビル | 240 ㎡ | ロビー / 執務室 ×2 / 会議室 / 機械室 / 電気室 | E-006 / K-005 / A-001 / A-101 / E-101 / K-101 / S-201 / K-210 / S-401 |
> | bms-commercial | 商業施設 | 390 ㎡ | ロビー / 店舗 ×2 / 共用廊下 / 倉庫 / 機械室 / 電気室 | S-001 (格子) / K-018 / E-201 / S-401 ×2 |
> | bms-hospital | 病院・医療施設 | 240 ㎡ | ロビー / 受付 / 診察室 ×3 / 給湯室 | K-002 / P-201 / K-101 / S-106 |
> | bms-hotel | ホテル・宿泊施設 | 290 ㎡ | ロビー / レストラン / 客室 ×4 | スプリンクラー / 誘導灯 / 高置水槽 / 排煙機 |
> | bms-school | 学校・教育施設 | 420 ㎡ | 昇降口 / 職員室 / 教室 ×4 / 倉庫 | E-007 (大型蛍光灯) / K-018 / S-201 ×2 / S-402 |
> | bms-factory | 工場・倉庫 | 520 ㎡ | 大空間倉庫 / 管理事務所 / 機械室 / 電気室 | 高天井 E-007 / 大規模スプリンクラー格子 / G-101 |
> | bms-apartment | マンション・集合住宅 | 320 ㎡ | エントランス / 管理人室 / 住戸 ×4 | P-301 / P-401 / P-402 |
> | bms-public | 公共施設 | 380 ㎡ | 市民ロビー / 受付 / 執務 / 会議室 | A-101 ×2 / E-101 / K-101 / E-102 |
> | bms-datacenter | データセンター | 330 ㎡ | 入退室管理 / 監視室 / **サーバー室** / 電気室 / 空調機械室 | A-101 ×8 / G-101 ×3 (CO2 消火) / K-008 (アナログ感知器) ×9 / S-402 |
> | bms-mixed-use | 複合施設 | 580 ㎡ | ロビー / 商業 ×2 / オフィス / ホテル ×2 | スプリンクラー / 高置水槽 / 排煙機 / 多数の誘導灯 |
>
> 設備配置のヘルパー (`bms.ts` 内):
>  - `gridLights(rect, cols, rows, id)`     部屋内に格子状に天井照明を撒く
>  - `roomCenter(rect, id)`                 部屋中央に 1 個 (ACカセット / 大型シーリング)
>  - `wallMount(rect, side, id, t=0.5)`     側面 N/S/E/W に壁付設備 (内側に offset)
>  - `detectors(rect, count, id)`           感知器を long-side に等間隔
>  - `sprinklerGrid(rect, id='S-001')`      3500mm ピッチでヘッド格子配置
>  - `eq(id, x, y, rotation?)`              単体配置。`PLACEMENT[id]` から mountTo を自動引き
>
> 内部マップ `PLACEMENT: Record<EquipmentId, FurnitureMount>` で 137 種のうち
> 主要 ~45 種の mountTo を持つ (= `equipment-master.json` が未ロード状態でも mountTo が
> 確実にセットされる)。
>
> ### M138 TemplateCard に `usageMode` 追加 / Home フィルタ
>
> ```ts
> export type TemplateCard = {
>   ...
>   /** §M136 v0.31: 'residential' | 'bms' (未指定は 'residential') */
>   usageMode?: UsageMode
> }
>
> export function listTemplatesForUsage(usage: UsageMode): readonly TemplateCard[]
> ```
>
> Home ピッカーは「テンプレートから作成」を開いたとき、選択中の usageMode で
> `listTemplatesForUsage` を呼んでフィルタする。住宅 → 平屋 1LDK/2LDK/3LDK の 3 種、
> BMS → 10 種の施設タイプ。
>
> ピッカー上部には用途モードチップ (緑=住宅 / 紺=BMS) を常時表示。テンプレリストは
> max-height 480px のスクロール領域で 10 件並べる。
>
> ### M139 テスト整合 (TC-Q)
>
> `data/__tests__/templates.test.ts` の `TC-Q` で furniture 空チェック
> (`expect(plan.floors[0].furniture).toEqual([])`) を撤去:
>  - Phase 3 では furniture は許容される (`PHASE_FORBIDDEN['3'] = []`)
>  - BMS テンプレは設備を事前配置するので空ではない
>  - 残った不変条件チェック (columns / pipeSpaces 空、floors.length === 1) は維持
>
> ### v0.31 で扱わない範囲 (今後)
>
> 1. **多階層テンプレ** — 現状は全テンプレが 1 階フロア。複合施設 (オフィス+商業+ホテル) は
>    本来 3 階以上の縦積みだが、v0.31 では 1 フロアにまとめている
> 2. **テンプレに天井高 / 床材を per-room で設定** — 現状は floor.ceilingHeight 一律。
>    将来は サーバー室 3000mm、執務 2700mm のように混在させたい
> 3. **設備の点検履歴データ** — `lastInspectedAt` フィールド (v0.29 で予約済) のテンプレ
>    側の事前データは未対応
>
> v0.30 以前の §1〜§17 はそのまま継承。
