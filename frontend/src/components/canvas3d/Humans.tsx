/**
 * §M61 v0.9: Floor.humanModels を R3F に描画 + クリック選択 + XZ 平面上の直接ドラッグ。
 *
 * 仕様:
 *  - Furniture.tsx と同じドラッグパターン (pointer event + e.ray.intersectPlane(y=0))
 *  - 形状は球 (頭) + カプセル (胴) + 2 本のカプセル (脚) の単純な人型。
 *    建築 3D の "スケール用フィギュア" として最低限のシルエットがあれば十分。
 *  - 身長 (human.height mm) で全体を縦スケール。既定 1700mm = 等倍。
 *  - 選択中は emissive で青く光らせる (家具と同じ視覚言語)。
 */
import { useEffect, useRef, useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Floor, HumanModel } from '@/types'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore } from '@/store/editorStore'

const MM_TO_M = 1 / 1000
const M_TO_MM = 1000
const REFERENCE_HEIGHT_MM = 1700

export function Humans({ humans }: { humans: Floor['humanModels'] }) {
  const selected = useEditorStore((s) => s.selected)
  const selectedId = selected?.kind === 'human' ? selected.id : null
  // §M78 v0.14: FPV 中の人物はカメラの中なので非表示にする (自分の頭が視界を塞ぐのを防ぐ)
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)
  return (
    <>
      {humans
        .filter((h) => h.id !== fpvHumanId)
        .map((h) => (
          <HumanFigure key={h.id} human={h} isSelected={h.id === selectedId} />
        ))}
    </>
  )
}

function HumanFigure({ human, isSelected }: { human: HumanModel; isSelected: boolean }) {
  const select = useEditorStore((s) => s.select)
  const moveHuman = useFloorplanStore((s) => s.moveHuman)
  const groupRef = useRef<THREE.Group>(null)

  // OrbitControls の一時無効化 (Furniture.tsx と同じ仕組み)
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

  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragOffset = useRef<{ x: number; z: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function projectToXZ(e: ThreeEvent<PointerEvent>, out: THREE.Vector3): THREE.Vector3 | null {
    return e.ray.intersectPlane(dragPlane.current, out)
  }

  function onPointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    select({ kind: 'human', id: human.id })
    setOrbitEnabled(false)
    const hit = projectToXZ(e, new THREE.Vector3())
    const g = groupRef.current
    if (hit != null && g != null) {
      dragOffset.current = { x: hit.x - g.position.x, z: hit.z - g.position.z }
      setIsDragging(true)
      try {
        ;(e.target as Element & { setPointerCapture: (id: number) => void }).setPointerCapture?.(
          e.pointerId,
        )
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
      if (xMm !== human.position[0] || zMm !== human.position[1]) {
        moveHuman(human.id, [xMm, zMm])
      }
    }
    dragOffset.current = null
    setIsDragging(false)
    setOrbitEnabled(true)
    try {
      ;(e.target as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture?.(
        e.pointerId,
      )
    } catch {
      // 同上
    }
  }

  // 身長スケール: 1700mm を 1.0 とする縦方向比率 (XZ は等倍にして "頭でっかち化" を避ける)
  const heightScale = Math.max(0.3, human.height / REFERENCE_HEIGHT_MM)
  const highlighted = isSelected || isDragging
  const skin = '#c9a47a'
  const cloth = highlighted ? '#3b82f6' : '#475569'

  // 各パーツの寸法 (REFERENCE_HEIGHT_MM 基準、m 単位)。
  // 身長スケールは group 単位でかける (子の position も縦に伸びる)
  const HEAD_RADIUS = 0.11 // ≒ 110mm
  const HEAD_Y = 1.55 // 頭の中心 y
  const TORSO_HEIGHT = 0.55
  const TORSO_RADIUS = 0.14
  const TORSO_Y = 1.05
  const HIP_HEIGHT = 0.1
  const HIP_Y = 0.75
  const LEG_HEIGHT = 0.7
  const LEG_RADIUS = 0.08
  const LEG_Y = 0.35
  const LEG_OFFSET_X = 0.09
  const ARM_HEIGHT = 0.55
  const ARM_RADIUS = 0.06
  const ARM_Y = 1.05
  const ARM_OFFSET_X = TORSO_RADIUS + ARM_RADIUS + 0.005

  return (
    <group
      ref={groupRef}
      position={[human.position[0] * MM_TO_M, 0, human.position[1] * MM_TO_M]}
      rotation={[0, human.rotation, 0]}
      // 身長スケールは縦のみ (Y)。X/Z 等倍にしないと立体感が崩れすぎるが、
      // 簡易フィギュアなので Y のみで割り切る (子供 1200mm が縦に縮む、長身 1900mm が縦に伸びる)
      scale={[1, heightScale, 1]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 頭 */}
      <mesh position={[0, HEAD_Y, 0]} castShadow>
        <sphereGeometry args={[HEAD_RADIUS, 24, 16]} />
        <meshStandardMaterial
          color={skin}
          roughness={0.55}
          metalness={0.05}
          emissive={highlighted ? '#3b82f6' : '#000000'}
          emissiveIntensity={highlighted ? 0.25 : 0}
        />
      </mesh>
      {/* 胴 */}
      <mesh position={[0, TORSO_Y, 0]} castShadow>
        <cylinderGeometry args={[TORSO_RADIUS, TORSO_RADIUS * 0.9, TORSO_HEIGHT, 18]} />
        <meshStandardMaterial
          color={cloth}
          roughness={0.7}
          metalness={0.03}
          emissive={highlighted ? '#3b82f6' : '#000000'}
          emissiveIntensity={highlighted ? 0.2 : 0}
        />
      </mesh>
      {/* 腰 */}
      <mesh position={[0, HIP_Y, 0]} castShadow>
        <cylinderGeometry args={[TORSO_RADIUS * 0.9, TORSO_RADIUS * 0.85, HIP_HEIGHT, 18]} />
        <meshStandardMaterial color={cloth} roughness={0.7} metalness={0.03} />
      </mesh>
      {/* 脚 (2 本) */}
      {[-LEG_OFFSET_X, LEG_OFFSET_X].map((x, i) => (
        <mesh key={`leg-${i}`} position={[x, LEG_Y, 0]} castShadow>
          <cylinderGeometry args={[LEG_RADIUS, LEG_RADIUS * 0.85, LEG_HEIGHT, 14]} />
          <meshStandardMaterial color="#1f2937" roughness={0.75} metalness={0.02} />
        </mesh>
      ))}
      {/* 腕 (2 本) */}
      {[-ARM_OFFSET_X, ARM_OFFSET_X].map((x, i) => (
        <mesh key={`arm-${i}`} position={[x, ARM_Y, 0]} castShadow>
          <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS * 0.85, ARM_HEIGHT, 14]} />
          <meshStandardMaterial color={cloth} roughness={0.7} metalness={0.03} />
        </mesh>
      ))}
    </group>
  )
}
