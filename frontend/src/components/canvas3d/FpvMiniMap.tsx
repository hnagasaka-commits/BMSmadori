/**
 * §M154 v0.36: 一人称視点 (FPV) 中、画面右上に小さな間取り図 + 現在地を表示する。
 *
 * 目的:
 *  - BMS 点検中、広いフロアで自分がどの部屋にいるかを把握しやすくする
 *  - 「機械室の入口」「商業廊下の中央」など、3D 視点だけでは判別しにくい位置感を補う
 *
 * 構成:
 *  - SVG で 200×200px に間取り全体を fit (paddings 10px)
 *  - 部屋: 薄いカテゴリ色塗り + 黒い枠線、中央に部屋名 (短縮)
 *  - 壁: 黒の線
 *  - 現在地: 赤色の円 + 三角矢印 (yaw に追従して向きを示す)
 *  - 現在いる部屋名を下部に表示
 *
 * 描画は 10 Hz (= editorStore.setFpvCamera の throttle) でしか更新されないが、
 * ミニマップとしては充分滑らか。
 */
import { useMemo } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { selectFloor, useFloorplanStore } from '@/store/floorplanStore'
import { shapeAabb, shapeVertices } from '@/core/geometry'
import { getPreset } from '@/data/roomPresets'

const SIZE_PX = 200
const PADDING_PX = 12

export function FpvMiniMap() {
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)
  const fpvCameraXZ = useEditorStore((s) => s.fpvCameraXZ)
  const fpvCameraYaw = useEditorStore((s) => s.fpvCameraYaw)
  const floor = useFloorplanStore(selectFloor)

  // §M154 v0.36: 全部屋の AABB を計算してミニマップに fit する mapping を作る。
  // 単一フロア前提 (Phase 3 多階対応は将来)。
  const transform = useMemo(() => {
    if (floor == null || floor.rooms.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of floor.rooms) {
      const a = shapeAabb(r.shape, r.rotation)
      if (a.minX < minX) minX = a.minX
      if (a.minY < minY) minY = a.minY
      if (a.maxX > maxX) maxX = a.maxX
      if (a.maxY > maxY) maxY = a.maxY
    }
    if (!Number.isFinite(minX)) return null
    const w = maxX - minX
    const h = maxY - minY
    if (w <= 0 || h <= 0) return null
    const inner = SIZE_PX - PADDING_PX * 2
    const scale = Math.min(inner / w, inner / h)
    const offX = (SIZE_PX - w * scale) / 2 - minX * scale
    const offY = (SIZE_PX - h * scale) / 2 - minY * scale
    const tx = (x: number) => x * scale + offX
    const ty = (y: number) => y * scale + offY
    return { tx, ty, scale, minX, minY, maxX, maxY }
  }, [floor])

  if (fpvHumanId == null || floor == null || transform == null) return null

  const { tx, ty } = transform

  // §M154 v0.36: 現在地が含まれる部屋を AABB で判定し、下部に部屋名を表示する。
  // 3D 座標 (m) は world frame の X, Z。 Floorplan の plan-XY は (X, Y) で
  // Konva-style に Y を下向きに使うが、Canvas3D は X/Z をそのまま plan の X/Y に
  // 対応させているので変換は不要。
  let currentRoomName: string | null = null
  if (fpvCameraXZ != null) {
    const [px, py] = fpvCameraXZ
    for (const r of floor.rooms) {
      const a = shapeAabb(r.shape, r.rotation)
      if (px >= a.minX && px <= a.maxX && py >= a.minY && py <= a.maxY) {
        const preset = getPreset(r.presetId)
        currentRoomName = r.customName ?? preset?.displayName ?? r.presetId
        break
      }
    }
  }

  return (
    <div
      data-testid="fpv-minimap"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: 6,
        zIndex: 10,
        pointerEvents: 'none',
        userSelect: 'none',
        color: 'white',
        fontSize: 11,
        lineHeight: 1.3,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.85,
          marginBottom: 4,
          textAlign: 'center',
          fontWeight: 600,
          letterSpacing: 0.4,
        }}
      >
        {floor.name} {currentRoomName != null && `· ${currentRoomName}`}
      </div>
      <svg
        width={SIZE_PX}
        height={SIZE_PX}
        viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`}
        style={{ background: '#f8fafc', borderRadius: 4 }}
      >
        {/* 部屋ポリゴン */}
        {floor.rooms.map((r) => {
          const verts = shapeVertices(r.shape, r.rotation)
          const points = verts.map(([x, y]) => `${tx(x).toFixed(1)},${ty(y).toFixed(1)}`).join(' ')
          return (
            <polygon
              key={r.id}
              points={points}
              fill="#e2e8f0"
              stroke="#475569"
              strokeWidth={0.8}
            />
          )
        })}
        {/* 壁 (派生壁 + freestanding) */}
        {[
          ...(floor.walls ?? []).filter((w) => !(floor.hiddenWallIds ?? []).includes(w.id)),
          ...(floor.freestandingWalls ?? []),
        ].map((w) => (
          <line
            key={w.id}
            x1={tx(w.from[0])}
            y1={ty(w.from[1])}
            x2={tx(w.to[0])}
            y2={ty(w.to[1])}
            stroke="#1e293b"
            strokeWidth={1.2}
          />
        ))}
        {/* 現在地マーカー */}
        {fpvCameraXZ != null && (
          <CurrentPositionMarker
            x={tx(fpvCameraXZ[0])}
            y={ty(fpvCameraXZ[1])}
            yaw={fpvCameraYaw}
          />
        )}
      </svg>
    </div>
  )
}

/**
 * §M154 v0.36: 現在地マーカー。赤丸 + yaw 方向を示す三角形 (頂点が前方)。
 * yaw=0 は plan view で「上」(= -Y 方向)。
 */
function CurrentPositionMarker({ x, y, yaw }: { x: number; y: number; yaw: number }) {
  const R = 5
  const ARROW = 9
  // SVG は Y 下向き、plan も Y 下向き。yaw=0 は前方が plan -Y (= SVG 上)
  // 三角形の頂点を yaw 方向に置く: (sin, -cos) で SVG 上向きを基準にする
  const tipX = x + Math.sin(yaw) * ARROW
  const tipY = y - Math.cos(yaw) * ARROW
  // 左右の base 角: yaw ± 90° から少しズラした位置
  const leftAngle = yaw - Math.PI / 2 + 0.3
  const rightAngle = yaw + Math.PI / 2 - 0.3
  const baseL = `${(x + Math.sin(leftAngle) * R).toFixed(1)},${(y - Math.cos(leftAngle) * R).toFixed(1)}`
  const baseR = `${(x + Math.sin(rightAngle) * R).toFixed(1)},${(y - Math.cos(rightAngle) * R).toFixed(1)}`
  return (
    <g>
      {/* yaw を示す三角矢印 */}
      <polygon
        points={`${tipX.toFixed(1)},${tipY.toFixed(1)} ${baseL} ${baseR}`}
        fill="#ef4444"
        stroke="white"
        strokeWidth={0.6}
      />
      {/* 現在地の円 */}
      <circle cx={x} cy={y} r={R - 1} fill="#ef4444" stroke="white" strokeWidth={1} />
    </g>
  )
}
