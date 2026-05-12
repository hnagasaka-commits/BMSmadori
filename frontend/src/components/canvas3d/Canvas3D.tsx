/**
 * §11 Phase 2 / M12: 3D ビューの最低ライン PoC。
 *
 * 構成:
 *  - R3F の <Canvas> + 影 (PCFSoftShadowMap)
 *  - ACES Filmic トーンマッピング (three の三既定の中で最も自然)
 *  - drei の <OrbitControls> / <Environment> / <ContactShadows> で日中ルックを作る
 *  - 床(板) / 壁(箱) を floorplanToScene の SceneSpec から立てる
 *  - 開口部 (扉/窓) は壁を 3 つに割って表現する: 下方 sill + 上方 lintel + 透明窓ガラス
 *
 * 単位はメートル: SceneSpec は mm を持っているので groupRef で /1000 にスケールする。
 * こうすると後で OrbitControls.target / カメラ距離もメートル統一になる。
 *
 * 描画頻度は OrbitControls の damping のみ。Konva 側の状態を直接購読しているので、
 * 2D で変更すると useFloorplanStore → SceneSpec 再計算 → React 再描画。
 */
import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { useFloorplanStore } from '@/store/floorplanStore'
import { useEditorStore, type LightingPreset } from '@/store/editorStore'
import { computeSunSample, type Season } from '@/core/three/sunPosition'
import {
  type Opening,
  type SceneSpec,
  type WallBox,
  floorplanToScene,
} from '@/core/three/floorplanToScene'
import {
  EXTERIOR_WALL_MATERIAL,
  FLOOR_MATERIAL,
  GROUND_MATERIAL,
  WALL_MATERIAL,
  WINDOW_GLASS_MATERIAL,
} from './materials'
import { Furniture } from './Furniture'
import { Humans } from './Humans'
import { pickFloorTextureKind } from './proceduralTextures'
import { repeatedClone, useTextures, type TextureBundle } from './useTextures'

const MM_TO_M = 1 / 1000

export function Canvas3D() {
  const floorplan = useFloorplanStore((s) => s.floorplan)
  const lightingPreset = useEditorStore((s) => s.lightingPreset)
  const sunHour = useEditorStore((s) => s.sunHour)
  const season = useEditorStore((s) => s.season)
  const orientation = useFloorplanStore((s) => s.floorplan.metadata.orientation)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  /**
   * §11 Phase 3 / M19: 階ごとに SceneSpec を構築して、
   * Y オフセット (= 下層の天井高の累積) を持たせて積み上げる。
   */
  const floors = floorplan.floors
  const metadata = floorplan.metadata
  const stacked = useMemo(() => {
    const all: { floor: typeof floors[number]; scene: SceneSpec; yOffsetMm: number }[] = []
    let yOffsetMm = 0
    for (const f of floors) {
      all.push({ floor: f, scene: floorplanToScene(f, metadata), yOffsetMm })
      yOffsetMm += f.ceilingHeight
    }
    return all
  }, [floors, metadata])

  if (stacked.length === 0) {
    return (
      <div
        data-testid="canvas-3d"
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: '#1f2937',
          color: 'white',
        }}
      >
        フロアが読み込まれていません
      </div>
    )
  }

  // 建物全体の AABB を取って camera target / radius を決める (Y は中央の高さ)
  const groundScene = stacked[0]!.scene
  const totalHeightMm = stacked.reduce((acc, s) => acc + s.scene.ceilingHeight, 0)
  const maxRadiusMm = Math.max(...stacked.map((s) => s.scene.radius))
  const radiusM = maxRadiusMm * MM_TO_M
  const cameraDistance = Math.max(radiusM * 2.2, 8)
  const target: [number, number, number] = [
    groundScene.center[0] * MM_TO_M,
    (totalHeightMm / 2) * MM_TO_M,
    groundScene.center[2] * MM_TO_M,
  ]

  return (
    <div
      data-testid="canvas-3d"
      style={{
        width: '100%',
        height: '100%',
        background: '#0f172a',
        position: 'relative',
      }}
    >
      <LightingSwitcher />
      <HumanToolbar centerMm={[groundScene.center[0], groundScene.center[2]]} />
      <Canvas
        shadows
        onPointerMissed={clearSelection}
        camera={{
          fov: 45,
          near: 0.1,
          far: 200,
          position: [
            target[0] + cameraDistance * 0.7,
            target[1] + cameraDistance * 0.6,
            target[2] + cameraDistance * 0.7,
          ],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <LightingRig
            preset={lightingPreset}
            hour={sunHour}
            season={season}
            buildingOrientationDeg={orientation}
            target={target}
            radius={radiusM}
          />
          <Ground centerXZ={[target[0], target[2]]} sizeM={Math.max(radiusM * 6, 40)} />

          {/*
            §M19: 階ごとに <group position={[0, yOffsetM, 0]}> でラップし、
            その配下に床/壁/家具を吐く。3 階建てなら 3 つの group がスタックされる。
          */}
          {stacked.map((s) => (
            <group
              key={s.floor.id}
              position={[0, s.yOffsetMm * MM_TO_M, 0]}
            >
              <TexturedScene scene={s.scene} />
              <Furniture furniture={s.floor.furniture} />
              {/* §M61 v0.9: 床ごとに人物モデルを描画 (家具と同様にドラッグ移動 + クリック選択) */}
              <Humans humans={s.floor.humanModels} />
            </group>
          ))}

          <ContactShadows
            position={[target[0], 0.01, target[2]]}
            scale={Math.max(radiusM * 4, 20)}
            blur={2}
            opacity={0.5}
            far={6}
          />

          <OrbitControls
            target={target}
            enableDamping
            dampingFactor={0.08}
            minDistance={1}
            maxDistance={cameraDistance * 4}
            maxPolarAngle={Math.PI / 2.05}
            makeDefault
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

/**
 * §11 Phase 2 / M17: 太陽位置モデル + IBL を統合したライティング。
 *
 * - 太陽位置は computeSunSample(hour, season, orientation) で求める
 *   - hour=12 (正午) → 仰角最大、真南向き
 *   - hour=6 / 18 → 地平線近く
 *   - 夜時間 → 仰角負 → intensity=0、ambient を高く
 * - drei <Environment> preset と <Sky> も sunSample.envPreset に追随
 * - 影は directionalLight.castShadow=true で出続ける (時刻と季節で動く)
 *
 * preset 引数 (旧 lightingPreset) は UI ボタンによる "サクッと切替" 用。
 * 押下時は editorStore.setSunHour で hour を上書きすることで反映する設計に切り替えた。
 * ここでは直接受け取らず、hour/season だけを見る。
 */
function LightingRig({
  preset,
  hour,
  season,
  buildingOrientationDeg,
  target,
  radius,
}: {
  /** legacy 互換: 受け取るが影響させない (UI 側で hour に変換済み) */
  preset: LightingPreset
  hour: number
  season: Season
  buildingOrientationDeg: number
  target: [number, number, number]
  radius: number
}) {
  void preset // legacy 互換のため受け取り続けるが、計算には使わない
  const sunDist = Math.max(radius * 3, 20)
  const sample = computeSunSample(hour, season, buildingOrientationDeg)
  const sunPos: [number, number, number] = [
    target[0] + sunDist * sample.direction[0],
    sunDist * Math.max(sample.direction[1], 0.05), // 地平線下でも shadow camera が破綻しないよう底上げ
    target[2] + sunDist * sample.direction[2],
  ]
  // Sky は太陽が地平線下のとき sunPosition.y < 0 で「夜空」になる。三項で渡し分けず、生の値を渡せばよい
  const skyPos: [number, number, number] = [
    sample.direction[0] * 100,
    sample.direction[1] * 100,
    sample.direction[2] * 100,
  ]
  // 仰角が低いほど Sky 散乱を強める (夕焼け)
  const altitudeDeg = (sample.altitude * 180) / Math.PI
  const skyRayleigh = altitudeDeg < 0 ? 0.5 : altitudeDeg < 15 ? 3 : 1.2
  const skyTurbidity = altitudeDeg < 0 ? 2 : altitudeDeg < 15 ? 10 : 6
  // §M18 hotfix: drei <Environment preset="..."> は外部 HDRI を fetch するため、
  // オフライン/CDN 不通環境で <CanvasImpl> が throw して画面が真っ白になる事故が起きた。
  // PoC スコープでは <hemisphereLight> で空-地面の 2 色グラデを疑似 IBL として代用する。
  // Phase 3 で同梱可能な軽量 HDRI を用意した時点で <Environment files={...}> に置き換える。
  const hemiSky = altitudeDeg < 0 ? '#0b1426' : altitudeDeg < 15 ? '#ffb070' : '#b5d8ff'
  const hemiGround = '#3a3528'
  return (
    <>
      <ambientLight intensity={sample.ambientIntensity} color={sample.ambientColor} />
      <hemisphereLight args={[hemiSky, hemiGround, 0.6]} />
      <Sky sunPosition={skyPos} turbidity={skyTurbidity} rayleigh={skyRayleigh} />
      <directionalLight
        position={sunPos}
        intensity={sample.intensity}
        color={sample.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-sunDist}
        shadow-camera-right={sunDist}
        shadow-camera-top={sunDist}
        shadow-camera-bottom={-sunDist}
        shadow-camera-near={0.1}
        shadow-camera-far={sunDist * 3}
        shadow-bias={-0.0005}
      />
    </>
  )
}

function Ground({
  centerXZ,
  sizeM,
}: {
  centerXZ: [number, number]
  sizeM: number
}) {
  return (
    <mesh
      position={[centerXZ[0], -0.001, centerXZ[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[sizeM, sizeM]} />
      <meshStandardMaterial {...GROUND_MATERIAL} />
    </mesh>
  )
}

/**
 * §11 Phase 2 / M13: テクスチャ適用版の床/壁レンダリングをまとめて持つ。
 *
 * 内側で useTextures() を呼ぶことで、textures bundle のシングルトン取得を 1 箇所に集約する。
 * FloorPlates / WallsWithOpenings は両方とも同じ bundle を参照する。
 */
function TexturedScene({ scene }: { scene: SceneSpec }) {
  const textures = useTextures()
  return (
    <>
      <FloorPlates scene={scene} textures={textures} />
      <WallsWithOpenings scene={scene} textures={textures} />
    </>
  )
}

function FloorPlates({ scene, textures }: { scene: SceneSpec; textures: TextureBundle }) {
  return (
    <>
      {scene.floorPlates.map((plate) => {
        const kind = pickFloorTextureKind(plate.presetId)
        const sourceTex =
          kind === 'wood'
            ? textures.woodFloor
            : kind === 'kitchen'
              ? textures.kitchenFloor
              : kind === 'tile'
                ? textures.tileFloor
                : textures.concreteFloor
        if (plate.shapeKind === 'rect') {
          const center: [number, number, number] = [
            plate.center[0] * MM_TO_M,
            0,
            plate.center[2] * MM_TO_M,
          ]
          const size: [number, number, number] = [
            plate.size[0] * MM_TO_M,
            0.02,
            plate.size[2] * MM_TO_M,
          ]
          return (
            <FloorPlateRectMesh
              key={plate.id}
              center={center}
              size={size}
              sizeMm={{ w: plate.size[0], h: plate.size[2] }}
              texture={sourceTex}
            />
          )
        }
        return (
          <FloorPlatePolygonMesh
            key={plate.id}
            pointsXZ={plate.pointsXZ}
            sizeMm={{ w: plate.size[0], h: plate.size[2] }}
            texture={sourceTex}
          />
        )
      })}
    </>
  )
}

function FloorPlateRectMesh({
  center,
  size,
  sizeMm,
  texture,
}: {
  center: [number, number, number]
  size: [number, number, number]
  sizeMm: { w: number; h: number }
  texture: THREE.CanvasTexture
}) {
  const { w: smW, h: smH } = sizeMm
  const cloned = useMemo(
    () => repeatedClone(texture, { w: smW, h: smH }),
    [texture, smW, smH],
  )
  return (
    <mesh position={center} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        map={cloned}
        color={FLOOR_MATERIAL.color}
        roughness={FLOOR_MATERIAL.roughness}
        metalness={FLOOR_MATERIAL.metalness}
      />
    </mesh>
  )
}

/**
 * §11 Phase 2 / M16: polygon 部屋の床。
 *
 * THREE.Shape にワールド XZ 頂点を流し込み、ShapeGeometry を XY 平面に作って
 * X 軸まわりに -π/2 回転して XZ 平面に倒す。厚みは持たないが ContactShadows と
 * Y=0 にぴったり合うので破綻しない。
 *
 * UV を頂点 XZ そのまま当てているので、texture.repeat は (sizeMm/1000) で
 * 1m=1 タイル単位に正規化する。
 */
function FloorPlatePolygonMesh({
  pointsXZ,
  sizeMm,
  texture,
}: {
  pointsXZ: ReadonlyArray<readonly [number, number]>
  sizeMm: { w: number; h: number }
  texture: THREE.CanvasTexture
}) {
  const { w: smW, h: smH } = sizeMm
  const cloned = useMemo(
    () => repeatedClone(texture, { w: smW, h: smH }),
    [texture, smW, smH],
  )
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    if (pointsXZ.length === 0) return null
    const [x0, z0] = pointsXZ[0]!
    shape.moveTo(x0 * MM_TO_M, z0 * MM_TO_M)
    for (let i = 1; i < pointsXZ.length; i++) {
      const [x, z] = pointsXZ[i]!
      shape.lineTo(x * MM_TO_M, z * MM_TO_M)
    }
    shape.closePath()
    const geom = new THREE.ShapeGeometry(shape)
    // UV は地面 XZ をそのまま m 単位で取る。CanvasTexture.repeat = (m, m) で 1 タイル=1m
    return geom
  }, [pointsXZ])
  if (geometry == null) return null
  return (
    <mesh
      receiveShadow
      // §M48 v0.5: ShapeGeometry は XY 平面に作る → +π/2 で寝かせると plan_y がそのまま +Z に
      // マップされて壁と Z 符号が一致する。-π/2 だと plan_y が -Z に飛んで床と壁の Z が反転する。
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      geometry={geometry}
    >
      <meshStandardMaterial
        map={cloned}
        color={FLOOR_MATERIAL.color}
        roughness={FLOOR_MATERIAL.roughness}
        metalness={FLOOR_MATERIAL.metalness}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * 壁 + 開口部の組み立て。
 * 壁ごとに「自分にぶら下がっている開口部」を集め、壁長を 1 軸に投影して
 * solid 区間と sill/lintel 区間に分割する。CSG は使わないので軽い。
 */
function WallsWithOpenings({
  scene,
  textures,
}: {
  scene: SceneSpec
  textures: TextureBundle
}) {
  const openingsByWall = useMemo(() => {
    const m = new Map<string, Opening[]>()
    for (const op of scene.openings) {
      const arr = m.get(op.wallId)
      if (arr == null) m.set(op.wallId, [op])
      else arr.push(op)
    }
    return m
  }, [scene.openings])

  return (
    <>
      {scene.walls.map((wall) => (
        <WallWithOpenings
          key={wall.id}
          wall={wall}
          openings={openingsByWall.get(wall.id) ?? []}
          ceilingHeight={scene.ceilingHeight}
          textures={textures}
        />
      ))}
    </>
  )
}

function WallWithOpenings({
  wall,
  openings,
  ceilingHeight,
  textures,
}: {
  wall: WallBox
  openings: Opening[]
  ceilingHeight: number
  textures: TextureBundle
}) {
  const segs = useMemo(() => splitWallByOpenings(wall, openings, ceilingHeight), [
    wall,
    openings,
    ceilingHeight,
  ])

  const material =
    wall.kind === 'exterior' ? EXTERIOR_WALL_MATERIAL : WALL_MATERIAL
  const sourceTexture =
    wall.kind === 'exterior' ? textures.siding : textures.wallpaper
  const wallLen = wall.size[0]
  const wallH = wall.size[1]
  // 壁ごとに長さ/高さで repeat を変えるので clone する
  const wallTexture = useMemo(
    () => repeatedClone(sourceTexture, { w: wallLen, h: wallH }),
    [sourceTexture, wallLen, wallH],
  )

  // §M60 v0.9: 非表示壁 (hiddenWallIds) は壁本体 (solids) と窓ガラスを描かないが、
  // ドアパネルだけは独立して残す。ドアは家具同様ユーザーが置いた要素なので、
  // 壁を消した瞬間に 3D から消えるのは不便というフィードバックに対応
  return (
    <group
      position={[wall.center[0] * MM_TO_M, 0, wall.center[2] * MM_TO_M]}
      rotation={[0, wall.rotationY, 0]}
    >
      {!wall.hidden && segs.solids.map((s, i) => (
        <mesh
          key={`solid-${i}`}
          position={[s.offsetX * MM_TO_M, (s.y + s.height / 2) * MM_TO_M, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              s.width * MM_TO_M,
              s.height * MM_TO_M,
              wall.size[2] * MM_TO_M,
            ]}
          />
          <meshStandardMaterial
            map={wallTexture}
            color={material.color}
            roughness={material.roughness}
            metalness={material.metalness}
          />
        </mesh>
      ))}
      {!wall.hidden && segs.glass.map((g, i) => (
        <mesh
          key={`glass-${i}`}
          position={[g.offsetX * MM_TO_M, (g.y + g.height / 2) * MM_TO_M, 0]}
        >
          <boxGeometry
            args={[
              g.width * MM_TO_M,
              g.height * MM_TO_M,
              Math.max(20, wall.size[2] * 0.2) * MM_TO_M,
            ]}
          />
          <meshStandardMaterial {...WINDOW_GLASS_MATERIAL} />
        </mesh>
      ))}
      {/* §M50 v0.6: ドアパネル (薄板)。swingInward に従って壁厚の 1/3 だけ片側へオフセット */}
      {segs.doorPanels.map((d, i) => {
        const offsetZ = (d.swingInward ? -1 : 1) * (wall.size[2] / 3)
        return (
          <mesh
            key={`door-panel-${i}`}
            position={[
              d.offsetX * MM_TO_M,
              (d.y + d.height / 2) * MM_TO_M,
              offsetZ * MM_TO_M,
            ]}
            castShadow
          >
            <boxGeometry
              args={[d.width * MM_TO_M, d.height * MM_TO_M, 30 * MM_TO_M]}
            />
            <meshStandardMaterial
              color="#6e4f33"
              roughness={0.55}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * 壁本体を 1 次元線分 (長さ wall.size[0]) に投影し、開口部の上下・両脇を sill / lintel として残す。
 * - 戻り値の座標系は wall.center を 0 とするローカル系 (壁の長さ方向 X、上方 Y)
 * - solids: 壁マテリアルで埋める箱の列
 * - glass: 窓のとき開口部に薄く立てる「窓ガラス」モック
 */
function splitWallByOpenings(
  wall: WallBox,
  openings: Opening[],
  ceilingHeight: number,
): {
  solids: { offsetX: number; y: number; width: number; height: number }[]
  glass: { offsetX: number; y: number; width: number; height: number }[]
  /** §M50 v0.6: ドアパネル (薄板)。kind='door' の開口に必ず 1 枚 */
  doorPanels: {
    offsetX: number
    y: number
    width: number
    height: number
    swingInward: boolean
  }[]
} {
  const total = wall.size[0]
  const top = wall.size[1]
  if (openings.length === 0) {
    return {
      solids: [{ offsetX: 0, y: 0, width: total, height: top }],
      glass: [],
      doorPanels: [],
    }
  }

  // ローカル座標: -total/2 .. +total/2。positionRatio=0 を -total/2 に対応
  const sorted = [...openings].sort((a, b) => a.positionRatio - b.positionRatio)
  const solids: { offsetX: number; y: number; width: number; height: number }[] = []
  const glass: { offsetX: number; y: number; width: number; height: number }[] = []
  const doorPanels: {
    offsetX: number
    y: number
    width: number
    height: number
    swingInward: boolean
  }[] = []

  let cursor = -total / 2
  for (const op of sorted) {
    const center = -total / 2 + op.positionRatio * total
    const half = op.width / 2
    const leftEdge = Math.max(cursor, center - half)
    const rightEdge = Math.min(total / 2, center + half)

    // §M56 v0.8: ドアパネルは cursor の進捗に依存させず、壁長クランプだけで判定する。
    // これにより 2 つ以上の開口が重なっても各 door に必ず 1 枚パネルが立つ
    if (op.kind === 'door') {
      const panelLeft = Math.max(-total / 2, center - half)
      const panelRight = Math.min(total / 2, center + half)
      const panelWidth = Math.max(0, panelRight - panelLeft)
      if (panelWidth > 50) {
        doorPanels.push({
          offsetX: (panelLeft + panelRight) / 2,
          y: op.sillHeight,
          width: panelWidth,
          height: op.height,
          swingInward: op.swingInward !== false,
        })
      }
    }

    if (leftEdge > cursor) {
      const w = leftEdge - cursor
      solids.push({ offsetX: cursor + w / 2, y: 0, width: w, height: top })
    }
    const opLeft = Math.max(cursor, leftEdge)
    const opRight = rightEdge
    const opWidth = Math.max(0, opRight - opLeft)
    if (opWidth > 0) {
      // sill (下) と lintel (上) を solid として加える
      if (op.sillHeight > 0) {
        solids.push({
          offsetX: opLeft + opWidth / 2,
          y: 0,
          width: opWidth,
          height: op.sillHeight,
        })
      }
      const headHeight = top - (op.sillHeight + op.height)
      if (headHeight > 0) {
        solids.push({
          offsetX: opLeft + opWidth / 2,
          y: op.sillHeight + op.height,
          width: opWidth,
          height: headHeight,
        })
      }
      // 窓ガラスは透明箱を 1 枚立てる (door panel は上で push 済み)。
      if (op.kind === 'window') {
        glass.push({
          offsetX: opLeft + opWidth / 2,
          y: op.sillHeight,
          width: opWidth,
          height: op.height,
        })
      }
      cursor = opRight
    } else {
      cursor = Math.max(cursor, rightEdge)
    }
    if (cursor >= total / 2) break
    if (cursor < ceilingHeight * 0) cursor = leftEdge // dummy: keep ts happy without unused var warning
  }
  if (cursor < total / 2) {
    const w = total / 2 - cursor
    solids.push({ offsetX: cursor + w / 2, y: 0, width: w, height: top })
  }
  return { solids, glass, doorPanels }
}

/**
 * §11 Phase 2 / M13: 3D ビュー左上のライティングプリセット切替 UI。
 * Canvas の外 (HTML 側) に置いて R3F の再レンダーから切り離す。
 */
function LightingSwitcher() {
  const preset = useEditorStore((s) => s.lightingPreset)
  const setPreset = useEditorStore((s) => s.setLightingPreset)
  const sunHour = useEditorStore((s) => s.sunHour)
  const setSunHour = useEditorStore((s) => s.setSunHour)
  const season = useEditorStore((s) => s.season)
  const setSeason = useEditorStore((s) => s.setSeason)

  const presets: { id: LightingPreset; label: string; hour: number }[] = [
    { id: 'noon', label: '昼', hour: 12 },
    { id: 'evening', label: '夕', hour: 17.5 },
    { id: 'night', label: '夜', hour: 22 },
  ]
  const seasons: { id: Season; label: string }[] = [
    { id: 'spring', label: '春' },
    { id: 'summer', label: '夏' },
    { id: 'autumn', label: '秋' },
    { id: 'winter', label: '冬' },
  ]

  return (
    <div
      data-testid="lighting-switcher"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'rgba(15, 23, 42, 0.72)',
        padding: 8,
        borderRadius: 6,
        color: 'white',
        fontSize: 12,
        minWidth: 200,
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPreset(p.id)
              setSunHour(p.hour)
            }}
            aria-pressed={preset === p.id}
            aria-label={`照明: ${p.label}`}
            data-testid={`lighting-${p.id}`}
            style={{
              border: 'none',
              background: preset === p.id ? '#3b82f6' : 'transparent',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/*
        §11 Phase 2 / M17: 時間スライダ。
        Range 0..24、0.25 (= 15 分) 刻みで影が動く。
        プリセットボタンと連動 (UI 表示のみ; sunHour は両方向から書き換え可)。
      */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>
          時刻: {Math.floor(sunHour).toString().padStart(2, '0')}:
          {Math.round((sunHour % 1) * 60).toString().padStart(2, '0')}
        </span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={sunHour}
          onChange={(e) => setSunHour(Number(e.target.value))}
          data-testid="sun-hour"
          aria-label="太陽時 (0〜24 時)"
        />
      </label>

      <div style={{ display: 'flex', gap: 4 }}>
        {seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSeason(s.id)}
            aria-pressed={season === s.id}
            aria-label={`季節: ${s.label}`}
            data-testid={`season-${s.id}`}
            style={{
              flex: 1,
              border: 'none',
              background: season === s.id ? '#3b82f6' : 'transparent',
              color: 'white',
              padding: '4px 6px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * §M61 v0.9: 3D ビュー右上の「人を置く」ボタン。
 * クリックで建物中心 (groundScene.center) に新規人物モデルを追加して即選択する。
 * 配置後はメッシュをドラッグして XZ 平面上を自由に移動できる。
 */
function HumanToolbar({ centerMm }: { centerMm: readonly [number, number] }) {
  const addHuman = useFloorplanStore((s) => s.addHuman)
  const select = useEditorStore((s) => s.select)
  return (
    <div
      data-testid="human-toolbar"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        background: 'rgba(15, 23, 42, 0.72)',
        padding: 8,
        borderRadius: 6,
        color: 'white',
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={() => {
          const id = addHuman({ position: [Math.round(centerMm[0]), Math.round(centerMm[1])] })
          if (id != null) select({ kind: 'human', id })
        }}
        aria-label="人物モデルを配置"
        data-testid="human-add"
        style={{
          border: 'none',
          background: '#3b82f6',
          color: 'white',
          padding: '6px 12px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        人を置く
      </button>
    </div>
  )
}

