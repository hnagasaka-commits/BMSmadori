/**
 * §11 Phase 2 / M13: プロシージャル PBR テクスチャ生成。
 *
 * 設計の意図:
 *  - 外部 GLB/HDRI ファイルをまだリポジトリに置きたくない (バイナリ管理が重い)。
 *  - それでも「板の継ぎ目」「グレイン」「タイル目地」が見えると 3D の説得力が一気に増す。
 *  - そこで Canvas で生成 → THREE.CanvasTexture → meshStandardMaterial の map に渡す方式を採る。
 *
 * 仕様:
 *  - サイズはすべて 256×256。低めにする理由は、PoC 段階で GPU 上のテクスチャ枚数が増えても VRAM を食わないため。
 *  - 床は frame ごとに 1 度しか生成しない (useMemo) → CPU 負荷ゼロ。
 *  - sRGB に揃える: CanvasTexture を colorSpace="srgb" にして、material.color と乗算が破綻しないようにする。
 *
 * 制限:
 *  - normalMap は省略 (PoC レベル)。法線の凹凸表現が必要になったら M16 で本物の素材に差し替える。
 *  - すべて 256×256 で fits 1 タイル = 1m に固定。床板/壁紙の継ぎ目間隔は repeat 値で吸収する。
 */
import * as THREE from 'three'

type ColorTexture = THREE.CanvasTexture

/** ベース色 + ノイズ + ストライプを重ねた汎用ジェネレータ */
function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 256,
): ColorTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('canvas 2d context not available')
  draw(ctx, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/** 木の床: 12cm 幅の板を縦に並べて、板内にグレインノイズ */
export function makeWoodFloorTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#c9a779'
    ctx.fillRect(0, 0, size, size)
    const plankWidth = size / 6 // 256 / 6 ≈ 42px / 256px = 1/6 タイル
    for (let i = 0; i < 6; i++) {
      const x = i * plankWidth
      // 板ごとに色をわずかにずらす
      const shade = 0.85 + ((i * 47) % 30) / 200
      ctx.fillStyle = `rgba(180, 140, 90, ${shade.toFixed(2)})`
      ctx.fillRect(x, 0, plankWidth, size)
      // 継ぎ目 (両端)
      ctx.fillStyle = 'rgba(60, 40, 25, 0.55)'
      ctx.fillRect(x, 0, 1, size)
      // グレイン (細い縦線をランダムに)
      ctx.fillStyle = 'rgba(95, 60, 30, 0.18)'
      for (let g = 0; g < 12; g++) {
        const gx = x + 3 + ((i * 23 + g * 17) % (plankWidth - 6))
        ctx.fillRect(gx, 0, 1, size)
      }
    }
    // 板の継ぎ (横方向の節)
    ctx.fillStyle = 'rgba(60, 40, 25, 0.55)'
    for (let row = 0; row < 4; row++) {
      const y = (row * size) / 4 + ((row * 31) % 18)
      const startPlank = row % 6
      ctx.fillRect(startPlank * plankWidth, y, plankWidth, 1)
    }
  })
}

/** クッションフロア (キッチン/洗面): 灰色のドット模様 */
export function makeKitchenFloorTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#e6e3dd'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(100, 100, 100, 0.16)'
    for (let y = 0; y < size; y += 16) {
      for (let x = 0; x < size; x += 16) {
        const r = ((x * 13 + y * 7) % 30) / 20 + 0.6
        ctx.beginPath()
        ctx.arc(x + 8, y + 8, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // タイル目地
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const p = (i * size) / 4
      ctx.beginPath()
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.stroke()
    }
  })
}

/** 浴室/トイレ: タイル目地強め */
export function makeTileFloorTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#c9d4dc'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(80, 90, 100, 0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i <= 8; i++) {
      const p = (i * size) / 8
      ctx.beginPath()
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.stroke()
    }
  })
}

/** 玄関土間: コンクリート灰 */
export function makeConcreteTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#9c9a90'
    ctx.fillRect(0, 0, size, size)
    // 砂利のような点を散らす
    for (let i = 0; i < 800; i++) {
      const x = (i * 73) % size
      const y = (i * 119 + 37) % size
      const a = ((i * 17) % 30) / 200
      ctx.fillStyle = `rgba(60, 60, 60, ${a.toFixed(2)})`
      ctx.fillRect(x, y, 1, 1)
    }
  })
}

/** 壁紙: クリーム色に細かいテクスチャ */
export function makeWallpaperTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#f5f1ea'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(190, 180, 165, 0.22)'
    for (let i = 0; i < 1200; i++) {
      const x = (i * 53) % size
      const y = (i * 89 + 11) % size
      ctx.fillRect(x, y, 1, 1)
    }
  })
}

/** 外壁: サイディング横ライン */
export function makeSidingTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#d8d2c5'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(110, 100, 85, 0.35)'
    for (let i = 1; i < 8; i++) {
      const y = (i * size) / 8
      ctx.fillRect(0, y, size, 1)
    }
  })
}

// §M90 v0.20: 家具リアル機能 (M86/M88) はユーザー要望で撤去。
// makeFurnitureWood/Fabric/Leather と pickFurnitureTextureKind を削除済み。

/**
 * 部屋プリセット ID から床テクスチャを選ぶ。
 * Phase 2 後半 (M15: 規格カタログ UI) で素材選択 UI が入った時点で、
 * Floor.roomFinishes を見るように差し替える。
 */
export function pickFloorTextureKind(presetId: string): FloorTextureKind {
  if (presetId === 'bathroom' || presetId === 'toilet') return 'tile'
  if (presetId === 'kitchen' || presetId === 'kitchen-gas' || presetId === 'washroom') return 'kitchen'
  // §M74 v0.13: バルコニーは屋外コンクリート床 (玄関と同じテクスチャを流用)
  if (presetId === 'entrance' || presetId === 'balcony') return 'concrete'
  // §M71 v0.12: 庭は屋外なので芝生テクスチャ
  if (presetId === 'garden') return 'grass'
  // §M132 v0.30: BMS / 商業向け部屋の既定床材。
  //  - 機械室 / 電気室 / 倉庫 / 執務室裏 → concrete (土足の汚れに強い、点検通路向き)
  //  - ロビー / 商業廊下 / 公衆トイレ / 給湯室 → tile (清掃しやすく見栄えする)
  if (
    presetId === 'machine-room' ||
    presetId === 'electric-room' ||
    presetId === 'storage-warehouse' ||
    presetId === 'office' ||
    presetId === 'conference-room'
  ) {
    return 'concrete'
  }
  if (
    presetId === 'lobby' ||
    presetId === 'corridor-bms' ||
    presetId === 'kitchenette' ||
    presetId === 'restroom-public'
  ) {
    return 'tile'
  }
  return 'wood'
}

export type FloorTextureKind = 'wood' | 'kitchen' | 'tile' | 'concrete' | 'grass'

/**
 * §M71 v0.12: 芝生床テクスチャ。
 * - ベースは深緑 (#3e7a3a)
 * - 短い線分を擬似的にランダム配置して芝のブレード感
 * - 角度バリエーションを混ぜて単色べた塗りに見えないようにする
 */
export function makeGrassTexture(): ColorTexture {
  return makeCanvasTexture((ctx, size) => {
    // ベース緑 + 縦のグラデで奥行き感
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, '#3f7a3a')
    grad.addColorStop(1, '#356a31')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    // 細かい色斑点 (土が透ける感じ)
    ctx.fillStyle = 'rgba(80, 50, 30, 0.18)'
    for (let i = 0; i < 60; i++) {
      const x = (i * 41) % size
      const y = (i * 73) % size
      ctx.beginPath()
      ctx.arc(x, y, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 芝のブレード: 短い線分を多めに描く
    const bladeCount = 700
    for (let i = 0; i < bladeCount; i++) {
      const x = (i * 53 + ((i * 17) % 13)) % size
      const y = (i * 97 + ((i * 11) % 7)) % size
      // 明るめ/暗めの緑を交互
      const bright = (i % 5 === 0)
      ctx.strokeStyle = bright ? 'rgba(140, 200, 100, 0.55)' : 'rgba(60, 100, 50, 0.5)'
      ctx.lineWidth = bright ? 1 : 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      const angle = ((i * 31) % 60) - 30 // -30〜+30°
      const len = 3 + ((i * 7) % 4) // 3〜6px
      const rad = (angle * Math.PI) / 180
      ctx.lineTo(x + Math.sin(rad) * len, y - Math.cos(rad) * len)
      ctx.stroke()
    }
  })
}
