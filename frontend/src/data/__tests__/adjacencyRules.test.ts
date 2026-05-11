import { describe, expect, it } from 'vitest'

import { ADJACENCY_RULES, findAdjacencyRule } from '@/data/adjacencyRules'

describe('findAdjacencyRule', () => {
  it('pair の順序を入れ替えても同じルールが見つかる', () => {
    const r1 = findAdjacencyRule('toilet', 'kitchen', 'direct-adjacent')
    const r2 = findAdjacencyRule('kitchen', 'toilet', 'direct-adjacent')
    expect(r1).toBeDefined()
    expect(r2).toBe(r1)
  })

  it('relation が違えばマッチしない', () => {
    expect(findAdjacencyRule('toilet', 'kitchen', 'shared-wall')).toBeUndefined()
  })

  it('未登録のペアは undefined', () => {
    expect(findAdjacencyRule('closet', 'entrance', 'direct-adjacent')).toBeUndefined()
  })
})

describe('ADJACENCY_RULES', () => {
  it('各ルールに ID / pair / message がある', () => {
    for (const r of ADJACENCY_RULES) {
      expect(r.id.length).toBeGreaterThan(0)
      expect(r.pair).toHaveLength(2)
      expect(r.message.length).toBeGreaterThan(0)
    }
  })

  it('すべて severity = info (Phase 1 の慣例レベル)', () => {
    for (const r of ADJACENCY_RULES) {
      expect(r.severity).toBe('info')
    }
  })
})
