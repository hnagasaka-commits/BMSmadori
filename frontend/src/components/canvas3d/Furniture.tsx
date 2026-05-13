/**
 * §11 Phase 2 / M14, M42, M47 → §M122/§M124 v0.29: 家具 / BMS 設備の 3D 描画。
 *
 * 入力 `Floor.furniture[i].catalogId` は (a) 既存家具カタログ (sofa, bed, …) または
 * (b) `public/equipment-master.json` の 137 種設備のいずれかを指す。設備マスター
 * 由来の場合は piece 配列の代わりに spec から単一メッシュ (Box か Cylinder) を合成する。
 *
 * Y 位置 (取り付け面の解釈):
 *  - 'floor'   : y = 0 (床に置く)。height はそのまま box の Y 寸法
 *  - 'ceiling' : y = ceilingHeight - height (天井に上端を貼る)
 *  - 'wall'    : y = 1500 (床から 1500mm の標準取付高)。XY 座標は手動配置
 *  - 'roof'    : y = ceilingHeight (= 当該フロアの天井上)。屋上機器
 *  - 'outdoor' : y = 0 (= 地面)。屋外機器は通常 1F の floor.furniture に置く
 *
 * 配置面フィルタが OFF の placement は 3D で非表示 (return null)。
 *
 * 操作 (M42, M47): クリックで選択 + XZ 平面ドラッグ。drag 中は OrbitControls を停止。
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
import { useEquipmentMasterStore } from '@/store/equipmentMasterStore'
import type { EquipmentSpec } from '@/types/equipment'
import type { FurniturePiece } from './furniturePresets'

const MM_TO_M = 1 / 1000
const M_TO_MM = 1000
const WALL_MOUNT_HEIGHT_MM = 1500

export function Furniture({
  furniture,
  ceilingHeightMm,
}: {
  furniture: Floor['furniture']
  ceilingHeightMm: number
}) {
  const selected = useEditorStore((s) => s.selected)
  const selectedId = selected?.kind === 'furniture' ? selected.id : null
  const specs = useEquipmentMasterStore((s) => s.byId)
  const categoryColors = useEquipmentMasterStore((s) => s.categoryColors)
  const placementFilter = useEquipmentMasterStore((s) => s.placementFilter)

  return (
    <>
      {furniture.map((fi) => {
        const mountTo = fi.mountTo ?? 'floor'
        // §M123 v0.29: 配置面フィルタ OFF は 3D 非表示
        if (placementFilter[mountTo] === false) return null

        const isSelected = fi.id === selectedId
        const scale3 = furnitureScale3(fi.scale)

        // §M122 v0.29: spec 優先で合成メッシュ、無ければ既存 piece 配列
        const spec = specs.get(fi.catalogId)
        if (spec != null) {
          const yMm = computeMountY(mountTo, spec.height, ceilingHeightMm, fi.y ?? 0)
          const color = categoryColors[spec.category]?.color ?? '#cccccc'
          return (
            <SpecMesh
              key={fi.id}
              id={fi.id}
              spec={spec}
              positionMm={fi.position}
              yMm={yMm}
              rotation={fi.rotation}
              instanceScale3={scale3}
              isSelected={isSelected}
              color={fi.colorOverride ?? color}
            />
          )
        }

        // ---- 既存家具カタログのパス (M14 以来) ----
        const entry = getCatalogEntry(fi.catalogId)
        if (entry == null) return null
        let yMm = fi.y ?? 0
        if (mountTo === 'ceiling') {
          let topLocal = 0
          for (const p of entry.pieces) {
            const t = p.position[1] + p.size[1] / 2
            if (t > topLocal) topLocal = t
          }
          yMm = ceilingHeightMm - topLocal * scale3[1]
        } else if (mountTo === 'wall') {
          yMm = WALL_MOUNT_HEIGHT_MM
        } else if (mountTo === 'roof') {
          yMm = ceilingHeightMm
        } else if (mountTo === 'outdoor') {
          yMm = 0
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
            colorOverride={fi.colorOverride}
          />
        )
      })}
    </>
  )
}

/**
 * §M122 v0.29: 設備マスター由来の取り付け面 → ローカル Y (mm)。
 *
 * - 'floor'   : 床直置き (= 0)。fi.y が指定されていればその上に積む
 * - 'ceiling' : ceilingHeight - spec.height (= 設備の上端が天井に貼る)
 * - 'wall'    : 1500 (= 床から 1500mm の標準取付高)
 * - 'roof'    : ceilingHeight (= フロアの天井の上、地面相当)
 * - 'outdoor' : 0 (= 地面。屋外設備は通常 1F のフロアに置かれる前提)
 */
function computeMountY(
  mountTo: 'floor' | 'ceiling' | 'wall' | 'roof' | 'outdoor',
  specHeight: number,
  ceilingHeightMm: number,
  fiY: number,
): number {
  switch (mountTo) {
    case 'floor':
      return fiY
    case 'ceiling':
      return ceilingHeightMm - specHeight
    case 'wall':
      return WALL_MOUNT_HEIGHT_MM
    case 'roof':
      return ceilingHeightMm
    case 'outdoor':
      return 0
  }
}

// ============================================================================
// Spec ベース (equipment master) のメッシュ
// ============================================================================

function SpecMesh({
  id,
  spec,
  positionMm,
  yMm,
  rotation,
  instanceScale3,
  isSelected,
  color,
}: {
  id: string
  spec: EquipmentSpec
  positionMm: readonly [number, number]
  yMm: number
  rotation: number
  instanceScale3: readonly [number, number, number]
  isSelected: boolean
  color: string
}) {
  const select = useEditorStore((s) => s.select)
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture)
  const groupRef = useRef<THREE.Group>(null)
  const dragOffset = useRef<{ x: number; z: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  const r3fControls = useThree((s) => s.controls)
  const controlsRef = useRef<{ enabled: boolean } | null>(null)
  useEffect(() => {
    controlsRef.current =
      r3fControls != null ? (r3fControls as unknown as { enabled: boolean }) : null
  }, [r3fControls])

  function setOrbitEnabled(enabled: boolean) {
    const c = controlsRef.current
    if (c != null) c.enabled = enabled
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    select({ kind: 'furniture', id })
    setOrbitEnabled(false)
    const hit = e.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
    const g = groupRef.current
    if (hit != null && g != null) {
      dragOffset.current = { x: hit.x - g.position.x, z: hit.z - g.position.z }
      setIsDragging(true)
    }
  }
  function onPointerMove(e: ThreeEvent<PointerEvent>) {
    if (dragOffset.current == null) return
    const hit = e.ray.intersectPlane(dragPlane.current, new THREE.Vector3())
    const g = groupRef.current
    if (hit == null || g == null) return
    g.position.x = hit.x - dragOffset.current.x
    g.position.z = hit.z - dragOffset.current.z
  }
  function onPointerUp() {
    if (dragOffset.current == null) {
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
  }

  // spec.width / depth / height + scale (X, Y, Z)
  // Y は height、X は width、Z は depth として box / cylinder を立てる
  const w = spec.width * instanceScale3[0]
  const h = spec.height * instanceScale3[1]
  const d = spec.depth * instanceScale3[2]
  const yCenter = yMm + h / 2

  const highlighted = isSelected || isDragging

  return (
    <group
      ref={groupRef}
      position={[positionMm[0] * MM_TO_M, yCenter * MM_TO_M, positionMm[1] * MM_TO_M]}
      rotation={[0, rotation, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {spec.shape === 'circle' ? (
        <mesh castShadow receiveShadow>
          <cylinderGeometry
            args={[
              (Math.max(w, d) / 2) * MM_TO_M,
              (Math.max(w, d) / 2) * MM_TO_M,
              h * MM_TO_M,
              24,
            ]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.1}
            emissive={highlighted ? '#3b82f6' : '#000000'}
            emissiveIntensity={highlighted ? 0.3 : 0}
          />
        </mesh>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w * MM_TO_M, h * MM_TO_M, d * MM_TO_M]} />
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.1}
            emissive={highlighted ? '#3b82f6' : '#000000'}
            emissiveIntensity={highlighted ? 0.3 : 0}
          />
        </mesh>
      )}
    </group>
  )
}

// ============================================================================
// 既存家具カタログのメッシュ (M14 〜 M118)
// ============================================================================

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
  yMm: number
  rotation: number
  instanceScale3: readonly [number, number, number]
  isSelected: boolean
  colorOverride: string | undefined
}) {
  const select = useEditorStore((s) => s.select)
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture)
  const groupRef = useRef<THREE.Group>(null)

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
