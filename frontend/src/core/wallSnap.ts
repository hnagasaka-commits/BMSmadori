/**
 * §M135 v0.30: 壁取り付け設備の自動スナップ。
 *
 * 「壁にしか付かない設備 (placement='wall')」を 2D で配置すると、ユーザーがクリック /
 * ドラッグしたおおよその点から **最寄りの壁** を探し、その壁線に投影した位置 + 壁角度
 * へ自動補正する。
 *
 * 入力:
 *  - pos: ユーザーが置きたい point (mm)
 *  - walls: 候補壁 (派生壁 + freestandingWalls。hidden は除く)
 *  - depth: 設備の奥行き (mm)。壁から張り出させる距離の計算に使う
 *  - maxDist: スナップ判定の最大距離 (mm)。これより遠ければ snap しない
 *
 * 出力 (null = スナップ無し、その場合呼び出し側は raw position をそのまま使う):
 *  - position: 壁にスナップした XY (mm 整数)
 *  - rotation: 壁の向きに合わせた Y 軸まわりの角度 (rad)
 *  - wallId : スナップ先の壁 id (UI で「どの壁に付けたか」を出す用)
 *
 * 取り付け位置の計算:
 *  1. pos を壁線分上に **正射影** (t を [0, 1] にクランプ)。これが壁面上の点 P
 *  2. 壁の法線 N は pos から見て pos 側 (= ユーザーが置きたかった部屋側)
 *  3. 設備の中心位置 = P + N * (depth/2 + wall.thickness/2)
 *     = 設備の **背面** が壁面にぴったり付き、奥行き方向が部屋内に張り出す形になる
 *  4. rotation = 壁の向き (atan2(dy, dx))。設備のローカル X 軸が壁に沿う
 *
 * クリック位置が壁線上 (距離 ~0) の場合、法線は退化する。フォールバックとして
 * 壁の左手側 (= 進行方向に対して左) を「外側」と仮定して使う。
 */

import type { Wall } from '@/types'

export type WallSnapResult = {
  position: readonly [number, number]
  rotation: number
  wallId: string
}

const DEFAULT_MAX_DIST_MM = 2500
const MIN_WALL_LEN_MM = 200

export function snapToNearestWall(
  pos: readonly [number, number],
  walls: ReadonlyArray<Wall>,
  depth: number,
  options: { maxDist?: number } = {},
): WallSnapResult | null {
  const maxDist = options.maxDist ?? DEFAULT_MAX_DIST_MM
  let best:
    | {
        dist2: number
        position: [number, number]
        rotation: number
        wallId: string
      }
    | null = null

  for (const wall of walls) {
    const dx = wall.to[0] - wall.from[0]
    const dy = wall.to[1] - wall.from[1]
    const len2 = dx * dx + dy * dy
    if (len2 < MIN_WALL_LEN_MM * MIN_WALL_LEN_MM) continue
    const len = Math.sqrt(len2)

    // pos の壁線への正射影 (壁線分内に clamp)
    const t = clamp(
      ((pos[0] - wall.from[0]) * dx + (pos[1] - wall.from[1]) * dy) / len2,
      0,
      1,
    )
    const projX = wall.from[0] + t * dx
    const projY = wall.from[1] + t * dy
    const ddx = pos[0] - projX
    const ddy = pos[1] - projY
    const dist2 = ddx * ddx + ddy * ddy
    if (dist2 > maxDist * maxDist) continue
    if (best != null && dist2 >= best.dist2) continue

    // 法線: pos 側に向かう単位ベクトル (= ユーザーが置きたかった部屋側)
    let nx: number
    let ny: number
    const dist = Math.sqrt(dist2)
    if (dist > 1) {
      nx = ddx / dist
      ny = ddy / dist
    } else {
      // 壁線上のクリック → 左手法線を既定とする (-dy, dx) / len
      nx = -dy / len
      ny = dx / len
    }
    const offset = depth / 2 + wall.thickness / 2
    const cx = projX + nx * offset
    const cy = projY + ny * offset
    const rotation = Math.atan2(dy, dx)
    best = {
      dist2,
      position: [Math.round(cx), Math.round(cy)],
      rotation,
      wallId: wall.id,
    }
  }

  return best == null
    ? null
    : { position: best.position, rotation: best.rotation, wallId: best.wallId }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
