/**
 * §8 隣接ルール。M5 法規警告と連動する。
 *
 * Phase 1 では最小セットを同梱。すべて severity = info (慣例レベル、必須ではない)。
 */

import type { AdjacencyRule } from '@/types'

export const ADJACENCY_RULES: readonly AdjacencyRule[] = [
  {
    id: 'toilet-kitchen-direct',
    pair: ['toilet', 'kitchen'],
    relation: 'direct-adjacent',
    severity: 'info',
    message: 'トイレとキッチンが直接隣接しています(衛生面の配慮)',
  },
  {
    id: 'toilet-kitchen-gas-direct',
    pair: ['toilet', 'kitchen-gas'],
    relation: 'direct-adjacent',
    severity: 'info',
    message: 'トイレとキッチンが直接隣接しています(衛生面の配慮)',
  },
  {
    id: 'toilet-dining-direct',
    pair: ['toilet', 'dining'],
    relation: 'direct-adjacent',
    severity: 'info',
    message: 'トイレとダイニングが直接隣接しています(衛生面の配慮)',
  },
  {
    id: 'bedroom-entrance-direct',
    pair: ['bedroom', 'entrance'],
    relation: 'direct-adjacent',
    severity: 'info',
    message: '寝室と玄関が直接隣接しています(プライバシーの観点で緩衝が望ましい)',
  },
  {
    id: 'ldk-door-required',
    pair: ['living', 'kitchen'],
    relation: 'door-connected',
    severity: 'info',
    message: 'LDK 構成の場合、リビングとキッチンの間にドアが無いのが一般的です',
  },
]

/**
 * pair を順序非依存で検索するヘルパー。
 */
export function findAdjacencyRule(
  presetIdA: string,
  presetIdB: string,
  relation: AdjacencyRule['relation'],
): AdjacencyRule | undefined {
  return ADJACENCY_RULES.find((r) => {
    if (r.relation !== relation) return false
    const [a, b] = r.pair
    return (a === presetIdA && b === presetIdB) || (a === presetIdB && b === presetIdA)
  })
}
