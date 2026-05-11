import { describe, expect, it } from 'vitest'

import {
  chooseLoadMode,
  compareSchemaVersion,
  CURRENT_SCHEMA_VERSION,
  ensureEdgeIds,
  migrate,
  stripDisallowedForPhase,
} from '@/data/migrate'

describe('compareSchemaVersion', () => {
  it('major が違えば major で決まる', () => {
    expect(compareSchemaVersion('2.0', '1.9')).toBeGreaterThan(0)
    expect(compareSchemaVersion('1.0', '2.0')).toBeLessThan(0)
  })

  it('minor の数値順 (parseFloat と違って "1.10" > "1.2" を正しく判定)', () => {
    expect(compareSchemaVersion('1.10', '1.2')).toBeGreaterThan(0)
    expect(compareSchemaVersion('1.2', '1.10')).toBeLessThan(0)
  })

  it('同じバージョンは 0', () => {
    expect(compareSchemaVersion('1.0', '1.0')).toBe(0)
    expect(compareSchemaVersion('1.0.5', '1.0.9')).toBe(0) // patch は無視
  })
})

describe('chooseLoadMode', () => {
  it('CURRENT_SCHEMA_VERSION 以下は normal', () => {
    expect(chooseLoadMode(CURRENT_SCHEMA_VERSION)).toBe('normal')
    expect(chooseLoadMode('0.9')).toBe('normal')
  })

  it('CURRENT_SCHEMA_VERSION より新しい (例: 将来 "2.0") は readonly', () => {
    expect(chooseLoadMode('2.0')).toBe('readonly')
    expect(chooseLoadMode('99.0')).toBe('readonly')
  })

  it('"1.10" は raw string として正しく比較される', () => {
    // Phase 3 の "1.2" より新しい "1.10" は readonly
    if (
      CURRENT_SCHEMA_VERSION === '1.0' ||
      CURRENT_SCHEMA_VERSION === '1.1' ||
      CURRENT_SCHEMA_VERSION === '1.2'
    ) {
      expect(chooseLoadMode('1.10')).toBe('readonly')
    }
  })
})

describe('migrate (現状は素通し)', () => {
  it('既知の version は変換なし', () => {
    const data = { version: CURRENT_SCHEMA_VERSION, foo: 1 }
    expect(migrate(data, CURRENT_SCHEMA_VERSION)).toBe(data)
  })

  it('migrator が登録されていない version は素通し (Zod 側で落とす想定)', () => {
    const data = { version: '0.9' }
    expect(migrate(data, '0.9')).toBe(data)
  })
})

describe('stripDisallowedForPhase (Phase 1)', () => {
  it('columns / pipeSpaces / furniture / humanModels / voids を全部空にする', () => {
    const raw = {
      floors: [
        {
          columns: [{ id: 'c1' }],
          pipeSpaces: [{ id: 'p1' }, { id: 'p2' }],
          furniture: [{ id: 'fu1' }],
          humanModels: [],
          voids: [{ id: 'v1' }],
        },
      ],
    }
    const { data, stripped } = stripDisallowedForPhase(raw, '1')
    expect(stripped).toBe(5)
    const floor = (data as { floors: Record<string, unknown[]>[] }).floors[0]!
    expect(floor.columns).toEqual([])
    expect(floor.pipeSpaces).toEqual([])
    expect(floor.furniture).toEqual([])
    expect(floor.humanModels).toEqual([])
    expect(floor.voids).toEqual([])
  })

  it('配列でない不正値を空配列に正規化する', () => {
    const raw = {
      floors: [{ columns: { id: 'bad' }, pipeSpaces: 'oops' }],
    }
    const { data, stripped } = stripDisallowedForPhase(raw, '1')
    expect(stripped).toBe(0)
    const floor = (data as { floors: Record<string, unknown>[] }).floors[0]!
    expect(floor.columns).toEqual([])
    expect(floor.pipeSpaces).toEqual([])
  })

  it('壊れた入力 (null / 非オブジェクト / floors なし) でクラッシュしない', () => {
    expect(stripDisallowedForPhase(null, '1').stripped).toBe(0)
    expect(stripDisallowedForPhase('not an object', '1').stripped).toBe(0)
    expect(stripDisallowedForPhase({}, '1').stripped).toBe(0)
    expect(stripDisallowedForPhase({ floors: 'not an array' }, '1').stripped).toBe(0)
  })

  it('Phase 3 では何も剥がさない', () => {
    const raw = {
      floors: [{ columns: [{ id: 'c1' }], pipeSpaces: [{ id: 'p1' }] }],
    }
    const { stripped } = stripDisallowedForPhase(raw, '3')
    expect(stripped).toBe(0)
  })
})

describe('ensureEdgeIds', () => {
  it('rect で edgeIds 欠落なら 4 個発行', () => {
    const raw = {
      floors: [{ rooms: [{ shape: { kind: 'rect', x: 0, y: 0, w: 100, h: 100 } }] }],
    }
    const { data, generated } = ensureEdgeIds(raw)
    expect(generated).toBe(4)
    const shape = (data as { floors: { rooms: { shape: { edgeIds: string[] } }[] }[] })
      .floors[0]!.rooms[0]!.shape
    expect(shape.edgeIds).toHaveLength(4)
    for (const id of shape.edgeIds) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it('polygon で edgeIds が points.length と揃うように発行', () => {
    const raw = {
      floors: [
        {
          rooms: [
            {
              shape: {
                kind: 'polygon',
                points: [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                  [0, 5],
                ],
              },
            },
          ],
        },
      ],
    }
    const { generated } = ensureEdgeIds(raw)
    expect(generated).toBe(5)
  })

  it('既存の有効な edgeId は保持し、欠けたものだけ発行する', () => {
    const raw = {
      floors: [
        {
          rooms: [
            {
              shape: {
                kind: 'rect',
                x: 0,
                y: 0,
                w: 100,
                h: 100,
                edgeIds: ['keep-1', 'keep-2', '', null],
              },
            },
          ],
        },
      ],
    }
    const { data, generated } = ensureEdgeIds(raw)
    expect(generated).toBe(2)
    const shape = (data as { floors: { rooms: { shape: { edgeIds: string[] } }[] }[] })
      .floors[0]!.rooms[0]!.shape
    expect(shape.edgeIds[0]).toBe('keep-1')
    expect(shape.edgeIds[1]).toBe('keep-2')
    expect(shape.edgeIds[2]?.length).toBeGreaterThan(0)
    expect(shape.edgeIds[3]?.length).toBeGreaterThan(0)
  })

  it('壊れた入力でクラッシュしない', () => {
    expect(ensureEdgeIds(null).generated).toBe(0)
    expect(ensureEdgeIds({ floors: [{ rooms: 'bad' }] }).generated).toBe(0)
    expect(ensureEdgeIds({ floors: [{ rooms: [{ shape: null }] }] }).generated).toBe(0)
  })
})
