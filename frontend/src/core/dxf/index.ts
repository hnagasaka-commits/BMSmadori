/**
 * §M116 v0.28: DXF サブシステムの公開 API。
 *
 * 呼び出し側 (Home.tsx) は以下の 1 行で取込が完結する:
 *   const { floorplan, report } = await importDxfText(text, { fileName })
 */

export { parseDxf } from './parser'
export type { DxfEntity, DxfEntities, Vec2 } from './parser'
export { buildFloorplanFromDxf, extractCeilingHeight } from './buildFloorplan'
export type { DxfImportReport, BuildFloorplanResult } from './buildFloorplan'
export { exportFloorplanToDxf, downloadFloorplanAsDxf } from './exporter'

import { parseDxf } from './parser'
import { buildFloorplanFromDxf, type BuildFloorplanResult } from './buildFloorplan'

/**
 * DXF テキストを受け取り、Floorplan + report を返す。
 * Home.tsx の "CAD から作成" ボタンが呼ぶ唯一のエントリポイント。
 */
export function importDxfText(
  text: string,
  options: { fileName?: string } = {},
): BuildFloorplanResult {
  const dxf = parseDxf(text)
  return buildFloorplanFromDxf(dxf, options)
}
