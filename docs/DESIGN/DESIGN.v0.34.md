# 間取りプランナー Web アプリ 設計書

> Version: **0.34** (Draft)
> Last Updated: 2026-05-13
> Status: 実装中 (FPV 増速 + 設備 DXF 図面化 + 3D ドラッグ安定化)
>
> ## v0.33 → v0.34 の主な変更
>
> ### M147 FPV 移動速度の増速
>
> ユーザーフィードバック「BMS 点検でフロア端まで移動が遅い」を受け、人モデルの
> 一人称視点 (FPV) 移動速度を増速:
>
>  - 通常: 1.4 m/s → **2.4 m/s** (約 1.7×、早歩き)
>  - Shift ダッシュ: 7.0 m/s → **9.0 m/s** (約 1.3×、軽い小走り)
>
> 旧 1.4 m/s は標準的な歩行速度に合わせていたが、点検フロー全体の体感速度を優先。
> 視点回転速度 (`PointerLockControls` 既定) は変更なし。
>
> `Canvas3D.tsx` の `useFrame` 内 1 行 (`baseSpeed = keys.has('shift') ? 9.0 : 2.4`) で
> 完結する変更。
>
> ### M148 3D ドラッグの安定化
>
> 報告: 「3D で設備をドラッグするとバグる」(動きが飛ぶ / 離した瞬間に元位置に戻る /
> 高所設備で掴んだ点から離れた位置に飛ぶ)。
>
> 3 つの原因を特定し、対症療法を実施:
>
> #### (1) ドラッグ平面 Y を設備の現在 Y に合わせる
>
> 旧: `dragPlane = new THREE.Plane(new Vector3(0,1,0), 0)` (= 常に Y=0 = 地面)
>
> 天井設備 (Y=2700mm) や屋根設備 (Y=ceilingHeight) などを Y=0 平面でレイ交差すると、
> カメラを傾けたときに「掴んだ点」と「設備本体」の間で視差ズレが発生し、ドラッグ
> 中の動きが大幅に飛ぶ。
>
> 修正: `onPointerDown` で `dragPlane.set(new Vector3(0,1,0), -g.position.y)` と
> 現在の Y に追従させる。地面設備 (Y=0) では挙動変わらず、高所設備の追従精度が向上。
>
> #### (2) ポインターキャプチャを SpecMesh にも適用
>
> 旧: SpecMesh (equipment-master 用の新メッシュ) には `setPointerCapture` を入れて
> いなかった (旧 FurnitureInstanceMesh には実装済)。
>
> 結果: ドラッグ中にカーソルが設備メッシュの境界を超えると `pointermove` が他の
> mesh / canvas に逃げ、本メッシュの handler が呼ばれなくなり、`onPointerUp` も
> 取りこぼされて drag が「張り付いた」状態になる。
>
> 修正: `onPointerDown` で `e.target.setPointerCapture(e.pointerId)`、
> `onPointerUp` で `releasePointerCapture` を呼ぶ (両者とも try/catch で XR 環境に配慮)。
>
> #### (3) ドラッグ中は `<Html>` ラベルを非表示
>
> 旧: `highlighted = isSelected || isDragging` のとき、設備名/シンボルを drei `<Html>` で
> オーバーレイ。ドラッグ中も表示していた。
>
> 推定: `<Html>` のポータル更新 (毎フレーム DOM 位置を再計算) が、`g.position.x/z` の
> imperative 変更と競合し、ドラッグ動作の追従が不安定になる場合があった。
>
> 修正: `isSelected && !isDragging` のときだけラベルを出す (= ドラッグ開始でラベル消失、
> 離すと再表示)。
>
> #### 副次: 旧 FurnitureInstanceMesh にもドラッグ平面 Y 補正を適用
>
> 既存家具カタログ (sofa 等) も mountTo='ceiling'/'wall'/'roof' で天井に貼れるよう
> なった (v0.30) ため、同じ視差ズレが起こり得る。コードを揃えて修正。
>
> ### M149 DXF エクスポートに設備の 2D 図面を含める
>
> 旧 (v0.28〜v0.33): 家具/設備は INSERT 1 点のみで書き出していた。外部 CAD で開くと
> 配置点しか分からず「実寸の図形」が出ない。
>
> 新仕様:
>  1. **外形を DXF 要素として書く**
>     - `shape='circle'` → `CIRCLE` (center + radius)
>     - その他 (`rect`/`square`) → `LWPOLYLINE` で 4 隅の回転矩形 (closed)
>  2. **シンボルラベル** を TEXT で中央配置 (高さ 200mm、`spec.symbol`)
>  3. **INSERT は併置** (再 import 時の equipment マーカーとして互換維持)
>
> レイヤー名:
>  - equipment-master 由来 (`E-001` 等): catalogId をそのままレイヤー名 (= 旧 CAD 互換)
>  - 旧 BMS catalog (`ceiling-light-led` 等): `CATALOG_TO_LAYER` で慣習名にマップ (`E-LIGHT` 等)
>  - その他家具 (sofa 等): `FURNITURE` レイヤー
>
> 回転矩形の 4 隅は ローカル `[(±w/2, ±d/2)]` を `[cos, sin; -sin, cos]` で回す:
>
> ```ts
> function rotatedRectCorners(cx, cy, w, d, rotation) {
>   const cos = Math.cos(rotation), sin = Math.sin(rotation)
>   const hw = w / 2, hd = d / 2
>   return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([dx,dy]) => [
>     cx + dx*cos - dy*sin,
>     cy + dx*sin + dy*cos,
>   ])
> }
> ```
>
> Y 反転 (DXF は Y 上向き、Floorplan は Y 下向き) は `ty(y) = bbox.maxY - y` で
> 一括変換するため、回転計算は plan 座標系のままで OK。
>
> ### v0.34 で扱わない範囲
>
> 1. **DXF 出力時の note 反映** — `EquipmentSpec.note` を TEXT として図面注記に
>    含めるのは現状未実装 (シンボルのみ)
> 2. **円形設備の楕円対応** — `shape='circle'` でも `width != depth` のケース
>    (楕円) は `CIRCLE` (= 正円) で書き出される。実用上ほぼ無いが将来 `ELLIPSE` 対応
> 3. **3D ラベルの表示モード設定** — ドラッグ中のラベル非表示は固定。ユーザー設定で
>    "常に表示" にしたい要望が出れば trailing 設計
>
> v0.33 以前の §1〜§17 はそのまま継承。
