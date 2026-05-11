/**
 * メインエディタ画面。
 * §9.2 のレイアウト (topbar / sidebar / canvas / properties / statusbar) を Grid で組む。
 */
import { useEffect, useRef } from 'react'
import { debounce } from 'lodash'
import { useNavigate, useParams } from 'react-router-dom'
import { Canvas2D } from '@/components/canvas2d/Canvas2D'
import { Canvas3D } from '@/components/canvas3d/Canvas3D'
import { CompliancePanel } from '@/components/editor/CompliancePanel'
import { PropertyPanel } from '@/components/editor/PropertyPanel'
import { PsAddBanner } from '@/components/editor/PsAddBanner'
import { Sidebar } from '@/components/editor/Sidebar'
import { StatusBar } from '@/components/editor/StatusBar'
import { TopBar } from '@/components/editor/TopBar'
import { redo, undo } from '@/store/history'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useComplianceStore } from '@/store/complianceStore'
import { loadPlanById, savePlan } from '@/data/storage'

const AUTOSAVE_DEBOUNCE_MS = 1000

export function Editor() {
  const { id: planId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const removeRoom = useFloorplanStore((s) => s.removeRoom)
  const removeWindow = useFloorplanStore((s) => s.removeWindow)
  const selected = useEditorStore((s) => s.selected)
  const readonly = useEditorStore((s) => s.readonly)
  const readonlyReason = useEditorStore((s) => s.readonlyReason)
  const viewMode = useEditorStore((s) => s.viewMode)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setTool = useEditorStore((s) => s.setTool)

  // 法規警告 (§6.6.1) の subscribe
  useEffect(() => {
    const schedule = useComplianceStore.getState().schedule
    const runNow = useComplianceStore.getState().runNow
    runNow()
    const unsubscribe = useFloorplanStore.subscribe(() => {
      schedule()
    })
    return () => {
      unsubscribe()
      useComplianceStore.getState().cancel()
    }
  }, [])

  // §M22: URL の :id でプランを IndexedDB から復元。見つからなければ Home に戻す
  const hydratedRef = useRef(false)
  useEffect(() => {
    let cancelled = false
    if (planId == null) {
      navigate('/', { replace: true })
      return
    }
    void (async () => {
      const plan = await loadPlanById(planId)
      if (cancelled) return
      if (plan == null) {
        // 存在しない id → Home へ戻す
        navigate('/', { replace: true })
        return
      }
      useFloorplanStore.getState().loadPlan(plan)
      hydratedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [planId, navigate])

  // §M22 autosave: floorplan の変更を debounce 1 秒で `plans/{id}` に書き戻す
  // readonly モードでは保存しない
  useEffect(() => {
    if (planId == null) return
    const debounced = debounce(() => {
      if (!hydratedRef.current) return
      if (useEditorStore.getState().readonly) return
      // metadata.updatedAt を更新してから保存
      const plan = useFloorplanStore.getState().floorplan
      const stamped = {
        ...plan,
        metadata: { ...plan.metadata, updatedAt: new Date().toISOString() },
      }
      void savePlan(planId, stamped)
    }, AUTOSAVE_DEBOUNCE_MS)
    const unsubscribe = useFloorplanStore.subscribe(() => {
      debounced()
    })
    return () => {
      unsubscribe()
      debounced.cancel()
    }
  }, [planId])

  // キーボードショートカット
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target != null) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const meta = e.metaKey || e.ctrlKey
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (!readonly) undo()
      } else if ((meta && e.shiftKey && e.key.toLowerCase() === 'z') || (meta && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        if (!readonly) redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (readonly) return
        if (selected?.kind === 'room') {
          e.preventDefault()
          removeRoom(selected.id)
          clearSelection()
        } else if (selected?.kind === 'window') {
          e.preventDefault()
          removeWindow(selected.id)
          clearSelection()
        }
      } else if (e.key === 'Escape') {
        // §M27: 描画中なら描画キャンセルを優先 (ツール切替で setTool が drawing も null にする)
        setTool('select')
        clearSelection()
      }
      // §M28: フリーハンドはマウスアップで自動確定するため Enter ハンドリングは不要
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, removeRoom, removeWindow, clearSelection, setTool, readonly])

  return (
    <div className="editor-shell" data-testid="editor">
      <TopBar />
      <Sidebar />
      {/*
        §11 Phase 2 / M12: 2D / 3D の両 Canvas を常にマウントしたまま、
        非表示側を CSS display:none で隠す。これにより:
        - 2D を切り替えても Konva stage 参照 (useEditorStore.stage) が失われない
          → PDF/PNG 出力が 3D 側からでも動く
        - 3D の R3F Scene を破棄/再構築せずに済むので、再表示時のチラつきがない
      */}
      <div style={{ gridArea: 'canvas', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: viewMode === '2d' ? 'visible' : 'hidden',
          }}
        >
          <Canvas2D />
        </div>
        {viewMode === '3d' && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <Canvas3D />
          </div>
        )}
      </div>
      <div
        style={{
          gridArea: 'properties',
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          borderLeft: '1px solid var(--gray-200)',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <PropertyPanel />
        </div>
        <CompliancePanel />
      </div>
      <StatusBar />

      <PsAddBanner />

      {readonly && (
        <div
          data-testid="readonly-banner"
          role="alert"
          style={{
            position: 'fixed',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: '#fef3c7',
            border: '1px solid #d97706',
            color: '#78350f',
            padding: '8px 16px',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: 12,
            maxWidth: '70vw',
            // §M18: readonly バナーをフェードで出す
            animation: 'fade-in-up 200ms ease-out',
          }}
        >
          ⚠ 復旧プレビュー (読み取り専用):{' '}
          {readonlyReason ?? 'ファイルが現行アプリより新しいバージョンです'}
        </div>
      )}
    </div>
  )
}
