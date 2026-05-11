/**
 * §17 PDF 出力 (Phase 1 MVP)。
 *
 * jsPDF + Konva Stage の高解像度 PNG 埋込 で平面図 PDF を組み立てる。
 *
 * Phase 1 制約:
 *  - 日本語フォントは未埋込み (Noto Sans JP のサブセット化 PoC は M7.5 で対応予定)。
 *    そのため PDF テキストは英語 + 数値で構成し、部屋名などの日本語は平面図の画像経由で出る。
 *  - レイアウトは §17.3 の A3 横を基本に簡素版。プラン情報・部屋一覧・警告サマリ・免責。
 *  - スケールバー / 方位記号は平面図の画像内に既に含まれる前提
 *    (将来 PDF 側で別途描画する。Phase 2 で本格化)。
 *
 * 設計書 §17.6 の Author opt-in は引数 `metadata.includeAuthor` で受け取る。
 */

import jsPDF from 'jspdf'
import type { ComplianceWarning, Floorplan, Room } from '@/types'
import { getPreset } from '@/data/roomPresets'
import { roomFloorArea } from '@/core/compliance/areas'
import { selectScale } from './scale'
import { containsNonAscii, renderJpTextAsImage } from './jpText'

// ---------------------------------------------------------------------------
// 用紙サイズ (§17.1)
// ---------------------------------------------------------------------------

export type PaperFormat = 'a3-landscape' | 'a4-portrait' | 'a4-landscape'

const PAPER_DIMS: Record<PaperFormat, { w: number; h: number; orientation: 'l' | 'p'; format: 'a3' | 'a4' }> = {
  'a3-landscape': { w: 420, h: 297, orientation: 'l', format: 'a3' },
  'a4-portrait': { w: 210, h: 297, orientation: 'p', format: 'a4' },
  'a4-landscape': { w: 297, h: 210, orientation: 'l', format: 'a4' },
}

const MARGIN_MM = 12

// ---------------------------------------------------------------------------
// 引数型
// ---------------------------------------------------------------------------

export type PdfMetadataOptions = {
  /** §17.6 Author opt-in。未指定または空文字なら PDF メタデータの Author は空 */
  author?: string
  appVersion?: string
}

export type BuildPdfArgs = {
  /** 出力対象の Floorplan */
  floorplan: Floorplan
  /** Konva Stage を toDataURL 経由で渡す。PNG dataURL ('data:image/png;base64,...') */
  planImageDataUrl: string
  /** 平面図画像のワールド bounding box (mm)。スケールバー描画とスケール選定で使う */
  planBboxMm: { w: number; h: number }
  /** 未 ack の法規警告 (§17.3 末尾サマリ) */
  warnings: readonly ComplianceWarning[]
  paper?: PaperFormat
  metadata?: PdfMetadataOptions
}

// ---------------------------------------------------------------------------
// メインビルダー
// ---------------------------------------------------------------------------

export function buildPdf(args: BuildPdfArgs): jsPDF {
  const paper = PAPER_DIMS[args.paper ?? 'a3-landscape']
  const doc = new jsPDF({
    orientation: paper.orientation,
    unit: 'mm',
    format: paper.format,
  })

  setMetadata(doc, args)

  // レイアウト: 左 = 平面図、右 = プラン情報 + 部屋一覧、フッター = 免責
  const usable = {
    x: MARGIN_MM,
    y: MARGIN_MM,
    w: paper.w - MARGIN_MM * 2,
    h: paper.h - MARGIN_MM * 2,
  }
  // 平面図エリアは usable の左 65% (a3-landscape のとき約 261mm × 264mm)
  // 右側パネルは usable の右 35%
  const planAreaW = usable.w * 0.65
  const rightX = usable.x + planAreaW + 4 // 4mm spacer
  const rightW = usable.w - planAreaW - 4

  drawHeader(doc, args, { x: usable.x, y: usable.y, w: usable.w })
  const planY = usable.y + 10
  const planH = usable.h - 10 - 10 // header 10mm, footer 10mm

  // スケール選定: 用紙の有効領域に収まる最大スケール
  const scaleDenom = selectScale({ w: planAreaW, h: planH }, args.planBboxMm)
  drawPlanImage(doc, args.planImageDataUrl, args.planBboxMm, scaleDenom, {
    x: usable.x,
    y: planY,
    w: planAreaW,
    h: planH,
  })
  drawScaleBar(doc, scaleDenom, {
    x: usable.x,
    y: planY + planH - 6,
    w: planAreaW,
  })

  drawInfoPanel(doc, args, scaleDenom, {
    x: rightX,
    y: planY,
    w: rightW,
    h: planH,
  })

  drawFooter(doc, args, { x: usable.x, y: usable.y + usable.h, w: usable.w })

  return doc
}

/**
 * PDF を保存する。クリックイベント内から呼ぶこと。
 */
export function downloadPdf(args: BuildPdfArgs, filename?: string): void {
  const doc = buildPdf(args)
  const name = filename ?? safeFilename(args.floorplan.metadata.name) + '_' + isoDateCompact()
  doc.save(`${name}.pdf`)
}

// ---------------------------------------------------------------------------
// 下請け描画関数
// ---------------------------------------------------------------------------

function setMetadata(doc: jsPDF, args: BuildPdfArgs): void {
  const md = args.metadata ?? {}
  const planName = args.floorplan.metadata.name || 'floorplan'
  const appVer = md.appVersion ?? '1.0'
  // §17.6 Title / Subject / Producer / Keywords
  doc.setProperties({
    title: planName,
    subject: 'Floorplan draft for contractor meeting',
    author: md.author ?? '', // §17.6 既定で空 (opt-in)
    creator: `間取りプランナー v${appVer}`,
    keywords: [
      args.floorplan.metadata.buildingType,
      ...(args.floorplan.metadata.template?.tags ?? []),
    ].join(', '),
  })
}

/**
 * §17.4 / M18: テキスト 1 行を描く。
 * - ASCII のみ → jsPDF native text (選択可能)
 * - 非 ASCII を含む → Canvas で PNG 化して addImage (選択不可だが Japanese を描ける)
 *
 * fontSizeMm は draw 時の高さ目標。返り値は実際に進めた px の Y オフセット (mm)。
 */
function drawTextLine(
  doc: jsPDF,
  text: string,
  x: number,
  baselineY: number,
  fontSizePt: number,
  color: { r: number; g: number; b: number },
): void {
  if (!containsNonAscii(text)) {
    doc.setFontSize(fontSizePt)
    doc.setTextColor(color.r, color.g, color.b)
    doc.text(text, x, baselineY)
    return
  }
  // fontSizePt → mm (1pt = 0.3528mm)
  const fontSizeMm = fontSizePt * 0.3528
  const hex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
  const img = renderJpTextAsImage(text, { fontSizeMm, color: hex })
  // baselineY を画像上端に揃える: baselineY - fontSizeMm でだいたい合う
  doc.addImage(
    img.dataUrl,
    'PNG',
    x,
    baselineY - fontSizeMm,
    img.widthMm,
    img.heightMm,
    undefined,
    'FAST',
  )
}

function drawHeader(
  doc: jsPDF,
  args: BuildPdfArgs,
  area: { x: number; y: number; w: number },
): void {
  const planName = args.floorplan.metadata.name || 'Plan'
  const date = isoDateDisplay()
  drawTextLine(doc, 'プラン名:', area.x, area.y + 5, 11, { r: 23, g: 23, b: 23 })
  drawTextLine(doc, planName, area.x + 22, area.y + 5, 11, { r: 23, g: 23, b: 23 })
  doc.setFontSize(9)
  doc.setTextColor(115, 115, 115)
  doc.text(date, area.x + area.w, area.y + 5, { align: 'right' })
}

function drawPlanImage(
  doc: jsPDF,
  dataUrl: string,
  planBboxMm: { w: number; h: number },
  scaleDenom: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  // 平面図画像を、選定スケールに従って配置 (用紙上の幅 = bbox / denom)
  const drawW = Math.min(rect.w, planBboxMm.w / scaleDenom)
  const drawH = Math.min(rect.h, planBboxMm.h / scaleDenom)
  // 領域内に中央配置
  const offsetX = rect.x + (rect.w - drawW) / 2
  const offsetY = rect.y + (rect.h - drawH) / 2
  doc.addImage(dataUrl, 'PNG', offsetX, offsetY, drawW, drawH, undefined, 'FAST')
}

function drawScaleBar(
  doc: jsPDF,
  scaleDenom: number,
  rect: { x: number; y: number; w: number },
): void {
  // 1m を用紙上 (1000 / denom) mm として描く。3 セグメントで 1m / 2m / 3m
  const segMm = 1000 / scaleDenom // 1m の用紙上長さ
  const segs = Math.min(5, Math.max(3, Math.floor(rect.w / segMm)))
  const totalMm = segMm * segs
  const startX = rect.x
  const y = rect.y
  doc.setDrawColor(115, 115, 115)
  doc.setLineWidth(0.2)
  doc.line(startX, y, startX + totalMm, y)
  for (let i = 0; i <= segs; i++) {
    const x = startX + segMm * i
    doc.line(x, y - 1.2, x, y + 1.2)
  }
  doc.setFontSize(7)
  doc.setTextColor(115, 115, 115)
  doc.text(`Scale 1:${scaleDenom}  (${segs}m)`, startX, y - 2)
}

function drawInfoPanel(
  doc: jsPDF,
  args: BuildPdfArgs,
  scaleDenom: number,
  rect: { x: number; y: number; w: number; h: number },
): void {
  let y = rect.y
  const lineH = 5

  drawTextLine(doc, 'プラン情報', rect.x, y + 3, 10, { r: 23, g: 23, b: 23 })
  y += lineH + 2

  doc.setFontSize(8)
  doc.setTextColor(82, 82, 82)
  const rooms = args.floorplan.floors[0]?.rooms ?? []
  const totalArea = rooms.reduce<number>((acc, r) => acc + roomFloorArea(r), 0)
  const lines: string[] = [
    `Building: ${args.floorplan.metadata.buildingType}`,
    `Structure: ${args.floorplan.building.structureType}`,
    `Floor area: ${totalArea.toFixed(2)} m^2`,
    `Rooms: ${rooms.length}`,
    `Scale: 1/${scaleDenom}`,
    `Grid: ${args.floorplan.metadata.gridSize}mm`,
    `Orientation N: ${args.floorplan.metadata.orientation} deg`,
  ]
  for (const line of lines) {
    doc.text(line, rect.x, y)
    y += lineH
  }
  y += 4

  // Room list
  drawTextLine(doc, '部屋一覧', rect.x, y, 10, { r: 23, g: 23, b: 23 })
  y += lineH
  doc.setFontSize(8)
  doc.setTextColor(82, 82, 82)
  for (const room of rooms) {
    const preset = getPreset(room.presetId)
    const area = roomFloorArea(room)
    // §17.4 / M18: 部屋名は日本語 (displayName) を画像で、面積/preset id は native text で
    doc.text('-', rect.x, y)
    drawTextLine(
      doc,
      preset?.displayName ?? room.presetId,
      rect.x + 2,
      y,
      8,
      { r: 82, g: 82, b: 82 },
    )
    doc.text(
      `  (${preset?.id ?? '?'})  ${area.toFixed(2)} m^2`,
      rect.x + 22,
      y,
    )
    y += lineH
    if (y > rect.y + rect.h - 30) {
      doc.text('... (more)', rect.x, y)
      y += lineH
      break
    }
  }

  // 警告サマリ
  if (args.warnings.length > 0) {
    y += 2
    drawTextLine(doc, `法規警告: ${args.warnings.length} 件`, rect.x, y, 10, { r: 217, g: 119, b: 6 })
    y += lineH
    doc.setFontSize(7)
    doc.setTextColor(82, 82, 82)
    for (const w of args.warnings.slice(0, 6)) {
      const label = `- [${w.severity}] ${w.category}: ${roomLabel(args.floorplan, w.affectedRoomIds)}`
      const wrapped = doc.splitTextToSize(label, rect.w)
      doc.text(wrapped, rect.x, y)
      y += 4 * wrapped.length
      if (y > rect.y + rect.h - 6) break
    }
  } else {
    y += 2
    drawTextLine(doc, '法規警告: なし', rect.x, y, 9, { r: 5, g: 150, b: 105 })
  }
}

function roomLabel(plan: Floorplan, ids: readonly string[] | undefined): string {
  if (ids == null || ids.length === 0) return '-'
  const rooms = plan.floors[0]?.rooms ?? []
  return ids
    .map((id) => {
      const r = rooms.find((x: Room) => x.id === id)
      const preset = r ? getPreset(r.presetId) : undefined
      return preset?.id ?? id
    })
    .join(', ')
}

function drawFooter(
  doc: jsPDF,
  args: BuildPdfArgs,
  area: { x: number; y: number; w: number },
): void {
  // §1.6.2 短縮版免責
  doc.setFontSize(7)
  doc.setTextColor(115, 115, 115)
  const disclaimer =
    'Note: This document is an early-stage draft for discussion. It does NOT replace work by a licensed architect. (See §1.6 disclaimer)'
  doc.text(disclaimer, area.x, area.y - 3)

  const appVer = args.metadata?.appVersion ?? '1.0'
  doc.text(`Generated by Madori Planner v${appVer}`, area.x + area.w, area.y - 3, { align: 'right' })
}

// ---------------------------------------------------------------------------
// 小ヘルパー
// ---------------------------------------------------------------------------

function isoDateDisplay(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDateCompact(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'floorplan'
}
