# 間取りプランナー Web アプリ 設計書

> Version: **0.37** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (DXF "ファイル破損" エラー修正)
>
> ## v0.36 → v0.37 の主な変更
>
> ### M155 DXF が AutoCAD で「This drawing file may be damaged.」と表示される不具合修正
>
> 報告: 出力した DXF を AutoCAD で開くと「This drawing file may be damaged.」が
> 表示されて開けない。
>
> 原因 (4 点):
>
> #### (1) AC1021 を宣言しているのに必須構造が不足
>
> v0.36 で `$ACADVER = AC1021` (R2007) を設定したが、R2007 形式は以下が必須:
>  - `CLASSES` セクション (空でも記述必要)
>  - 完全な `TABLES` (VPORT / LTYPE / LAYER / STYLE / VIEW / UCS / APPID /
>    DIMSTYLE / BLOCK_RECORD)
>  - 全エンティティに handle (group code 5)
>  - `OBJECTS` セクション (Dictionary 等)
>
> 本アプリは HEADER + ENTITIES + EOF のみだったので、R2007 検証で「damaged」判定。
>
> **対策**: 最も検証が緩い `AC1009` (R12) に降格。R12 は:
>  - HEADER + TABLES (LTYPE / LAYER / STYLE) + BLOCKS + ENTITIES + EOF だけで開ける
>  - handle 不要、CLASSES / OBJECTS 不要
>  - 1992 年から AutoCAD に標準サポート、現代の CAD ツールも互換読込可能
>
> #### (2) TABLES → LAYER が未定義のままレイヤー参照
>
> ENTITIES で `8 WALL` や `8 ROOM` などのレイヤーを使っていたが、LAYER テーブルに
> 定義が無かった。AutoCAD は未定義レイヤーを参照するエンティティを「damaged」と
> 見なすことがある。
>
> **対策**:
>  1. 全エンティティを一旦一時配列に書き出し
>  2. `collectLayersFromEntities` で使用レイヤー集合を抽出
>  3. TABLES → LAYER テーブルに動的に列挙
>
> ```ts
> // exporter 内部の二段階構成
> const entityLines: string[] = []
> floor.forEach((f) => appendFloorEntities(entityLines, f, bbox, yOffset))
> const usedLayers = collectLayersFromEntities(entityLines)
>
> pushHeader(out, ...)
> pushTablesSection(out, usedLayers)   // LAYER に動的列挙
> pushBlocksSection(out, usedBlocks)
> pushSectionStart(out, 'ENTITIES')
> out.push(...entityLines)
> ```
>
> #### (3) LWPOLYLINE は R14 (AC1014) 以降の要素
>
> 旧 exporter は AC1009 (R12) でも LWPOLYLINE を書き出していた。
>
> **対策**: R12 互換の `POLYLINE + VERTEX × N + SEQEND` の組合せに置き換え。
>  - `POLYLINE` 本体: `66 1` (entities follow フラグ), `70 1` (closed フラグ)
>  - 各 `VERTEX` に同じレイヤーを指定 + XYZ 座標
>  - `SEQEND` で終端を明示 (これが無いと AutoCAD damaged 判定)
>
> ```ts
> function pushPolyline(out, layer, pointsXY, closed) {
>   out.push('0', 'POLYLINE', '8', layer, '66', '1', '10', '0.0', '20', '0.0', '30', '0.0',
>            '70', closed ? '1' : '0')
>   for (const [x, y] of pointsXY) {
>     out.push('0', 'VERTEX', '8', layer, '10', dxfNum(x), '20', dxfNum(y), '30', '0.0')
>   }
>   out.push('0', 'SEQEND', '8', layer)
> }
> ```
>
> #### (4) BLOCK 未定義の INSERT 参照
>
> 設備の `INSERT` エンティティで block 名 (例: `E-001`, `S-201`) を参照していたが、
> BLOCKS セクションには `*MODEL_SPACE` / `*PAPER_SPACE` 以外定義が無かった。
> AutoCAD は未定義 block の INSERT を警告 / damaged 扱いにする。
>
> **対策**:
>  1. INSERT で参照される block 名集合を `collectBlocksFromEntities` で抽出
>  2. BLOCKS セクションに空の BLOCK スタブを動的定義
>
> ```ts
> function pushBlockStub(out, name, isPaper) {
>   out.push('0', 'BLOCK', '8', '0', '2', name, '70', isPaper ? '1' : '0',
>            '10', '0.0', '20', '0.0', '30', '0.0', '3', name, '1', '',
>            '0', 'ENDBLK', '8', '0')
> }
> ```
>
> ### 副次修正
>
> - HEADER に `$DWGCODEPAGE = ANSI_1252` / `$INSBASE` / `$EXTMIN` / `$EXTMAX` /
>   `$LIMMIN` / `$LIMMAX` を追加 (R12 の標準的な完全性)
> - 全 float 系 group code (40 等) の値を `dxfNum` 経由で `0.0` 形式に統一
>   (旧は `'250'` のように整数表現がある箇所があった)
> - 全エンティティに Z 座標 (`30 0.0` / `31 0.0`) を明示
>
> ### round-trip 互換
>
> §M153 v0.36 の `\U+XXXX` エスケープ + parser 側の `decodeDxfText` は維持。日本語
> も問題なく round-trip する。POLYLINE は parser が既に対応済 (v0.28 から)。
>
> ### v0.37 で扱わない範囲
>
> 1. **R14 (AC1014) 以降への再アップグレード** — LWPOLYLINE が使えると ENTITIES が
>    コンパクトになるが、R12 で十分動作するので保留
> 2. **AutoCAD-style handle (group 5)** — R12 では任意。R13 以降では必須
> 3. **OBJECTS セクション** — R12 では不要。R13 以降の現代 DXF に再対応するなら必要
>
> v0.36 以前の §1〜§17 はそのまま継承。
