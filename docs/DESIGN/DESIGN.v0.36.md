# 間取りプランナー Web アプリ 設計書

> Version: **0.36** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (DXF 日本語文字化け対策 + FPV ミニマップ)
>
> ## v0.35 → v0.36 の主な変更
>
> ### M153 DXF 出力の日本語文字化け対策
>
> 報告: DXF 出力で日本語 (部屋名 / 設備名 / シンボル) が文字化け。
>
> 原因:
>  - 旧仕様は AC1009 (R12) で UTF-8 文字をそのまま書き出していた
>  - AutoCAD の R12 は **システム codepage** (Windows JP は Shift-JIS) を期待する
>  - 結果、別 PC / 別 codepage の環境で開くと文字化け
>
> 対策 (二重防衛):
>
> #### (a) `$ACADVER` を AC1009 → AC1021 (R2007) に引き上げ
>
> R2007 以降の DXF は **UTF-8 をネイティブサポート** するため、新しめの CAD
> (AutoCAD 2007+ / BricsCAD / LibreCAD / dxf2svg 等) では UTF-8 でそのまま読める。
>
> #### (b) すべての非 ASCII 文字を `\U+XXXX` エスケープに置換 (escapeDxfText)
>
> AutoCAD/BricsCAD 標準の Unicode 表現。ファイルエンコーディングに依らず正しく解釈
> される (DXF spec 規定)。BMP 外 (U+10000 以降 = 絵文字など) はサロゲートペアに分割。
>
> ```ts
> function escapeDxfText(s: string): string {
>   let out = ''
>   for (const ch of s) {
>     const code = ch.codePointAt(0)!
>     if (code < 0x80) {
>       /* ASCII printable */
>     } else if (code <= 0xffff) {
>       out += '\\U+' + code.toString(16).toUpperCase().padStart(4, '0')
>     } else {
>       /* サロゲートペア分割 */
>     }
>   }
>   return out
> }
> ```
>
> 例:
>  - 「会議室α」→ `\U+4F1A\U+8B70\U+5BA4\U+03B1`
>  - 「リビング」→ `\U+30EA\U+30D3\U+30F3\U+30B0`
>
> #### (c) parser 側に `decodeDxfText` を追加 (round-trip 対応)
>
> 取込時に `\U+XXXX` パターンを `String.fromCharCode(parseInt(hex, 16))` で復号。
> v0.35 まで動いていた round-trip テストもエスケープ → 復元の経路で再合格。
>
> ### M154 FPV ミニマップ (画面右上に間取り図 + 現在地)
>
> 報告: 「FPV 中、自分がどの部屋にいるか分からない」。
>
> 解決:
>  1. **`editorStore` に FPV カメラ位置を追加**
>     - `fpvCameraXZ: [x, y] | null`、`fpvCameraYaw: number`
>     - `setFpvCamera(xz, yaw, floorIndex)` を editorStore に追加
>  2. **Canvas3D の `useFrame` で 10Hz throttle で更新**
>     - 60fps で毎フレーム setState すると React 再レンダー過多
>     - `lastSyncTimeRef.current += delta; if (>= 0.1) ...` で 100ms 周期に絞る
>     - yaw は `cam.getWorldDirection(forward); atan2(forward.x, -forward.z)`
>  3. **`FpvMiniMap.tsx` を新規作成**
>     - SVG 200×200px の小窓を画面右上に absolute 配置
>     - 全部屋 AABB を fit するスケール + offset を `useMemo` で計算
>     - 部屋: `<polygon>` (slate-200 塗り + slate-600 枠)
>     - 壁: `<line>` (slate-900 太線、freestanding 含む)
>     - 現在地: 赤丸 + yaw 方向の三角矢印
>     - ヘッダに 「`floor.name` · `現在いる部屋名`」を表示
>     - 部屋判定: 現在地が含まれる Room の AABB を走査して `customName` または
>       `preset.displayName` を引く
>     - 操作不可 (`pointerEvents: 'none'`)、半透明黒地 + backdrop-blur で 3D 描画と
>       重ねても視認性高い
>
> ### v0.36 で扱わない範囲
>
> 1. **複数階の FPV ミニマップ** — 現状は floor 0 (1F) のみ。多階建物では他階を
>    切り替えて見るには別 UI が必要
> 2. **設備の点滅マーカー** — 検索結果をミニマップ上で点滅させる演出は未実装
> 3. **ミニマップ拡大表示モード** — クリックで全画面オーバーレイなど将来検討
> 4. **DXF の絵文字 (BMP 外)** — escapeDxfText は対応済だが、実 CAD ソフトでの
>    サロゲートペア処理は実装依存。BMS 用途では絵文字は使わない前提
>
> v0.35 以前の §1〜§17 はそのまま継承。
