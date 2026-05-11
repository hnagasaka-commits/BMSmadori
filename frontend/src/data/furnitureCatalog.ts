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
