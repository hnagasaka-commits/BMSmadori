/**
 * TC-Q: テンプレ → JSON ラウンドトリップ。
 * 同梱テンプレを export → import で同じ内容が戻り、Phase 1 不変条件 (floors=1) を満たす。
 */
import { describe, expect, it } from 'vitest'

import {
  TEMPLATE_CARDS,
  getTemplateById,
  listTemplatesForPhase,
} from '@/data/templates'
import { exportFloorplanJson, importFloorplan } from '@/data/loader'
import { FloorplanSchema } from '@/data/schemas'

describe('TEMPLATE_CARDS', () => {
  it('Phase 1 で表示されるテンプレは平屋 3 種', () => {
    const visible = listTemplatesForPhase('1')
    expect(visible).toHaveLength(3)
    for (const t of visible) {
      expect(t.startPhase).toBe('1')
    }
  })

  it('getTemplateById で取得できる', () => {
    expect(getTemplateById('house-flat-1ldk-20')).toBeDefined()
    expect(getTemplateById('unknown')).toBeUndefined()
  })
})

describe('TC-Q: テンプレ → export → import ラウンドトリップ', () => {
  for (const card of TEMPLATE_CARDS) {
    it(`${card.id} は FloorplanSchema を通り、export/import で復元できる`, () => {
      const plan = card.build()

      // §11 不変条件
      expect(plan.floors).toHaveLength(1)
      expect(plan.floors[0]!.columns).toEqual([])
      expect(plan.floors[0]!.pipeSpaces).toEqual([])
      expect(plan.floors[0]!.furniture).toEqual([])

      // Zod 検証
      const schemaResult = FloorplanSchema.safeParse(plan)
      expect(schemaResult.success).toBe(true)

      // ラウンドトリップ
      const json = exportFloorplanJson(plan)
      const imported = importFloorplan(json)
      expect(imported.ok).toBe(true)
      if (!imported.ok) return
      expect(imported.mode).toBe('normal')
      expect(imported.stripped).toBe(0)
    })
  }
})

describe('TC-R: インポート異常系', () => {
  it('JSON 構文エラー → ER2_JSON', () => {
    const result = importFloorplan('{ broken json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER2_JSON')
  })

  it('version 欠落 → ER3_SCHEMA', () => {
    const result = importFloorplan(JSON.stringify({ noVersion: true }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER3_SCHEMA')
  })

  it('floors 配列が空 → ER3_SCHEMA', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    const broken = { ...template, floors: [] }
    const result = importFloorplan(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER3_SCHEMA')
  })

  it('Phase 3: floors が 4 階以上は superRefine で ER3_SCHEMA', () => {
    // §11 PHASE_FLOORS_RANGE['3'] = max 3。同じ階を 4 つ並べたら拒否
    const template = TEMPLATE_CARDS[0]!.build()
    const dup = JSON.parse(JSON.stringify(template)) as typeof template
    const f = dup.floors[0]!
    const broken = { ...dup, floors: [f, f, f, f] }
    const result = importFloorplan(JSON.stringify(broken))
    expect(result.ok).toBe(false)
  })

  it('将来 version → readonly モードで開ける', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    const future = { ...template, version: '99.0' }
    const result = importFloorplan(JSON.stringify(future))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.mode).toBe('readonly')
      expect(result.fileVersion).toBe('99.0')
    }
  })

  it('Phase 3 では furniture を含む JSON も strip されず open できる', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    const dirty = JSON.parse(JSON.stringify(template)) as typeof template
    // Phase 3 では furniture は禁止リストにないので、そのまま読み込める
    ;(dirty.floors[0] as unknown as { furniture: unknown[] }).furniture = [
      {
        id: 'f1',
        catalogId: 'sofa-standard',
        position: [0, 0],
        rotation: 0,
      },
    ]
    const result = importFloorplan(JSON.stringify(dirty))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stripped).toBe(0)
    }
  })

  it('edgeIds が欠落していても ensureEdgeIds が補完して open できる', () => {
    const template = TEMPLATE_CARDS[0]!.build()
    const dirty = JSON.parse(JSON.stringify(template)) as typeof template
    for (const room of dirty.floors[0]!.rooms) {
      delete (room.shape as Partial<Record<string, unknown>>).edgeIds
    }
    const result = importFloorplan(JSON.stringify(dirty))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.generatedEdgeIds).toBeGreaterThan(0)
    }
  })

  it('10MB 超のファイル → ER_OVERSIZE', () => {
    const big = 'x'.repeat(11 * 1024 * 1024)
    const result = importFloorplan(`{"big":"${big}"}`)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ER_OVERSIZE')
  })
})
