/**
 * §11 Phase 2 / M17: 日当たりシミュレーション — 太陽位置モデル。
 *
 * 設計の意図:
 *  - 本来の太陽位置は (緯度経度, 日付, 時刻) から SPA / NREL アルゴリズムで計算するが、
 *    Phase 2 PoC ではユーザーに「季節 + 時刻」のスライダだけ与えて、北緯 35°N (東京) を
 *    暗黙に固定する近似モデルで足りる。
 *  - 太陽高度は二分曲線 (sin) で簡略化する。日の出/日の入り時刻は季節ごとに切替。
 *  - 方位 (azimuth) は線形補間。サンセットは西、サンライズは東、正午は真南 (北緯前提)。
 *  - Floorplan.metadata.orientation は「北からの角度 0-359、建物 +X が北からどれだけ回転しているか」
 *    と解釈する。3D ワールドでは「北 = -Z」を採用するので、方位は orientation を相殺するように回す。
 *
 * 戻り値:
 *  - direction: 3D ワールドで「シーン中心→太陽」を指す単位ベクトル (Y up)
 *  - altitude: 仰角 (rad)。負なら地平線下 (夜)
 *  - intensity / color: 仰角に応じた sunIntensity / sunColor (LightingRig が直接受け取れる形)
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type SunSample = {
  /** 3D ワールド: 中心→太陽の単位ベクトル (Y up) */
  direction: readonly [number, number, number]
  /** 仰角 (rad)。負なら太陽は地平線下 */
  altitude: number
  /** 方位角 (rad)。0 = 北、π/2 = 東、π = 南、3π/2 = 西 */
  azimuth: number
  /** LightingRig に渡す太陽光の強度。地平線下なら 0 */
  intensity: number
  /** 太陽光の色 (sRGB hex)。仰角が低いと赤みがかる */
  color: string
  /** 環境光の強度 (夜は底上げ) */
  ambientIntensity: number
  /** 環境光の色 */
  ambientColor: string
  /** drei <Environment> preset。仰角と時刻から推定 */
  envPreset: 'city' | 'sunset' | 'night' | 'dawn'
}

/** 季節ごとの「日の出 / 南中時の仰角 / 日の入り」(東京基準、時刻は太陽時) */
const SEASON_PROFILE: Record<
  Season,
  { sunrise: number; sunset: number; noonAltitudeDeg: number; sunriseAzimuthDeg: number; sunsetAzimuthDeg: number }
> = {
  // 春分 (3/20 頃)
  spring: { sunrise: 6, sunset: 18, noonAltitudeDeg: 55, sunriseAzimuthDeg: 90, sunsetAzimuthDeg: 270 },
  // 夏至 (6/21 頃) — 日が長く、太陽が真上近くまで上がる
  summer: { sunrise: 4.5, sunset: 19.5, noonAltitudeDeg: 78, sunriseAzimuthDeg: 60, sunsetAzimuthDeg: 300 },
  // 秋分 (9/22 頃)
  autumn: { sunrise: 5.7, sunset: 17.7, noonAltitudeDeg: 55, sunriseAzimuthDeg: 90, sunsetAzimuthDeg: 270 },
  // 冬至 (12/22 頃) — 日が短く、太陽が低い
  winter: { sunrise: 7, sunset: 17, noonAltitudeDeg: 31, sunriseAzimuthDeg: 117, sunsetAzimuthDeg: 243 },
}

const DEG = Math.PI / 180

/**
 * 太陽位置を計算する。
 *
 * @param hour 0..24 の時刻 (太陽時)。日の出より前/日の入り後は altitude が負になる。
 * @param season 季節
 * @param buildingOrientationDeg Floorplan.metadata.orientation (0..359°)。
 *   建物 +X 軸が北から何度回転しているかを表す。3D シーンは平面図 X→3D X、平面図 Y→3D Z で投影され、
 *   3D の "北" = -Z とするので、最終 azimuth から orientation を引いて建物座標に合わせる。
 */
export function computeSunSample(
  hour: number,
  season: Season,
  buildingOrientationDeg = 0,
): SunSample {
  const profile = SEASON_PROFILE[season]
  const { sunrise, sunset, noonAltitudeDeg, sunriseAzimuthDeg, sunsetAzimuthDeg } = profile

  let altitudeDeg: number
  let azimuthDeg: number

  if (hour < sunrise || hour > sunset) {
    // 地平線下: 仰角を負にして影を消す
    altitudeDeg = -10
    // 方位は連続性のため日の入り/日の出方位を保持
    azimuthDeg = hour <= sunrise ? sunriseAzimuthDeg : sunsetAzimuthDeg
  } else {
    // 日中: sin 曲線で altitude を作る (0 → noonAltitude → 0)
    const phase = (hour - sunrise) / (sunset - sunrise) // 0..1
    altitudeDeg = noonAltitudeDeg * Math.sin(phase * Math.PI)
    // azimuth は線形補間。phase=0.5 で真南 (180°)、phase=0 で sunrise azimuth、phase=1 で sunset azimuth
    azimuthDeg =
      sunriseAzimuthDeg + (sunsetAzimuthDeg - sunriseAzimuthDeg) * phase
  }

  // 建物オリエンテーションを差し引く
  const adjustedAzimuthDeg = ((azimuthDeg - buildingOrientationDeg) % 360 + 360) % 360
  const azimuth = adjustedAzimuthDeg * DEG
  const altitude = altitudeDeg * DEG

  // 3D 方向: 北 = -Z, 東 = +X
  //   x =  sin(azimuth) * cos(altitude)
  //   y =  sin(altitude)
  //   z = -cos(azimuth) * cos(altitude)
  const cosAlt = Math.cos(altitude)
  const x = Math.sin(azimuth) * cosAlt
  const y = Math.sin(altitude)
  const z = -Math.cos(azimuth) * cosAlt

  // 強度/色は仰角依存
  const intensity = altitudeDeg <= 0 ? 0 : Math.max(0.05, Math.sin(altitude) * 2.2 + 0.3)
  const color = sunColor(altitudeDeg)
  const envPreset = pickEnvPreset(hour, altitudeDeg)
  const { ambientIntensity, ambientColor } = ambientFor(hour, altitudeDeg)

  return {
    direction: [x, y, z],
    altitude,
    azimuth,
    intensity,
    color,
    ambientIntensity,
    ambientColor,
    envPreset,
  }
}

function sunColor(altitudeDeg: number): string {
  if (altitudeDeg < 0) return '#7090c0' // 月光的な冷たい色 (主に強度 0 なので実質見えない)
  if (altitudeDeg < 15) return '#ff8a40' // 朝焼け/夕焼けの強いオレンジ
  if (altitudeDeg < 35) return '#ffd080' // 朝・夕の温かい色
  return '#fff5e0' // 正午前後の白に近い
}

function pickEnvPreset(hour: number, altitudeDeg: number): SunSample['envPreset'] {
  if (altitudeDeg < 0) return 'night'
  if (hour < 7) return 'dawn'
  if (altitudeDeg < 20) return 'sunset' // 朝夕ともにオレンジ系の IBL
  return 'city'
}

function ambientFor(
  _hour: number,
  altitudeDeg: number,
): { ambientIntensity: number; ambientColor: string } {
  if (altitudeDeg < 0) {
    // 夜: ambient を底上げ
    return { ambientIntensity: 0.6, ambientColor: '#9aa8d0' }
  }
  if (altitudeDeg < 15) {
    return { ambientIntensity: 0.45, ambientColor: '#ffd9b0' }
  }
  // 日中
  return { ambientIntensity: 0.4, ambientColor: '#ffffff' }
}

// ----------------------------------------------------------------------------
// プリセット → (hour, season) のマッピング (UI のショートカット用)
// ----------------------------------------------------------------------------

/**
 * 旧 lightingPreset との互換マップ。
 * UI で「昼/夕/夜」ボタンを押した瞬間に sunHour を一括変更するために使う。
 * season はそのまま据え置く。
 */
export function hourForLegacyPreset(preset: 'noon' | 'evening' | 'night'): number {
  switch (preset) {
    case 'noon':
      return 12
    case 'evening':
      return 17.5
    case 'night':
      return 22
  }
}
