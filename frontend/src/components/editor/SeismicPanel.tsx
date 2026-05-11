/**
 * §6.4.4 耐震診断パネル (Phase 3 / M21)。
 *
 * Sidebar 下部に置く小さなテーブル。建物の各階について X/Y 方向の壁量と
 * 要求値を並べて、達成 / 不足を視覚化する。
 *
 * 木造のみ表示 (rc/steel は別表で扱う、本アプリではスキップ)。
 *
 * UI の意図:
 *  - 値は cm 単位で表示 (実務で耳慣れた単位)
 *  - 達成は緑、不足は赤に色分け
 *  - 床面積も併記し「必要 = 面積 × 係数」のロジックを見える化
 */
import { useMemo } from 'react'
import { useFloorplanStore } from '@/store/floorplanStore'
import { computeBuildingSeismic, requiredFactor } from '@/core/seismic'

export function SeismicPanel() {
  const floorplan = useFloorplanStore((s) => s.floorplan)
  const isWood = floorplan.building.structureType === 'wood'

  // 階数が変わったら係数も変わるので useMemo に floors.length を依存させる
  const reports = useMemo(() => computeBuildingSeismic(floorplan), [floorplan])

  if (!isWood) {
    return (
      <div className="sidebar-section">
        <h2>耐震診断 (Phase 3)</h2>
        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
          木造のみ対象 (現在: {floorplan.building.structureType})
        </div>
      </div>
    )
  }

  const totalFloors = floorplan.floors.length

  return (
    <div className="sidebar-section" data-testid="seismic-panel">
      <h2>耐震診断 (Phase 3)</h2>
      <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 6 }}>
        簡易壁量計算 (§6.4.4)
      </div>
      <table
        style={{
          width: '100%',
          fontSize: 11,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ color: 'var(--gray-500)' }}>
            <th style={{ textAlign: 'left', padding: '2px 4px' }}>階</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>面積 m²</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>必要 cm</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>X 実 cm</th>
            <th style={{ textAlign: 'right', padding: '2px 4px' }}>Y 実 cm</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r, i) => {
            const f = floorplan.floors[i]!
            const factor = requiredFactor(f.level, totalFloors)
            return (
              <tr key={f.id} data-testid={`seismic-row-${i}`}>
                <td style={{ padding: '2px 4px' }}>
                  {f.name}{' '}
                  <span style={{ color: 'var(--gray-400)' }}>(×{factor})</span>
                </td>
                <td style={{ textAlign: 'right', padding: '2px 4px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.floorAreaM2.toFixed(1)}
                </td>
                <td style={{ textAlign: 'right', padding: '2px 4px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.requiredCm.toFixed(0)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '2px 4px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: r.passX ? '#059669' : '#dc2626',
                    fontWeight: r.passX ? 400 : 600,
                  }}
                >
                  {r.actualXCm.toFixed(0)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '2px 4px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: r.passY ? '#059669' : '#dc2626',
                    fontWeight: r.passY ? 400 : 600,
                  }}
                >
                  {r.actualYCm.toFixed(0)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 6 }}>
        筋交い詳細・偏心率は未対応 (M22 以降)
      </div>
    </div>
  )
}
