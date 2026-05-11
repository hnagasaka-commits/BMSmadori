import { beforeEach, describe, expect, it } from 'vitest'

import {
  getAuthorPreference,
  resolveAuthorForPdf,
  setAuthorPreference,
} from '@/data/authorPreference'

beforeEach(() => {
  localStorage.clear()
})

describe('authorPreference', () => {
  it('既定では optIn=false, name="" を返す', () => {
    expect(getAuthorPreference()).toEqual({ optIn: false, name: '' })
  })

  it('opt-in せず名前を入れても resolveAuthorForPdf は undefined', () => {
    setAuthorPreference({ optIn: false, name: '田中太郎' })
    expect(resolveAuthorForPdf()).toBeUndefined()
  })

  it('opt-in + 名前ありで resolveAuthorForPdf が値を返す', () => {
    setAuthorPreference({ optIn: true, name: '田中太郎' })
    expect(resolveAuthorForPdf()).toBe('田中太郎')
  })

  it('opt-in だけで名前空なら undefined (誤公開防止)', () => {
    setAuthorPreference({ optIn: true, name: '' })
    expect(resolveAuthorForPdf()).toBeUndefined()
  })

  it('opt-in を取り消すと値も読まれない (§3.7.4 既定で空)', () => {
    setAuthorPreference({ optIn: true, name: '田中太郎' })
    setAuthorPreference({ optIn: false, name: '田中太郎' })
    expect(resolveAuthorForPdf()).toBeUndefined()
  })
})
