/**
 * §6.4.3 Phase 1.5 移行時の PS 追加候補バナー。
 *
 * 開いたファイルが以下を満たす場合、ユーザーの明示的な許可で標準 PS を追加できる:
 *  - buildingType === 'condo-unit' (マンション 1 住戸)
 *  - floors[0].pipeSpaces.length === 0 (Phase 1 で作ったテンプレ起点ファイル)
 *  - metadata.templateOrigin が設定済み (= テンプレ起点で作られた)
 *
 * §6.4.3 の通り、自動マイグレーションはせず、ユーザーが「追加する」をクリックして初めて PS を入れる。
 * 一度許可するか「あとで」を選ぶとセッション中は再表示しない (localStorage で永続化はしない、
 * 同じファイルを再度開けば再判定される)。
 */
import { useState } from 'react'
import { useFloorplanStore } from '@/store/floorplanStore'

export function PsAddBanner() {
  const buildingType = useFloorplanStore((s) => s.floorplan.metadata.buildingType)
  const templateOrigin = useFloorplanStore((s) => s.floorplan.metadata.templateOrigin)
  // future-version 経由の Tolerant データでは pipeSpaces / rooms が undefined のことがある。
  // optional chain を 2 段にしないと .length / ?? [] で TypeError が出る。
  const psCount = useFloorplanStore((s) => s.floorplan.floors[0]?.pipeSpaces?.length ?? 0)
  const roomsRaw = useFloorplanStore((s) => s.floorplan.floors[0]?.rooms)
  const rooms = Array.isArray(roomsRaw) ? roomsRaw : []
  const addPipeSpace = useFloorplanStore((s) => s.addPipeSpace)
  const [dismissed, setDismissed] = useState(false)

  const eligible =
    !dismissed &&
    buildingType === 'condo-unit' &&
    templateOrigin != null &&
    psCount === 0 &&
    rooms.length > 0

  if (!eligible) return null

  function handleAdd() {
    // テンプレ由来の住戸なら、水回り部屋の近くに標準 PS を 1 つ置く (簡易版)
    const wet = rooms.find((r) =>
      ['bathroom', 'washroom', 'toilet', 'kitchen', 'kitchen-gas', 'laundry'].includes(r.presetId),
    )
    if (wet != null && wet.shape.kind === 'rect') {
      addPipeSpace({
        position: [wet.shape.x - 300, wet.shape.y + wet.shape.h / 2],
        size: { w: 600, h: 600 },
        systems: ['water-supply', 'drainage', 'vent', 'gas'],
        isLocked: true,
      })
    } else {
      addPipeSpace({
        position: [0, 0],
        systems: ['water-supply', 'drainage', 'vent'],
        isLocked: true,
      })
    }
    setDismissed(true)
  }

  return (
    <div
      data-testid="ps-add-banner"
      role="status"
      style={{
        position: 'fixed',
        top: 56,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 95,
        background: '#eff6ff',
        border: '1px solid #3b82f6',
        color: '#1e3a8a',
        padding: '8px 16px',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        fontSize: 12,
        maxWidth: '70vw',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        // §M18: バナー出現を控えめにフェード
        animation: 'fade-in-up 200ms ease-out',
      }}
    >
      <span>
        このマンション住戸テンプレには PS の追加候補があります (Phase 1.5 機能)。
      </span>
      <button
        type="button"
        className="btn primary"
        onClick={handleAdd}
        data-testid="ps-banner-add"
      >
        PS を追加する
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => setDismissed(true)}
        data-testid="ps-banner-dismiss"
      >
        あとで
      </button>
    </div>
  )
}
