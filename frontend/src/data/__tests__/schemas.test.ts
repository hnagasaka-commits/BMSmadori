import { describe, expect, it } from 'vitest'

import {
  FloorplanSchema,
  SafeFloorplanSchema,
  TolerantFloorplanSchema,
} from '@/data/schemas'
import {
  makeFloor,
  makeFloorplan,
  makeRectShape,
  makeRoom,
  makeWall,
} from '@/test/fixtures'

describe('FloorplanSchema (normal mode, Phase 3)', () => {
  it('最小構成の Floorplan を受け入れる', () => {
    const plan = makeFloorplan()
    const result = FloorplanSchema.safeParse(plan)
    expect(result.success).toBe(true)
  })

  it('Phase 3 不変条件: floors は 1〜3 階。0 階や 4 階以上は拒否', () => {
    const empty = makeFloorplan({ floors: [] })
    expect(FloorplanSchema.safeParse(empty).success).toBe(false)

    // 4 階は不可
    const tooMany = makeFloorplan({
      floors: [
        makeFloor({ rooms: [makeRoom()] }),
        makeFloor({ rooms: [makeRoom()] }),
        makeFloor({ rooms: [makeRoom()] }),
        makeFloor({ rooms: [makeRoom()] }),
      ],
    })
    expect(FloorplanSchema.safeParse(tooMany).success).toBe(false)

    // 2 階は OK (Phase 3 で解放)
    const twoStorey = makeFloorplan({
      floors: [
        makeFloor({ rooms: [makeRoom()] }),
        makeFloor({ rooms: [makeRoom()] }),
      ],
    })
    expect(FloorplanSchema.safeParse(twoStorey).success).toBe(true)
  })

  it('Phase 3 では furniture / humanModels / voids すべて空でなくてもよい', () => {
    const planWithFurniture = makeFloorplan({
      floors: [
        makeFloor({
          rooms: [makeRoom()],
          furniture: [
            {
              id: 'f1',
              catalogId: 'sofa-standard',
              position: [0, 0],
              rotation: 0,
            },
          ],
        }),
      ],
    })
    expect(FloorplanSchema.safeParse(planWithFurniture).success).toBe(true)
  })

  it('Room.shape は edgeIds が必須 (4 個)', () => {
    const planMissingEdgeIds = makeFloorplan({
      floors: [
        makeFloor({
          rooms: [
            makeRoom({
              shape: {
                kind: 'rect',
                x: 0,
                y: 0,
                w: 100,
                h: 100,
              } as never, // 故意に edgeIds 抜きを渡す
            }),
          ],
        }),
      ],
    })
    expect(FloorplanSchema.safeParse(planMissingEdgeIds).success).toBe(false)
  })

  it('Wall の sharedBy は最大 2 要素', () => {
    const wall = makeWall()
    expect(wall.sharedBy.length).toBeLessThanOrEqual(2)
    const plan = makeFloorplan({
      floors: [
        makeFloor({
          walls: [{ ...wall, sharedBy: ['r1', 'r2', 'r3'] }],
        }),
      ],
    })
    expect(FloorplanSchema.safeParse(plan).success).toBe(false)
  })

  it('Window: width / height / type は必須', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({
          rooms: [makeRoom()],
          windows: [
            {
              id: 'win-1',
              wallId: 'w-1',
              positionRatio: 0.5,
              width: 1690,
              height: 1170,
              type: 'sliding-2',
              sillHeight: 800,
            },
          ],
        }),
      ],
    })
    expect(FloorplanSchema.safeParse(plan).success).toBe(true)
  })

  it('Polygon の edgeIds.length === points.length を要求', () => {
    const plan = makeFloorplan({
      floors: [
        makeFloor({
          rooms: [
            makeRoom({
              shape: {
                kind: 'polygon',
                points: [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                ],
                edgeIds: ['e1', 'e2', 'e3'], // 1 個足りない
              },
            }),
          ],
        }),
      ],
    })
    expect(FloorplanSchema.safeParse(plan).success).toBe(false)
  })
})

describe('TolerantFloorplanSchema (readonly mode)', () => {
  it('未知の version を受け入れる', () => {
    const futureFile = {
      version: '99.0',
      metadata: { name: 'Future' },
      floors: [{ id: 'f1', rooms: [{ unknownNewField: 'x' }] }],
      building: { someNewKey: true },
    }
    const result = TolerantFloorplanSchema.safeParse(futureFile)
    expect(result.success).toBe(true)
  })

  it('floors が完全に欠落していたら拒否', () => {
    const broken = { version: '1.0', metadata: {} }
    expect(TolerantFloorplanSchema.safeParse(broken).success).toBe(false)
  })

  it('未知フィールドを passthrough する (loose)', () => {
    const withExtra = {
      version: '1.5',
      metadata: { name: 'P', extraMetaField: 'kept' },
      floors: [{ id: 'f', rooms: [], extraFloorField: true }],
      building: {},
    }
    const result = TolerantFloorplanSchema.safeParse(withExtra)
    expect(result.success).toBe(true)
    if (result.success) {
      // loose で extra field が保持されることを確認
      const md = result.data.metadata as Record<string, unknown>
      expect(md.extraMetaField).toBe('kept')
    }
  })
})

describe('SafeFloorplanSchema (readonly モード描画)', () => {
  it('room: shape (rect) が描けるなら通る', () => {
    const room = {
      id: 'r1',
      shape: makeRectShape(),
      rotation: 0,
    }
    expect(SafeFloorplanSchema.room.safeParse(room).success).toBe(true)
  })

  it('room: shape kind が不明なら通らない', () => {
    const room = { id: 'r1', shape: { kind: 'star', sides: 5 } }
    expect(SafeFloorplanSchema.room.safeParse(room).success).toBe(false)
  })

  it('door: wallId と positionRatio があれば通る (passthrough で他フィールド保持)', () => {
    const door = {
      id: 'd1',
      wallId: 'w1',
      positionRatio: 0.5,
      futureField: 'kept',
    }
    const result = SafeFloorplanSchema.door.safeParse(door)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>).futureField).toBe('kept')
    }
  })

  it('door: positionRatio が範囲外なら通らない', () => {
    const door = { id: 'd1', wallId: 'w1', positionRatio: 1.5 }
    expect(SafeFloorplanSchema.door.safeParse(door).success).toBe(false)
  })

  it('plan: version は任意文字列を許す', () => {
    expect(
      SafeFloorplanSchema.plan.safeParse({
        version: '99.99.99',
        floors: [{}],
      }).success,
    ).toBe(true)
  })
})
