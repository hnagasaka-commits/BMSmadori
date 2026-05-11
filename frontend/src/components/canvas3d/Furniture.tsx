/**
 * §11 Phase 2 / M14: Floor.furniture から R3F メッシュ群をレンダリング + クリック選択 + ドラッグ移動。
 *
 * - Floor.furniture[i].catalogId → カタログから piece 配列を引き、子メッシュとして描画
 * - mesh の onPointerDown で stopPropagation + editorStore.select({ kind:'furniture', id })
 * - 選択中の家具は drei <PivotControls> でラップして XZ ドラッグ可能にする
 *   → drag 中は OrbitControls を一時的に enabled=false に倒すべきだが、
 *      PivotControls の depthTest=false 表示 + 別個のドラッグハンドラに任せれば衝突は実用上少ない。
 * - リリース時 (PivotControls の onDragEnd) で moveFurniture を呼ぶ → history.push が走る
 */
import { useMemo, useRef } from 'react'
import { PivotControls } from '@react-three/drei'
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
  // PivotControls から座標を取り出すための作業行列
  const startMatrix = useMemo(
    () =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(positionMm[0] * MM_TO_M, 0, positionMm[1] * MM_TO_M),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
        new THREE.Vector3(1, 1, 1),
      ),
    // matrix は最初に PivotControls にセットするだけ。位置/回転変更後は groupRef 側の値を読む。
    // 依存配列を空にすると再選択時に古い matrix から再開してしまうので id/座標も含める。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, positionMm[0], positionMm[1], rotation],
  )

  const meshes = pieces.map((p) => (
    <PieceMesh key={p.id} piece={p} highlighted={isSelected} />
  ))

  const onClickSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    select({ kind: 'furniture', id })
  }

  if (!isSelected) {
    return (
      <group
        position={[positionMm[0] * MM_TO_M, 0, positionMm[1] * MM_TO_M]}
        rotation={[0, rotation, 0]}
        onPointerDown={onClickSelect}
        ref={groupRef}
      >
        {meshes}
      </group>
    )
  }

  return (
    <PivotControls
      offset={[0, 0.05, 0]}
      scale={1.2}
      anchor={[0, -1, 0]}
      depthTest={false}
      lineWidth={2.5}
      activeAxes={[true, false, true]}
      disableScaling
      disableRotations
      matrix={startMatrix}
      onDragEnd={() => {
        const g = groupRef.current
        if (g == null) return
        // PivotControls は親 group の matrix を直接書き換える。world position を読み戻す
        const worldPos = new THREE.Vector3()
        g.getWorldPosition(worldPos)
        const xMm = Math.round(worldPos.x * M_TO_MM)
        const zMm = Math.round(worldPos.z * M_TO_MM)
        if (xMm === positionMm[0] && zMm === positionMm[1]) return
        moveFurniture(id, [xMm, zMm])
      }}
    >
      <group ref={groupRef} onPointerDown={onClickSelect}>
        {meshes}
      </group>
    </PivotControls>
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
