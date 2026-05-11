/**
 * §M22 Phase 3: 間取り一覧プラットフォーム画面。
 *
 * 起点画面:
 *  - 既存プランの一覧 (IndexedDB に保存されている `plans/{id}` を全件取得)
 *  - 各カードをクリックで編集画面 `/editor/:id` に遷移
 *  - 「新規間取りを作成」ボタンで [M23] テンプレ/白紙ピッカー (modal)
 *  - 削除はカード右上の × (確認ダイアログ付き)
 *
 * 状態:
 *  - プラン一覧は useEffect で initial mount に取得
 *  - 削除や新規作成のあとは再取得 (再現性重視で setState ではなくバージョン番号で発火)
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import {
  deletePlan,
  listPlanSummaries,
  savePlan,
  type PlanSummary,
} from '@/data/storage'
import { createEmptyFloorplan } from '@/store/floorplanStore'
import { TEMPLATE_CARDS } from '@/data/templates'
import type { Floorplan } from '@/types'

export function Home() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanSummary[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const refresh = useCallback(async () => {
    setPlans(await listPlanSummaries())
  }, [])

  useEffect(() => {
    // initial mount: IndexedDB から一覧を取得して setState。非同期なので react-hooks ルールには
    // 「cascading」フラグが立つが、ここは外部システムの値を React state に同期する正規の使い方。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  async function handleOpen(id: string) {
    navigate(`/editor/${id}`)
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除します。よろしいですか?`)) return
    await deletePlan(id)
    await refresh()
  }

  async function handleCreate(source: { kind: 'blank' } | { kind: 'template'; id: string }) {
    let plan: Floorplan
    if (source.kind === 'blank') {
      plan = createEmptyFloorplan()
    } else {
      const card = TEMPLATE_CARDS.find((t) => t.id === source.id)
      if (card == null) return
      plan = card.build()
    }
    const id = crypto.randomUUID()
    // 新規作成時は metadata.name を初期化
    plan = {
      ...plan,
      metadata: {
        ...plan.metadata,
        name:
          source.kind === 'blank'
            ? `新規プラン ${new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric' })}`
            : plan.metadata.name,
        updatedAt: new Date().toISOString(),
      },
    }
    await savePlan(id, plan)
    setPickerOpen(false)
    navigate(`/editor/${id}`)
  }

  return (
    <div data-testid="home" style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header
        style={{
          padding: '24px 32px',
          borderBottom: '1px solid var(--gray-200)',
          background: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>間取りプランナー</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 13 }}>
            業者打ち合わせの叩き台 (§1.6 L2)
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setPickerOpen(true)}
          data-testid="home-new-plan"
        >
          <Plus size={14} />
          新規間取りを作成
        </button>
      </header>

      <main style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
        {plans == null && <div>読み込み中…</div>}
        {plans != null && plans.length === 0 && (
          <div
            data-testid="home-empty"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--gray-500)',
              border: '1px dashed var(--gray-300)',
              borderRadius: 12,
              background: 'white',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 16 }}>まだプランがありません</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              右上の「新規間取りを作成」から始めてください
            </p>
          </div>
        )}
        {plans != null && plans.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}
            data-testid="home-plan-grid"
          >
            {plans.map((p) => (
              <article
                key={p.id}
                data-testid={`home-plan-card-${p.id}`}
                style={{
                  background: 'white',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'box-shadow 140ms ease-out, border-color 140ms ease-out',
                }}
                onClick={() => handleOpen(p.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-500)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-200)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <h2 style={{ margin: '0 0 8px', fontSize: 15 }}>{p.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'grid', gap: 2 }}>
                  <span>{p.buildingType}</span>
                  <span>
                    {p.floorCount} 階 · 1F に {p.roomCount} 部屋
                  </span>
                  {p.updatedAt && (
                    <span>{new Date(p.updatedAt).toLocaleString('ja-JP')}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDelete(p.id, p.name)
                  }}
                  aria-label={`「${p.name}」を削除`}
                  data-testid={`home-plan-delete-${p.id}`}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--gray-400)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </main>

      {pickerOpen && (
        <NewPlanPicker onCancel={() => setPickerOpen(false)} onPick={handleCreate} />
      )}
    </div>
  )
}

/**
 * §M23: 新規作成ピッカー。「テンプレートから作成」「自由に作成」の 2 択。
 * テンプレを選ぶと一覧 → クリックで決定。
 */
function NewPlanPicker({
  onCancel,
  onPick,
}: {
  onCancel: () => void
  onPick: (source: { kind: 'blank' } | { kind: 'template'; id: string }) => void
}) {
  const [mode, setMode] = useState<'choose' | 'template'>('choose')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="新規間取りを作成"
      data-testid="new-plan-picker"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        animation: 'fade-in-up 200ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          minWidth: 480,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>新規間取りを作成</h2>

        {mode === 'choose' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('template')}
              data-testid="new-plan-from-template"
              style={{ padding: 24, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
            >
              <strong>テンプレートから作成</strong>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                既製の間取り (平屋 1LDK / 2LDK / 3LDK) を起点に編集
              </span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onPick({ kind: 'blank' })}
              data-testid="new-plan-blank"
              style={{ padding: 24, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
            >
              <strong>自由に作成</strong>
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                空のプランから線を引いて間取りを描く
              </span>
            </button>
          </div>
        )}

        {mode === 'template' && (
          <div>
            <div style={{ display: 'grid', gap: 8 }}>
              {TEMPLATE_CARDS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="btn"
                  onClick={() => onPick({ kind: 'template', id: t.id })}
                  data-testid={`new-plan-template-${t.id}`}
                  style={{ padding: 16, justifyContent: 'space-between' }}
                >
                  <span style={{ textAlign: 'left' }}>
                    <strong>{t.displayName}</strong>
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {t.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setMode('choose')}
              style={{ marginTop: 12 }}
            >
              ← 戻る
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn"
          onClick={onCancel}
          style={{ marginTop: 12, marginLeft: mode === 'template' ? 8 : 0 }}
          data-testid="new-plan-cancel"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
