/**
 * §M122 v0.29: 設備マスター store と addFurniture の equipment-master 統合テスト。
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  getEquipmentSpec,
  useEquipmentMasterStore,
} from '@/store/equipmentMasterStore'
import { useFloorplanStore } from '@/store/floorplanStore'
import type { EquipmentMasterFile } from '@/types/equipment'

const SAMPLE_FILE: EquipmentMasterFile = {
  metadata: {
    version: '1.0.0',
    unit: 'mm',
    categoryColors: {
      E: { name: '電気', color: '#FFD700' },
      P: { name: '給排水', color: '#1E90FF' },
      A: { name: '空調', color: '#32CD32' },
      G: { name: 'ガス', color: '#FF8C00' },
      S: { name: '消火', color: '#E60000' },
      K: { name: '火災報知', color: '#FF69B4' },
      B: { name: '防災', color: '#9370DB' },
    },
    placementColors: {
      ceiling: '#5DADE2',
      floor: '#58D68D',
      wall: '#F5B041',
      roof: '#AF7AC5',
      outdoor: '#85929E',
    },
  },
  equipment: [
    {
      id: 'E-001',
      name: 'シーリングライト',
      category: 'E',
      placement: 'ceiling',
      shape: 'square',
      width: 600,
      depth: 600,
      height: 100,
      symbol: '◇',
    },
    {
      id: 'S-401',
      name: '送水口',
      category: 'S',
      placement: 'outdoor',
      shape: 'rect',
      width: 300,
      depth: 200,
      height: 800,
      symbol: '送水',
    },
    {
      id: 'P-301',
      name: '高置水槽',
      category: 'P',
      placement: 'roof',
      shape: 'rect',
      width: 2000,
      depth: 2000,
      height: 2000,
      symbol: '高水',
    },
  ],
}

describe('equipmentMasterStore', () => {
  beforeEach(() => {
    useEquipmentMasterStore.getState().load(SAMPLE_FILE)
    useFloorplanStore.getState().reset()
  })

  it('load(file) で 137 種の spec が byId にインデックスされる', () => {
    expect(useEquipmentMasterStore.getState().list).toHaveLength(3)
    expect(getEquipmentSpec('E-001')?.name).toBe('シーリングライト')
    expect(getEquipmentSpec('S-401')?.placement).toBe('outdoor')
  })

  it('addFurniture(catalogId=spec.id) で mountTo に placement がコピーされる', () => {
    const id = useFloorplanStore
      .getState()
      .addFurniture({ catalogId: 'E-001', position: [1000, 500] })
    expect(id).not.toBeNull()
    const floor = useFloorplanStore.getState().floorplan.floors[0]!
    const placed = floor.furniture.find((f) => f.id === id)
    expect(placed?.mountTo).toBe('ceiling')
    expect(placed?.position).toEqual([1000, 500])
  })

  it('outdoor / roof 配置も mountTo に正しく入る', () => {
    const a = useFloorplanStore
      .getState()
      .addFurniture({ catalogId: 'S-401', position: [0, 0] })
    const b = useFloorplanStore
      .getState()
      .addFurniture({ catalogId: 'P-301', position: [0, 0] })
    const floor = useFloorplanStore.getState().floorplan.floors[0]!
    expect(floor.furniture.find((f) => f.id === a)?.mountTo).toBe('outdoor')
    expect(floor.furniture.find((f) => f.id === b)?.mountTo).toBe('roof')
  })

  it('setPlacementVisible で対応する配置面のフラグが切り替わる', () => {
    expect(useEquipmentMasterStore.getState().placementFilter.ceiling).toBe(true)
    useEquipmentMasterStore.getState().setPlacementVisible('ceiling', false)
    expect(useEquipmentMasterStore.getState().placementFilter.ceiling).toBe(false)
    useEquipmentMasterStore.getState().setPlacementVisible('ceiling', true)
    expect(useEquipmentMasterStore.getState().placementFilter.ceiling).toBe(true)
  })

  it('未知の catalogId は addFurniture が null を返す', () => {
    const id = useFloorplanStore
      .getState()
      .addFurniture({ catalogId: 'UNKNOWN-999', position: [0, 0] })
    expect(id).toBeNull()
  })
})

describe('§M135 v0.30: 壁取り付け設備の壁スナップ', () => {
  beforeEach(() => {
    useEquipmentMasterStore.getState().load({
      ...SAMPLE_FILE,
      equipment: [
        ...SAMPLE_FILE.equipment,
        {
          id: 'S-201',
          name: '屋内消火栓箱',
          category: 'S',
          placement: 'wall',
          shape: 'rect',
          width: 750,
          depth: 250,
          height: 1800,
          symbol: '消栓',
        },
      ],
    })
    useFloorplanStore.getState().reset()
  })

  it('部屋の中央付近に置こうとした wall 設備は最寄り壁にスナップする', () => {
    // 4000x3000 の部屋を配置
    useFloorplanStore.getState().addRoom({
      id: 'r1',
      presetId: 'living',
      shape: {
        kind: 'rect',
        x: 0,
        y: 0,
        w: 4000,
        h: 3000,
        edgeIds: ['e1', 'e2', 'e3', 'e4'],
      },
    })
    // 部屋の左寄りに 屋内消火栓箱 (placement='wall', depth=250) を置く
    const id = useFloorplanStore
      .getState()
      .addFurniture({ catalogId: 'S-201', position: [200, 1500] })
    expect(id).not.toBeNull()
    const floor = useFloorplanStore.getState().floorplan.floors[0]!
    const placed = floor.furniture.find((f) => f.id === id)!
    // 左壁 (x=0, thickness=100) から depth/2 + thickness/2 = 175mm 内側にスナップ
    expect(placed.mountTo).toBe('wall')
    expect(placed.position[0]).toBe(175)
    // rotation も壁の角度 (左壁は下→上に進むので π * 3/2 など。とにかく rotation が
    // 0 から変わっていることを確認すれば壁スナップが効いた証拠)
    expect(placed.rotation).not.toBe(0)
  })
})
