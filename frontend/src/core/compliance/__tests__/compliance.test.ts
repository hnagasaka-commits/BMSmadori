/**
 * TC-M: 法規警告 (採光・換気・住戸内廊下・避難経路)。
 */
import { describe, expect, it } from 'vitest'

import { openableRatio, roomFloorArea, sumLightingArea, sumVentilationArea } from '@/core/compliance/areas'
import { checkLighting } from '@/core/compliance/lighting'
import { checkVentilation } from '@/core/compliance/ventilation'
import { checkCirculation } from '@/core/compliance/circulation'
import { checkFireEgress } from '@/core/compliance/fireEgress'
import { runLegalChecks } from '@/core/compliance'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeFloor, makeFloorplan, makeRectShape, makeRoom } from '@/test/fixtures'
import type { Door, Window } from '@/types'

function makeWindow(args: {
  id?: string
  wallId: string
  width?: number
  height?: number
  type?: Window['type']
  positionRatio?: number
}): Window {
  return {
    id: args.id ?? crypto.randomUUID(),
    wallId: args.wallId,
    positionRatio: args.positionRatio ?? 0.5,
    width: args.width ?? 1690,
    height: args.height ?? 1170,
    type: args.type ?? 'sliding-2',
    sillHeight: 800,
  }
}

describe('areas helpers', () => {
  it('roomFloorArea: rect の面積を m² で返す', () => {
    const room = makeRoom({ shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }) })
    expect(roomFloorArea(room)).toBeCloseTo(3.64 * 2.73, 4)
  })

  it('openableRatio: FIX = 0 / sliding = 0.5 / casement = 1.0', () => {
    expect(openableRatio('fixed')).toBe(0)
    expect(openableRatio('sliding-2')).toBe(0.5)
    expect(openableRatio('sliding-4')).toBe(0.5)
    expect(openableRatio('casement')).toBe(1.0)
    expect(openableRatio('bay')).toBe(0.5)
  })

  it('sumVentilationArea: FIX 窓は除外、引違いは半分', () => {
    const room = makeRoom({ id: 'r', shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }) })
    const walls = regenerateWallsFromRooms([room])
    const w0 = walls[0]!.id
    const windows: Window[] = [
      makeWindow({ wallId: w0, width: 1000, height: 1000, type: 'fixed' }),
      makeWindow({ wallId: w0, width: 1000, height: 1000, type: 'sliding-2' }),
    ]
    expect(sumLightingArea(room, windows, walls)).toBeCloseTo(2.0, 3) // 両方算入
    expect(sumVentilationArea(room, windows, walls)).toBeCloseTo(0.5, 3) // FIX 0 + 引違い 0.5
  })
})

describe('TC-M: 採光 (lighting)', () => {
  // TC-M-01: 寝室 8畳 (13.2㎡) に窓なし → 警告
  it('窓のない居室は採光警告', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 3640 }),
    })
    const walls = regenerateWallsFromRooms([room])
    const floor = makeFloor({ rooms: [room], walls, windows: [] })
    const warnings = checkLighting(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.category).toBe('lighting')
    expect(warnings[0]!.affectedRoomIds).toEqual(['r'])
  })

  // TC-M-02: 窓面積が床面積 / 7 未満 → 警告
  it('採光面積不足の居室は警告', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 4000, h: 4000 }), // 16 m²
    })
    const walls = regenerateWallsFromRooms([room])
    // 必要採光面積 = 16 / 7 ≒ 2.286 m²。0.5 m² の小さい窓だけ
    const windows: Window[] = [
      makeWindow({ wallId: walls[0]!.id, width: 700, height: 700, type: 'fixed' }),
    ]
    const floor = makeFloor({ rooms: [room], walls, windows })
    const warnings = checkLighting(floor)
    expect(warnings).toHaveLength(1)
  })

  // TC-M-05: 採光警告が出ている部屋で窓を追加 → 警告自動解除
  it('十分な窓を追加すると警告が消える', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 3640 }), // 13.25 m²、要 1.89 m²
    })
    const walls = regenerateWallsFromRooms([room])
    // 1690 x 1170 引違いを 1 つ = 1.978 m² > 1.89 m²
    const windows: Window[] = [
      makeWindow({ wallId: walls[0]!.id, width: 1690, height: 1170, type: 'sliding-2' }),
    ]
    const floor = makeFloor({ rooms: [room], walls, windows })
    expect(checkLighting(floor)).toHaveLength(0)
  })

  it('居室でない preset (廊下) は採光チェック対象外', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'hallway',
      shape: makeRectShape({ x: 0, y: 0, w: 910, h: 3000 }),
    })
    const walls = regenerateWallsFromRooms([room])
    const floor = makeFloor({ rooms: [room], walls, windows: [] })
    expect(checkLighting(floor)).toHaveLength(0)
  })
})

describe('TC-M: 換気 (ventilation)', () => {
  it('換気面積不足の居室は警告', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 4000, h: 4000 }), // 16 m²、要 0.8 m²
    })
    const walls = regenerateWallsFromRooms([room])
    // FIX 窓だけ。換気面積 = 0
    const windows: Window[] = [
      makeWindow({ wallId: walls[0]!.id, width: 2000, height: 2000, type: 'fixed' }),
    ]
    const floor = makeFloor({ rooms: [room], walls, windows })
    const warnings = checkVentilation(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.category).toBe('ventilation')
  })

  it('開放可能な窓が十分なら警告なし', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 3640 }), // 13.25 m²、要 0.66 m²
    })
    const walls = regenerateWallsFromRooms([room])
    // 引違い 1690x1170 = 1.978 m²、有効 0.5 倍 = 0.989 m² > 0.66 m²
    const windows: Window[] = [
      makeWindow({ wallId: walls[0]!.id, width: 1690, height: 1170, type: 'sliding-2' }),
    ]
    const floor = makeFloor({ rooms: [room], walls, windows })
    expect(checkVentilation(floor)).toHaveLength(0)
  })
})

describe('TC-M-03: 住戸内廊下幅 (circulation)', () => {
  it('廊下幅 700mm は info 警告', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'hallway',
      shape: makeRectShape({ x: 0, y: 0, w: 700, h: 3000 }),
    })
    const floor = makeFloor({ rooms: [room] })
    const warnings = checkCirculation(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('info')
  })

  it('780mm 以上の廊下は警告なし', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'hallway',
      shape: makeRectShape({ x: 0, y: 0, w: 910, h: 3000 }),
    })
    const floor = makeFloor({ rooms: [room] })
    expect(checkCirculation(floor)).toHaveLength(0)
  })

  it('hallway 以外の preset は対象外', () => {
    const room = makeRoom({
      id: 'r',
      presetId: 'closet',
      shape: makeRectShape({ x: 0, y: 0, w: 500, h: 800 }),
    })
    const floor = makeFloor({ rooms: [room] })
    expect(checkCirculation(floor)).toHaveLength(0)
  })
})

describe('TC-M-04: 避難経路 (fire-egress)', () => {
  it('寝室から玄関までドア経由経路がないと警告', () => {
    const bedroom = makeRoom({
      id: 'br',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3000, h: 3000 }),
    })
    const entrance = makeRoom({
      id: 'en',
      presetId: 'entrance',
      shape: makeRectShape({ x: 5000, y: 0, w: 1820, h: 1820 }),
    })
    const walls = regenerateWallsFromRooms([bedroom, entrance])
    const floor = makeFloor({ rooms: [bedroom, entrance], walls, doors: [] })
    const warnings = checkFireEgress(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.affectedRoomIds).toEqual(['br'])
  })

  it('共有壁にドアがあれば経路ありで警告なし', () => {
    const bedroom = makeRoom({
      id: 'br',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3000, h: 3000 }),
    })
    const entrance = makeRoom({
      id: 'en',
      presetId: 'entrance',
      shape: makeRectShape({ x: 3000, y: 0, w: 1820, h: 3000 }),
    })
    const walls = regenerateWallsFromRooms([bedroom, entrance])
    const shared = walls.find((w) => w.sharedBy.length === 2)!
    const door: Door = {
      id: 'd',
      wallId: shared.id,
      positionRatio: 0.5,
      width: 800,
      type: 'single-swing',
    }
    const floor = makeFloor({ rooms: [bedroom, entrance], walls, doors: [door] })
    expect(checkFireEgress(floor)).toHaveLength(0)
  })

  it('玄関の preset がまだ無い間取りはチェック対象外', () => {
    const bedroom = makeRoom({
      id: 'br',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3000, h: 3000 }),
    })
    const floor = makeFloor({ rooms: [bedroom] })
    expect(checkFireEgress(floor)).toHaveLength(0)
  })
})

describe('runLegalChecks 集約', () => {
  it('複数カテゴリの警告を 1 つの配列にまとめる', () => {
    const bedroom = makeRoom({
      id: 'br',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 3640 }),
    })
    const hallway = makeRoom({
      id: 'h',
      presetId: 'hallway',
      shape: makeRectShape({ x: 4000, y: 0, w: 600, h: 2000 }),
    })
    const entrance = makeRoom({
      id: 'en',
      presetId: 'entrance',
      shape: makeRectShape({ x: 6000, y: 0, w: 1820, h: 1820 }),
    })
    const walls = regenerateWallsFromRooms([bedroom, hallway, entrance])
    const floor = makeFloor({ rooms: [bedroom, hallway, entrance], walls })
    const plan = makeFloorplan({ floors: [floor] })

    const warnings = runLegalChecks(plan)
    const categories = warnings.map((w) => w.category)
    expect(categories).toContain('lighting')
    expect(categories).toContain('ventilation')
    expect(categories).toContain('circulation')
    expect(categories).toContain('fire-egress')
  })
})
