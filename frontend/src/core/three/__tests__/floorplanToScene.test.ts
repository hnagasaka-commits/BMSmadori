/**
 * floorplanToScene の単体テスト (M12-b)。
 *
 * R3F/three を一切使わない純粋関数なので、jsdom 環境のまま回る。
 */
import { describe, expect, it } from 'vitest'
import { floorplanToScene } from '@/core/three/floorplanToScene'
import { makeFloor, makeMetadata, makeRectShape, makeRoom, makeWall } from '@/test/fixtures'

describe('floorplanToScene', () => {
  it('rect 部屋 1 つを 1 つの FloorPlate に落とす', () => {
    const floor = makeFloor({
      rooms: [makeRoom({ shape: makeRectShape({ x: 0, y: 0, w: 4000, h: 3000 }) })],
    })
    const scene = floorplanToScene(floor, makeMetadata())
    expect(scene.floorPlates).toHaveLength(1)
    expect(scene.floorPlates[0]!.center).toEqual([2000, 0, 1500])
    expect(scene.floorPlates[0]!.size).toEqual([4000, 1, 3000])
  })

  it('壁を中心 + 長さ + Y 軸回転に変換する', () => {
    const floor = makeFloor({
      walls: [
        makeWall({ from: [0, 0], to: [4000, 0], thickness: 120, wallType: 'exterior' }),
      ],
    })
    const scene = floorplanToScene(floor, makeMetadata())
    expect(scene.walls).toHaveLength(1)
    const wb = scene.walls[0]!
    expect(wb.center[0]).toBeCloseTo(2000)
    expect(wb.center[2]).toBeCloseTo(0)
    expect(wb.size[0]).toBeCloseTo(4000)
    expect(wb.size[2]).toBeCloseTo(120)
    expect(wb.rotationY).toBeCloseTo(0)
    expect(wb.kind).toBe('exterior')
  })

  it('Y 軸方向の壁は π/2 回転 (- に注意: three の Y-up 座標系で正面が見えるよう調整)', () => {
    const floor = makeFloor({
      walls: [makeWall({ from: [0, 0], to: [0, 3000], wallType: 'shared' })],
    })
    const scene = floorplanToScene(floor, makeMetadata())
    expect(scene.walls[0]!.rotationY).toBeCloseTo(-Math.PI / 2)
    expect(scene.walls[0]!.kind).toBe('shared')
  })

  it('長さ 0 の壁は捨てる', () => {
    const floor = makeFloor({
      walls: [makeWall({ from: [100, 100], to: [100, 100] })],
    })
    const scene = floorplanToScene(floor, makeMetadata())
    expect(scene.walls).toHaveLength(0)
  })

  it('部屋がない場合でも center / radius は妥当な値を返す', () => {
    const scene = floorplanToScene(makeFloor(), makeMetadata())
    expect(scene.floorPlates).toHaveLength(0)
    expect(scene.walls).toHaveLength(0)
    expect(scene.radius).toBeGreaterThan(0)
  })

  it('Tolerant データ (rooms 不在) でも落ちずに空のシーンを返す', () => {
    const broken = { ...makeFloor(), rooms: undefined as unknown as never[] }
    const scene = floorplanToScene(broken, makeMetadata())
    expect(scene.floorPlates).toHaveLength(0)
  })
})
