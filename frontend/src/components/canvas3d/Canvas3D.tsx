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
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, PointerLockControls, Sky } from '@react-three/drei'
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
  // §M99 v0.22: 3D で特定の階だけ表示するインデックス (null=全階)
  const visibleFloorIndex = useEditorStore((s) => s.visibleFloorIndex)
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
          {stacked.map((s, idx) => {
            // §M99 v0.22: 任意の階に絞って表示するモード。null なら全階表示
            if (visibleFloorIndex !== null && idx !== visibleFloorIndex) return null
            return (
              <group
                key={s.floor.id}
                position={[0, s.yOffsetMm * MM_TO_M, 0]}
              >
                <TexturedScene scene={s.scene} />
                {/* §M67 v0.11: ドアパネルを独立レイヤーで描画 (wall 描画と完全に分離)。
                    壁の split 結果に依存しないので、ドアが 3D に出ない不具合を根治する */}
                <DoorPanelsLayer scene={s.scene} />
                {/* §M98 v0.22: 階段 (stairs-start) を 3D で立ち上げる */}
                <StairsLayer stairs={s.scene.stairs} />
                <Furniture furniture={s.floor.furniture} />
                {/* §M61 v0.9: 床ごとに人物モデルを描画 (家具と同様にドラッグ移動 + クリック選択) */}
                <Humans humans={s.floor.humanModels} />
              </group>
            )
          })}

          {/* §M97 v0.21: 最上階の天井高に屋根を載せる (style により形状切替) */}
          <RoofMesh stacked={stacked} totalHeightMm={totalHeightMm} />

          <ContactShadows
            position={[target[0], 0.01, target[2]]}
            scale={Math.max(radiusM * 4, 20)}
            blur={2}
            opacity={0.5}
            far={6}
          />

          {/* §M78 v0.14: fpvHumanId が立っている時は FPV カメラ + PointerLockControls。
              null の時は通常の OrbitControls。 */}
          <CameraRig
            target={target}
            cameraDistance={cameraDistance}
            stacked={stacked}
          />
        </Suspense>
      </Canvas>
      {/* §M78: FPV モード中の HUD (Canvas 外の HTML 層) */}
      <FpvHud />
      {/* §M103 v0.23: 視線方向を示すクロスヘア (FPV 中のみ表示) */}
      <FpvCrosshair />
    </div>
  )
}

/**
 * §M78 v0.14: OrbitControls と FPV (PointerLockControls + 人モデル位置) を切替える。
 *  - fpvHumanId が null: 通常の OrbitControls
 *  - fpvHumanId に id がある: stacked から該当人物を探し、その目の高さに camera を置く。
 *    PointerLockControls がマウス操作で視線回転を担当する。
 *    ESC でロック解除されたら editorStore.exitFpv で state を戻す。
 */
function CameraRig({
  target,
  cameraDistance,
  stacked,
}: {
  target: [number, number, number]
  cameraDistance: number
  stacked: { floor: import('@/types').Floor; scene: SceneSpec; yOffsetMm: number }[]
}) {
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)
  const exitFpv = useEditorStore((s) => s.exitFpv)
  const moveHuman = useFloorplanStore((s) => s.moveHuman)
  const { camera } = useThree()

  // 対象 HumanModel を探す (どのフロアに居るかも判定)。
  // stacked の中身は floor 更新で都度新規参照になるので useMemo を挟まず直接走らせる
  let fpvTarget: { human: import('@/types').HumanModel; yOffsetMm: number } | null = null
  if (fpvHumanId != null) {
    for (const s of stacked) {
      const h = s.floor.humanModels.find((x) => x.id === fpvHumanId)
      if (h != null) {
        fpvTarget = { human: h, yOffsetMm: s.yOffsetMm }
        break
      }
    }
  }

  // FPV エントリ時のみカメラを初期化。以降は useFrame / キーボードで更新する。
  // 旧コードは fpvTarget が変わる度に位置リセットしていたため、キー移動した直後に
  // 元の位置に戻されてしまっていた。entry ref で初回のみに絞る。
  const lastFpvIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (fpvHumanId == null) {
      lastFpvIdRef.current = null
      return
    }
    if (lastFpvIdRef.current === fpvHumanId) return
    if (fpvTarget == null) return
    lastFpvIdRef.current = fpvHumanId
    const { human, yOffsetMm } = fpvTarget
    // 目線は身長 - 100mm (頭頂から ~10cm 下)
    const eyeY = (yOffsetMm + Math.max(800, human.height - 100)) * MM_TO_M
    const px = human.position[0] * MM_TO_M
    const pz = human.position[1] * MM_TO_M
    camera.position.set(px, eyeY, pz)
    // human.rotation: Y 軸回転 (rad)。three.js デフォルト forward は -Z。
    const dirX = -Math.sin(human.rotation)
    const dirZ = -Math.cos(human.rotation)
    camera.lookAt(px + dirX * 10, eyeY, pz + dirZ * 10)
  }, [fpvHumanId, fpvTarget, camera])

  // §M103 v0.23: 矢印キー / WASD で人物モデルを移動。
  // 移動は camera の現在の向き (XZ 平面に射影) を基準に Forward / Strafe を計算。
  // 移動後の XZ 位置を moveHuman に流し、camera 位置もメートル単位で同期する。
  useEffect(() => {
    if (fpvHumanId == null) return
    const stepM = 0.2 // 1 回押すごとに 200mm 進む (Shift で 5×)
    const handleKey = (e: KeyboardEvent) => {
      let dz = 0  // forward(-) / back(+)
      let dx = 0  // strafe right(+) / left(-)
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dz = -1
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          dz = 1
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dx = -1
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          dx = 1
          break
        default:
          return
      }
      e.preventDefault()
      // カメラの forward (XZ 投影、Y を 0 にして水平移動に揃える)
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      forward.y = 0
      if (forward.lengthSq() < 1e-6) return
      forward.normalize()
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
      const speed = e.shiftKey ? stepM * 5 : stepM
      const move = new THREE.Vector3()
      // dz = -1 (上 / W) → forward 方向へ
      move.addScaledVector(forward, -dz * speed)
      move.addScaledVector(right, dx * speed)
      camera.position.x += move.x
      camera.position.z += move.z
      // 人物モデルの XZ を camera 位置に同期 (mm 整数化)
      const xMm = Math.round(camera.position.x * 1000)
      const zMm = Math.round(camera.position.z * 1000)
      moveHuman(fpvHumanId, [xMm, zMm])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fpvHumanId, camera, moveHuman])

  if (fpvHumanId != null && fpvTarget != null) {
    return (
      <PointerLockControls
        // ロック解除 (ESC など) で FPV モードを抜ける
        onUnlock={() => exitFpv()}
      />
    )
  }
  return (
    <OrbitControls
      target={target}
      enableDamping
      dampingFactor={0.08}
      // §M77 v0.14: 旧 1m だと「室内に潜り込んで人と同じ目線まで降りられない」
      // という指摘。0.2m まで詰めて、家具レベルの拡大や床上低い視点も可能に
      minDistance={0.2}
      maxDistance={cameraDistance * 4}
      maxPolarAngle={Math.PI / 2.05}
      // §M73 v0.13: ホイールズームをカーソル位置基準に (CAD 系の挙動)
      zoomToCursor
      makeDefault
    />
  )
}

/**
 * §M78 v0.14: FPV 中だけ画面右上に出る「終了」HUD。
 * Canvas の外 (HTML 層) なので、PointerLock の影響を受けずクリックできる。
 * §M103 v0.23: 操作キーの説明も併記。
 */
function FpvHud() {
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)
  const exitFpv = useEditorStore((s) => s.exitFpv)
  if (fpvHumanId == null) return null
  return (
    <div
      data-testid="fpv-hud"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.85)',
        padding: '8px 12px',
        borderRadius: 6,
        color: 'white',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span>FPV モード</span>
        <button
          type="button"
          onClick={() => exitFpv()}
          data-testid="fpv-exit"
          style={{
            border: 'none',
            background: '#ef4444',
            color: 'white',
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          FPV 終了
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
        <div>マウス: 視線回転 / クリック: ドア開閉等</div>
        <div>↑↓←→ / WASD: 歩く (Shift で 5×) / ESC: 終了</div>
      </div>
    </div>
  )
}

/**
 * §M103 v0.23: FPV 中の十字クロスヘア (画面中央)。
 * - PointerLock 中はカーソルが消えるため、視線方向を示すレチクルとして必要
 * - `pointerEvents: 'none'` にしてクリックは下の canvas (= door 等の onPointerDown) に通す
 *   → 通常のクリックで「視線先のドアを開閉」など、既存ハンドラがそのまま機能する
 */
function FpvCrosshair() {
  const fpvHumanId = useEditorStore((s) => s.fpvHumanId)
  if (fpvHumanId == null) return null
  return (
    <div
      data-testid="fpv-crosshair"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 28,
        height: 28,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28">
        {/* 外周リング (薄め) */}
        <circle
          cx="14"
          cy="14"
          r="10"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.2"
        />
        {/* 横棒 */}
        <line x1="6" y1="14" x2="22" y2="14" stroke="white" strokeWidth="1.5" />
        {/* 縦棒 */}
        <line x1="14" y1="6" x2="14" y2="22" stroke="white" strokeWidth="1.5" />
        {/* 中央のドット */}
        <circle cx="14" cy="14" r="1.5" fill="white" />
      </svg>
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
        // §M71 v0.12: grass を選択肢に追加
        const sourceTex =
          kind === 'wood'
            ? textures.woodFloor
            : kind === 'kitchen'
              ? textures.kitchenFloor
              : kind === 'tile'
                ? textures.tileFloor
                : kind === 'grass'
                  ? textures.grassFloor
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
 * §M67 v0.11: ドアパネルを独立レイヤーとして描画する。
 *
 * 設計意図:
 *  - これまでドアパネル mesh は WallWithOpenings の内側 (壁グループ + rotation Y) で描画していた。
 *    そのため splitWallByOpenings の状態 (cursor バグ / 区間 union の不整合) に強く依存し、
 *    M56/M60/M63 と度重なる修正を入れても「2D で置いたドアが 3D に出ない」報告が残った。
 *  - 本レイヤーは `scene.openings` の中の `kind === 'door'` だけを抜き、
 *    `scene.walls` から id 一致で wall geometry を得て、ワールド系に直接 mesh を立てる。
 *  - パネルは壁厚 + 20mm の Z 寸法を持ち、壁の両面から少し顔を出すので、
 *    どの視点からも必ずドアが視認できる。
 *  - 非表示壁 (M60 hidden=true) でも開口部マッチがあれば描画されるので、
 *    「壁削除済みでもドアだけ残る」要件を満たす。
 */
function DoorPanelsLayer({ scene }: { scene: SceneSpec }) {
  const wallById = useMemo(() => {
    const m = new Map<string, WallBox>()
    for (const w of scene.walls) m.set(w.id, w)
    return m
  }, [scene.walls])

  return (
    <>
      {scene.openings
        // §M82 v0.17: 伝播コピーはパネル描画から除外 (1 ドア = 1 パネル)
        .filter((op) => op.kind === 'door' && !op.isPropagated)
        .map((op) => {
          const wall = wallById.get(op.wallId)
          if (wall == null) return null
          const total = wall.size[0]
          if (total < 1) return null
          const center = -total / 2 + op.positionRatio * total
          const half = op.width / 2
          const left = Math.max(-total / 2, center - half)
          const right = Math.min(total / 2, center + half)
          const widthMm = right - left
          if (widthMm < 10) return null
          const heightMm = op.height > 0 ? op.height : 2000
          return (
            <DoorPanel
              key={op.id}
              wall={wall}
              leftMm={left}
              rightMm={right}
              widthMm={widthMm}
              heightMm={heightMm}
              sillHeightMm={op.sillHeight}
              swingInward={op.swingInward !== false}
              isSliding={op.doorType === 'sliding'}
            />
          )
        })}
    </>
  )
}

/**
 * §M72 v0.13: ドアパネル単体。クリックで開閉アニメーション、壁を貫通する厚みを持つ。
 *
 *  - 厚さ Z = wall.thickness + 20mm、中心 Z = 0 にして壁の両面に 10mm ずつ顔を出す
 *    (M67 で片側に寄せていた offsetZ を廃止し、user 報告の「壁の片側にだけくっつく」を解消)
 *  - ヒンジ位置 = ドアの左端 (wall-local) に group origin を置き、子 mesh を +width/2 オフセット
 *  - swingInward=true → 開いた時 -π/2 (壁の "内側" 想定)、false → +π/2
 *  - useFrame で目標角度に向けて lerp、滑らかにアニメ
 */
function DoorPanel({
  wall,
  leftMm,
  rightMm,
  widthMm,
  heightMm,
  sillHeightMm,
  swingInward,
  isSliding,
}: {
  wall: WallBox
  leftMm: number
  rightMm: number
  widthMm: number
  heightMm: number
  sillHeightMm: number
  swingInward: boolean
  /** §M95 v0.21: 引き戸 (true) は壁長方向にスライドで開閉、false (= 開き戸) は Y 軸回転で開閉 */
  isSliding: boolean
}) {
  const [open, setOpen] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  // §M72: 開き戸は内開き=-π/2、外開き=+π/2
  // §M95: 引き戸は壁長方向 (X) に widthMm * 0.95 スライド (パネル幅分ほぼ開く)
  const targetAngle = !isSliding && open ? (swingInward ? -Math.PI / 2 : Math.PI / 2) : 0
  const targetSlideX = isSliding && open ? widthMm * 0.95 : 0

  useFrame((_state, delta) => {
    const g = groupRef.current
    if (g == null) return
    if (isSliding) {
      // §M101 v0.22: g.position.x は three.js のメートル系。base / targetSlideX も
      // メートルに揃えて lerp する (旧 M95 は mm のまま比較していたためアニメが破綻していた)
      const baseM = leftMm * MM_TO_M
      const targetM = baseM + targetSlideX * MM_TO_M
      const current = g.position.x
      const diff = targetM - current
      if (Math.abs(diff) < 1e-4) {
        g.position.x = targetM
        return
      }
      // スライドは 約 1.5 m/s で動かす (典型的引き戸の操作速度)
      const step = Math.sign(diff) * Math.min(Math.abs(diff), delta * 1.5)
      g.position.x = current + step
      g.rotation.y = 0
      return
    }
    // 回転開閉 (旧 M72)
    const current = g.rotation.y
    const diff = targetAngle - current
    if (Math.abs(diff) < 1e-3) {
      g.rotation.y = targetAngle
      return
    }
    const step = Math.sign(diff) * Math.min(Math.abs(diff), delta * 8)
    g.rotation.y = current + step
  })

  // §M76 v0.14: パネル厚は実建材のドア厚 (40mm) ベース。
  // 壁の hole 形状 (M63 + M81) がパネルの両脇に見えて「ドアの形に開いた穴」が判別できる。
  // §M81 v0.16: 安全策として「壁厚 + 20mm」を下限に。
  // 同一直線上に複数の壁が重なるケースで穴の伝播が間に合わなくても、
  // パネルが両面 10mm ずつ顔を出して必ず視認できる。
  const panelDepthMm = Math.max(40, wall.size[2] + 20)
  const hingeXMm = leftMm
  return (
    <group
      position={[wall.center[0] * MM_TO_M, 0, wall.center[2] * MM_TO_M]}
      rotation={[0, wall.rotationY, 0]}
    >
      {/* ヒンジ group: ドア左端を pivot に。回転はこの group の rotation.y で行う */}
      <group
        ref={groupRef}
        position={[hingeXMm * MM_TO_M, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <mesh
          position={[
            (widthMm / 2) * MM_TO_M,
            (sillHeightMm + heightMm / 2) * MM_TO_M,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[widthMm * MM_TO_M, heightMm * MM_TO_M, panelDepthMm * MM_TO_M]}
          />
          <meshStandardMaterial color="#6e4f33" roughness={0.55} metalness={0.05} />
        </mesh>
        {/* §M72: ノブ。視認性 + クリックヒント */}
        <mesh
          position={[
            (widthMm - 60) * MM_TO_M,
            (sillHeightMm + heightMm / 2) * MM_TO_M,
            ((panelDepthMm / 2) + 8) * MM_TO_M,
          ]}
        >
          <sphereGeometry args={[18 * MM_TO_M, 16, 12]} />
          <meshStandardMaterial color="#cfb37a" roughness={0.35} metalness={0.6} />
        </mesh>
      </group>
    </group>
  )
  // rightMm は使っていないが API 一貫性のために受け取る
  void rightMm
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

/**
 * §M98 v0.22: 階段 (stairs-start) を 3D で立ち上げる。
 *
 *  - 階段の踏面長 (tread): aabb の昇り方向の長さ
 *  - 踏面幅 (going): 階段の幅方向の AABB
 *  - 蹴上 (riser): ceilingHeight / steps
 *  - 段数: 17 段固定 (一般住宅標準) または rise / 200mm を切り上げ
 *  - 各段は薄い箱として積み上げ。下から (0, 0) → (0, rise) まで
 */
function StairsLayer({ stairs }: { stairs: import('@/core/three/floorplanToScene').Stairs[] }) {
  return (
    <>
      {stairs.map((s) => {
        const length =
          s.direction === '+x' || s.direction === '-x'
            ? s.aabb.maxX - s.aabb.minX
            : s.aabb.maxZ - s.aabb.minZ
        const width =
          s.direction === '+x' || s.direction === '-x'
            ? s.aabb.maxZ - s.aabb.minZ
            : s.aabb.maxX - s.aabb.minX
        if (length < 100 || width < 100) return null
        const steps = Math.max(12, Math.ceil(s.rise / 200))
        const riser = s.rise / steps
        const tread = length / steps
        const cx = (s.aabb.minX + s.aabb.maxX) / 2
        const cz = (s.aabb.minZ + s.aabb.maxZ) / 2
        return (
          <group key={s.id}>
            {Array.from({ length: steps }).map((_, i) => {
              // 各段の中心 (世界 mm)
              let stepX = cx
              let stepZ = cz
              const stepY = (i * riser + riser / 2) * MM_TO_M
              const offset = -length / 2 + tread / 2 + i * tread
              if (s.direction === '+x') stepX = s.aabb.minX + tread / 2 + i * tread
              else if (s.direction === '-x') stepX = s.aabb.maxX - tread / 2 - i * tread
              else if (s.direction === '+z') stepZ = s.aabb.minZ + tread / 2 + i * tread
              else stepZ = s.aabb.maxZ - tread / 2 - i * tread
              void offset
              const stepW =
                s.direction === '+x' || s.direction === '-x' ? tread : width
              const stepD =
                s.direction === '+x' || s.direction === '-x' ? width : tread
              return (
                <mesh
                  key={i}
                  position={[stepX * MM_TO_M, stepY, stepZ * MM_TO_M]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[stepW * MM_TO_M, riser * MM_TO_M, stepD * MM_TO_M]} />
                  <meshStandardMaterial color="#a98765" roughness={0.65} metalness={0.0} />
                </mesh>
              )
            })}
          </group>
        )
      })}
    </>
  )
}

/**
 * §M97 v0.21: 建物全体に被せる屋根 mesh。
 *
 * - `style === 'none'`: 何も描画しない
 * - `style === 'flat'`: 床 AABB に厚さ 200mm の薄い slab を被せる
 * - `style === 'gable'`: 床 AABB の長辺方向に切妻 (両側傾斜)。pitch ≒ 30°
 * - `style === 'shed'`: 床 AABB の長辺方向に片流れ。pitch ≒ 15°
 *
 * 床 AABB は最上階の scene.center / scene.radius から推定する (= 各 floorPlate の
 * 包絡 AABB)。屋根の張り出し (eave) は周囲 500mm。
 */
function RoofMesh({
  stacked,
  totalHeightMm,
}: {
  stacked: { floor: import('@/types').Floor; scene: SceneSpec; yOffsetMm: number }[]
  totalHeightMm: number
}) {
  const roofStyle = useEditorStore((s) => s.roofStyle)
  if (roofStyle === 'none' || stacked.length === 0) return null

  // 最上階の床プレートから AABB を集計 (X, Z 範囲)
  const top = stacked[stacked.length - 1]!
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const fp of top.scene.floorPlates) {
    if (fp.shapeKind === 'rect') {
      minX = Math.min(minX, fp.center[0] - fp.size[0] / 2)
      maxX = Math.max(maxX, fp.center[0] + fp.size[0] / 2)
      minZ = Math.min(minZ, fp.center[2] - fp.size[2] / 2)
      maxZ = Math.max(maxZ, fp.center[2] + fp.size[2] / 2)
    } else {
      for (const [px, pz] of fp.pointsXZ) {
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (pz < minZ) minZ = pz
        if (pz > maxZ) maxZ = pz
      }
    }
  }
  if (!Number.isFinite(minX)) return null
  const EAVE = 500
  minX -= EAVE; maxX += EAVE; minZ -= EAVE; maxZ += EAVE
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const w = (maxX - minX) * MM_TO_M
  const d = (maxZ - minZ) * MM_TO_M
  const baseY = totalHeightMm * MM_TO_M

  if (roofStyle === 'flat') {
    return (
      <mesh
        position={[cx * MM_TO_M, baseY + 0.1, cz * MM_TO_M]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[w, 0.2, d]} />
        <meshStandardMaterial color="#4a4a52" roughness={0.7} metalness={0.1} />
      </mesh>
    )
  }

  // 切妻 / 片流れの傾斜辺の向き: X (左右) が D より長ければ X 方向が棟方向
  const ridgeAlongX = w >= d
  // pitch (傾斜): gable は急め (≒30°)、shed は緩め (≒15°)
  const pitchRad = roofStyle === 'gable' ? (30 * Math.PI) / 180 : (15 * Math.PI) / 180
  const spanForRise = ridgeAlongX ? d : w  // 軒〜棟までの span
  const rise = (spanForRise / 2) * Math.tan(pitchRad)
  // shed は span 全長で rise
  const shedRise = spanForRise * Math.tan(pitchRad)
  const thickness = 0.18  // 屋根材厚 m

  if (roofStyle === 'shed') {
    // 平行四辺形を傾けただけのスラブ。Y 軸まわりに棟方向で回転 + Z (or X) 軸で pitch 回転
    const rotateY = ridgeAlongX ? 0 : Math.PI / 2
    const rotateOther = ridgeAlongX ? -pitchRad : -pitchRad
    return (
      <mesh
        position={[cx * MM_TO_M, baseY + shedRise / 2, cz * MM_TO_M]}
        rotation={[rotateOther * (ridgeAlongX ? 1 : 0), rotateY, ridgeAlongX ? 0 : rotateOther]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, thickness, d]} />
        <meshStandardMaterial color="#6b3a2a" roughness={0.7} metalness={0.05} />
      </mesh>
    )
  }

  // §M100 v0.22: gable 屋根 — 棟が建物中央で最も高く、両側に下がるよう修正。
  // 旧 M97 は rotation の符号が反転していて V 字 (中央が低い) になっていた。
  // 各 slab は「軒〜棟」の長さを持ち、軒側の端が y=0 軒先、棟側の端が y=rise 棟上 になる。
  const slabW = ridgeAlongX ? w : Math.hypot(spanForRise / 2, rise)
  const slabD = ridgeAlongX ? Math.hypot(spanForRise / 2, rise) : d
  if (ridgeAlongX) {
    // 棟は X 軸方向。-Z 側と +Z 側に slab を 1 枚ずつ配置し、中央 (z=0) で頂点が出会う
    return (
      <group position={[cx * MM_TO_M, baseY, cz * MM_TO_M]}>
        {/* -Z 側 slab: -Z 端 (z=-d/2) が y=0 軒、+Z 端 (z=0) が y=rise 棟 */}
        <mesh
          position={[0, rise / 2, -d / 4]}
          rotation={[-pitchRad, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[slabW, thickness, slabD]} />
          <meshStandardMaterial color="#6b3a2a" roughness={0.7} metalness={0.05} />
        </mesh>
        {/* +Z 側 slab: +Z 端 (z=d/2) が軒、-Z 端 (z=0) が棟 */}
        <mesh
          position={[0, rise / 2, d / 4]}
          rotation={[pitchRad, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[slabW, thickness, slabD]} />
          <meshStandardMaterial color="#6b3a2a" roughness={0.7} metalness={0.05} />
        </mesh>
      </group>
    )
  }
  // 棟は Z 軸方向。-X 側と +X 側に slab を配置
  return (
    <group position={[cx * MM_TO_M, baseY, cz * MM_TO_M]}>
      {/* -X 側 slab: -X 端 (x=-w/2) が軒、+X 端 (x=0) が棟 */}
      <mesh
        position={[-w / 4, rise / 2, 0]}
        rotation={[0, 0, pitchRad]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[slabW, thickness, slabD]} />
        <meshStandardMaterial color="#6b3a2a" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* +X 側 slab: +X 端 (x=w/2) が軒、-X 端 (x=0) が棟 */}
      <mesh
        position={[w / 4, rise / 2, 0]}
        rotation={[0, 0, -pitchRad]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[slabW, thickness, slabD]} />
        <meshStandardMaterial color="#6b3a2a" roughness={0.7} metalness={0.05} />
      </mesh>
    </group>
  )
}

/**
 * §M70 v0.12: バルコニー外周の手摺。
 *
 * 壁ローカル座標 (X = 壁長方向、Y = 上、Z = 厚み方向) に対し:
 *  - 縦柱を 800mm 間隔で立てる (40×40mm、高さ 1000mm)
 *  - 上下に横棒 2 本: 上 ~1000mm、下 ~80mm
 *  - 中段に 細い縦バー (柵風) を 100mm 間隔で並べる
 * 色は外装系ダーク (金属感のあるグレー)。
 */
function Railing({
  length,
  thickness,
  outsideSign,
}: {
  length: number
  thickness: number
  /** §M75 v0.13: 部屋の外側を指す local +Z 軸の符号 (-1 or +1) */
  outsideSign: -1 | 1
}) {
  const RAIL_HEIGHT = 1000 // mm
  const POST_SIZE = 50 // mm
  const POST_SPACING = 800 // mm
  const TOP_RAIL_H = 60
  const BOTTOM_RAIL_H = 40
  const BAR_SIZE = 15
  const BAR_SPACING = 110
  const halfLen = length / 2
  const depth = Math.max(20, thickness * 0.3)
  // §M75 v0.13: 部屋境界の外側に貼り付くように local Z 方向に shift する
  const outsideShiftZ = outsideSign * (thickness / 2 - depth / 2)
  const material = { color: '#5b6b75', roughness: 0.45, metalness: 0.4 }

  // 柱: 両端 + 等間隔
  const postPositions: number[] = []
  const postCount = Math.max(2, Math.ceil(length / POST_SPACING))
  for (let i = 0; i < postCount; i++) {
    postPositions.push(-halfLen + (i * length) / (postCount - 1))
  }
  // 縦バー (柵風)
  const barPositions: number[] = []
  if (length > BAR_SPACING * 2) {
    const innerStart = -halfLen + 80
    const innerEnd = halfLen - 80
    for (let x = innerStart; x <= innerEnd; x += BAR_SPACING) {
      barPositions.push(x)
    }
  }

  return (
    <group position={[0, 0, outsideShiftZ * MM_TO_M]}>
      {/* 柱 */}
      {postPositions.map((px, i) => (
        <mesh
          key={`post-${i}`}
          position={[px * MM_TO_M, (RAIL_HEIGHT / 2) * MM_TO_M, 0]}
          castShadow
        >
          <boxGeometry args={[POST_SIZE * MM_TO_M, RAIL_HEIGHT * MM_TO_M, POST_SIZE * MM_TO_M]} />
          <meshStandardMaterial {...material} />
        </mesh>
      ))}
      {/* 上の横棒 */}
      <mesh
        position={[0, (RAIL_HEIGHT + TOP_RAIL_H / 2) * MM_TO_M, 0]}
        castShadow
      >
        <boxGeometry args={[length * MM_TO_M, TOP_RAIL_H * MM_TO_M, depth * MM_TO_M]} />
        <meshStandardMaterial color="#3d4a52" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* 下の横棒 */}
      <mesh
        position={[0, (BOTTOM_RAIL_H / 2) * MM_TO_M, 0]}
        castShadow
      >
        <boxGeometry args={[length * MM_TO_M, BOTTOM_RAIL_H * MM_TO_M, depth * MM_TO_M]} />
        <meshStandardMaterial color="#3d4a52" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* 中段の細い縦バー */}
      {barPositions.map((bx, i) => (
        <mesh
          key={`bar-${i}`}
          position={[bx * MM_TO_M, (RAIL_HEIGHT / 2) * MM_TO_M, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              BAR_SIZE * MM_TO_M,
              (RAIL_HEIGHT - 80) * MM_TO_M,
              BAR_SIZE * MM_TO_M,
            ]}
          />
          <meshStandardMaterial {...material} />
        </mesh>
      ))}
    </group>
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

  // §M70 v0.12: バルコニーの外周は手摺 (柱 + 横棒) として描画する。
  // 通常の solids/glass/lintel/sill は出さず、Railing コンポーネントに任せる。
  // §M75 v0.13: outsideSign で「部屋の外側」に手摺をシフトする
  if (wall.kind === 'railing' && !wall.hidden) {
    return (
      <group
        position={[wall.center[0] * MM_TO_M, 0, wall.center[2] * MM_TO_M]}
        rotation={[0, wall.rotationY, 0]}
      >
        <Railing
          length={wall.size[0]}
          thickness={wall.size[2]}
          outsideSign={wall.outsideSign ?? 1}
        />
      </group>
    )
  }

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
      {/*
        §M67 v0.11: ドアパネルは WallWithOpenings 内では描画しない。
        DoorPanelsLayer (壁外) で `scene.openings` から独立に描画する。
        - 旧実装は wall の split 結果 (doorPanels[]) を頼っていたが、splitWallByOpenings の
          バグ修正 (M56/M60/M63) を入れても画面上に出ないケースが残る、というユーザー報告に対応
        - 独立レイヤー化により wall 表示ロジックと完全に分離し、開口の wallId だけで描画する
      */}
    </group>
  )
}

/**
 * 壁本体を 1 次元線分 (長さ wall.size[0]) に投影し、開口部の上下・両脇を sill / lintel として残す。
 * - 戻り値の座標系は wall.center を 0 とするローカル系 (壁の長さ方向 X、上方 Y)
 * - solids: 壁マテリアルで埋める箱の列
 * - glass: 窓のとき開口部に薄く立てる「窓ガラス」モック
 *
 * §M63 v0.10: 旧 cursor ベースのアルゴリズムを「区間 union ベース」に置換。
 * 旧実装は開口を positionRatio 順に走査し、cursor が進むたびに次の開口を
 * 「cursor より右の領域だけ」で扱っていた。このため重なった開口や近接した開口に対して
 * opWidth=0 となるケースが発生し、ドアの開口穴が壁に空かず、壁本体が
 * ドアパネルを覆い隠す事故が頻発していた (実際の利用で 2D に置いたドアの半数が 3D に出ない)。
 *
 * 新実装:
 *  1. 各開口を [left, right] 区間にクランプし、union を merged intervals として求める
 *  2. merged intervals の補集合に「壁全高 (y=0..top) のソリッド」を埋める
 *  3. 各ドアについて、その区間にリンテル (y=door.height..top) のソリッドとドアパネルを出す
 *  4. 各窓について、その区間に sill (y=0..sillHeight) + リンテル (y=sillHeight+height..top) + ガラスを出す
 *
 * これでどの開口にも必ず「壁が空いている」区間ができ、ドアパネルが壁内に埋もれることが無くなる。
 */
function splitWallByOpenings(
  wall: WallBox,
  openings: Opening[],
  _ceilingHeight: number,
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
  void _ceilingHeight
  const total = wall.size[0]
  const top = wall.size[1]
  const solids: { offsetX: number; y: number; width: number; height: number }[] = []
  const glass: { offsetX: number; y: number; width: number; height: number }[] = []
  const doorPanels: {
    offsetX: number
    y: number
    width: number
    height: number
    swingInward: boolean
  }[] = []

  if (openings.length === 0) {
    return {
      solids: [{ offsetX: 0, y: 0, width: total, height: top }],
      glass,
      doorPanels,
    }
  }

  // 1. 各開口の [left, right] を計算 (壁端でクランプ、最小幅 10mm 未満のみ無効)。
  // §M80 v0.15: 旧 50mm のしきい値だと、壁端近くにあるドアで「DoorPanelsLayer
  // は描画するが splitWallByOpenings は穴を切らない」不整合が出てパネルが壁内に
  // 埋もれて見えなくなっていた。DoorPanelsLayer 側 (>10mm) と同じ閾値に揃えて
  // 「描画されるドアには必ず穴を空ける」不変条件を保証する。
  type Iv = { left: number; right: number; op: Opening }
  const ivs: Iv[] = []
  for (const op of openings) {
    const center = -total / 2 + op.positionRatio * total
    const half = op.width / 2
    const left = Math.max(-total / 2, center - half)
    const right = Math.min(total / 2, center + half)
    if (right - left > 10) ivs.push({ left, right, op })
  }
  if (ivs.length === 0) {
    return {
      solids: [{ offsetX: 0, y: 0, width: total, height: top }],
      glass,
      doorPanels,
    }
  }

  // 2. 区間 union を求める (位置順にソート → 重なるものを merge)
  const sortedByLeft = [...ivs].sort((a, b) => a.left - b.left)
  const merged: { left: number; right: number }[] = []
  for (const iv of sortedByLeft) {
    const last = merged[merged.length - 1]
    if (last == null || last.right < iv.left) {
      merged.push({ left: iv.left, right: iv.right })
    } else {
      last.right = Math.max(last.right, iv.right)
    }
  }

  // 3. merged interval の隙間に「全高ソリッド」を埋める
  let cursor = -total / 2
  for (const m of merged) {
    if (m.left > cursor) {
      const w = m.left - cursor
      solids.push({ offsetX: cursor + w / 2, y: 0, width: w, height: top })
    }
    cursor = m.right
  }
  if (cursor < total / 2) {
    const w = total / 2 - cursor
    solids.push({ offsetX: cursor + w / 2, y: 0, width: w, height: top })
  }

  // 4. 各開口ごとに sill / lintel / glass / doorPanel を push (重なりは Z-fight を許容)
  for (const iv of ivs) {
    const { op, left, right } = iv
    const width = right - left
    const offsetX = (left + right) / 2
    if (op.kind === 'door') {
      // ドアは床直 (sillHeight=0) を前提とするが、念のため値を尊重
      if (op.sillHeight > 0) {
        solids.push({ offsetX, y: 0, width, height: op.sillHeight })
      }
      const headY = op.sillHeight + op.height
      if (headY < top) {
        solids.push({ offsetX, y: headY, width, height: top - headY })
      }
      doorPanels.push({
        offsetX,
        y: op.sillHeight,
        width,
        height: op.height,
        swingInward: op.swingInward !== false,
      })
    } else {
      // 窓: 下に sill、上に lintel、開口部にガラス
      if (op.sillHeight > 0) {
        solids.push({ offsetX, y: 0, width, height: op.sillHeight })
      }
      const headY = op.sillHeight + op.height
      if (headY < top) {
        solids.push({ offsetX, y: headY, width, height: top - headY })
      }
      glass.push({ offsetX, y: op.sillHeight, width, height: op.height })
    }
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
  const roofStyle = useEditorStore((s) => s.roofStyle)
  const setRoofStyle = useEditorStore((s) => s.setRoofStyle)
  const visibleFloorIndex = useEditorStore((s) => s.visibleFloorIndex)
  const setVisibleFloorIndex = useEditorStore((s) => s.setVisibleFloorIndex)
  const floors = useFloorplanStore((s) => s.floorplan.floors)
  const roofOptions: Array<{ id: typeof roofStyle; label: string }> = [
    { id: 'none', label: '無し' },
    { id: 'flat', label: '陸屋根' },
    { id: 'gable', label: '切妻' },
    { id: 'shed', label: '片流れ' },
  ]
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
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
      {/* §M97 v0.21: 屋根スタイルを 4 択ボタンで切替 */}
      <div data-testid="roof-toolbar">
        <div style={{ fontSize: 11, marginBottom: 4, color: 'rgba(255,255,255,0.7)' }}>屋根</div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {roofOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setRoofStyle(o.id)}
              aria-pressed={roofStyle === o.id}
              data-testid={`roof-${o.id}`}
              style={{
                border: 'none',
                background: roofStyle === o.id ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {/* §M99 v0.22: 複数階あるときの「この階だけ表示」セレクタ。floors.length > 1 のときだけ出す */}
      {floors.length > 1 && (
        <div data-testid="floor-visibility-toolbar">
          <div style={{ fontSize: 11, marginBottom: 4, color: 'rgba(255,255,255,0.7)' }}>表示階</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setVisibleFloorIndex(null)}
              aria-pressed={visibleFloorIndex === null}
              data-testid="floor-visibility-all"
              style={{
                border: 'none',
                background:
                  visibleFloorIndex === null ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              全階
            </button>
            {floors.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setVisibleFloorIndex(i)}
                aria-pressed={visibleFloorIndex === i}
                data-testid={`floor-visibility-${i}`}
                style={{
                  border: 'none',
                  background:
                    visibleFloorIndex === i ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

