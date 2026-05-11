/**
 * §6.4.4 簡易壁量計算 (Phase 3 / M21) のテスト。
 */
import { describe, expect, it } from 'vitest'

import {
  computeBuildingSeismic,
  computeFloorSeismic,
  requiredFactor,
  wallBearingFactor,
} from '@/core/seismic'
import { checkSeismic } from '@/core/compliance/seismic'
import { makeFloor, makeFloorplan, makeRoom, makeWall } from '@/test/fixtures'

describe('wallBearingFactor', () => {
  it('外壁 / 戸境壁は 1.0', () => {
    expect(wallBearingFactor('exterior')).toBe(1.0)
    expect(wallBearingFactor('shared')).toBe(1.0)
  })
  it('耐力壁は 2.0', () => {
    expect(wallBearingFactor('load-bearing')).toBe(2.0)
  })
  it('間仕切り / 非耐力壁は 0', () => {
    expect(wallBearingFactor('partition')).toBe(0)
    expect(wallBearingFactor('non-bearing')).toBe(0)
  })
})

describe('requiredFactor', () => {
  it('1 階建ては 15 cm/m²', () => {
    expect(requiredFactor(1, 1)).toBe(15)
  })
  it('2 階建ては 1F=33, 2F=21', () => {
    expect(requiredFactor(1, 2)).toBe(33)
    expect(requiredFactor(2, 2)).toBe(21)
  })
  it('3 階建ては 1F=50, 2F=39, 3F=24', () => {
    expect(requiredFactor(1, 3)).toBe(50)
    expect(requiredFactor(2, 3)).toBe(39)
    expect(requiredFactor(3, 3)).toBe(24)
  })
})

describe('computeFloorSeismic', () => {
  it('壁が無ければ X/Y の実壁量は 0', () => {
    const floor = makeFloor({ rooms: [makeRoom()], walls: [] })
    const r = computeFloorSeismic(floor, 1)
    expect(r.actualXCm).toBe(0)
    expect(r.actualYCm).toBe(0)
    expect(r.passX).toBe(false)
    expect(r.passY).toBe(false)
  })

  it('X 軸沿いの load-bearing 壁は X 方向に効く', () => {
    // 10m の X 軸沿い load-bearing 壁: actualXCm = 1000 * 2 = 2000
    const floor = makeFloor({
      rooms: [makeRoom()],
      walls: [
        makeWall({
          from: [0, 0],
          to: [10000, 0],
          wallType: 'load-bearing',
        }),
      ],
    })
    const r = computeFloorSeismic(floor, 1)
    expect(r.actualXCm).toBeCloseTo(2000)
    expect(r.actualYCm).toBe(0)
  })

  it('partition は実壁量に算入されない', () => {
    const floor = makeFloor({
      rooms: [makeRoom()],
      walls: [
        makeWall({
          from: [0, 0],
          to: [10000, 0],
          wallType: 'partition',
        }),
      ],
    })
    const r = computeFloorSeismic(floor, 1)
    expect(r.actualXCm).toBe(0)
  })

  it('床面積から必要壁量が算出される (1 階建て: 15 cm/m²)', () => {
    // makeRoom の既定 shape: 3640×2730 ≈ 9.93 m² → 必要壁量 ≈ 149 cm
    const floor = makeFloor({ rooms: [makeRoom()] })
    const r = computeFloorSeismic(floor, 1)
    expect(r.requiredCm).toBeCloseTo((3640 * 2730 * 15) / 1_000_000, 0)
  })
})

describe('computeBuildingSeismic', () => {
  it('全階の SeismicReport を順番に返す', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({ level: 1, rooms: [makeRoom()] }),
        makeFloor({ level: 2, rooms: [makeRoom()] }),
      ],
    })
    const reports = computeBuildingSeismic(plan)
    expect(reports).toHaveLength(2)
    // 2 階建ての 1F の係数は 33
    expect(reports[0]!.requiredCm).toBeGreaterThan(reports[1]!.requiredCm)
  })
})

describe('checkSeismic (法規警告)', () => {
  it('木造以外は警告 0', () => {
    const plan = makeFloorplan({
      building: { structureType: 'rc', isExistingBuilding: false },
      floors: [makeFloor({ rooms: [makeRoom()] })],
    })
    expect(checkSeismic(plan)).toEqual([])
  })

  it('壁が無ければ X / Y の両方で不足 → warning が階数分出る', () => {
    const plan = makeFloorplan({
      floors: [makeFloor({ rooms: [makeRoom()], walls: [] })],
    })
    const warnings = checkSeismic(plan)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.category).toBe('structure')
    expect(warnings[0]!.message).toContain('X 方向')
    expect(warnings[0]!.message).toContain('Y 方向')
  })

  it('十分な壁量があれば warning 0', () => {
    // 1 階建て (係数 15)、面積 9.93m²、必要 ≈ 149 cm。
    // 各方向に 10m の load-bearing を 1 本ずつ → 各 2000 cm で余裕。
    const plan = makeFloorplan({
      floors: [
        makeFloor({
          rooms: [makeRoom()],
          walls: [
            makeWall({ from: [0, 0], to: [10000, 0], wallType: 'load-bearing' }),
            makeWall({ from: [0, 0], to: [0, 10000], wallType: 'load-bearing' }),
          ],
        }),
      ],
    })
    expect(checkSeismic(plan)).toEqual([])
  })
})
