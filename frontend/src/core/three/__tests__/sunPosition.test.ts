/**
 * §11 Phase 2 / M17: 太陽位置モデルの単体テスト。
 *
 * - 正午は南向きで仰角 = 季節の noonAltitude
 * - 日の出/日の入り時刻に仰角 ~= 0
 * - 夜は仰角 < 0、intensity = 0
 * - 建物 orientation の打ち消しが効く
 */
import { describe, expect, it } from 'vitest'
import { computeSunSample } from '@/core/three/sunPosition'

const DEG = Math.PI / 180

describe('computeSunSample', () => {
  it('春分の正午は仰角 ≒ 55°、南向き (azimuth = π)', () => {
    const s = computeSunSample(12, 'spring', 0)
    expect(s.altitude / DEG).toBeCloseTo(55, 0)
    expect(s.azimuth / DEG).toBeCloseTo(180, 0)
  })

  it('夏至の正午は仰角 ≒ 78°', () => {
    const s = computeSunSample(12, 'summer', 0)
    expect(s.altitude / DEG).toBeCloseTo(78, 0)
  })

  it('冬至の正午は仰角 ≒ 31°', () => {
    const s = computeSunSample(12, 'winter', 0)
    expect(s.altitude / DEG).toBeCloseTo(31, 0)
  })

  it('夜は仰角が負で intensity = 0', () => {
    const s = computeSunSample(2, 'spring', 0) // 02:00
    expect(s.altitude).toBeLessThan(0)
    expect(s.intensity).toBe(0)
  })

  it('日の出時刻は仰角 ≒ 0 (sin(0))', () => {
    const s = computeSunSample(6, 'spring', 0)
    expect(Math.abs(s.altitude)).toBeLessThan(0.05) // 約 3° 以下
  })

  it('建物が東向き (orientation=90°) なら 12 時の太陽は西 (建物座標で azimuth=90°)', () => {
    const s = computeSunSample(12, 'spring', 90)
    // 真南 180° から 90° 引いて 90° (建物の東向き)
    expect(s.azimuth / DEG).toBeCloseTo(90, 0)
  })

  it('3D 方向ベクトルは仰角 0 のとき水平面上 (y ≒ 0)', () => {
    const s = computeSunSample(6, 'spring', 0)
    expect(Math.abs(s.direction[1])).toBeLessThan(0.05)
  })

  it('正午の太陽は南 → 3D の +X/-Z 平面で z 成分が正 (北向き)', () => {
    const s = computeSunSample(12, 'spring', 0)
    // azimuth = π (south) → x = 0, z = +cos(altitude) (南から照らすベクトルは +Z)
    expect(Math.abs(s.direction[0])).toBeLessThan(0.01)
    expect(s.direction[2]).toBeGreaterThan(0)
  })
})
