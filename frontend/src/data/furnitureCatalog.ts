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

/**
 * §M92 v0.20: 家具カタログのカテゴリ。Sidebar の家具リストでグループ表示に使う。
 *  - living   : リビング (ソファ / テーブル / TV / 観葉植物 / ラグ)
 *  - dining   : ダイニング (テーブル / 食器棚 / カウンターチェア)
 *  - kitchen  : キッチン (冷蔵庫 / カウンター / 洗濯機)
 *  - bedroom  : 寝室 (ベッド / ナイトテーブル / ドレッサー)
 *  - bath     : 水回り (浴槽 / 洗面台 / トイレ)
 *  - storage  : 収納 (本棚 / クローゼット / 下駄箱 / 3 段ボックス)
 *  - work     : ワーク (デスク / 椅子)
 *  - lighting : 照明 (ペンダント / フロアランプ)
 *  - misc     : その他 (ゴミ箱 / 玄関マット / 衣類スタンド)
 */
export type FurnitureCategory =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bath'
  | 'storage'
  | 'work'
  | 'lighting'
  | 'misc'

export const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  living: 'リビング',
  dining: 'ダイニング',
  kitchen: 'キッチン',
  bedroom: '寝室',
  bath: '水回り',
  storage: '収納',
  work: 'ワーク',
  lighting: '照明',
  misc: 'その他',
}

/** §M92 v0.20: Sidebar グルーピング用の表示順 (上から登場させる順) */
export const FURNITURE_CATEGORY_ORDER: readonly FurnitureCategory[] = [
  'living',
  'dining',
  'kitchen',
  'bedroom',
  'bath',
  'storage',
  'work',
  'lighting',
  'misc',
]

export type FurnitureCatalogEntry = {
  id: string
  displayName: string
  /** §M92 v0.20: 大分類カテゴリ。Sidebar グルーピング用 */
  category: FurnitureCategory
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
    category: 'living',
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
    category: 'living',
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
    category: 'living',
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
    category: 'dining',
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
    category: 'kitchen',
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
    category: 'bedroom',
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
    category: 'bedroom',
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
    category: 'bath',
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
    category: 'bath',
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
    category: 'bath',
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
    category: 'storage',
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
    category: 'living',
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
    category: 'living',
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
    category: 'living',
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
    category: 'dining',
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
    category: 'living',
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
    category: 'bedroom',
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
    category: 'bedroom',
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
    category: 'bedroom',
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
    category: 'bedroom',
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
    category: 'kitchen',
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
    category: 'dining',
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
    category: 'bath',
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
    category: 'storage',
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
    category: 'storage',
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
  // §M68 v0.11: 3 段ボックス (カラーボックス相当)。
  // 棚 3 段が見える形で stack。底板〜天板はベース色、棚板は少し濃い色で段を視認可能に。
  {
    id: 'storage-box-3tier',
    displayName: '3 段ボックス',
    category: 'storage',
    minRoom: { w: 420, h: 320 },
    pieces: [
      // 本体外殻 (側板 + 背板を一体の箱で表現)
      {
        id: 'body',
        position: [0, 450, 0],
        size: [420, 900, 300],
        shape: 'box',
        material: { color: '#d9c9a8', roughness: 0.7, metalness: 0.0 },
      },
      // 棚板 1 (下段の上)
      {
        id: 'shelf-1',
        position: [0, 305, 5],
        size: [400, 14, 290],
        shape: 'box',
        material: { color: '#a98765', roughness: 0.7, metalness: 0.0 },
      },
      // 棚板 2 (中段の上)
      {
        id: 'shelf-2',
        position: [0, 605, 5],
        size: [400, 14, 290],
        shape: 'box',
        material: { color: '#a98765', roughness: 0.7, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'desk-work',
    displayName: 'ワークデスク',
    category: 'work',
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
    category: 'lighting',
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
    category: 'lighting',
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
    category: 'living',
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
    category: 'living',
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
    category: 'bath',
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
    category: 'misc',
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
    category: 'misc',
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
  // §M92 v0.20: 家具バリエーション追加
  {
    id: 'ottoman',
    displayName: 'オットマン (足置き)',
    category: 'living',
    minRoom: { w: 600, h: 500 },
    pieces: [
      {
        id: 'body',
        position: [0, 200, 0],
        size: [600, 400, 500],
        shape: 'box',
        material: { color: '#7a8896', roughness: 0.9, metalness: 0.02 },
      },
    ],
  },
  {
    id: 'plant-small',
    displayName: '観葉植物 (小)',
    category: 'living',
    minRoom: { w: 250, h: 250 },
    pieces: [
      {
        id: 'pot',
        position: [0, 100, 0],
        size: [220, 200, 220],
        shape: 'cylinder',
        material: { color: '#9b6b3f', roughness: 0.7, metalness: 0.0 },
      },
      {
        id: 'leaves',
        position: [0, 400, 0],
        size: [380, 600, 380],
        shape: 'cylinder',
        material: { color: '#3d6b3a', roughness: 0.95, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'counter-chair',
    displayName: 'カウンターチェア',
    category: 'dining',
    minRoom: { w: 420, h: 420 },
    pieces: [
      {
        id: 'seat',
        position: [0, 700, 0],
        size: [400, 50, 400],
        shape: 'box',
        material: { color: '#3a3a3a', roughness: 0.6, metalness: 0.1 },
      },
      {
        id: 'leg',
        position: [0, 350, 0],
        size: [60, 650, 60],
        shape: 'cylinder',
        material: { color: '#222222', roughness: 0.4, metalness: 0.6 },
      },
    ],
  },
  {
    id: 'kitchen-counter-l',
    displayName: 'L 型キッチン',
    category: 'kitchen',
    minRoom: { w: 2400, h: 2400 },
    pieces: [
      {
        id: 'counter-h',
        position: [0, 425, -700],
        size: [2400, 850, 650],
        shape: 'box',
        material: { color: '#dad6cd', roughness: 0.4, metalness: 0.15 },
      },
      {
        id: 'counter-v',
        position: [-875, 425, 175],
        size: [650, 850, 1100],
        shape: 'box',
        material: { color: '#dad6cd', roughness: 0.4, metalness: 0.15 },
      },
      {
        id: 'sink',
        position: [-600, 880, -700],
        size: [600, 60, 450],
        shape: 'box',
        material: { color: '#b7bcc2', roughness: 0.2, metalness: 0.85 },
      },
    ],
  },
  {
    id: 'microwave',
    displayName: '電子レンジ',
    category: 'kitchen',
    minRoom: { w: 480, h: 400 },
    pieces: [
      {
        id: 'body',
        position: [0, 200, 0],
        size: [480, 300, 400],
        shape: 'box',
        material: { color: '#1a1a1a', roughness: 0.4, metalness: 0.3 },
      },
      {
        id: 'window',
        position: [80, 200, 200],
        size: [240, 200, 6],
        shape: 'box',
        material: { color: '#3a3a3a', roughness: 0.1, metalness: 0.6 },
      },
    ],
  },
  {
    id: 'dishwasher',
    displayName: '食器洗浄機',
    category: 'kitchen',
    minRoom: { w: 500, h: 600 },
    pieces: [
      {
        id: 'body',
        position: [0, 425, 0],
        size: [500, 850, 600],
        shape: 'box',
        material: { color: '#e0e2e5', roughness: 0.35, metalness: 0.3 },
      },
    ],
  },
  {
    id: 'wardrobe',
    displayName: 'ワードローブ',
    category: 'bedroom',
    minRoom: { w: 1200, h: 600 },
    pieces: [
      {
        id: 'body',
        position: [0, 950, 0],
        size: [1200, 1900, 600],
        shape: 'box',
        material: { color: '#7a5c40', roughness: 0.55, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'mirror-stand',
    displayName: '姿見',
    category: 'bedroom',
    minRoom: { w: 500, h: 200 },
    pieces: [
      {
        id: 'frame',
        position: [0, 850, 0],
        size: [500, 1700, 50],
        shape: 'box',
        material: { color: '#5a3e22', roughness: 0.55, metalness: 0.0 },
      },
      {
        id: 'glass',
        position: [0, 850, 30],
        size: [440, 1620, 5],
        shape: 'box',
        material: { color: '#cfdde6', roughness: 0.04, metalness: 0.9 },
      },
    ],
  },
  {
    id: 'office-chair',
    displayName: 'オフィスチェア',
    category: 'work',
    minRoom: { w: 600, h: 600 },
    pieces: [
      {
        id: 'seat',
        position: [0, 460, 0],
        size: [520, 80, 520],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.7, metalness: 0.1 },
      },
      {
        id: 'back',
        position: [0, 750, 230],
        size: [500, 600, 60],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.7, metalness: 0.1 },
      },
      {
        id: 'pole',
        position: [0, 250, 0],
        size: [80, 400, 80],
        shape: 'cylinder',
        material: { color: '#1c1c1c', roughness: 0.3, metalness: 0.6 },
      },
    ],
  },
  {
    id: 'desk-study',
    displayName: '学習デスク',
    category: 'work',
    minRoom: { w: 1100, h: 600 },
    pieces: [
      {
        id: 'top',
        position: [0, 720, 0],
        size: [1100, 30, 600],
        shape: 'box',
        material: { color: '#d2bb96', roughness: 0.55, metalness: 0.0 },
      },
      {
        id: 'leg-l',
        position: [-500, 360, 0],
        size: [50, 720, 600],
        shape: 'box',
        material: { color: '#a98765', roughness: 0.6, metalness: 0.0 },
      },
      {
        id: 'leg-r',
        position: [500, 360, 0],
        size: [50, 720, 600],
        shape: 'box',
        material: { color: '#a98765', roughness: 0.6, metalness: 0.0 },
      },
      {
        id: 'shelf',
        position: [0, 1100, -260],
        size: [1100, 250, 80],
        shape: 'box',
        material: { color: '#a98765', roughness: 0.6, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'desk-lamp',
    displayName: 'デスクライト',
    category: 'lighting',
    minRoom: { w: 200, h: 200 },
    pieces: [
      {
        id: 'base',
        position: [0, 20, 0],
        size: [180, 40, 180],
        shape: 'cylinder',
        material: { color: '#2c2c2c', roughness: 0.3, metalness: 0.6 },
      },
      {
        id: 'arm',
        position: [60, 250, 0],
        size: [30, 460, 30],
        shape: 'cylinder',
        material: { color: '#2c2c2c', roughness: 0.3, metalness: 0.6 },
      },
      {
        id: 'shade',
        position: [180, 460, 0],
        size: [200, 100, 200],
        shape: 'cylinder',
        material: { color: '#fff2b8', roughness: 0.3, metalness: 0.1 },
      },
    ],
  },
  {
    id: 'ceiling-light',
    displayName: 'シーリングライト',
    category: 'lighting',
    minRoom: { w: 400, h: 400 },
    pieces: [
      {
        id: 'shade',
        position: [0, 2380, 0],
        size: [500, 40, 500],
        shape: 'cylinder',
        material: { color: '#f6f1e3', roughness: 0.4, metalness: 0.05 },
      },
    ],
  },
  {
    id: 'hanger-rack',
    displayName: 'ハンガーラック',
    category: 'storage',
    minRoom: { w: 900, h: 500 },
    pieces: [
      {
        id: 'pole',
        position: [0, 1700, 0],
        size: [900, 30, 30],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.3, metalness: 0.6 },
      },
      {
        id: 'leg-l',
        position: [-440, 850, 0],
        size: [30, 1700, 500],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.3, metalness: 0.6 },
      },
      {
        id: 'leg-r',
        position: [440, 850, 0],
        size: [30, 1700, 500],
        shape: 'box',
        material: { color: '#2c2c2c', roughness: 0.3, metalness: 0.6 },
      },
    ],
  },
  {
    id: 'entrance-mat',
    displayName: '玄関マット',
    category: 'misc',
    minRoom: { w: 900, h: 600 },
    pieces: [
      {
        id: 'mat',
        position: [0, 6, 0],
        size: [900, 12, 600],
        shape: 'box',
        material: { color: '#7a503a', roughness: 1.0, metalness: 0.0 },
      },
    ],
  },
  {
    id: 'umbrella-stand',
    displayName: '傘立て',
    category: 'misc',
    minRoom: { w: 250, h: 250 },
    pieces: [
      {
        id: 'body',
        position: [0, 250, 0],
        size: [220, 500, 220],
        shape: 'cylinder',
        material: { color: '#8a8a8a', roughness: 0.4, metalness: 0.6 },
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
