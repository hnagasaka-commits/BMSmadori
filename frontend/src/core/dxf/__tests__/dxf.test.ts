/**
 * §M116 v0.28: DXF パーサと Floorplan 構築のスモークテスト。
 *
 * 完全な DXF (AutoCAD 出力) を想定するのではなく、parser が ENTITIES セクションの
 * LINE / LWPOLYLINE / TEXT / INSERT / CIRCLE を正しく拾えるか、buildFloorplanFromDxf が
 * レイヤー名から壁・部屋・設備に振り分けられるかを検証する。
 */
import { describe, expect, it } from 'vitest'

import {
  exportFloorplanToDxf,
  extractCeilingHeight,
  importDxfText,
  parseDxf,
} from '@/core/dxf'
import { createEmptyFloorplan } from '@/store/floorplanStore'
import type { Floorplan } from '@/types'

/**
 * 最小限の ASCII DXF を組み立てるヘルパー。
 * DXF は (group code, value) ペアを 1 行ずつ並べる単純フォーマット。
 */
function buildDxf(entities: string[]): string {
  return [
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entities,
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n')
}

function lineEntity(layer: string, x1: number, y1: number, x2: number, y2: number): string[] {
  return [
    '0', 'LINE',
    '8', layer,
    '10', String(x1),
    '20', String(y1),
    '11', String(x2),
    '21', String(y2),
  ]
}

function lwpolylineEntity(
  layer: string,
  closed: boolean,
  verts: Array<[number, number]>,
): string[] {
  const out = ['0', 'LWPOLYLINE', '8', layer, '70', closed ? '1' : '0']
  for (const [x, y] of verts) {
    out.push('10', String(x))
    out.push('20', String(y))
  }
  return out
}

function insertEntity(layer: string, x: number, y: number, blockName = 'BLK'): string[] {
  return [
    '0', 'INSERT',
    '8', layer,
    '2', blockName,
    '10', String(x),
    '20', String(y),
  ]
}

function textEntity(layer: string, x: number, y: number, value: string): string[] {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', String(x),
    '20', String(y),
    '40', '250',
    '1', value,
  ]
}

describe('parseDxf', () => {
  it('LINE / LWPOLYLINE / INSERT / TEXT を ENTITIES セクションから抽出する', () => {
    const dxf = buildDxf([
      ...lineEntity('WALL', 0, 0, 1000, 0),
      ...lwpolylineEntity('ROOM', true, [
        [0, 0],
        [1000, 0],
        [1000, 800],
        [0, 800],
      ]),
      ...insertEntity('E-LIGHT', 500, 400, 'LED'),
      ...textEntity('ROOM', 500, 400, 'リビング'),
    ])

    const parsed = parseDxf(dxf)
    const kinds = parsed.entities.map((e) => e.kind)
    expect(kinds).toContain('line')
    expect(kinds).toContain('lwpolyline')
    expect(kinds).toContain('insert')
    expect(kinds).toContain('text')

    const poly = parsed.entities.find((e) => e.kind === 'lwpolyline')!
    expect(poly.kind).toBe('lwpolyline')
    if (poly.kind === 'lwpolyline') {
      expect(poly.closed).toBe(true)
      expect(poly.vertices).toHaveLength(4)
    }
  })

  it('ENTITIES セクション外のトークンを無視する', () => {
    const dxf = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', '4',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      ...lineEntity('WALL', 0, 0, 100, 0),
      '0', 'ENDSEC',
      '0', 'EOF',
    ].join('\n')
    const parsed = parseDxf(dxf)
    expect(parsed.entities).toHaveLength(1)
    expect(parsed.insUnits).toBe(4)
  })
})

describe('extractCeilingHeight', () => {
  it('数値表記から天井高 (mm) を抽出する', () => {
    expect(extractCeilingHeight('2400')).toBe(2400)
    expect(extractCeilingHeight('CH=2700')).toBe(2700)
    expect(extractCeilingHeight('H:2700mm')).toBe(2700)
    expect(extractCeilingHeight('天井高 2700mm')).toBe(2700)
    expect(extractCeilingHeight('2.7')).toBe(2700)
    expect(extractCeilingHeight('hello')).toBeNull()
  })
})

describe('importDxfText', () => {
  it('壁 / 部屋 / 天井設備 / 床設備 / 天井高をレイヤー名から振り分ける', () => {
    const dxf = buildDxf([
      // 部屋 (閉じた LWPOLYLINE)
      ...lwpolylineEntity('ROOM', true, [
        [0, 0],
        [4000, 0],
        [4000, 3000],
        [0, 3000],
      ]),
      // 室名 TEXT
      ...textEntity('ROOM', 2000, 1500, 'リビング'),
      // 壁
      ...lineEntity('WALL', 0, 0, 4000, 0),
      ...lineEntity('WALL', 4000, 0, 4000, 3000),
      ...lineEntity('WALL', 4000, 3000, 0, 3000),
      ...lineEntity('WALL', 0, 3000, 0, 0),
      // 天井設備
      ...insertEntity('E-LIGHT', 2000, 1500),
      ...insertEntity('E-SMOKE', 2000, 2500),
      ...insertEntity('E-AC', 3000, 1500),
      // 床設備
      ...insertEntity('F-EXT', 3500, 500),
      // 天井高
      ...textEntity('CEILING', 100, 100, 'CH=2700'),
    ])
    const { floorplan, report } = importDxfText(dxf, { fileName: 'sample.dxf' })

    expect(floorplan.floors).toHaveLength(1)
    const floor = floorplan.floors[0]!
    expect(floor.rooms.length).toBe(1)
    expect(floor.rooms[0]!.presetId).toBe('living')
    expect(floor.rooms[0]!.customName).toBe('リビング')
    expect(floor.ceilingHeight).toBe(2700)
    expect(report.equipment).toBe(4)
    expect(report.equipmentByCatalog['ceiling-light-led']).toBe(1)
    expect(report.equipmentByCatalog['smoke-detector']).toBe(1)
    expect(report.equipmentByCatalog['ac-cassette-4way']).toBe(1)
    expect(report.equipmentByCatalog['fire-extinguisher']).toBe(1)
    // 天井設備は mountTo='ceiling'、床設備は 'floor'
    const ceil = floor.furniture.find((f) => f.catalogId === 'ceiling-light-led')
    expect(ceil?.mountTo).toBe('ceiling')
    const ext = floor.furniture.find((f) => f.catalogId === 'fire-extinguisher')
    expect(ext?.mountTo).toBe('floor')
    // 壁は freestandingWalls に入る
    expect(floor.freestandingWalls?.length).toBe(4)
    // metadata.name にファイル名が反映される
    expect(floorplan.metadata.name).toContain('sample')
  })

  it('壁も部屋も見つからない DXF は walls=0, rooms=0 を返す', () => {
    const dxf = buildDxf([...textEntity('UNKNOWN', 0, 0, 'foo')])
    const { report } = importDxfText(dxf)
    expect(report.walls).toBe(0)
    expect(report.rooms).toBe(0)
  })
})

describe('exportFloorplanToDxf', () => {
  it('Floorplan を DXF に書き出して再パースすると同じ部屋・天井設備が復元できる', () => {
    // 1 部屋 + 天井設備 1 + 床設備 1 を持つプランを直接組み立てる
    const base = createEmptyFloorplan()
    const floor = base.floors[0]!
    const plan: Floorplan = {
      ...base,
      floors: [
        {
          ...floor,
          ceilingHeight: 2700,
          rooms: [
            {
              id: 'r1',
              presetId: 'living',
              customName: 'リビング',
              shape: {
                kind: 'rect',
                x: 0,
                y: 0,
                w: 4000,
                h: 3000,
                edgeIds: ['e1', 'e2', 'e3', 'e4'],
              },
              rotation: 0,
            },
          ],
          furniture: [
            {
              id: 'f1',
              catalogId: 'ceiling-light-led',
              position: [2000, 1500],
              rotation: 0,
              mountTo: 'ceiling',
            },
            {
              id: 'f2',
              catalogId: 'fire-extinguisher',
              position: [3500, 500],
              rotation: 0,
              mountTo: 'floor',
            },
          ],
        },
      ],
    }
    const dxfText = exportFloorplanToDxf(plan)
    // 主要レイヤー名が含まれていることを軽く確認
    expect(dxfText).toContain('ROOM')
    expect(dxfText).toContain('CEILING')
    expect(dxfText).toContain('E-LIGHT')
    expect(dxfText).toContain('F-EXT')
    expect(dxfText).toContain('CH=2700')
    // 再パース
    const { floorplan: round, report } = importDxfText(dxfText, { fileName: 'roundtrip.dxf' })
    expect(round.floors).toHaveLength(1)
    const roundFloor = round.floors[0]!
    expect(roundFloor.rooms).toHaveLength(1)
    expect(roundFloor.rooms[0]!.customName).toBe('リビング')
    expect(roundFloor.ceilingHeight).toBe(2700)
    expect(report.equipmentByCatalog['ceiling-light-led']).toBe(1)
    expect(report.equipmentByCatalog['fire-extinguisher']).toBe(1)
    // mountTo が保存される
    const ceilOnRound = roundFloor.furniture.find((f) => f.catalogId === 'ceiling-light-led')
    expect(ceilOnRound?.mountTo).toBe('ceiling')
    const floorOnRound = roundFloor.furniture.find((f) => f.catalogId === 'fire-extinguisher')
    expect(floorOnRound?.mountTo).toBe('floor')
  })
})
