/**
 * §11 Phase 2 / M13: 部屋プリセット ID → プロシージャル家具レイアウト。
 *
 * 設計の意図:
 *  - GLB の家具は M14 以降 (規格カタログ UI と一緒に Floorplan.furniture に保存) で本格対応する。
 *  - その前段として、3D の説得力を出すためだけに「箱と円柱で組んだ家具っぽい何か」を置く。
 *  - Floorplan 側にはデータを持たず、render 時だけ部屋の AABB に対して相対配置する。
 *  - すべて部屋ローカル座標 (中心原点) で吐く。回転 0..3 (90° 量子化) は呼び出し側で適用。
 *
 * 描画パフォーマンス:
 *  - 1 部屋あたり最大 ~8 mesh。10 部屋で 80 mesh 程度。three の instance 化なしでも 60fps 維持の想定。
 */

export type FurniturePiece = {
  id: string
  /** 部屋ローカル中心からの位置 (mm)。Y は床面=0 */
  position: readonly [number, number, number]
  /** mm */
  size: readonly [number, number, number]
  /** Y 軸回転 (rad)。家具自身の向き */
  rotationY?: number
  shape: 'box' | 'cylinder'
  /** sRGB 色 + 物性 */
  material: {
    color: string
    roughness: number
    metalness: number
  }
}

/**
 * 部屋 AABB (mm) と presetId からプロシージャル家具を返す。
 * - rectW / rectH は部屋の幅(X)×奥行き(Z) (mm)
 * - 戻り値は部屋ローカル座標。呼び出し側で room.shape.x + w/2 を原点として翻訳する
 */
export function generateFurniture(
  presetId: string,
  rectW: number,
  rectH: number,
): FurniturePiece[] {
  switch (presetId) {
    case 'living':
      return livingFurniture(rectW, rectH)
    case 'dining':
      return diningFurniture(rectW, rectH)
    case 'kitchen':
    case 'kitchen-gas':
      return kitchenFurniture(rectW, rectH)
    case 'bedroom':
    case 'kids-room':
      return bedroomFurniture(rectW, rectH)
    case 'bathroom':
      return bathroomFurniture(rectW, rectH)
    case 'washroom':
      return washroomFurniture(rectW, rectH)
    case 'toilet':
      return toiletFurniture(rectW, rectH)
    case 'entrance':
      return entranceFurniture(rectW, rectH)
    case 'closet':
      return closetFurniture(rectW, rectH)
    default:
      return []
  }
}

// ============================================================================
// 各部屋
// ============================================================================

function livingFurniture(w: number, h: number): FurniturePiece[] {
  const pieces: FurniturePiece[] = []
  // 部屋の壁から少し離れた位置にソファ (奥壁沿い)
  if (w >= 1800 && h >= 2400) {
    const sofaW = Math.min(2000, w * 0.55)
    pieces.push({
      id: 'sofa',
      position: [0, 380, -h / 2 + 450],
      size: [sofaW, 760, 850],
      shape: 'box',
      material: { color: '#5d7c8a', roughness: 0.9, metalness: 0.02 },
    })
    // ローテーブル
    pieces.push({
      id: 'coffee-table',
      position: [0, 200, -h / 2 + 1500],
      size: [Math.min(1100, w * 0.4), 400, 600],
      shape: 'box',
      material: { color: '#6e4f33', roughness: 0.7, metalness: 0.0 },
    })
    // TV ボード (反対側の壁)
    pieces.push({
      id: 'tv-board',
      position: [0, 250, h / 2 - 250],
      size: [Math.min(1600, w * 0.5), 500, 400],
      shape: 'box',
      material: { color: '#2c2c2c', roughness: 0.6, metalness: 0.1 },
    })
  }
  return pieces
}

function diningFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 1500 || h < 1500) return []
  const tableW = Math.min(1600, w * 0.6)
  const tableH = Math.min(900, h * 0.5)
  const pieces: FurniturePiece[] = [
    {
      id: 'table',
      position: [0, 360, 0],
      size: [tableW, 720, tableH],
      shape: 'box',
      material: { color: '#8b5a2b', roughness: 0.55, metalness: 0.0 },
    },
  ]
  // 椅子 4 つ (テーブル長辺の前後に 2 つずつ)
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 2; i++) {
      pieces.push({
        id: `chair-${side}-${i}`,
        position: [
          (i === 0 ? -1 : 1) * (tableW * 0.27),
          230,
          (side === 0 ? -1 : 1) * (tableH * 0.6 + 200),
        ],
        size: [420, 460, 420],
        shape: 'box',
        material: { color: '#a47148', roughness: 0.6, metalness: 0.0 },
      })
    }
  }
  return pieces
}

function kitchenFurniture(w: number, h: number): FurniturePiece[] {
  // I 型キッチン: 奥壁沿いに台が一直線
  if (w < 1500 && h < 1500) return []
  const counterDepth = 650
  const counterHeight = 850
  // 部屋の長辺に沿わせる
  const isWide = w >= h
  const len = isWide ? w * 0.85 : h * 0.85
  const piece: FurniturePiece = {
    id: 'counter',
    position: isWide ? [0, counterHeight / 2, -h / 2 + counterDepth / 2] : [-w / 2 + counterDepth / 2, counterHeight / 2, 0],
    size: isWide ? [len, counterHeight, counterDepth] : [counterDepth, counterHeight, len],
    shape: 'box',
    material: { color: '#dad6cd', roughness: 0.4, metalness: 0.15 },
  }
  const sink: FurniturePiece = {
    id: 'sink',
    position: isWide
      ? [-len * 0.25, counterHeight + 30, -h / 2 + counterDepth / 2]
      : [-w / 2 + counterDepth / 2, counterHeight + 30, -len * 0.25],
    size: isWide ? [600, 60, 450] : [450, 60, 600],
    shape: 'box',
    material: { color: '#b7bcc2', roughness: 0.2, metalness: 0.85 },
  }
  return [piece, sink]
}

function bedroomFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 1800 || h < 2200) return []
  // セミダブル (1200) を最低基準にして部屋に収まるかで決める
  const bedW = Math.min(1400, w * 0.7)
  const bedH = 2000 // 標準ベッド長
  const pieces: FurniturePiece[] = [
    {
      id: 'bed',
      position: [0, 250, -h / 2 + bedH / 2 + 200],
      size: [bedW, 500, bedH],
      shape: 'box',
      material: { color: '#cdd5dd', roughness: 0.95, metalness: 0.0 },
    },
    {
      id: 'pillow',
      position: [0, 530, -h / 2 + 320],
      size: [bedW * 0.85, 100, 350],
      shape: 'box',
      material: { color: '#ffffff', roughness: 1.0, metalness: 0.0 },
    },
  ]
  // ナイトスタンド (枕元横)
  pieces.push({
    id: 'nightstand',
    position: [bedW / 2 + 250, 250, -h / 2 + 250],
    size: [400, 500, 400],
    shape: 'box',
    material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
  })
  return pieces
}

function bathroomFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 1500 || h < 1500) return []
  // バスタブ (奥壁沿い)
  return [
    {
      id: 'bathtub',
      position: [0, 280, -h / 2 + 400],
      size: [Math.min(1600, w * 0.85), 560, 750],
      shape: 'box',
      material: { color: '#f0f3f5', roughness: 0.2, metalness: 0.05 },
    },
  ]
}

function washroomFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 1500 || h < 1500) return []
  return [
    {
      id: 'sink-vanity',
      position: [0, 400, -h / 2 + 280],
      size: [Math.min(900, w * 0.6), 800, 500],
      shape: 'box',
      material: { color: '#e8ebed', roughness: 0.5, metalness: 0.05 },
    },
    {
      id: 'mirror',
      position: [0, 1200, -h / 2 + 70],
      size: [Math.min(900, w * 0.6), 700, 30],
      shape: 'box',
      material: { color: '#b7d4e3', roughness: 0.05, metalness: 0.7 },
    },
  ]
}

function toiletFurniture(_w: number, h: number): FurniturePiece[] {
  return [
    {
      id: 'toilet',
      position: [0, 200, -h / 2 + 400],
      size: [400, 400, 600],
      shape: 'box',
      material: { color: '#fafafa', roughness: 0.2, metalness: 0.05 },
    },
    {
      id: 'tank',
      position: [0, 600, -h / 2 + 180],
      size: [400, 400, 200],
      shape: 'box',
      material: { color: '#fafafa', roughness: 0.2, metalness: 0.05 },
    },
  ]
}

function entranceFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 1200 || h < 1200) return []
  return [
    {
      id: 'shoe-cabinet',
      position: [w / 2 - 200, 600, 0],
      size: [400, 1200, Math.min(1200, h * 0.6)],
      shape: 'box',
      material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
    },
  ]
}

function closetFurniture(w: number, h: number): FurniturePiece[] {
  if (w < 800 || h < 800) return []
  return [
    {
      id: 'hanger-bar',
      position: [0, 1700, 0],
      size: [w * 0.8, 30, 30],
      shape: 'cylinder',
      material: { color: '#888888', roughness: 0.3, metalness: 0.7 },
    },
  ]
}
