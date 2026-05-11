/**
 * TC-U §12.1 パフォーマンスバジェット。
 *
 * 設計書 §3.1 / §6.6.3:
 *  - 50 部屋・通常 PC で `runLegalChecks()` 1 回 < 80ms (60fps の 1 フレーム時間 = 16ms × 5)
 *  - 30 部屋未満は同一スレッドで十分。30 部屋以上または 80ms 超で Web Worker 化検討
 *
 * このテストでは p95 (= 30 回中 28 番目) を測って 80ms 未満を要求する。
 * CI とローカルで差が出るため、極端な遅さだけを検出するゆるい目安。
 */
import { describe, expect, it } from 'vitest'

import { runLegalChecks } from '@/core/compliance'
import { regenerateWallsFromRooms } from '@/core/walls'
import { makeFloor, makeFloorplan, makeRectShape, makeRoom } from '@/test/fixtures'
import type { Room } from '@/types'

function buildPlanWith(roomCount: number) {
  // 部屋を 4550x3640 のグリッド状に並べる (居室を半数、水回りを残り)
  const cols = Math.ceil(Math.sqrt(roomCount))
  const rooms: Room[] = []
  const gapX = 4550
  const gapY = 3640
  for (let i = 0; i < roomCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const isWet = i % 4 === 0
    const presetId = isWet ? 'bathroom' : i % 4 === 1 ? 'bedroom' : 'living'
    rooms.push(
      makeRoom({
        id: `r${i}`,
        presetId,
        shape: makeRectShape({ x: col * gapX, y: row * gapY, w: gapX, h: gapY }),
      }),
    )
  }
  const walls = regenerateWallsFromRooms(rooms)
  return makeFloorplan({ floors: [makeFloor({ rooms, walls })] })
}

function measureP95(fn: () => void, samples = 30): number {
  // 軽くウォームアップ
  for (let i = 0; i < 3; i++) fn()
  const times: number[] = []
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const idx = Math.min(times.length - 1, Math.floor(times.length * 0.95))
  return times[idx]!
}

describe('TC-U: runLegalChecks パフォーマンスバジェット', () => {
  it('10 部屋で 1 回 < 20ms (軽負荷)', () => {
    const plan = buildPlanWith(10)
    const p95 = measureP95(() => runLegalChecks(plan))
    expect(p95).toBeLessThan(20)
  })

  it('30 部屋で 1 回 < 50ms', () => {
    const plan = buildPlanWith(30)
    const p95 = measureP95(() => runLegalChecks(plan))
    expect(p95).toBeLessThan(50)
  })

  it('50 部屋で 1 回 < 80ms (§3.1)', () => {
    const plan = buildPlanWith(50)
    const p95 = measureP95(() => runLegalChecks(plan))
    expect(p95).toBeLessThan(80)
  })
})
