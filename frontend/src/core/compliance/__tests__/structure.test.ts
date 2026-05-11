/**
 * TC-L: 構造制約 (柱間隔・柱位置)。Phase 1.5 で有効。
 */
import { describe, expect, it } from 'vitest'

import { checkStructure } from '@/core/compliance/structure'
import { makeFloor, makeFloorplan, makeRoom } from '@/test/fixtures'
import type { Column } from '@/types'

function col(id: string, x: number, y: number): Column {
  return {
    id,
    position: [x, y],
    size: { w: 105, h: 105 },
    isLocked: false,
    loadBearing: false,
  }
}

describe('TC-L: 構造警告 (一軒家)', () => {
  it('柱がない一軒家は警告なし', () => {
    const floor = makeFloor({ rooms: [makeRoom()] })
    const plan = makeFloorplan({ floors: [floor] })
    expect(checkStructure(floor, plan.metadata)).toEqual([])
  })

  it('柱間隔 > 1820mm (x 方向) は info 警告', () => {
    const floor = makeFloor({
      columns: [col('a', 0, 0), col('b', 2730, 0)],
    })
    const plan = makeFloorplan({ floors: [floor] })
    const warnings = checkStructure(floor, plan.metadata)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]!.severity).toBe('info')
    expect(warnings[0]!.category).toBe('structure')
  })

  it('柱間隔 1820mm ジャストは警告なし', () => {
    const floor = makeFloor({ columns: [col('a', 0, 0), col('b', 1820, 0)] })
    const plan = makeFloorplan({ floors: [floor] })
    expect(checkStructure(floor, plan.metadata)).toEqual([])
  })

  it('柱が 910 グリッドから外れていると info 警告', () => {
    const floor = makeFloor({ columns: [col('a', 100, 0)] })
    const plan = makeFloorplan({ floors: [floor] })
    const warnings = checkStructure(floor, plan.metadata)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('info')
    expect(warnings[0]!.message).toMatch(/グリッド/)
  })

  it('マンション住戸は対象外 (柱は躯体側で grid 非依存)', () => {
    const floor = makeFloor({ columns: [col('a', 100, 0)] })
    const plan = makeFloorplan({
      floors: [floor],
      metadata: {
        ...makeFloorplan().metadata,
        buildingType: 'condo-unit',
      },
    })
    expect(checkStructure(floor, plan.metadata)).toEqual([])
  })
})
