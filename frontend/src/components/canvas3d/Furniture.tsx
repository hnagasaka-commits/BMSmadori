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
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'
import { getCatalogEntry } from '@/data/furnitureCatalog'
import type { FurniturePiece } from './furniturePresets'

const MM_TO_M = 1 / 1000
const M_TO_MM = 1000

export function Furniture({ furniture }: { furniture: Floor['furniture'] }) {
  const selected = useEditorStore((s) => s.selected)
  const selectedId = selected?.kind === 'furniture' ? selected.id : null

  return (
    <>
      {furniture.map((fi) => {
        const entry = getCatalogEntry(fi.catalogId)
        if (entry == null) return null
        const isSelected = fi.id === selectedId
        return (
          <FurnitureInstanceMesh
            key={fi.id}
            id={fi.id}
            pieces={entry.pieces}
            positionMm={fi.position}
            rotation={fi.rotation}
            isSelected={isSelected}
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
  rotation,
  isSelected,
}: {
  id: string
  pieces: ReadonlyArray<FurniturePiece>
  positionMm: readonly [number, number]
  rotation: number
  isSelected: boolean
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
      position={[positionMm[0] * MM_TO_M, 0, positionMm[1] * MM_TO_M]}
      rotation={[0, rotation, 0]}
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
        />
      ))}
    </group>
  )
}

function PieceMesh({
  piece,
  highlighted,
}: {
  piece: FurniturePiece
  highlighted: boolean
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
          color={piece.material.color}
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
        color={piece.material.color}
        roughness={piece.material.roughness}
        metalness={piece.material.metalness}
        emissive={highlighted ? '#3b82f6' : '#000000'}
        emissiveIntensity={highlighted ? 0.25 : 0}
      />
    </mesh>
  )
}
