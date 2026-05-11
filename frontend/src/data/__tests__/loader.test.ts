import { describe, expect, it } from 'vitest'

import { exportFloorplanJson, importFloorplan } from '@/data/loader'
import { CURRENT_SCHEMA_VERSION } from '@/data/migrate'
import { makeFloorplan } from '@/test/fixtures'
import type { Floorplan } from '@/types'

describe('importFloorplan (§5.1.2 8 ステップ)', () => {
  it('正常系: ラウンドトリップ (export → import) で同じ Floorplan が得られる', () => {
    const original = makeFloorplan()
    const json = exportFloorplanJson(original)
    const result = importFloorplan(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mode).toBe('normal')
      expect(result.stripped).toBe(0)
      expect(result.generatedEdgeIds).toBe(0)
      const data = result.data as Floorplan
      expect(data.version).toBe(CURRENT_SCHEMA_VERSION)
      expect(data.floors[0]!.rooms).toHaveLength(1)
    }
  })

  it('ER2_JSON: JSON 構文エラー', () => {
    const result = importFloorplan('{ broken json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER2_JSON')
  })

  it('ER3_SCHEMA: version が無い', () => {
    const result = importFloorplan(JSON.stringify({ noVersion: true }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER3_SCHEMA')
  })

  it('ER3_SCHEMA: スキーマ違反 (floors が空)', () => {
    const broken = { ...makeFloorplan(), floors: [] }
    const result = importFloorplan(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER3_SCHEMA')
  })

  it('readonly モード: 将来 version (2.0) は TolerantFloorplanSchema で開ける', () => {
    const future = {
      version: '2.0',
      metadata: { name: 'Future' },
      floors: [{ id: 'f1', rooms: [] }],
      building: {},
    }
    const result = importFloorplan(JSON.stringify(future))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mode).toBe('readonly')
      expect(result.fileVersion).toBe('2.0')
    }
  })

  it('readonly モードでも edgeIds は補完される', () => {
    const future = {
      version: '99.0',
      metadata: { name: 'Future' },
      floors: [
        {
          id: 'f1',
          rooms: [
            {
              id: 'r1',
              shape: { kind: 'rect', x: 0, y: 0, w: 100, h: 100 }, // edgeIds なし
            },
          ],
        },
      ],
      building: {},
    }
    const result = importFloorplan(JSON.stringify(future))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mode).toBe('readonly')
      expect(result.generatedEdgeIds).toBe(4)
    }
  })

  it('Phase 3 では禁止フィールドが空集合なので strip は 0 件 (互換)', () => {
    // Phase 3 では furniture / voids 等は禁止リストに含まれない
    const withFurniture = {
      ...makeFloorplan(),
      floors: [
        {
          ...makeFloorplan().floors[0]!,
          furniture: [
            {
              id: 'f1',
              catalogId: 'sofa-standard',
              position: [0, 0],
              rotation: 0,
            },
          ],
        },
      ],
    }
    const result = importFloorplan(JSON.stringify(withFurniture))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stripped).toBe(0)
      const data = result.data as Floorplan
      expect(data.floors[0]!.furniture).toHaveLength(1)
    }
  })

  it('edgeIds 欠落のテンプレ風 JSON は補完されてから Zod を通る', () => {
    // edgeIds を抜いた最小ファイル
    const raw = makeFloorplan()
    const stripped = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
    const floor = (stripped.floors as Record<string, unknown>[])[0]!
    const room = (floor.rooms as Record<string, unknown>[])[0]!
    delete (room.shape as Record<string, unknown>).edgeIds

    const result = importFloorplan(JSON.stringify(stripped))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.generatedEdgeIds).toBe(4)
  })

  it('ER_OVERSIZE: 10MB 超は拒否', () => {
    const big = 'x'.repeat(11 * 1024 * 1024)
    const result = importFloorplan(`{"big":"${big}"}`)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER_OVERSIZE')
  })
})

describe('exportFloorplanJson', () => {
  it('CURRENT_SCHEMA_VERSION を書き込む (古い version を渡しても上書き)', () => {
    const plan: Floorplan = { ...makeFloorplan(), version: '1.0' }
    const json = exportFloorplanJson(plan)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('2 スペースインデントで書き出す (§5.1 ファイル形式)', () => {
    const json = exportFloorplanJson(makeFloorplan())
    expect(json).toContain('\n  "metadata"')
  })
})
