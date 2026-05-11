import { describe, expect, it } from 'vitest'
import { CURRENT_PHASE } from '@/types'

describe('environment smoke test', () => {
  it('Vitest + path alias が動く', () => {
    // Phase 移行時にここを更新する (現在 Phase 1.5)
    expect(['1', '1.5', '2', '3']).toContain(CURRENT_PHASE)
  })

  it('crypto.randomUUID が利用可能(setup.ts のフォールバック含む)', () => {
    const id = crypto.randomUUID()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
