/**
 * §11 Phase 2 / M12: PBR マテリアル定数。
 *
 * Phase 2 後半 (M13) で本物の PBR テクスチャを差し込む前段として、
 * まずは色 / roughness / metalness の調整値で「3D が成立する」最低ラインを作る。
 *
 * メートル単位で値が決まる three の都合に合わせ、distance や size を渡す側で /1000 する。
 */

export const FLOOR_MATERIAL = {
  color: '#e8dfd0',
  roughness: 0.85,
  metalness: 0.02,
} as const

export const WALL_MATERIAL = {
  color: '#f5f1ea',
  roughness: 0.95,
  metalness: 0.0,
} as const

export const EXTERIOR_WALL_MATERIAL = {
  color: '#d8d2c5',
  roughness: 0.9,
  metalness: 0.0,
} as const

export const GROUND_MATERIAL = {
  color: '#cfd6c8',
  roughness: 1.0,
  metalness: 0.0,
} as const

/** Phase 1.5 までしか入らないことが多いが、デバッグ表示用 */
export const COLUMN_MATERIAL = {
  color: '#3c3c3c',
  roughness: 0.6,
  metalness: 0.1,
} as const

export const PIPESPACE_MATERIAL = {
  color: '#5a9bd4',
  roughness: 0.5,
  metalness: 0.2,
  transparent: true,
  opacity: 0.55,
} as const

export const WINDOW_GLASS_MATERIAL = {
  color: '#a8d5e2',
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.35,
} as const
