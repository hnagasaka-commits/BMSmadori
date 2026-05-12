/**
 * §11 Phase 2 / M14: 家具カタログ (procedural geometry 版)。
 *
 * 設計の意図:
 *  - Phase 1.5 までは Floor.furniture を常に空配列で運用してきた。
 *  - M14 で「3D 上で家具を選択して動かせる」ためには、Floor.furniture に実体が必要。
 *  - そこで「規格 GLB を後で差し込む前提」の形でカタログを定義する。
 *    今は geometry を box / cylinder の組合せで返すが、catalogId は GLB に置き換え可能なキー。
 *  - catalogId は M15 (規格カタログ UI) でユーザーから選択可能になる予定。
 *
 * Floor.furniture[i] = { id, catalogId, position: [x,z], rotation, scale? }
 *  - position は床面 (Y=0) の XZ 平面、mm 整数 (§3.6 量子化)
 *  - rotation は Y 軸まわりの角度 (rad)。Phase 2 では 0/π/2/π/3π/2 の 4 方向に量子化
 *  - scale は省略 (1.0 固定)。catalog 自体に複数サイズが入る前提
 */

import type { FurniturePiece } from '@/components/canvas3d/furniturePresets'

export type FurnitureCatalogEntry = {
  id: string
  displayName: string
  /** 配置時にバウンディングが必要な部屋の最小寸法 (mm)。Sidebar の自動配置で使う */
  minRoom: { w: number; h: number }
  /** カタログから生成される子ピース */
  pieces: ReadonlyArray<FurniturePiece>
}

/**
 * カタログ。Floor.furniture[i].catalogId はこの id を参照する。
 *
 * piece の position は「家具の中心」をローカル原点として書く。
 * 配置時に Floor.furniture[i].position (mm in XZ) と rotation で世界座標に展開する。
 */
const ENTRIES: FurnitureCatalogEntry[] = [
  {
    id: 'sofa-standard',
    displayName: 'ソファ',
    minRoom: { w: 1800, h: 2400 },
    pieces: [
      {
        id: 'body',
        position: [0, 380, 0],
        size: [2000, 760, 850],
        shape: 'box',
        material: { color: '#5d7c8a', roughness: 0.9, metalness: 0.02 },
      },
    ],
  },
  {
    id: 'coffee-table',
    displayName: 'ローテーブル',
    minRoom: { w: 1100, h: 600 },
    pieces: [
      {
        id: 'top',
        position: [0, 200, 0],
        size: [1100, 400, 600],
        shape: 'box',
        material: { color: '#6e4f33', roughness: 0.7, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'tv-board',
    displayName: 'TV ボード',
    minRoom: { w: 1600, h: 400 },
    pieces: [
      {
        id: 'body',
        position: [0, 250, 0],
        size: [1600, 500, 400],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.6, metalness: 0.1 },
      },
    ],
  },
  {
    id: 'dining-table-4',
    displayName: 'ダイニングテーブル (4 人)',
    minRoom: { w: 1600, h: 900 },
    pieces: [
      {
        id: 'top',
        position: [0, 360, 0],
        size: [1600, 720, 900],
        shape: 'box',
        material: { color: '#8b5a2b', roughness: 0.55, metalness: 0.0 },
      },
      {
        id: 'chair-front-1',
        position: [-432, 230, -750],
        size: [420, 460, 420],
        shape: 'box',
        material: { color: '#a47148', roughness: 0.6, metalness: 0.0 },
      },
      {
        id: 'chair-front-2',
        position: [432, 230, -750],
        size: [420, 460, 420],
        shape: 'box',
        material: { color: '#a47148', roughness: 0.6, metalness: 0.0 },
      },
      {
        id: 'chair-back-1',
        position: [-432, 230, 750],
        size: [420, 460, 420],
        shape: 'box',
        material: { color: '#a47148', roughness: 0.6, metalness: 0.0 },
      },
      {
        id: 'chair-back-2',
        position: [432, 230, 750],
        size: [420, 460, 420],
        shape: 'box',
        material: { color: '#a47148', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'kitchen-counter-i',
    displayName: 'I 型キッチン',
    minRoom: { w: 2400, h: 650 },
    pieces: [
      {
        id: 'counter',
        position: [0, 425, 0],
        size: [2400, 850, 650],
        shape: 'box',
        material: { color: '#dad6cd', roughness: 0.4, metalness: 0.15 },
      },
      {
        id: 'sink',
        position: [-600, 880, 0],
        size: [600, 60, 450],
        shape: 'box',
        material: { color: '#b7bcc2', roughness: 0.2, metalness: 0.85 },
      },
    ],
  },
  {
    id: 'bed-semi-double',
    displayName: 'セミダブルベッド',
    minRoom: { w: 1400, h: 2000 },
    pieces: [
      {
        id: 'mattress',
        position: [0, 250, 0],
        size: [1400, 500, 2000],
        shape: 'box',
        material: { color: '#cdd5dd', roughness: 0.95, metalness: 0.0 },
      },
      {
        id: 'pillow',
        position: [0, 530, -820],
        size: [1200, 100, 350],
        shape: 'box',
        material: { color: '#ffffff', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'nightstand',
    displayName: 'ナイトスタンド',
    minRoom: { w: 400, h: 400 },
    pieces: [
      {
        id: 'body',
        position: [0, 250, 0],
        size: [400, 500, 400],
        shape: 'box',
        material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'bathtub',
    displayName: 'バスタブ',
    minRoom: { w: 1600, h: 750 },
    pieces: [
      {
        id: 'tub',
        position: [0, 280, 0],
        size: [1600, 560, 750],
        shape: 'box',
        material: { color: '#f0f3f5', roughness: 0.2, metalness: 0.05 },
      },
    ],
  },
  {
    id: 'sink-vanity',
    displayName: '洗面化粧台',
    minRoom: { w: 900, h: 500 },
    pieces: [
      {
        id: 'cabinet',
        position: [0, 400, 0],
        size: [900, 800, 500],
        shape: 'box',
        material: { color: '#e8ebed', roughness: 0.5, metalness: 0.05 },
      },
      {
        id: 'mirror',
        position: [0, 1200, -235],
        size: [900, 700, 30],
        shape: 'box',
        material: { color: '#b7d4e3', roughness: 0.05, metalness: 0.7 },
      },
    ],
  },
  {
    id: 'toilet-tank',
    displayName: 'トイレ',
    minRoom: { w: 400, h: 600 },
    pieces: [
      {
        id: 'bowl',
        position: [0, 200, 100],
        size: [400, 400, 600],
        shape: 'box',
        material: { color: '#fafafa', roughness: 0.2, metalness: 0.05 },
      },
      {
        id: 'tank',
        position: [0, 600, -100],
        size: [400, 400, 200],
        shape: 'box',
        material: { color: '#fafafa', roughness: 0.2, metalness: 0.05 },
      },
    ],
  },
  {
    id: 'shoe-cabinet',
    displayName: '靴箱',
    minRoom: { w: 400, h: 1200 },
    pieces: [
      {
        id: 'body',
        position: [0, 600, 0],
        size: [400, 1200, 1200],
        shape: 'box',
        material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  // ---------------------------------------------------------------------------
  // §M39 v0.3 拡充: ソファ追加 / 椅子系 / 大型ベッド / 収納 / 家電 / 照明
  // ---------------------------------------------------------------------------
  {
    id: 'sofa-l-shape',
    displayName: 'L 字ソファ',
    minRoom: { w: 2500, h: 2200 },
    pieces: [
      {
        id: 'body-h',
        position: [0, 380, 700],
        size: [2400, 760, 850],
        shape: 'box',
        material: { color: '#4f6e7c', roughness: 0.9, metalness: 0.02 },
      },
      {
        id: 'body-v',
        position: [-775, 380, -100],
        size: [850, 760, 1600],
        shape: 'box',
        material: { color: '#4f6e7c', roughness: 0.9, metalness: 0.02 },
      },
    ],
  },
  {
    id: 'armchair',
    displayName: '一人掛けアームチェア',
    minRoom: { w: 800, h: 800 },
    pieces: [
      {
        id: 'seat',
        position: [0, 380, 0],
        size: [800, 760, 800],
        shape: 'box',
        material: { color: '#8a6b50', roughness: 0.85, metalness: 0.02 },
      },
    ],
  },
  {
    id: 'side-table',
    displayName: 'サイドテーブル',
    minRoom: { w: 450, h: 450 },
    pieces: [
      {
        id: 'top',
        position: [0, 280, 0],
        size: [450, 560, 450],
        shape: 'box',
        material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'dining-table-6',
    displayName: 'ダイニングテーブル (6 人)',
    minRoom: { w: 1800, h: 900 },
    pieces: [
      {
        id: 'top',
        position: [0, 360, 0],
        size: [1800, 720, 900],
        shape: 'box',
        material: { color: '#8b5a2b', roughness: 0.55, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'tv-stand-large',
    displayName: 'TV スタンド (大)',
    minRoom: { w: 2000, h: 400 },
    pieces: [
      {
        id: 'body',
        position: [0, 350, 0],
        size: [2000, 700, 400],
        shape: 'box',
        material: { color: '#1f1f1f', roughness: 0.5, metalness: 0.15 },
      },
    ],
  },
  {
    id: 'bed-single',
    displayName: 'シングルベッド',
    minRoom: { w: 1000, h: 2000 },
    pieces: [
      {
        id: 'mattress',
        position: [0, 250, 0],
        size: [1000, 500, 2000],
        shape: 'box',
        material: { color: '#cdd5dd', roughness: 0.95, metalness: 0.0 },
      },
      {
        id: 'pillow',
        position: [0, 530, -820],
        size: [850, 100, 350],
        shape: 'box',
        material: { color: '#ffffff', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'bed-double',
    displayName: 'ダブルベッド',
    minRoom: { w: 1400, h: 2000 },
    pieces: [
      {
        id: 'mattress',
        position: [0, 250, 0],
        size: [1400, 500, 2000],
        shape: 'box',
        material: { color: '#cdd5dd', roughness: 0.95, metalness: 0.0 },
      },
      {
        id: 'pillow',
        position: [0, 530, -820],
        size: [1200, 100, 350],
        shape: 'box',
        material: { color: '#ffffff', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'bed-queen',
    displayName: 'クイーンベッド',
    minRoom: { w: 1600, h: 2050 },
    pieces: [
      {
        id: 'mattress',
        position: [0, 250, 0],
        size: [1600, 500, 2050],
        shape: 'box',
        material: { color: '#cdd5dd', roughness: 0.95, metalness: 0.0 },
      },
      {
        id: 'pillow',
        position: [0, 530, -850],
        size: [1450, 100, 350],
        shape: 'box',
        material: { color: '#ffffff', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'dresser',
    displayName: 'ドレッサー',
    minRoom: { w: 1000, h: 450 },
    pieces: [
      {
        id: 'body',
        position: [0, 400, 0],
        size: [1000, 800, 450],
        shape: 'box',
        material: { color: '#7a5a3f', roughness: 0.6, metalness: 0.05 },
      },
      {
        id: 'mirror',
        position: [0, 1300, -200],
        size: [600, 700, 30],
        shape: 'box',
        material: { color: '#cce0ec', roughness: 0.05, metalness: 0.7 },
      },
    ],
  },
  {
    id: 'refrigerator',
    displayName: '冷蔵庫',
    minRoom: { w: 600, h: 650 },
    pieces: [
      {
        id: 'body',
        position: [0, 900, 0],
        size: [600, 1800, 650],
        shape: 'box',
        material: { color: '#d0d3d6', roughness: 0.4, metalness: 0.5 },
      },
    ],
  },
  {
    id: 'dining-cabinet',
    displayName: 'カップボード',
    minRoom: { w: 1200, h: 450 },
    pieces: [
      {
        id: 'body',
        position: [0, 900, 0],
        size: [1200, 1800, 450],
        shape: 'box',
        material: { color: '#dcd3c4', roughness: 0.55, metalness: 0.05 },
      },
    ],
  },
  {
    id: 'washing-machine',
    displayName: '洗濯機',
    minRoom: { w: 700, h: 700 },
    pieces: [
      {
        id: 'body',
        position: [0, 500, 0],
        size: [650, 1000, 650],
        shape: 'box',
        material: { color: '#ececec', roughness: 0.5, metalness: 0.2 },
      },
    ],
  },
  {
    id: 'closet-walk-in',
    displayName: 'ウォークインクローゼット (棚)',
    minRoom: { w: 1500, h: 600 },
    pieces: [
      {
        id: 'shelf',
        position: [0, 1100, 0],
        size: [1500, 2200, 600],
        shape: 'box',
        material: { color: '#a98763', roughness: 0.65, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'bookshelf',
    displayName: '本棚',
    minRoom: { w: 900, h: 300 },
    pieces: [
      {
        id: 'shelf',
        position: [0, 950, 0],
        size: [900, 1900, 300],
        shape: 'box',
        material: { color: '#6e4f33', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'desk-work',
    displayName: 'ワークデスク',
    minRoom: { w: 1200, h: 600 },
    pieces: [
      {
        id: 'top',
        position: [0, 360, 0],
        size: [1200, 720, 600],
        shape: 'box',
        material: { color: '#dcd3c4', roughness: 0.55, metalness: 0.05 },
      },
      {
        id: 'chair',
        position: [0, 230, 350],
        size: [500, 460, 500],
        shape: 'box',
        material: { color: '#3c3c3c', roughness: 0.7, metalness: 0.1 },
      },
    ],
  },
  {
    id: 'pendant-light',
    displayName: 'ペンダントライト',
    minRoom: { w: 300, h: 300 },
    pieces: [
      {
        id: 'shade',
        position: [0, 2100, 0],
        size: [300, 120, 300],
        shape: 'cylinder',
        material: { color: '#fff2b8', roughness: 0.3, metalness: 0.1 },
      },
    ],
  },
  {
    id: 'floor-lamp',
    displayName: 'フロアランプ',
    minRoom: { w: 400, h: 400 },
    pieces: [
      {
        id: 'stand',
        position: [0, 900, 0],
        size: [80, 1800, 80],
        shape: 'cylinder',
        material: { color: '#1f1f1f', roughness: 0.5, metalness: 0.6 },
      },
      {
        id: 'shade',
        position: [0, 1750, 0],
        size: [400, 300, 400],
        shape: 'cylinder',
        material: { color: '#fff2b8', roughness: 0.3, metalness: 0.1 },
      },
    ],
  },
  {
    id: 'plant-large',
    displayName: '観葉植物 (大)',
    minRoom: { w: 500, h: 500 },
    pieces: [
      {
        id: 'pot',
        position: [0, 200, 0],
        size: [400, 400, 400],
        shape: 'cylinder',
        material: { color: '#8a6b50', roughness: 0.8, metalness: 0.0 },
      },
      {
        id: 'leaves',
        position: [0, 1100, 0],
        size: [700, 1400, 700],
        shape: 'cylinder',
        material: { color: '#3c6b41', roughness: 0.9, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'rug-3x2',
    displayName: 'ラグ (3×2m)',
    minRoom: { w: 2000, h: 3000 },
    pieces: [
      {
        id: 'rug',
        position: [0, 5, 0],
        size: [3000, 10, 2000],
        shape: 'box',
        material: { color: '#c8b89b', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  // ---------------------------------------------------------------------------
  // §M51 v0.6: ユーティリティ系の追加 (トイレ詳細 + ゴミ箱)
  // ---------------------------------------------------------------------------
  {
    id: 'toilet-detail',
    displayName: '洋式トイレ (詳細)',
    minRoom: { w: 450, h: 700 },
    pieces: [
      {
        id: 'bowl',
        position: [0, 200, 100],
        size: [380, 400, 550],
        shape: 'box',
        material: { color: '#fafafa', roughness: 0.18, metalness: 0.05 },
      },
      {
        id: 'seat',
        position: [0, 430, 80],
        size: [400, 50, 500],
        shape: 'box',
        material: { color: '#f0f0f0', roughness: 0.35, metalness: 0.05 },
      },
      {
        id: 'tank',
        position: [0, 700, -150],
        size: [400, 600, 250],
        shape: 'box',
        material: { color: '#fafafa', roughness: 0.18, metalness: 0.05 },
      },
      {
        id: 'lid',
        position: [0, 470, 80],
        size: [420, 30, 520],
        shape: 'box',
        material: { color: '#e8e8e8', roughness: 0.4, metalness: 0.05 },
      },
    ],
  },
  {
    id: 'trash-can-small',
    displayName: 'ゴミ箱 (小)',
    minRoom: { w: 250, h: 250 },
    pieces: [
      {
        id: 'body',
        position: [0, 220, 0],
        size: [240, 440, 240],
        shape: 'cylinder',
        material: { color: '#9aa0a6', roughness: 0.5, metalness: 0.3 },
      },
    ],
  },
  {
    id: 'trash-can-large',
    displayName: 'ゴミ箱 (45L 大)',
    minRoom: { w: 350, h: 350 },
    pieces: [
      {
        id: 'body',
        position: [0, 320, 0],
        size: [340, 640, 340],
        shape: 'cylinder',
        material: { color: '#3c3c3c', roughness: 0.6, metalness: 0.2 },
      },
      {
        id: 'lid',
        position: [0, 650, 0],
        size: [340, 20, 340],
        shape: 'cylinder',
        material: { color: '#2c2c2c', roughness: 0.6, metalness: 0.2 },
      },
    ],
  },
]

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]))

export function getCatalogEntry(id: string): FurnitureCatalogEntry | null {
  return BY_ID.get(id) ?? null
}

export function listCatalog(): readonly FurnitureCatalogEntry[] {
  return ENTRIES
}

/**
 * 部屋プリセット ID → その部屋に自動配置すべき家具一覧。
 * 戻り値の各エントリ:
 *  - catalogId
 *  - 部屋ローカル中心からの XZ 位置 (mm)
 *  - Y 軸回転 (rad)
 *
 * Sidebar の "自動家具配置" ボタンが、各部屋の rect AABB を見て呼び出す。
 */
export function defaultFurnitureForPreset(
  presetId: string,
  rectW: number,
  rectH: number,
): Array<{ catalogId: string; offsetXZ: [number, number]; rotation: number }> {
  switch (presetId) {
    case 'living':
      if (rectW < 1800 || rectH < 2400) return []
      return [
        { catalogId: 'sofa-standard', offsetXZ: [0, -rectH / 2 + 450], rotation: 0 },
        { catalogId: 'coffee-table', offsetXZ: [0, -rectH / 2 + 1500], rotation: 0 },
        { catalogId: 'tv-board', offsetXZ: [0, rectH / 2 - 250], rotation: 0 },
      ]
    case 'dining':
      if (rectW < 1700 || rectH < 1100) return []
      return [{ catalogId: 'dining-table-4', offsetXZ: [0, 0], rotation: 0 }]
    case 'kitchen':
    case 'kitchen-gas':
      if (rectW < 2500 && rectH < 2500) return []
      return [
        {
          catalogId: 'kitchen-counter-i',
          offsetXZ: rectW >= rectH ? [0, -rectH / 2 + 325] : [-rectW / 2 + 325, 0],
          rotation: rectW >= rectH ? 0 : Math.PI / 2,
        },
      ]
    case 'bedroom':
    case 'kids-room':
      if (rectW < 1800 || rectH < 2400) return []
      return [
        {
          catalogId: 'bed-semi-double',
          offsetXZ: [0, -rectH / 2 + 1000 + 200],
          rotation: 0,
        },
        {
          catalogId: 'nightstand',
          offsetXZ: [900, -rectH / 2 + 250],
          rotation: 0,
        },
      ]
    case 'bathroom':
      if (rectW < 1700 || rectH < 1500) return []
      return [{ catalogId: 'bathtub', offsetXZ: [0, -rectH / 2 + 400], rotation: 0 }]
    case 'washroom':
      if (rectW < 1000 || rectH < 800) return []
      return [{ catalogId: 'sink-vanity', offsetXZ: [0, -rectH / 2 + 280], rotation: 0 }]
    case 'toilet':
      return [{ catalogId: 'toilet-tank', offsetXZ: [0, -rectH / 2 + 400], rotation: 0 }]
    case 'entrance':
      if (rectW < 1500 || rectH < 1500) return []
      return [{ catalogId: 'shoe-cabinet', offsetXZ: [rectW / 2 - 200, 0], rotation: 0 }]
    default:
      return []
  }
}
