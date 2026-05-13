# 間取りプランナー Web アプリ 設計書

> Version: **0.32** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (設備名称表示 + シンボル更新 + 3D ラベル)
>
> ## v0.31 → v0.32 の主な変更
>
> ### M140 PropertyPanel に設備マスター名称の lookup を追加
>
> 旧仕様: 家具タップ時、`getCatalogEntry(catalogId)` で家具カタログ entry を引き
> `entry.displayName` を表示。設備マスター由来の catalogId (`E-001` 等) は entry が
> null になるため **カタログ ID がそのまま表示** されていた (例: `E-001`)。
>
> 新仕様 (`FurnitureProperties`):
>  1. まず `getCatalogEntry(catalogId)` を試す (家具カタログ用)
>  2. null なら `useEquipmentMasterStore.getState().byId.get(catalogId)` を引いて spec を取得
>  3. `displayName = entry?.displayName ?? spec?.name ?? catalogId`
>
> 加えて、spec があるときは見出しを「設備」に変え、以下のプロパティ行を追加:
>  - 分類 (`spec.category` / placement の日本語ラベル)
>  - 寸法 (W × D × H mm)
>  - 記号 (`spec.symbol`)
>
> カタログ ID 行は残すが、フォントを小さく灰色にして補助情報の見栄えに。
>
> ### M141 equipment-master.json の刷新
>
> ユーザー提供の最新版で全 137 種の記号を統一フォーマット (枠付きシンボル) に更新。
> 主な差分:
>  - 旧 `非` → 新 `●非`、旧 `DL` → 新 `○DL`、旧 `FL` → 新 `▭FL` のように、形状+ラベル
>  - 旧 `配` → 新 `[配]`、`湯` → `[湯]` のように四角括弧で囲んで盤類を識別しやすく
>  - `S-202`: 名称を「放水口」→「放水口(屋内消火栓箱及び格納箱)」に更新 (より正確)
>
> metadata に追加されたフィールド:
>  - `description`: ファイル全体の説明
>  - `categoryColors.*.label`: カテゴリ英名 (Electrical / Plumbing / Air / Gas /
>    Sprinkler / Kasai / Bousai)
>  - `shapes`: 許容 shape 一覧 (`["rect", "square", "circle", "line"]`)
>  - `placements`: 許容 placement 一覧 (5 面)
>
> 型 `EquipmentMasterFile.metadata` をこれらに対応する optional フィールドで拡張。
> categoryColors の各エントリは `{ name, color, label? }` に。
>
> ### M142 3D で選択時に設備名フロート (HTML オーバーレイ)
>
> 旧: 3D 上で設備をクリックすると `select({kind:'furniture', id})` で右側
> PropertyPanel が更新されるだけ。3D シーン内では何が選択されているか把握しづらい。
>
> 新: spec ベースのメッシュ (= equipment-master 由来) が **isSelected || isDragging**
> のとき、`drei` の `<Html>` で高さ `h/2 + 0.15m` 上に黒地の名前ラベルを浮かべる:
>
> ```tsx
> <Html position={[0, h/2 + 0.15, 0]} center distanceFactor={8} style={{pointerEvents:'none'}}>
>   <div style={{ ... border: '2px solid' + categoryColor }}>
>     <span>{spec.symbol}</span> {spec.name}
>   </div>
> </Html>
> ```
>
>  - シンボル + フル名称 + カテゴリ色の枠付き
>  - distanceFactor=8 でカメラ距離に応じて自動スケーリング
>  - `pointerEvents: 'none'` でクリックを邪魔しない
>  - 同一カタログ ID が大量にある (例: ホテルテンプレ S-001 スプリンクラー数十個) 場合の
>    選択判別が容易になる
>
> ### M143 (申し送り) 設備件数の確認
>
> ユーザーから「全 144 個あるはず」とのフィードバック。本リリース時点の同梱
> `equipment-master.json` および提供された参照 JSON は両方とも **137 件** (E:25 / P:18 /
> A:12 / G:16 / S:21 / K:37 / B:8) で一致。追加の 7 件が必要な場合は、別途 ID と
> 仕様 (category / placement / shape / width / depth / height / symbol / name) の
> リストを共有いただければ即時追加可能。
>
> ### v0.32 で扱わない範囲
>
> 1. **設備件数 137 → 144 への増補** — 追加分の仕様が未提供のため保留
> 2. **3D 上のシンボル decal** — 現状は選択時のみ HTML フロート。常時表示は視認性を
>    損なうため避けている (将来、ユーザー設定で切替可にする予定)
> 3. **凡例パネル (Legend overlay)** — categoryColors + placementColors の表をオーバーレイ表示
>
> v0.31 以前の §1〜§17 はそのまま継承。
