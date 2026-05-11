/**
 * §9.8.2 テンプレ選択モーダル (Phase 1 簡易版)。
 *
 * Sidebar / TopBar から開かれ、カードクリックでテンプレを Floorplan にロードする。
 * Phase 1 では `listTemplatesForPhase` で平屋 3 種だけが表示される。
 */
import { useEffect } from 'react'
import { listTemplatesForPhase, type TemplateCard } from '@/data/templates'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useHistoryStore } from '@/store/historyStore'
import { useEditorStore } from '@/store/editorStore'

type Props = {
  open: boolean
  onClose: () => void
}

export function TemplatePicker({ open, onClose }: Props) {
  const loadPlan = useFloorplanStore((s) => s.loadPlan)
  const exitReadonly = useEditorStore((s) => s.exitReadonly)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const templates = listTemplatesForPhase()

  function handlePick(card: TemplateCard) {
    const plan = card.build()
    loadPlan(plan)
    useHistoryStore.getState().clear()
    exitReadonly()
    onClose()
  }

  return (
    <div
      data-testid="template-picker"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 20,
          width: 'min(720px, 90vw)',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>テンプレートから始める</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--gray-500)', fontSize: 12 }}>
          Phase 1 では平屋 3 種を同梱しています (商用・2 階建以上は Phase 3 で開放)。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {templates.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => handlePick(card)}
              data-testid={`template-${card.id}`}
              style={{
                textAlign: 'left',
                padding: 12,
                border: '1px solid var(--gray-200)',
                borderRadius: 6,
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>
                {card.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                {card.description}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--gray-400)',
                  marginTop: 6,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}
              >
                {card.id}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button type="button" className="btn" onClick={onClose} data-testid="template-close">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
