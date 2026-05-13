/**
 * §M116 v0.28: ASCII DXF (R12/R14/R2000 系) の最小プロファイル parser。
 *
 * 外部依存なしで実装する。DXF は「group code (整数) / value (文字列または数値)」が
 * 1 行ずつ交互に並ぶタグ形式。本 parser は ENTITIES セクションだけを走査して、
 * 以下のエンティティを抽出する:
 *  - LINE       (10/20 = start XY, 11/21 = end XY)
 *  - LWPOLYLINE (繰り返しの 10/20 = vertices, 70 = flags (bit 1: closed))
 *  - POLYLINE + VERTEX/SEQEND (R12 以前の形式)
 *  - CIRCLE     (10/20 = center, 40 = radius)
 *  - TEXT       (10/20 = position, 1 = value, 40 = height, 50 = rotation)
 *  - MTEXT      (10/20 = position, 1/3 = value (3 が複数チャンク可), 40 = height, 50 = rotation)
 *  - INSERT     (10/20 = insertion point, 2 = block name, 41/42 = scale X/Y, 50 = rotation)
 *
 * 仕様外で出てきた group code は読み飛ばす。BLOCKS セクションは v0.28 では参照しない
 * (ブロック名は INSERT entity の group code 2 から得る)。
 *
 * 単位 (mm/inch) は DXF $INSUNITS から取れるが、現場では未設定の図面も多いため、
 * v0.28 では「座標の絶対値が小さい場合のみメートル単位だと判定して × 1000」する
 * ヒューリスティクスを buildFloorplan 側で行う。本 parser はそのまま raw 値を返す。
 *
 * 制限:
 *  - SPLINE / ELLIPSE / ARC は無視 (= 壁としては検出されない)
 *  - 3D エンティティ (Z 成分 30/31) は無視 (= 平面プロジェクション前提)
 *  - 中国語 / 韓国語など UTF-8 以外の DXF は呼び出し側で TextDecoder を選ぶ
 */

export type Vec2 = readonly [number, number]

export type DxfEntity =
  | { kind: 'line'; layer: string; from: Vec2; to: Vec2 }
  | { kind: 'lwpolyline'; layer: string; closed: boolean; vertices: Vec2[] }
  | { kind: 'circle'; layer: string; center: Vec2; radius: number }
  | {
      kind: 'text'
      layer: string
      position: Vec2
      value: string
      height: number
      rotation: number
    }
  | {
      kind: 'insert'
      layer: string
      blockName: string
      position: Vec2
      rotation: number
      xScale: number
      yScale: number
    }

export type DxfEntities = {
  entities: DxfEntity[]
  /** parser が遭遇した layer 名の集合 (UI でドロップダウンに使う) */
  layers: string[]
  /** $INSUNITS で示された単位 (0=unspecified, 1=inch, 4=mm, 6=m, 等)。ヘッダ未読時は 0 */
  insUnits: number
}

/**
 * DXF テキストを 1 行ずつ正規化する。group code / value のペアで返す。
 * - 行末の \r\n は LF に揃える
 * - 先頭末尾の空白を取り除く
 */
function tokenize(text: string): Array<{ code: number; value: string }> {
  const lines = text.split(/\r?\n/)
  const out: Array<{ code: number; value: string }> = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const codeStr = lines[i]!.trim()
    const value = lines[i + 1] ?? ''
    if (codeStr.length === 0) continue
    const code = Number.parseInt(codeStr, 10)
    if (!Number.isFinite(code)) continue
    out.push({ code, value })
  }
  return out
}

export function parseDxf(text: string): DxfEntities {
  const tokens = tokenize(text)
  const entities: DxfEntity[] = []
  const layerSet = new Set<string>()
  let insUnits = 0

  // ヘッダーから $INSUNITS を拾う (任意)。0=unitless, 1=inch, 4=mm, 6=m
  for (let i = 0; i < tokens.length - 2; i++) {
    const t = tokens[i]!
    if (t.code === 9 && t.value === '$INSUNITS') {
      const v = tokens[i + 1]
      if (v != null && v.code === 70) {
        insUnits = Number.parseInt(v.value, 10) || 0
      }
      break
    }
  }

  // ENTITIES セクションの開始/終了を見つける。SECTION (0) → '$INSUNITS' (9) でなく code(2) === 'ENTITIES' なら開始
  let inEntities = false
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    if (t.code === 0 && t.value === 'SECTION') {
      // 次のトークンが (2, 'ENTITIES') かを確認
      const next = tokens[i + 1]
      if (next != null && next.code === 2 && next.value === 'ENTITIES') {
        inEntities = true
        i += 2
        continue
      }
    }
    if (t.code === 0 && t.value === 'ENDSEC') {
      inEntities = false
      i++
      continue
    }
    if (!inEntities) {
      i++
      continue
    }
    // ここから ENTITIES の中身
    if (t.code === 0) {
      const entityType = t.value
      // 同じエンティティの属性を集める: 次の code=0 が出るまで
      const attrs: Array<{ code: number; value: string }> = []
      let j = i + 1
      while (j < tokens.length && tokens[j]!.code !== 0) {
        attrs.push(tokens[j]!)
        j++
      }
      // POLYLINE は code=0/VERTEX が続き、code=0/SEQEND で終わる特殊形式
      if (entityType === 'POLYLINE') {
        const polyAttrs = attrs
        const verts: Vec2[] = []
        let k = j
        while (k < tokens.length) {
          const tok = tokens[k]!
          if (tok.code === 0 && tok.value === 'VERTEX') {
            const va: Array<{ code: number; value: string }> = []
            let kk = k + 1
            while (kk < tokens.length && tokens[kk]!.code !== 0) {
              va.push(tokens[kk]!)
              kk++
            }
            const x = readNum(va, 10)
            const y = readNum(va, 20)
            if (x != null && y != null) verts.push([x, y])
            k = kk
            continue
          }
          if (tok.code === 0 && tok.value === 'SEQEND') {
            k++
            break
          }
          if (tok.code === 0) break
          k++
        }
        const layer = readStr(polyAttrs, 8) ?? '0'
        const flags = readInt(polyAttrs, 70) ?? 0
        layerSet.add(layer)
        if (verts.length >= 2) {
          entities.push({
            kind: 'lwpolyline',
            layer,
            closed: (flags & 1) !== 0,
            vertices: verts,
          })
        }
        i = k
        continue
      }

      const ent = buildEntity(entityType, attrs)
      if (ent != null) {
        entities.push(ent)
        layerSet.add(ent.layer)
      }
      i = j
      continue
    }
    i++
  }

  return {
    entities,
    layers: Array.from(layerSet).sort(),
    insUnits,
  }
}

function buildEntity(
  type: string,
  attrs: Array<{ code: number; value: string }>,
): DxfEntity | null {
  const layer = readStr(attrs, 8) ?? '0'
  switch (type) {
    case 'LINE': {
      const x1 = readNum(attrs, 10)
      const y1 = readNum(attrs, 20)
      const x2 = readNum(attrs, 11)
      const y2 = readNum(attrs, 21)
      if (x1 == null || y1 == null || x2 == null || y2 == null) return null
      return { kind: 'line', layer, from: [x1, y1], to: [x2, y2] }
    }
    case 'LWPOLYLINE': {
      const verts: Vec2[] = []
      let pendingX: number | null = null
      for (const a of attrs) {
        if (a.code === 10) {
          if (pendingX != null) {
            // 前の頂点に Y が無いまま次の X が来た → 落とす
          }
          pendingX = Number.parseFloat(a.value)
        } else if (a.code === 20 && pendingX != null) {
          const y = Number.parseFloat(a.value)
          if (Number.isFinite(pendingX) && Number.isFinite(y)) {
            verts.push([pendingX, y])
          }
          pendingX = null
        }
      }
      const flags = readInt(attrs, 70) ?? 0
      if (verts.length < 2) return null
      return { kind: 'lwpolyline', layer, closed: (flags & 1) !== 0, vertices: verts }
    }
    case 'CIRCLE': {
      const cx = readNum(attrs, 10)
      const cy = readNum(attrs, 20)
      const r = readNum(attrs, 40)
      if (cx == null || cy == null || r == null) return null
      return { kind: 'circle', layer, center: [cx, cy], radius: r }
    }
    case 'TEXT': {
      const x = readNum(attrs, 10)
      const y = readNum(attrs, 20)
      const value = decodeDxfText(readStr(attrs, 1) ?? '')
      const height = readNum(attrs, 40) ?? 0
      const rotation = (readNum(attrs, 50) ?? 0) * (Math.PI / 180)
      if (x == null || y == null) return null
      return { kind: 'text', layer, position: [x, y], value, height, rotation }
    }
    case 'MTEXT': {
      const x = readNum(attrs, 10)
      const y = readNum(attrs, 20)
      // MTEXT の本文は code=3 (継続) + 終端で code=1。両方をまとめる
      const chunks: string[] = []
      for (const a of attrs) {
        if (a.code === 3) chunks.push(a.value)
        else if (a.code === 1) chunks.push(a.value)
      }
      const value = decodeDxfText(chunks.join('').replace(/\\P/g, '\n'))
      const height = readNum(attrs, 40) ?? 0
      const rotation = (readNum(attrs, 50) ?? 0) * (Math.PI / 180)
      if (x == null || y == null) return null
      return { kind: 'text', layer, position: [x, y], value, height, rotation }
    }
    case 'INSERT': {
      const x = readNum(attrs, 10)
      const y = readNum(attrs, 20)
      const blockName = readStr(attrs, 2) ?? ''
      const xScale = readNum(attrs, 41) ?? 1
      const yScale = readNum(attrs, 42) ?? 1
      const rotation = (readNum(attrs, 50) ?? 0) * (Math.PI / 180)
      if (x == null || y == null) return null
      return {
        kind: 'insert',
        layer,
        blockName,
        position: [x, y],
        rotation,
        xScale,
        yScale,
      }
    }
    default:
      return null
  }
}

function readNum(
  attrs: Array<{ code: number; value: string }>,
  code: number,
): number | null {
  for (const a of attrs) {
    if (a.code === code) {
      const n = Number.parseFloat(a.value)
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

function readInt(
  attrs: Array<{ code: number; value: string }>,
  code: number,
): number | null {
  for (const a of attrs) {
    if (a.code === code) {
      const n = Number.parseInt(a.value, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

function readStr(
  attrs: Array<{ code: number; value: string }>,
  code: number,
): string | null {
  for (const a of attrs) {
    if (a.code === code) return a.value
  }
  return null
}

/**
 * §M153 v0.36: DXF の TEXT/MTEXT 内 `\U+XXXX` エスケープを Unicode 文字に復元する。
 *
 * AutoCAD 互換 CAD ソフトが日本語等の非 ASCII を `\U+30EA\U+30D3...` のように
 * 出力する慣習がある。本アプリ exporter (§M153) もこの形式で書き出すため、
 * 取込時に復元することで round-trip 完全一致が成立する。
 *
 * - `\U+XXXX` × 2 で BMP 外 (絵文字など) のサロゲートペアにも対応
 * - エスケープ以外の `\` は素通し
 */
function decodeDxfText(s: string): string {
  if (s.indexOf('\\U+') < 0) return s
  return s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}
