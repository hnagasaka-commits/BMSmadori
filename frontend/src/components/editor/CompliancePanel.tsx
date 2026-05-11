/**
 * 法規警告パネル (§6.6 / §9 関連)。
 * Phase 1 では右ペインの下半分に配置する (M3 のレイアウトを最小変更で再利用)。
 *
 * §9 仕様の「現在の警告 / ack 履歴 2 タブ」までは作らず、まずフラットなリストに
 * 「了解する / 再表示」ボタンを並べる。
 */
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import {
  ackWarning,
  unackWarning,
  useComplianceStore,
  visibleWarnings,
  type ComplianceFilterMode,
} from '@/store/complianceStore'
import { useEditorStore } from '@/store/editorStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import type { ComplianceWarning } from '@/types'

/** 安定参照の空配列。selector 内で `?? []` を返すと毎回新参照になり無限再レンダーするため。 */
const EMPTY_ACKED: readonly string[] = []

const FILTER_OPTIONS: ReadonlyArray<{ id: ComplianceFilterMode; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'warning-only', label: 'warning のみ' },
  { id: 'none', label: '非表示' },
]

export function CompliancePanel() {
  const warnings = useComplianceStore((s) => s.warnings)
  const filterMode = useComplianceStore((s) => s.filterMode)
  const setFilterMode = useComplianceStore((s) => s.setFilterMode)
  const ackedRaw = useFloorplanStore((s) => s.floorplan.metadata.acknowledgedWarnings)
  const acked = ackedRaw ?? EMPTY_ACKED

  const visible = visibleWarnings(warnings, acked, filterMode)
  const ackedWarnings = warnings.filter((w) => acked.includes(w.id))

  return (
    <section
      className="editor-compliance"
      data-testid="compliance-panel"
      style={{
        borderTop: '1px solid var(--gray-200)',
        padding: '12px 16px',
        background: 'white',
        maxHeight: '40vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--gray-500)',
          }}
        >
          法規警告 ({visible.length})
        </h3>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as ComplianceFilterMode)}
          data-testid="compliance-filter"
          aria-label="警告フィルタ"
          style={{ fontSize: 11, padding: '2px 4px' }}
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 && filterMode !== 'none' && (
        <div className="empty-message">すべて適合しています (現在のチェック範囲)</div>
      )}

      <ul
        data-testid="compliance-active-list"
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}
      >
        {visible.map((w) => (
          <WarningCard
            key={w.id}
            warning={w}
            onAck={() => ackWarning(w.id)}
            kind="active"
          />
        ))}
      </ul>

      {ackedWarnings.length > 0 && (
        <details style={{ marginTop: 12 }} data-testid="compliance-acked-section">
          <summary
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--gray-500)',
              cursor: 'pointer',
              marginBottom: 6,
            }}
          >
            ack 済み履歴 ({ackedWarnings.length})
          </summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {ackedWarnings.map((w) => (
              <WarningCard
                key={w.id}
                warning={w}
                onAck={() => unackWarning(w.id)}
                kind="acked"
              />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function WarningCard({
  warning,
  onAck,
  kind,
}: {
  warning: ComplianceWarning
  onAck: () => void
  kind: 'active' | 'acked'
}) {
  const select = useEditorStore((s) => s.select)
  const Icon = warning.severity === 'warning' ? AlertTriangle : Info
  const color = warning.severity === 'warning' ? 'var(--warning)' : 'var(--info)'

  function handleFocus() {
    const roomId = warning.affectedRoomIds?.[0]
    if (roomId != null) {
      select({ kind: 'room', id: roomId })
    }
  }

  return (
    <li
      data-testid="compliance-item"
      data-warning-id={warning.id}
      style={{
        border: '1px solid var(--gray-200)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: 8,
        background: kind === 'acked' ? 'var(--gray-50)' : 'white',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <button
            type="button"
            onClick={handleFocus}
            style={{
              all: 'unset',
              cursor: 'pointer',
              color: 'var(--gray-700)',
              fontWeight: 500,
            }}
          >
            {warning.message}
          </button>
          {warning.suggestion != null && (
            <div style={{ color: 'var(--gray-500)', fontSize: 11, marginTop: 4 }}>
              {warning.suggestion}
            </div>
          )}
          <div
            style={{
              color: 'var(--gray-400)',
              fontSize: 10,
              marginTop: 4,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            {warning.rule}
          </div>
        </div>
        <button
          type="button"
          onClick={onAck}
          className="btn icon"
          aria-label={kind === 'active' ? '了解する' : '再表示'}
          data-testid={kind === 'active' ? 'compliance-ack' : 'compliance-unack'}
          style={{ padding: 4 }}
        >
          <CheckCircle2 size={14} />
        </button>
      </div>
    </li>
  )
}
