/**
 * 型のエントリポイント。`import type { Floor, Wall } from '@/types'` の到達点。
 */

export type CurrentPhase = '1' | '1.5' | '2' | '3'

/**
 * ビルド時定数として参照する。
 * - Phase 1   : '1'   columns / pipeSpaces / furniture / humanModels / voids すべて空配列
 * - Phase 1.5 : '1.5' columns / pipeSpaces を解放 (柱 + PS が編集可能)
 * - Phase 2   : '2'   voids 以外を解放
 * - Phase 3   : '3'   すべて解放、floors の length 制約も .min(1).max(3) に
 *
 * superRefine / stripDisallowedForPhase / CURRENT_SCHEMA_VERSION / runLegalChecks の挙動が
 * この定数を起点に切り替わる。
 */
export const CURRENT_PHASE: CurrentPhase = '3'

export * from './floorplan'
