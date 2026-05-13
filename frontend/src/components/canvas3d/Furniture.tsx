/**
 * §11 Phase 2 / M14, M42, M47: Floor.furniture を R3F メッシュ群として描画 + クリック選択 +
 * XZ 平面上の直接ドラッグ移動。
 *
 * 仕様 (v0.4 / M47):
 *  - クリック (pointerdown) で select & ドラッグ開始
 *  - pointermove: カーソル → XZ 平面 (y=0) のレイキャストで新位置を計算し group.position に反映
 *  - pointerup: 最終位置を `moveFurniture` でストアに commit
 *  - drag 中は OrbitControls を disable (カメラを動かさない)
 *  - 旧バージョンの PivotControls は廃止し、メッシュ本体を直接掴む直感的 UX に変更
 */
import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Floor } from '@/types'
import { furnitureScale3 } from '@/types'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import type { FurniturePiece } from './furniturePresets'

const MM_TO_M = 1 / 1000
const M_TO_MM = 1000

export function Furniture({
  furniture,
  ceilingHeightMm,
}: {
  furniture: Floor['furniture']
  /** §M118 v0.28: 親フロアの天井高 (mm)。mountTo='ceiling' の家具の Y 位置補正に使う */
  ceilingHeightMm: number
}) {
  const selected = useEditorStore((s) => s.selected)
  const selectedId = selected?.kind === 'furniture' ? selected.id : null

  return (
    <>
      {furniture.map((fi) => {
        const entry = getCatalogEntry(fi.catalogId)
        if (entry == null) return null
        const isSelected = fi.id === selectedId
        const scale3 = furnitureScale3(fi.scale)
        // §M118 v0.28: 天井設備の Y 位置補正。
        //   mountTo='ceiling' の場合、設備のローカル AABB 上端 (= piece.position[1] + size[1]/2 の最大値) を
        //   ceilingHeight に貼り付ける位置を yMm に渡す。yMm はそのまま group.position.y に乗る。
        //   既存の y (床積み) は無視する (天井設備は床積みしない)。
        const mountTo = fi.mountTo ?? 'floor'
        let yMm = fi.y ?? 0
        if (mountTo === 'ceiling') {
          let topLocal = 0
          for (const p of entry.pieces) {
            const t = p.position[1] + p.size[1] / 2
            if (t > topLocal) topLocal = t
          }
          // scale Y を考慮して上端を求める
          const topScaled = topLocal * scale3[1]
          yMm = ceilingHeightMm - topScaled
        }
        return (
          <FurnitureInstanceMesh
            key={fi.id}
            id={fi.id}
            pieces={entry.pieces}
            positionMm={fi.position}
            yMm={yMm}
            rotation={fi.rotation}
            instanceScale3={scale3}
            isSelected={isSelected}
            // §M107 v0.25: 全パーツの色を上書きするオプション
            colorOverride={fi.colorOverride}
          />
        )
      })}
    </>
  )
}

function FurnitureInstanceMesh({
  id,
  pieces,
  positionMm,
  yMm,
  rotation,
  instanceScale3,
  isSelected,
  colorOverride,
}: {
  id: string
  pieces: ReadonlyArray<FurniturePiece>
  positionMm: readonly [number, number]
  /** §M94 v0.21: 床からの Y オフセット (mm)。0 = 直置き、>0 = 他家具の天面に乗っている */
  yMm: number
  rotation: number
  /** §M69 v0.12: 家具のインスタンス拡大率 [X, Y, Z] (1 = 等倍) */
  instanceScale3: readonly [number, number, number]
  isSelected: boolean
  /** §M107 v0.25: undefined ならカタログ色、文字列なら全パーツをその色で上書き */
  colorOverride: string | undefined
}) {
  const select = useEditorStore((s) => s.select)
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture)
  const groupRef = useRef<THREE.Group>(null)

  // §M42: OrbitControls を一時的に disable する仕組み (ref 経由)
  const r3fControls = useThree((s) => s.controls)
  const controlsRef = useRef<{ enabled: boolean } | null>(null)
  useEffect(() => {
    controlsRef.current =
      r3fControls != null
        ? (r3fControls as unknown as { enabled: boolean })
        : null
  }, [r3fControls])
  function setOrbitEnabled(enabled: boolean) {
    const c = controlsRef.current
    if (c != null) c.enabled = enabled
  }

  // §M47: XZ 平面 (y=0) 上の直接ドラッグ
  // - dragOffset は「クリック時点のカーソル世界座標 - 家具世界座標」(m 単位)
  // - drag 中はこれで group.position.x/z = cursor - offset を保つ
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragOffset = useRef<{ x: number; z: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function projectToXZ(
    e: ThreeEvent<PointerEvent>,
    out: THREE.Vector3,
  ): THREE.Vector3 | null {
    return e.ray.intersectPlane(dragPlane.current, out)
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    select({ kind: 'furniture', id })
    setOrbitEnabled(false)
    const hit = projectToXZ(e, new THREE.Vector3())
    const g = groupRef.current
    if (hit != null && g != null) {
      dragOffset.current = {
        x: hit.x - g.position.x,
        z: hit.z - g.position.z,
      }
      setIsDragging(true)
      try {
        ;(e.target as Element & { setPointerCapture: (id: number) => void })
          .setPointerCapture?.(e.pointerId)
      } catch {
        // 一部の環境で target が capture を持たない場合があるので握りつぶす
      }
    }
  }

  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    if (dragOffset.current == null) return
    const hit = projectToXZ(e, new THREE.Vector3())
    if (hit == null) return
    const g = groupRef.current
    if (g == null) return
    g.position.x = hit.x - dragOffset.current.x
    g.position.z = hit.z - dragOffset.current.z
  }

  function onPointerUp(e: ThreeEvent<PointerEvent>) {
    if (dragOffset.current == null) {
      // クリックのみで終わった場合も orbit を戻す
      setOrbitEnabled(true)
      return
    }
    const g = groupRef.current
    if (g != null) {
      const xMm = Math.round(g.position.x * M_TO_MM)
      const zMm = Math.round(g.position.z * M_TO_MM)
      if (xMm !== positionMm[0] || zMm !== positionMm[1]) {
        moveFurniture(id, [xMm, zMm])
      }
    }
    dragOffset.current = null
    setIsDragging(false)
    setOrbitEnabled(true)
    try {
      ;(e.target as Element & { releasePointerCapture: (id: number) => void })
        .releasePointerCapture?.(e.pointerId)
    } catch {
      // 同上
    }
  }

  return (
    <group
      ref={groupRef}
      position={[positionMm[0] * MM_TO_M, yMm * MM_TO_M, positionMm[1] * MM_TO_M]}
      rotation={[0, rotation, 0]}
      // §M52 / §M69: スケールはグループ単位で各軸に適用 (子の piece position/size に乗る)
      scale={[instanceScale3[0], instanceScale3[1], instanceScale3[2]]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {pieces.map((p) => (
        <PieceMesh
          key={p.id}
          piece={p}
          highlighted={isSelected || isDragging}
          // §M107 v0.25: 全パーツ共通の色上書き (undefined ならカタログ色)
          colorOverride={colorOverride}
        />
      ))}
    </group>
  )
}

function PieceMesh({
  piece,
  highlighted,
  colorOverride,
}: {
  piece: FurniturePiece
  highlighted: boolean
  /** §M107 v0.25: 上書きカラー (16 進)。undefined ならカタログ色 */
  colorOverride: string | undefined
}) {
  const pos: [number, number, number] = [
    piece.position[0] * MM_TO_M,
    piece.position[1] * MM_TO_M,
    piece.position[2] * MM_TO_M,
  ]
  const size: [number, number, number] = [
    piece.size[0] * MM_TO_M,
    piece.size[1] * MM_TO_M,
    piece.size[2] * MM_TO_M,
  ]
  // §M107 v0.25: override 優先
  const meshColor = colorOverride ?? piece.material.color

  if (piece.shape === 'cylinder') {
    const radius = size[1] / 2
    const length = size[0]
    return (
      <mesh
        position={pos}
        rotation={[0, piece.rotationY ?? 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial
          color={meshColor}
          roughness={piece.material.roughness}
          metalness={piece.material.metalness}
          emissive={highlighted ? '#3b82f6' : '#000000'}
          emissiveIntensity={highlighted ? 0.25 : 0}
        />
      </mesh>
    )
  }
  return (
    <mesh
      position={pos}
      rotation={[0, piece.rotationY ?? 0, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={meshColor}
        roughness={piece.material.roughness}
        metalness={piece.material.metalness}
        emissive={highlighted ? '#3b82f6' : '#000000'}
        emissiveIntensity={highlighted ? 0.25 : 0}
      />
    </mesh>
  )
}
