/**
 * §17.4 スケール選定。
 * 1/50, 1/100, 1/200 の候補から、用紙の有効描画領域に収まる最大スケールを選ぶ。
 *
 * paperRect / planBbox は mm 単位。戻り値は縮尺の分母 (50, 100, 200)。
 */

const CANDIDATES = [50, 100, 200] as const

export function selectScale(
  paperRect: { w: number; h: number },
  planBbox: { w: number; h: number },
): number {
  if (planBbox.w <= 0 || planBbox.h <= 0) return 100
  for (const denom of CANDIDATES) {
    const scaledW = planBbox.w / denom
    const scaledH = planBbox.h / denom
    if (scaledW <= paperRect.w && scaledH <= paperRect.h) return denom
  }
  return 200
}
