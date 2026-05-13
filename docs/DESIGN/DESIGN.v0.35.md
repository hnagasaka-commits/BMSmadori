# 間取りプランナー Web アプリ 設計書

> Version: **0.35** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (FPV 再増速 + DXF 名そのまま + CAD 取込で 144 設備認識)
>
> ## v0.34 → v0.35 の主な変更
>
> ### M150 FPV 移動速度の再増速
>
> ユーザーフィードバック「もっと速くして」を受け、v0.34 で 2.4 / 9.0 m/s に
> 設定していた FPV 速度を更に増速:
>
>  - 通常: 2.4 m/s → **4.5 m/s** (約 1.9×、ジョギング相当)
>  - Shift ダッシュ: 9.0 m/s → **15.0 m/s** (約 1.7×、全力疾走相当)
>
> 広いフロア (例: 工場テンプレ 32m×22m、商業施設テンプレ 28m×18m) でも、
> 端から端まで Shift 押下で 2 秒程度に短縮される計算。
>
> 視点回転速度 (PointerLockControls の感度) は変更なし。
>
> ### M151 DXF ファイル名を間取り名そのまま
>
> 旧 (v0.28〜v0.34): `downloadFloorplanAsDxf` は filename を `[^\w\-.]+` で
> サニタイズしていた。`\w` は ASCII 英数字 + `_` のみマッチするので、日本語名
> (例: 「オフィスビル (中規模1フロア)」) 全てが `_` 化されて
> `_______.dxf` のような無意味な名前で出力されていた。
>
> 新仕様:
>  - OS のファイル名 **真の禁止文字** だけを `_` 置換: `/ \ : * ? " < > |` (9 文字)
>  - 日本語 / 括弧 (全角 / 半角) / 空白 / ハイフンなどは **そのまま保持**
>  - trim 後に空文字なら `floorplan` をフォールバック
>
> 結果: 「オフィスビル (中規模1フロア)」→ `オフィスビル (中規模1フロア).dxf` で
> ダウンロードされる。
>
> ### M152 CAD 取込で 144 設備マスターを直接認識
>
> 旧 `classifyLayer` は substring 判定で 9 種の旧 BMS catalog (ceiling-light-led /
> smoke-detector 等) にしかマップできなかった。equipment-master の 144 種は認識外で、
> DXF round-trip では情報が落ちていた。
>
> 新仕様 (M152):
>  1. **最優先で equipment-master id 直接マッチ**
>     - 正規表現 `/^[EPAGSKB]-\d{3}$/` でレイヤー名がカタログ id 形式かを判定
>     - 一致したら `useEquipmentMasterStore.getState().byId.get(layerName)` で spec を取得
>     - spec が見つかれば `{ kind: 'equipment', catalogId: spec.id, mountTo: spec.placement }` を返す
>  2. 該当しなければ **従来の substring 判定にフォールバック** (E-LIGHT / SD / 煙感知 等)
>
> `buildFloorplanFromDxf` の equipment 抽出ループも修正:
>  - 旧: `getCatalogEntry(role.catalogId)` で `null` ならスキップ → 新 ID を全部弾いていた
>  - 新: `getCatalogEntry` OR `useEquipmentMasterStore.byId.get` のどちらかで存在すれば受け入れ
>
> 効果:
>  - v0.34 の DXF exporter が書き出す `E-001` / `S-201` / `K-005` などのレイヤー名を
>    完全に round-trip で復元できる
>  - 144 種すべての placement (天井 / 床 / 壁 / 屋上 / 屋外) が DXF → Floorplan 復元時に
>    正しく `FurnitureInstance.mountTo` に反映
>
> ### v0.35 で扱わない範囲
>
> 1. **DXF 取込時の equipment-master ロード待ち** — 起動直後にロード前で DXF を開くと、
>    spec 直接マッチが効かない (substring 判定にフォールバック)。ロード後に
>    再 import すれば正しく認識される。将来 `await ensureEquipmentMasterLoaded()` を
>    `importDxfText` 内に挟む改修が望ましい
> 2. **note フィールドの DXF 反映** — `EquipmentSpec.note` を DXF の TEXT 注記に
>    含めるのは未実装
> 3. **広範な日本語ファイル名サポート確認** — Safari / Firefox での日本語 download
>    属性の挙動はブラウザ依存。Chromium / 最近の Safari は問題なし
>
> v0.34 以前の §1〜§17 はそのまま継承。
