# 間取りプランナー Web アプリ 設計書

> Version: **0.4** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 改善 v2)
>
> ## v0.3 → v0.4 の主な変更
>
> 今回は 3 件の不具合修正 + 1 件の UX 強化のみ。仕様 (法規・データモデル・3D) の変更なし。
>
> ### 不具合 (リグレッション) 修正
>
> **§5.2 polygon 部屋の移動が反映されない**
>
> v0.3 までの `applyTranslation` (`floorplanStore.ts`) は rect のみ対応で、
> polygon は `// polygon は Phase 2 で対応` のコメント付きで no-op になっていた。
> しかし RoomShape の Group は Konva drag で一時的に位置が動き、ドラッグ終了時には
> store の shape が更新されないので、React 再レンダで Group は元位置に戻ろうとする…
> が、Konva が drag 終了直後の prop 同期を見落とすケースで **「床は新位置、壁は旧位置」**
> という視覚的不整合が発生する。**M45 で polygon の points も dx/dy で平行移動するよう修正。**
>
> **§7 描画ツール後にプリセット部屋が置けなくなる**
>
> `Sidebar.tsx` の `findFreePlacement` は既存 rect の最大 x を見て新部屋の位置を決める
> ロジックで、`r.shape.kind !== 'rect' continue` の早期スキップにより polygon が無視されていた。
> 結果、polygon しか無い floor では `maxRight = 0` のまま (0, 0) に配置しようとして
> 描画済み polygon と重なり、`addRoom` が `overlapsAny` で `false` を返す。**M46 で
> `shapeAabb` ベースの集計に置き換える (polygon も対象)。**
>
> **3D 家具の操作性**
>
> PivotControls の矢印は小さく、初心者には押下点が分かりにくい。**M47 で「家具メッシュ本体を
> 直接ドラッグできる」ように拡張する。** PivotControls は引き続き併用 (微調整用)。
>
>  - 家具をクリックすると select (既存)
>  - クリック中に動かすと **XZ 平面上の cursor 位置に追従**
>  - リリースで `moveFurniture` をコミット
>  - OrbitControls は drag 中ずっと disable
>
> ### 内部実装メモ
>
> - `Furniture.tsx` (3D): R3F の `e.ray.intersectPlane(plane, target)` で
>   XZ 平面 (y=0) 上の交点を計算 → `group.position.set(...)` で表示更新
> - pointer capture: `e.target.setPointerCapture(e.pointerId)` でメッシュから
>   外れても pointermove が来るようにする
>
> v0.3 以前の §1〜§17 はそのまま継承。
