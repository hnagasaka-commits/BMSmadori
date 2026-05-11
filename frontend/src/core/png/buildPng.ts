/**
 * §2.5 / §17.5 PNG 書き出し。
 *
 * Konva Stage を `toDataURL({ pixelRatio: 4 })` で高解像度 PNG にしてダウンロードする。
 * Phase 1 では Canvas2D の現在の Stage をそのまま画像化する (ビューポート依存)。
 * Phase 2 で「ステージ全体の bounding box を計算し、視野外も含めて出力」に拡張する。
 */

import type Konva from 'konva'

export type BuildPngOptions = {
  /** 解像度倍率。既定 4 (§17.5 と整合) */
  pixelRatio?: number
  /** ファイル名 (拡張子なし、`.png` は自動付与) */
  filename?: string
}

/** Konva Stage を PNG の data URL に変換する。テストと UI 両方から使う。 */
export function stageToPngDataUrl(stage: Konva.Stage, options: BuildPngOptions = {}): string {
  const pixelRatio = options.pixelRatio ?? 4
  return stage.toDataURL({ mimeType: 'image/png', pixelRatio })
}

/**
 * Stage を PNG として保存し、ブラウザにダウンロードさせる。
 * クリックイベントから呼ぶこと (popup blocker 回避)。
 */
export function downloadStageAsPng(stage: Konva.Stage, options: BuildPngOptions = {}): void {
  const dataUrl = stageToPngDataUrl(stage, options)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${options.filename ?? 'floorplan'}.png`
  link.click()
}
