/**
 * §5.8.3 サッシ規格カタログ (Phase 2 / M15)。
 *
 * 設計の意図:
 *  - Phase 1 の窓は「自由寸法 + WindowType」のみで運用してきた。
 *  - Phase 2 で「規格寸法から選ぶ」UI を入れる。実際の住宅では数十ある規格寸法から選ぶのが正で、
 *    任意の幅を設計者が打ち込むのは例外パスにすべき。
 *  - §5.8.3 「展開保存」ルール: sashId を選択した瞬間、width / height / type / sillHeight を
 *    すべて Window 本体にコピーする。後から sashId のカタログ寸法が変わっても影響を受けない。
 *  - sashId は文字列 (例: "h11-w17") として保存される。
 *
 * カタログの構成:
 *  - 主要メーカー (LIXIL / YKK AP / 三協アルミ) の共通呼称に近い形で命名する。
 *  - 高さは住宅で多用される H7(770) / H9(970) / H11(1170) / H13(1370) / H22(2230) を中心に。
 *  - 幅は W6 / W11 / W16 / W17 / W18 (= 600 / 1100 / 1600 / 1700 / 1800mm) を中心に。
 *  - sillHeight は H11 以上の腰窓は 800、テラスは 0、高窓は 1800 を既定とする。
 *
 * 規格名 → 寸法の対応 (社内ローカルな簡易呼称):
 *   - h7-w11 → 770 × 1100 (高窓)
 *   - h11-w17 → 1170 × 1700 (腰窓 / 標準)
 *   - h22-w17 → 2230 × 1700 (テラス窓)
 *   - h7-w6  → 770 × 600 (浴室・トイレ用)
 */
import type { WindowType } from '@/types'

export type SashCatalogEntry = {
  id: string
  displayName: string
  /** mm */
  width: number
  /** mm */
  height: number
  /** 既定の窓種別 */
  type: WindowType
  /** 床からの腰の高さ (mm)。0 ならテラス窓 */
  sillHeight: number
  /**
   * 使い分けのヒント。UI で表示するときの補助テキスト。
   * Phase 1.5 の §6.6 採光・換気計算とは独立 (採光は WindowType で決まる)。
   */
  hint: string
}

const ENTRIES: ReadonlyArray<SashCatalogEntry> = [
  // ---- 腰窓 (sillHeight 800mm) ----
  {
    id: 'h11-w17',
    displayName: '腰窓 1170 × 1700',
    width: 1700,
    height: 1170,
    type: 'sliding-2',
    sillHeight: 800,
    hint: '標準的な居室の腰窓 (引違い 2 枚)',
  },
  {
    id: 'h11-w16',
    displayName: '腰窓 1170 × 1600',
    width: 1600,
    height: 1170,
    type: 'sliding-2',
    sillHeight: 800,
    hint: '個室・寝室の中型腰窓',
  },
  {
    id: 'h11-w11',
    displayName: '腰窓 1170 × 1100',
    width: 1100,
    height: 1170,
    type: 'sliding-2',
    sillHeight: 800,
    hint: '小さめの腰窓',
  },
  {
    id: 'h13-w17',
    displayName: '腰窓 1370 × 1700',
    width: 1700,
    height: 1370,
    type: 'sliding-2',
    sillHeight: 600,
    hint: '採光重視の大型腰窓',
  },

  // ---- テラス窓 (sillHeight 0) ----
  {
    id: 'h22-w17',
    displayName: 'テラス窓 2230 × 1700',
    width: 1700,
    height: 2230,
    type: 'sliding-2',
    sillHeight: 0,
    hint: 'リビング・バルコニー出入用',
  },
  {
    id: 'h22-w18',
    displayName: 'テラス窓 2230 × 1800',
    width: 1800,
    height: 2230,
    type: 'sliding-2',
    sillHeight: 0,
    hint: 'リビング向け大型テラス',
  },
  {
    id: 'h22-w25',
    displayName: 'テラス窓 2230 × 2500',
    width: 2500,
    height: 2230,
    type: 'sliding-4',
    sillHeight: 0,
    hint: '4 枚引違いの大開口',
  },

  // ---- 高窓 (sillHeight 1800) ----
  {
    id: 'h7-w11',
    displayName: '高窓 770 × 1100',
    width: 1100,
    height: 770,
    type: 'casement',
    sillHeight: 1800,
    hint: 'クロゼット・廊下の換気/採光',
  },

  // ---- 小窓 (浴室・トイレ用) ----
  {
    id: 'h7-w6',
    displayName: '小窓 770 × 600',
    width: 600,
    height: 770,
    type: 'casement',
    sillHeight: 1200,
    hint: '浴室 / トイレの換気窓',
  },
  {
    id: 'h9-w6',
    displayName: '小窓 970 × 600',
    width: 600,
    height: 970,
    type: 'casement',
    sillHeight: 1100,
    hint: 'トイレの小窓',
  },

  // ---- FIX 窓 ----
  {
    id: 'fix-h11-w11',
    displayName: 'FIX 窓 1170 × 1100',
    width: 1100,
    height: 1170,
    type: 'fixed',
    sillHeight: 800,
    hint: '採光のみ (換気不可)。階段・吹抜け向け',
  },
  {
    id: 'fix-h22-w11',
    displayName: 'FIX 窓 2230 × 1100',
    width: 1100,
    height: 2230,
    type: 'fixed',
    sillHeight: 0,
    hint: '縦長 FIX 窓 (デザイン用途)',
  },
]

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]))

export function listSashCatalog(): ReadonlyArray<SashCatalogEntry> {
  return ENTRIES
}

export function getSashEntry(id: string): SashCatalogEntry | null {
  return BY_ID.get(id) ?? null
}
