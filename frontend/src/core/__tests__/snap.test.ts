/**
 * TC-A: スナップ判定 / TC-F: グリッドスナップ
 */
import { describe, expect, it } from 'vitest'

import {
  OVERLAP_RATIO_MIN,
  SNAP_THRESHOLD,
  detectSnapCandidates,
  snapPointToGrid,
  snapToGrid,
} from '@/core/snap'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeRectShape, makeRoom } from '@/test/fixtures'

describe('snapToGrid / snapPointToGrid (TC-F グリッドスナップ)', () => {
  it('910mm モジュールに丸める', () => {
    expect(snapToGrid(0, 910)).toBe(0)
    expect(snapToGrid(454, 910)).toBe(0)
    expect(snapToGrid(456, 910)).toBe(910)
    expect(snapToGrid(910, 910)).toBe(910)
    expect(snapToGrid(2730, 910)).toBe(2730)
  })

  it('grid <= 0 のときは整数 mm に量子化', () => {
    expect(snapToGrid(123.7, 0)).toBe(124)
  })

  it('snapPointToGrid は各軸を独立に量子化', () => {
    expect(snapPointToGrid([455, 1820], 910)).toEqual([910, 1820])
  })
})

describe('detectSnapCandidates (TC-A: 基本スナップ判定)', () => {
  it('200mm 以内・重なり率 50% 以上ならスナップ候補', () => {
    const stationary = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const stationaryWalls = regenerateWallsFromRooms([stationary])

    // moving 部屋を a の右に 100mm 隙間を空けて配置 (= a の east 壁から 100mm 離れる)
    const moving = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1100, y: 0, w: 1000, h: 1000 }),
    })
    const cands = detectSnapCandidates(moving, stationaryWalls)
    // 西辺 (x=1100) が a の東辺 (x=1000) から 100mm < 200mm 以内 → 1 件以上
    expect(cands.length).toBeGreaterThan(0)
    const closest = cands[0]!
    expect(closest.perpendicularDistance).toBeLessThanOrEqual(SNAP_THRESHOLD)
    expect(closest.overlapRatio).toBeGreaterThanOrEqual(OVERLAP_RATIO_MIN)
  })

  it('200mm より遠ければスナップ候補にならない', () => {
    const stationary = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([stationary])
    const moving = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1500, y: 0, w: 1000, h: 1000 }),
    })
    // 500mm 離れている → スナップ候補にならない
    const cands = detectSnapCandidates(moving, walls)
    expect(cands.length).toBe(0)
  })

  it('重なり比率が 50% 未満ならスナップしない', () => {
    const stationary = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([stationary])
    // moving の y を 900 にずらすと a の east 壁 (y=0..1000) と
    // moving の west 壁 (y=900..1900) は 100mm しか重ならず、moving 辺長 1000mm の 10% で 50% 未満
    const moving = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1100, y: 900, w: 1000, h: 1000 }),
    })
    const cands = detectSnapCandidates(moving, walls)
    expect(cands.length).toBe(0)
  })

  it('movingRoom 自身の壁 (sharedBy に自分の id) はスナップ対象から除外', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const walls = regenerateWallsFromRooms([a])
    // 自分自身が動いているとき、自分の壁にスナップしない
    const cands = detectSnapCandidates(a, walls)
    expect(cands.length).toBe(0)
  })
})
