/**
 * TC-N: 設備系統チェック (Phase 1.5)。
 */
import { describe, expect, it } from 'vitest'

import { checkEquipment } from '@/core/compliance/equipment'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeFloor, makeRectShape, makeRoom } from '@/test/fixtures'
import type { PipeSpace } from '@/types'

function ps(args: {
  id?: string
  position: readonly [number, number]
  systems: PipeSpace['systems']
}): PipeSpace {
  return {
    id: args.id ?? crypto.randomUUID(),
    position: args.position,
    size: { w: 600, h: 600 },
    systems: args.systems,
    isLocked: false,
  }
}

describe('TC-N: 設備系統チェック', () => {
  it('TC-N-01: PS から浴室まで 5m なら警告なし', () => {
    const bathroom = makeRoom({
      id: 'br',
      presetId: 'bathroom',
      shape: makeRectShape({ x: 0, y: 0, w: 1820, h: 1820 }),
    })
    const walls = regenerateWallsFromRooms([bathroom])
    const floor = makeFloor({
      rooms: [bathroom],
      walls,
      pipeSpaces: [
        ps({
          position: [5000, 1000], // 部屋中心 (910, 910) から 4.1m
          systems: ['water-supply', 'drainage', 'vent'],
        }),
      ],
    })
    expect(checkEquipment(floor)).toHaveLength(0)
  })

  it('TC-N-02: PS から浴室まで 10m 超なら距離警告 (info)', () => {
    const bathroom = makeRoom({
      id: 'br',
      presetId: 'bathroom',
      shape: makeRectShape({ x: 0, y: 0, w: 1820, h: 1820 }),
    })
    const floor = makeFloor({
      rooms: [bathroom],
      pipeSpaces: [
        ps({
          position: [10000, 5000], // 部屋中心から 10m 超
          systems: ['water-supply', 'drainage', 'vent'],
        }),
      ],
    })
    const warnings = checkEquipment(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('info')
    expect(warnings[0]!.message).toMatch(/配管が困難/)
  })

  it('TC-N-03: キッチンを配置、PS なし → warning (配管不能)', () => {
    const kitchen = makeRoom({
      id: 'k',
      presetId: 'kitchen', // IH キッチン、水道+排水のみ要
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }),
    })
    const floor = makeFloor({ rooms: [kitchen] })
    const warnings = checkEquipment(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('warning')
    expect(warnings[0]!.category).toBe('equipment')
  })

  it('給水だけの PS は drainage を必要とするキッチンに対しては「見つからない」warning', () => {
    const kitchen = makeRoom({
      id: 'k',
      presetId: 'kitchen',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }),
    })
    const floor = makeFloor({
      rooms: [kitchen],
      pipeSpaces: [
        ps({ position: [100, 100], systems: ['water-supply'] }), // drainage 欠落
      ],
    })
    const warnings = checkEquipment(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('warning')
  })

  it('IH キッチンは gas を要求しないので、給水+排水だけの PS で OK', () => {
    const kitchen = makeRoom({
      id: 'k',
      presetId: 'kitchen', // IH (utilityRequirements = ["water-supply", "drainage"])
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }),
    })
    const floor = makeFloor({
      rooms: [kitchen],
      pipeSpaces: [
        ps({ position: [100, 100], systems: ['water-supply', 'drainage'] }),
      ],
    })
    expect(checkEquipment(floor)).toHaveLength(0)
  })

  it('ガス併設キッチンは gas を要求するので、IH 用 PS だけだと warning', () => {
    const kitchen = makeRoom({
      id: 'k',
      presetId: 'kitchen-gas',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 2730 }),
    })
    const floor = makeFloor({
      rooms: [kitchen],
      pipeSpaces: [
        ps({ position: [100, 100], systems: ['water-supply', 'drainage'] }),
      ],
    })
    const warnings = checkEquipment(floor)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.severity).toBe('warning')
  })

  it('居室 (寝室) は対象外', () => {
    const bedroom = makeRoom({
      id: 'br',
      presetId: 'bedroom',
      shape: makeRectShape({ x: 0, y: 0, w: 3640, h: 3640 }),
    })
    const floor = makeFloor({ rooms: [bedroom] })
    expect(checkEquipment(floor)).toHaveLength(0)
  })
})
