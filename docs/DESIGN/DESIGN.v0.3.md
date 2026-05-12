# 間取りプランナー Web アプリ 設計書

> Version: **0.3** (Draft)
> Last Updated: 2026-05-12
> Status: 実装中 (Phase 3 後半 UX 改善)
>
> ## v0.2 → v0.3 の主な変更
>
> 編集体験 (M35〜M40) に関する仕様変更。法規・データモデル・3D まわりは v0.2 から実質変更なし。
>
> - **§5.7 / §5.8 ドア・窓**: 配置時の `positionRatio` を「壁中央 (0.5)」固定からカーソル位置の射影に変更
>   (`addDoor` / `addWindow` の API は同一、UI 側で `wall.from→to` への正射影を計算)
> - **§6.3 部屋移動**: 既定のグリッドスナップを「自由位置 + 隣接部屋の角スナップ」に置き換え
>   (グリッドは保険、優先は対面・隣接の対応点)
> - **§5.2 polygon 部屋**: 頂点ハンドルによるリサイズを追加 (描画ツールで作った部屋もリサイズ可)
> - **§5.6 Room.presetId 変更**: PropertyPanel に preset 切替セレクトを追加。描画ツールで生成した
>   既定 `living` を任意の用途へ後から変更できる
> - **§7 家具カタログ拡張**: 既存 11 種に 12 種 (椅子・テーブル系/寝具系/収納系/照明系) を追加して 23+ 種に
>   → §17 PDF 部屋一覧の見え方が変わる (家具名の Canvas 画像化件数増)
> - **§5.2.1 FurnitureInstance.position の量子化**: 1mm 単位 (既定の gridSize スナップを撤回)
>   → 3D PivotControls / 2D ドラッグの両方で「正確に置きたい位置」に置ける
>
> 設計上の不変条件 (壁芯ベース / 派生壁 / Phase 不変条件) は変更なし。

---

## §1〜§4 略 — v0.2 から変更なし

詳細は [DESIGN.v0.2.md](./DESIGN.v0.2.md) §1〜§4 を参照。

---

## §5 データモデル

### §5.2 Floor / Shape

**変更点 (v0.3)**:

- `Shape.kind = 'polygon'` の頂点はリサイズ対象。RoomResizeHandles の polygon 拡張により、
  各頂点に対応するハンドルを描画し、ドラッグで `shape.points[i]` を直接更新する。
- リサイズ時は **隣接頂点との直交関係を維持** する補正を入れる (M16 で軸並行のみ作る仕様と整合)。

#### §5.2.1 FurnitureInstance

**変更点 (v0.3)**:

- `position: readonly [number, number]` の量子化を **1mm 単位** に変更 (旧: gridSize スナップ)。
- 3D PivotControls / 2D ドラッグの両方で 1mm 精度の位置調整が可能。
- 「グリッドスナップしたい」用途は将来 Modifier キー (Shift) で復活させる前提でストア API は据え置き。

### §5.6 Room

`Room.presetId` は描画ツール生成後でも編集可能。PropertyPanel から **room preset** セレクトで
変更し、変更時に `updateRoomPreset(roomId, nextPresetId)` を呼ぶ (新規 store action)。

```ts
// floorplanStore 新規 action
updateRoomPreset: (roomId: string, presetId: string) => boolean
```

副作用:
- `presetId` から `RoomPreset` を引き直し、`requiresPipeSpace` / `utilityRequirements` が変わる
- 法規再評価 (§6.6.1) は floorplan 全体の subscribe で自然に発火

### §5.7 Door / §5.8 Window

`addDoor` / `addWindow` 共に **positionRatio が 0..1 の任意値** を受け付ける (v0.2 と同じ)。

UI 側 ([WallLine.tsx](../frontend/src/components/canvas2d/WallLine.tsx)) で **クリック位置を壁線上に正射影** して
positionRatio を計算する処理を追加:

```ts
// クリック (clickWorld) を壁ベクトル (from→to) に射影
const dx = wall.to[0] - wall.from[0]
const dy = wall.to[1] - wall.from[1]
const len2 = dx*dx + dy*dy
const t = ((clickWorld.x - wall.from[0]) * dx +
           (clickWorld.y - wall.from[1]) * dy) / len2
const positionRatio = clamp(t, 0, 1)
```

開口幅 (`width`) が壁長を超える / 端からはみ出す場合は positionRatio を `[w/2/wallLen, 1-w/2/wallLen]`
の範囲にクランプ (壁の端に切れた開口が出ないようにする)。

## §6 アルゴリズム

### §6.3 部屋移動 (v0.3 改訂)

旧:
> ドラッグ中はリアルタイム反映、drop 時に `gridSize` (既定 910mm) にスナップ。

新:

1. ドラッグ中はリアルタイム反映 (rotation 不変)
2. drop 時に **以下の順で最適スナップ点を選ぶ**:
   - **角スナップ (優先)**: 移動後の自部屋 AABB の 4 隅と、他部屋の 4 隅との距離が 200mm 以内に
     入るペアが 1 組以上あれば、最も近いペアで自部屋を平行移動 (= 角が「カチッとハマる」)
   - **辺スナップ**: 移動後の自 AABB の各辺 (X/Y 軸沿い) が他部屋の辺と同 X / 同 Y で
     200mm 以内に揃うなら、その方向にだけ平行移動 (片軸スナップ)
   - **グリッドスナップ (保険)**: 上記のどれも当てはまらなければ、従来通り `gridSize` に丸める
3. スナップ後に既存の重なり判定 → 重なるなら drop を拒否し元位置へ戻す

200mm 公差は「ユーザーが目視で揃えたい」感覚的な距離。grid 910mm 内では複数の他部屋の角と
被る可能性があるが、最近接優先で 1 ヶ所に確定する。

### §6.4 共有壁ドラッグ — v0.2 と同じ (M34 で実装済み)

### §6.5 ドラッグ中の壁・床の追従

v0.2 (M32) で「draggingRoomId に紐づく壁/窓/ドアを 2D で非表示にする」方針は据え置き。
ただし v0.3 追加で:

- ドラッグ中に **隣接部屋の対応する角に近づいたら、Group 内の Rect stroke 色を `#3b82f6` (青) に
  パルス表示** してスナップ予告を出す。
- 共有壁ドラッグ中も同様にプレビュー線色を変更。

これは UX のみ。データモデル上の不変条件には影響しない。

## §7 家具カタログ (拡張)

v0.2: 11 種。v0.3: **23+ 種** (リビング/ダイニング/キッチン/寝室/水回り/玄関/収納/照明を充実)。

| 区分 | カタログ id (例) | 用途 |
|---|---|---|
| ソファ系 | `sofa-standard`, `sofa-l-shape`, `armchair` | リビング |
| テーブル系 | `coffee-table`, `dining-table-4`, `dining-table-6`, `side-table` | リビング/ダイニング |
| TV/AV | `tv-board`, `tv-stand-large` | リビング |
| 寝具 | `bed-single`, `bed-semi-double`, `bed-double`, `bed-queen` | 寝室 |
| ナイト系 | `nightstand`, `dresser` | 寝室 |
| キッチン | `kitchen-counter-i`, `refrigerator`, `dining-cabinet` | キッチン |
| 水回り | `bathtub`, `sink-vanity`, `toilet-tank`, `washing-machine` | 浴室/洗面/トイレ |
| 玄関/収納 | `shoe-cabinet`, `closet-walk-in`, `bookshelf` | 玄関/廊下/居室 |
| 照明 | `pendant-light`, `floor-lamp` | 任意 |

各 entry は v0.2 と同じ構造 (`id`, `displayName`, `minRoom`, `pieces`)。3D 化は piece の box/cylinder
組合せで近似する PoC レベル。

## §11 Phase 計画

v0.2 の Phase 3 (M19〜M34) はそのまま。今回追加した M35〜M40 は Phase 3 後半の UX 改善として
ロードマップに編入する。完了後は **L2 (業者打ち合わせの叩き台)** をより快適に作れる状態になる。

| Milestone | 概要 | ファイル |
|---|---|---|
| M35 | ドア/窓のカーソル位置配置 | WallLine.tsx |
| M36 | 部屋の自由移動 + 隣接角スナップ | floorplanStore.moveRoom, RoomShape.tsx |
| M37 | polygon 頂点リサイズハンドル | RoomResizeHandles.tsx (拡張) |
| M38 | PropertyPanel 部屋 preset 変更 | PropertyPanel.tsx, floorplanStore.updateRoomPreset |
| M39 | 家具カタログ 23+ 種 | furnitureCatalog.ts |
| M40 | 家具の 1mm 単位ドラッグ | FurnitureMark.tsx, Furniture.tsx (3D) |

## 付録: 略

v0.2 の付録 A〜C はそのまま継承。
