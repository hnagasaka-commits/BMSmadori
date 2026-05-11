/**
 * §17.4 (Phase 2 / M18): PDF 用日本語テキストの画像化レンダラ。
 *
 * 背景:
 *  - jsPDF 標準フォント (Helvetica/Times/Courier) は CJK を含まないため、Japanese を直接書くと
 *    豆腐になる。
 *  - 本格対応は TrueType フォントを VFS に登録するが、Noto Sans JP の OTF は数 MB あり
 *    Phase 2 のバンドルを膨らませる。fontsource は WOFF2 しか配らないため jsPDF と互換性がない。
 *  - 妥協案: 必要な日本語文字列だけ Canvas で描画 → PNG 化 → jsPDF.addImage で配置。
 *    画像なので PDF テキストとしては選択不可だが、業者打ち合わせの叩き台 PDF (§1.6) としては
 *    十分。Phase 3 でフォント埋込みに置き換える前提。
 *
 * 使い方:
 *   const { dataUrl, widthMm, heightMm } = renderJpTextAsImage('リビング', { fontSizeMm: 3 })
 *   doc.addImage(dataUrl, 'PNG', x, y, widthMm, heightMm)
 *
 * パフォーマンス:
 *  - 1 PDF あたり呼ぶ回数は 50 件程度 (部屋数 + 警告サマリ)
 *  - 1 件 ~10ms。50 件で ~500ms。export-pdf ボタンの体感では問題なし。
 *  - 同一文字列はキャッシュで再生成しない。
 */

const cache = new Map<string, { dataUrl: string; widthPx: number; heightPx: number }>()

type RenderOptions = {
  /** PDF 上での描画高さ (mm)。Canvas 解像度は high-DPI を見越して 4 倍にとる */
  fontSizeMm?: number
  /** sRGB hex */
  color?: string
  /** font-weight。default 400 */
  weight?: 400 | 500 | 600 | 700
}

/**
 * 日本語テキストを Canvas で PNG に変換し、jsPDF で addImage できる形にする。
 *
 * 戻り値:
 *  - dataUrl: image/png base64
 *  - widthMm / heightMm: 1pt = 0.3528mm を仮定して 1mm = 約 2.83pt
 *    PDF の mm 単位で addImage 時の幅高に渡す
 */
export function renderJpTextAsImage(
  text: string,
  options: RenderOptions = {},
): { dataUrl: string; widthMm: number; heightMm: number } {
  const fontSizeMm = options.fontSizeMm ?? 3
  const color = options.color ?? '#171717'
  const weight = options.weight ?? 400

  const cacheKey = `${fontSizeMm}|${color}|${weight}|${text}`
  const hit = cache.get(cacheKey)
  // dataUrl だけキャッシュしている。widthMm/heightMm は再計算する (画像サイズから)
  if (hit != null) {
    return {
      dataUrl: hit.dataUrl,
      widthMm: hit.widthPx / 4 / 2.83464567,
      heightMm: hit.heightPx / 4 / 2.83464567,
    }
  }

  // 4 倍解像度で描く (PDF 用に高 DPI に)
  const PX_PER_MM = 2.83464567 * 4 // 4× of 72dpi
  const fontPx = fontSizeMm * PX_PER_MM
  // テキスト幅は measureText で得る。先に offscreen で測ってからメインキャンバス作る
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (measureCtx == null) {
    // §M18: テスト環境 (jsdom) などで canvas 2d が無い場合は空の 1×1 PNG にフォールバック。
    // 呼び出し側 (buildPdf.drawTextLine) は returns 値の widthMm/heightMm を見て領域を取るので、
    // テキストは消えるが PDF 生成自体は壊れない。
    const fallback = makeFallbackImage()
    cache.set(cacheKey, fallback)
    return {
      dataUrl: fallback.dataUrl,
      widthMm: fallback.widthPx / 4 / 2.83464567,
      heightMm: fallback.heightPx / 4 / 2.83464567,
    }
  }
  measureCtx.font = `${weight} ${fontPx}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, sans-serif`
  const metrics = measureCtx.measureText(text)
  const widthPx = Math.max(1, Math.ceil(metrics.width) + 2)
  // 文字高は fontPx を基準にする (ascent+descent を完全に拾うのは難しいので余白を多めに)
  const heightPx = Math.ceil(fontPx * 1.4)

  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('canvas 2d context unavailable')
  ctx.font = measureCtx.font
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, 1, heightPx / 2)

  const dataUrl = canvas.toDataURL('image/png')
  cache.set(cacheKey, { dataUrl, widthPx, heightPx })
  return {
    dataUrl,
    widthMm: widthPx / PX_PER_MM,
    heightMm: heightPx / PX_PER_MM,
  }
}

/**
 * jsdom など canvas 2d が無い環境用の 1×1 透明 PNG (data URL は base64 で固定)。
 * - 1 ピクセルなので drawImage しても PDF に微小な点しか残らない (ほぼ無視できる)
 * - widthPx / heightPx を 4 にして「fontSize=1mm 相当」のサイズとして扱う
 */
function makeFallbackImage(): { dataUrl: string; widthPx: number; heightPx: number } {
  return {
    dataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    widthPx: 4,
    heightPx: 4,
  }
}

/**
 * 文字列が ASCII 範囲外を含む (= 日本語かそれに準ずる) なら true。
 * jsPDF の native text で出すか、Canvas 画像で出すかの分岐に使う。
 */
export function containsNonAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) return true
  }
  return false
}
