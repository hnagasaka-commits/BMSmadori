/**
 * §6.4.3 通し柱整合 (Phase 3 / M20) のテスト。
 */
import { describe, expect, it } from 'vitest'

import { checkColumnAlignment } from '@/core/compliance/columnAlignment'
import { makeFloor, makeFloorplan } from '@/test/fixtures'
import type { Column } from '@/types'

function col(x: number, y: number, loadBearing = false, id = `c-${x}-${y}`): Column {
  return {
    id,
    position: [x, y],
    size: { w: 105, h: 105 },
    isLocked: false,
    loadBearing,
  }
}

describe('checkColumnAlignment (通し柱整合)', () => {
  it('1 階建ては警告 0', () => {
    const plan = makeFloorplan()
    expect(checkColumnAlignment(plan)).toEqual([])
  })

  it('木造以外 (rc/steel) はチェックしない', () => {
    const plan = makeFloorplan({
      building: { structureType: 'rc', isExistingBuilding: false },
      floors: [
        makeFloor({ level: 1, columns: [col(0, 0, true)] }),
        makeFloor({ level: 2, columns: [] }), // 1F に対応する柱がない
      ],
    })
    expect(checkColumnAlignment(plan)).toEqual([])
  })

  it('上階の耐力柱に対応する下階の柱があれば警告 0', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: [col(0, 0), col(3640, 0), col(3640, 2730), col(0, 2730)] }),
        makeFloor({
          level: 2,
          columns: [col(0, 0, true), col(3640, 0, true), col(3640, 2730, true), col(0, 2730, true)],
        }),
      ],
    })
    expect(checkColumnAlignment(plan)).toEqual([])
  })

  it('上階の耐力柱に対応する下階の柱が無いと warning 1 件', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: [col(0, 0)] }), // 1F は 1 本だけ
        makeFloor({
          level: 2,
          columns: [col(0, 0, true), col(3640, 0, true)], // 2F に 2 本、(3640, 0) は 1F に無い
        }),
      ],
    })
    const warnings = checkColumnAlignment(plan)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.category).toBe('structure')
  })

  it('公差 100mm 以内なら一致扱い (98mm ずれは OK)', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: [col(0, 0)] }),
        makeFloor({ level: 2, columns: [col(98, 0, true)] }), // 98mm ずれ
      ],
    })
    expect(checkColumnAlignment(plan)).toEqual([])
  })

  it('公差超 (200mm ずれ) は不整合', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: [col(0, 0)] }),
        makeFloor({ level: 2, columns: [col(200, 0, true)] }),
      ],
    })
    expect(checkColumnAlignment(plan)).toHaveLength(1)
  })

  it('上階の loadBearing=false な柱は対象外', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: [] }),
        makeFloor({ level: 2, columns: [col(0, 0, false), col(3640, 0, false)] }),
      ],
    })
    expect(checkColumnAlignment(plan)).toEqual([])
  })

  it('Tolerant データ (columns 不在) でも落ちずに警告 0', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, columns: undefined as unknown as Column[] }),
        makeFloor({ level: 2, columns: [col(0, 0, true)] }),
      ],
    })
    expect(checkColumnAlignment(plan)).toEqual([])
  })
})
