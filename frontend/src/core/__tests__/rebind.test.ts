import { describe, expect, it } from 'vitest'

import {
  buildWallIdMap,
  indexPrevWalls,
  rebindReferences,
  rebindWalls,
} from '@/core/rebind'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeRectShape, makeRoom } from '@/test/fixtures'
import type { Door } from '@/types'

describe('rebindWalls (id 引き継ぎ + 片側 EdgeRef フォールバック)', () => {
  it('部屋を平行移動しても wall id が完全に引き継がれる (完全一致 a)', () => {
    const room = makeRoom({
      id: 'r1',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const prevWalls = regenerateWallsFromRooms([room])
    const prevIndex = indexPrevWalls(prevWalls, [room])

    // 部屋を 500mm 右にずらす (edgeIds 不変)
    const moved = {
      ...room,
      shape: { ...room.shape, x: 500 },
    }
    const newWalls = regenerateWallsFromRooms([moved])

    const report = rebindWalls(newWalls, [moved], prevIndex)
    // すべて旧 id を引き継ぐ
    const reusedIds = new Set(report.reused.values())
    expect(reusedIds.size).toBe(4)
    for (const w of report.walls) {
      expect(prevWalls.map((p) => p.id)).toContain(w.id)
    }
    expect(report.invalidatedWallIds.size).toBe(0)
  })

  it('外周壁が共有壁化したケースで片側 EdgeRef フォールバックが動く (case b)', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const prevWalls = regenerateWallsFromRooms([a])
    const prevIndex = indexPrevWalls(prevWalls, [a])
    // a の東辺 (edgeIds[1]) の id
    const aEastEdgeId = a.shape.edgeIds[1]
    const aEastWall = prevWalls.find(
      (w) => w.sharedBy.includes('a') && w.from[0] === 1000 && w.to[0] === 1000,
    )
    expect(aEastWall).toBeDefined()

    // b を右隣に追加 → a-east と b-west が共有壁にマージされる
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    const newWalls = regenerateWallsFromRooms([a, b])
    const report = rebindWalls(newWalls, [a, b], prevIndex)

    // 共有壁になった新 wall は、a 側 EdgeRef = (a, aEastEdgeId) で片側マッチ → 旧 a-east の id を引き継ぐ
    const sharedWall = report.walls.find(
      (w) => w.sharedBy.length === 2 && w.from[0] === 1000,
    )
    expect(sharedWall).toBeDefined()
    expect(sharedWall!.id).toBe(aEastWall!.id)
    expect(aEastEdgeId).toBeDefined()
  })

  it('共有壁が分離 (= 部屋削除) すると、外周壁化した新壁は片側マッチで旧 id を引き継ぐ (case c)', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const b = makeRoom({
      id: 'b',
      shape: makeRectShape({ x: 1000, y: 0, w: 1000, h: 1000 }),
    })
    const prevWalls = regenerateWallsFromRooms([a, b])
    const prevIndex = indexPrevWalls(prevWalls, [a, b])
    const prevSharedId = prevWalls.find((w) => w.sharedBy.length === 2)!.id

    // b を削除 → 共有壁が a の外周壁に戻る
    const newWalls = regenerateWallsFromRooms([a])
    const report = rebindWalls(newWalls, [a], prevIndex)
    const aEastNew = report.walls.find(
      (w) => w.sharedBy.includes('a') && w.from[0] === 1000,
    )!
    expect(aEastNew.id).toBe(prevSharedId)
  })

  it('対応する旧壁がなければ新 ID を発行する (case d)', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const prevIndex = indexPrevWalls([], [])
    const newWalls = regenerateWallsFromRooms([a])
    const report = rebindWalls(newWalls, [a], prevIndex)
    expect(report.walls).toHaveLength(4)
    expect(report.reused.size).toBe(0)
  })
})

describe('rebindReferences (Door/Window/WallFinish)', () => {
  it('引き継がれた wallId のドアはそのまま生き残る', () => {
    const door: Door = {
      id: 'd1',
      wallId: 'w-keep',
      positionRatio: 0.5,
      width: 800,
      type: 'single-swing',
    }
    const report = rebindReferences({
      doors: [door],
      windows: [],
      wallFinishes: [],
      wallIdMap: new Map([['w-keep', 'w-keep']]),
      invalidatedWallIds: new Set(),
    })
    expect(report.doors).toHaveLength(1)
    expect(report.doors[0]!.wallId).toBe('w-keep')
    expect(report.removedDoorIds).toHaveLength(0)
  })

  it('失効した wallId のドア・窓は削除される', () => {
    const door: Door = {
      id: 'd1',
      wallId: 'w-gone',
      positionRatio: 0.5,
      width: 800,
      type: 'single-swing',
    }
    const report = rebindReferences({
      doors: [door],
      windows: [],
      wallFinishes: [],
      wallIdMap: new Map(),
      invalidatedWallIds: new Set(['w-gone']),
    })
    expect(report.doors).toHaveLength(0)
    expect(report.removedDoorIds).toEqual(['d1'])
  })
})

describe('buildWallIdMap', () => {
  it('rebindWalls.reused を oldId -> oldId にまとめ、失効 id を invalidated に', () => {
    const a = makeRoom({
      id: 'a',
      shape: makeRectShape({ x: 0, y: 0, w: 1000, h: 1000 }),
    })
    const prevWalls = regenerateWallsFromRooms([a])
    const prevIndex = indexPrevWalls(prevWalls, [a])

    // 何も変わらない: 同じ部屋セットを再生成 → 全部 reused
    const newWalls = regenerateWallsFromRooms([a])
    const report = rebindWalls(newWalls, [a], prevIndex)
    const { wallIdMap, invalidatedWallIds } = buildWallIdMap(prevIndex, report)
    expect(invalidatedWallIds.size).toBe(0)
    expect(wallIdMap.size).toBe(prevWalls.length)
    for (const id of prevWalls.map((w) => w.id)) {
      expect(wallIdMap.get(id)).toBe(id)
    }
  })
})
