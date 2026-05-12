# 間取りプランナー Web アプリ 設計書

> Version: **0.17** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 補強 v13)
>
> ## v0.16 → v0.17 の主な変更
>
> v0.16 (M81) の「同一直線上の重なる壁にも opening を伝播」ロジックで
> ドアが必ず 3D に出るようにはなったが、副作用が 2 件出ていた:
>  1. 伝播でドアパネル本体まで 2 枚立っていた (内開き + 外開き両方が同時に見える)
>  2. balcony の長い辺が家側部屋の短い辺と重なるとき、その balcony 辺が
>     "sharedBy=[balcony] のみ" として railing 化されていた (家側にも手摺が立ってしまう)
>
> ### 1. 伝播コピーはパネル描画から除外 (M82)
>
> `Opening` 型に `isPropagated?: boolean` を追加。
> `propagateOpeningsToCoplanarWalls` で伝播コピーを push する際に
> `isPropagated: true` をセット。
>
> 一方:
>  - `splitWallByOpenings` (壁の穴掘り) は **isPropagated に関わらず処理する** →
>    同一直線上の全ての壁にちゃんと穴が空く (M81 の効果は維持)
>  - `DoorPanelsLayer` (ドアパネル本体の描画) は **isPropagated=true をスキップ** →
>    パネル本体は元の wallId 上に 1 枚だけ立つ
>
> ### 2. railing 判定に "家側オーバーラップ" 除外を追加 (M83)
>
> 旧 M70 の判定:
>  - `sharedBy.length === 1 && roomById.get(sharedBy[0]).presetId === 'balcony'` なら railing
>
> 問題:
>  - canonicalSegmentKey の端点完全一致仕様により、長い balcony 辺と複数の家側部屋の
>    短い辺は別個の Wall になる。balcony 辺の sharedBy には balcony しか入らないため、
>    上記条件で railing 認定 → 家側にも金属手摺が並んでしまう
>
> 修正:
>  - 新しい `computeRailingWallIds(walls, roomById)` を導入し、上記条件に加えて
>    「同一直線上に balcony 以外の部屋を sharedBy に持つ壁が存在しない」を
>    必須条件として追加
>  - 同一直線判定は M81 と同じ cross-product ベース (関数 `wallsOnSameLine` を切り出して共有)
>  - 線分オーバーラップ判定は壁方向ベクトルへの射影 + 共通 t-range の有効長 > 1mm で判定
>
> 結果:
>  - balcony の **外周のみ (= 真に屋外に面している辺)** が railing として描画される
>  - balcony の家側に貼り付く辺 (= 隣接する closet/living/bedroom などの部屋境界)
>    は通常壁 (`kind: 'interior'`) として描画され、railing が二重に立つことが無くなる
>  - 既存の balcony が独立した小さなボックスのケース (家側に何も無い) では、
>    どの辺も "他に重なる壁が無い" 状態なので 4 辺すべて railing になる (旧挙動と同じ)
>
> v0.16 以前の §1〜§17 はそのまま継承。
