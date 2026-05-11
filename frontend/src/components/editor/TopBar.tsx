/**
 * トップバー: タイトル + ツール切替 + アンドゥ/リドゥ + I/O + テンプレ
 *
 * §M17 readonly モードでは保存 / エクスポート / インポート / テンプレ系を無効化する。
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  DoorOpen,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutTemplate,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  RectangleHorizontal,
  RotateCcw,
  Save,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { redo, undo } from '@/store/history'
import {
  selectCanRedo,
  selectCanUndo,
  useHistoryStore,
} from '@/store/historyStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { useComplianceStore, visibleWarnings } from '@/store/complianceStore'
import { downloadPdf } from '@/core/pdf/buildPdf'
import { downloadStageAsPng } from '@/core/png/buildPng'
import { resolveAuthorForPdf } from '@/data/authorPreference'
import { TemplatePicker } from './TemplatePicker'

export function TopBar() {
  const canUndo = useHistoryStore(selectCanUndo)
  const canRedo = useHistoryStore(selectCanRedo)
  const reset = useFloorplanStore((s) => s.reset)
  const saveLocal = useFloorplanStore((s) => s.saveLocal)
  const exportJson = useFloorplanStore((s) => s.exportJson)
  const importJsonAction = useFloorplanStore((s) => s.importJson)
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const readonly = useEditorStore((s) => s.readonly)

  // §M18 ズーム UI: + / - / リセット (既定 0.1 = 1mm 0.1px = 1m 100px)
  const ZOOM_STEP = 1.25
  const ZOOM_DEFAULT = 0.1

  /**
   * §M33: ボタン経由のズームでも「canvas 中央を基準」に拡縮する。
   * Stage が取れない (= まだ未マウント) ときは fallback で setZoom のみ。
   */
  function zoomAround(target: { x: number; y: number } | null, nextRaw: number) {
    const editor = useEditorStore.getState()
    const oldZoom = editor.zoom
    const oldPan = editor.pan
    const nextZoom = Math.max(0.02, Math.min(0.5, nextRaw))
    if (Math.abs(nextZoom - oldZoom) < 1e-6) return
    const stage = editor.stage
    const fallbackTarget = stage != null
      ? { x: stage.width() / 2, y: stage.height() / 2 }
      : null
    const anchor = target ?? fallbackTarget
    if (anchor == null) {
      setZoom(nextZoom)
      return
    }
    const worldX = (anchor.x - oldPan.x) / oldZoom
    const worldY = (anchor.y - oldPan.y) / oldZoom
    editor.setZoom(nextZoom)
    editor.setPan({ x: anchor.x - worldX * nextZoom, y: anchor.y - worldY * nextZoom })
  }

  function handleZoomIn() {
    zoomAround(null, zoom * ZOOM_STEP)
  }
  function handleZoomOut() {
    zoomAround(null, zoom / ZOOM_STEP)
  }
  /**
   * §M29: ズームリセットは「中央フィット」に再定義。
   * Stage の現在サイズを取得してから全部屋の AABB に合わせ直す。
   */
  function handleZoomReset() {
    const stage = useEditorStore.getState().stage
    const floor = useFloorplanStore.getState().floorplan.floors[
      useFloorplanStore.getState().activeFloorIndex
    ]
    const canvasW = stage?.width() ?? 0
    const canvasH = stage?.height() ?? 0
    if (canvasW === 0 || canvasH === 0 || floor == null) {
      setZoom(ZOOM_DEFAULT)
      return
    }
    const rooms = floor.rooms
    if (rooms.length === 0) {
      useEditorStore.getState().fitToContent({ w: canvasW, h: canvasH }, null)
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const r of rooms) {
      if (r.shape.kind === 'rect') {
        minX = Math.min(minX, r.shape.x)
        minY = Math.min(minY, r.shape.y)
        maxX = Math.max(maxX, r.shape.x + r.shape.w)
        maxY = Math.max(maxY, r.shape.y + r.shape.h)
      } else if (r.shape.kind === 'polygon') {
        for (const [px, py] of r.shape.points) {
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
        }
      }
    }
    if (!Number.isFinite(minX)) {
      setZoom(ZOOM_DEFAULT)
      return
    }
    useEditorStore
      .getState()
      .fitToContent({ w: canvasW, h: canvasH }, { minX, minY, maxX, maxY })
  }
  const enterReadonly = useEditorStore((s) => s.enterReadonly)
  const exitReadonly = useEditorStore((s) => s.exitReadonly)
  const planName = useFloorplanStore((s) => s.floorplan.metadata.name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (readonly) return
    await saveLocal()
  }

  function handleExportPng() {
    if (readonly) return
    const stage = useEditorStore.getState().stage
    if (stage == null) {
      window.alert('描画キャンバスがまだ初期化されていません')
      return
    }
    downloadStageAsPng(stage, { filename: planName || 'floorplan' })
  }

  function handleExportPdf() {
    if (readonly) return
    const stage = useEditorStore.getState().stage
    if (stage == null) {
      window.alert('描画キャンバスがまだ初期化されていません')
      return
    }
    const floorplan = useFloorplanStore.getState().floorplan
    const planImageDataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 4 })

    // 平面図 bbox を rooms の外接矩形から計算 (壁芯ベース)
    const rooms = floorplan.floors[0]?.rooms ?? []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of rooms) {
      if (r.shape.kind !== 'rect') continue
      minX = Math.min(minX, r.shape.x)
      minY = Math.min(minY, r.shape.y)
      maxX = Math.max(maxX, r.shape.x + r.shape.w)
      maxY = Math.max(maxY, r.shape.y + r.shape.h)
    }
    const planBboxMm =
      Number.isFinite(minX) && Number.isFinite(maxY)
        ? { w: maxX - minX, h: maxY - minY }
        : { w: 10_000, h: 10_000 }

    const warnings = useComplianceStore.getState().warnings
    const acked = floorplan.metadata.acknowledgedWarnings ?? []
    const filterMode = useComplianceStore.getState().filterMode
    const unacked = visibleWarnings(warnings, acked, filterMode)

    const author = resolveAuthorForPdf()
    downloadPdf({
      floorplan,
      planImageDataUrl,
      planBboxMm,
      warnings: unacked,
      paper: 'a3-landscape',
      metadata: {
        ...(author != null && { author }),
        appVersion: '1.0',
      },
    })
  }

  function handleExport() {
    if (readonly) return
    const json = exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${planName || 'floorplan'}.floorplan.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを再選択できるようにクリア
    if (file == null) return
    const text = await file.text()
    const result = importJsonAction(text)
    if (!result.ok) {
      window.alert(`インポートに失敗しました (${result.code}): ${result.message}`)
      return
    }
    if (result.mode === 'readonly') {
      enterReadonly(
        `このファイル (version ${result.fileVersion}) は現行アプリより新しいため、復旧プレビューで開きました。編集・保存・PDF/PNG 出力は無効です。`,
      )
    } else {
      exitReadonly()
    }
    if (result.stripped > 0 || result.generatedEdgeIds > 0) {
      const notes: string[] = []
      if (result.stripped > 0) notes.push(`Phase 1 で未対応のフィールドを ${result.stripped} 件除去しました`)
      if (result.generatedEdgeIds > 0)
        notes.push(`欠落していた edgeId を ${result.generatedEdgeIds} 件補完しました`)
      window.alert(notes.join('\n'))
    }
  }

  const navigate = useNavigate()

  return (
    <header className="editor-topbar">
      <button
        type="button"
        className="btn icon"
        onClick={() => navigate('/')}
        aria-label="間取り一覧へ戻る"
        data-testid="back-to-home"
        title="間取り一覧へ戻る (現在のプランは自動保存済み)"
      >
        <ArrowLeft size={14} />
      </button>
      <h1>間取りプランナー</h1>

      <div className="actions" style={{ marginLeft: 16 }}>
        <button
          type="button"
          className="btn icon"
          onClick={() => setTool('select')}
          aria-pressed={tool === 'select'}
          aria-label="選択ツール"
          data-testid="tool-select"
          disabled={readonly || viewMode === '3d'}
          style={tool === 'select' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <MousePointer2 size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => setTool('window')}
          aria-pressed={tool === 'window'}
          aria-label="窓配置ツール"
          data-testid="tool-window"
          disabled={readonly || viewMode === '3d'}
          style={tool === 'window' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <RectangleHorizontal size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => setTool('door')}
          aria-pressed={tool === 'door'}
          aria-label="ドア配置ツール"
          data-testid="tool-door"
          disabled={readonly || viewMode === '3d'}
          style={tool === 'door' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <DoorOpen size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => setTool('draw')}
          aria-pressed={tool === 'draw'}
          aria-label="部屋をフリーハンドで描くツール"
          data-testid="tool-draw"
          disabled={readonly || viewMode === '3d'}
          title="部屋をフリーハンドで描く (ドラッグ開始 → 一筆書き → リリースで部屋に変換)"
          style={tool === 'draw' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => setTool('wall')}
          aria-pressed={tool === 'wall'}
          aria-label="壁を 1 本描くツール"
          data-testid="tool-wall"
          disabled={readonly || viewMode === '3d'}
          title="壁ツール: ドラッグで 1 本の壁を引く (軸並行に自動補正)"
          style={tool === 'wall' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <Minus size={14} />
        </button>

        <span style={{ width: 8 }} />

        {/* §11 Phase 2 / M12: 2D⇄3D 切替。3D 中は編集ツールが無効化される */}
        <button
          type="button"
          className="btn icon"
          onClick={() => setViewMode('2d')}
          aria-pressed={viewMode === '2d'}
          aria-label="2D 表示"
          data-testid="view-2d"
          style={viewMode === '2d' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <Square size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => setViewMode('3d')}
          aria-pressed={viewMode === '3d'}
          aria-label="3D 表示"
          data-testid="view-3d"
          style={viewMode === '3d' ? { borderColor: '#3b82f6', background: '#eff6ff' } : undefined}
        >
          <Box size={14} />
        </button>

        <span style={{ width: 8 }} />

        {/* §M18: 2D キャンバスのズーム。3D 中も押せる (3D は OrbitControls 側で別管理) が、
            3D 時には disable して挙動の予期を揃える */}
        <button
          type="button"
          className="btn icon"
          onClick={handleZoomOut}
          aria-label="ズームアウト"
          data-testid="zoom-out"
          disabled={viewMode === '3d'}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleZoomReset}
          aria-label="ズームを既定 (1/100) に戻す"
          data-testid="zoom-reset"
          disabled={viewMode === '3d'}
          title={`現在: 1/${Math.round(1000 / zoom / 10) || '?'} (px=mm×${zoom.toFixed(3)})`}
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleZoomIn}
          aria-label="ズームイン"
          data-testid="zoom-in"
          disabled={viewMode === '3d'}
        >
          <ZoomIn size={14} />
        </button>
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn icon"
          onClick={() => setPickerOpen(true)}
          aria-label="テンプレートから始める"
          data-testid="open-template"
          disabled={readonly}
        >
          <LayoutTemplate size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleImportClick}
          aria-label="JSON インポート"
          data-testid="import-json"
        >
          <FolderOpen size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleExport}
          aria-label="JSON エクスポート"
          data-testid="export-json"
          disabled={readonly}
        >
          <Download size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleExportPng}
          aria-label="PNG として保存"
          data-testid="export-png"
          disabled={readonly}
        >
          <ImageIcon size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleExportPdf}
          aria-label="PDF として保存"
          data-testid="export-pdf"
          disabled={readonly}
        >
          <FileText size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={handleSave}
          aria-label="保存"
          data-testid="save-local"
          disabled={readonly}
        >
          <Save size={14} />
        </button>

        <span style={{ width: 8 }} />

        <button
          type="button"
          className="btn icon"
          onClick={undo}
          disabled={!canUndo || readonly}
          aria-label="元に戻す"
          data-testid="undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={redo}
          disabled={!canRedo || readonly}
          aria-label="やり直す"
          data-testid="redo"
        >
          <Redo2 size={14} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={() => {
            if (readonly) {
              exitReadonly()
              reset()
              return
            }
            if (window.confirm('プランをリセットします。よろしいですか?')) reset()
          }}
          aria-label="新規プラン"
          data-testid="reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
        data-testid="import-file-input"
      />
      <TemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </header>
  )
}
