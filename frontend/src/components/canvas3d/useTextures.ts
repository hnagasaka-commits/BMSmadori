/**
 * §11 Phase 2 / M13: テクスチャを 1 度だけ生成して使い回すフック。
 *
 * R3F は再レンダーごとに JSX を流すが、テクスチャは GPU リソースなので毎回作り直すと
 * dispose が間に合わず VRAM が増え続ける。モジュールスコープのシングルトンで保持する。
 *
 * 注意: テストや SSR で document が無い環境では呼ばないこと (Canvas3D は browser only)。
 */
import { useEffect } from 'react'
import * as THREE from 'three'
import {
  makeConcreteTexture,
  makeKitchenFloorTexture,
  makeSidingTexture,
  makeTileFloorTexture,
  makeWallpaperTexture,
  makeWoodFloorTexture,
} from './proceduralTextures'

export type TextureBundle = {
  woodFloor: THREE.CanvasTexture
  kitchenFloor: THREE.CanvasTexture
  tileFloor: THREE.CanvasTexture
  concreteFloor: THREE.CanvasTexture
  wallpaper: THREE.CanvasTexture
  siding: THREE.CanvasTexture
}

let cache: TextureBundle | null = null

function getOrBuildBundle(): TextureBundle {
  if (cache != null) return cache
  cache = {
    woodFloor: makeWoodFloorTexture(),
    kitchenFloor: makeKitchenFloorTexture(),
    tileFloor: makeTileFloorTexture(),
    concreteFloor: makeConcreteTexture(),
    wallpaper: makeWallpaperTexture(),
    siding: makeSidingTexture(),
  }
  return cache
}

export function useTextures(): TextureBundle {
  // モジュール側のシングルトンなので React の useMemo を介す必要がない (再レンダーで同じ参照が返る)
  const bundle = getOrBuildBundle()
  // 開発中の HMR で texture が無効になることを避けるため、material 側で needsUpdate を立てる
  useEffect(() => {
    const list: THREE.CanvasTexture[] = Object.values(bundle)
    for (const t of list) {
      t.needsUpdate = true
    }
  }, [bundle])
  return bundle
}

/**
 * 床テクスチャを (size, repeatScale) でクローンする。
 *
 * 同じ画像ソースを共有しつつ、部屋ごとに repeat 値を変えたいので clone する。
 * clone は GPU 上では同じ画像、CPU 側で UV を変えた別オブジェクトになる (軽い)。
 *
 * @param sourceTexture 元テクスチャ
 * @param sizeMm 部屋の (w, h) mm。1m = 1 タイル基準で repeat を決める
 */
export function repeatedClone(
  sourceTexture: THREE.CanvasTexture,
  sizeMm: { w: number; h: number },
): THREE.Texture {
  const repeatX = Math.max(sizeMm.w / 1000, 0.1)
  const repeatY = Math.max(sizeMm.h / 1000, 0.1)
  const clone = sourceTexture.clone()
  clone.needsUpdate = true
  clone.repeat.set(repeatX, repeatY)
  return clone
}
