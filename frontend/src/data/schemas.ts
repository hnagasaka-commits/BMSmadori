/**
 * §5.1.2 Zod スキーマ。
 *
 * 用途別に 3 つ用意する (§M17 比較表参照):
 *   - FloorplanSchema           : 通常の読み書き。strict + superRefine で Phase 不変条件
 *   - TolerantFloorplanSchema   : readonly モードのローダー。looseObject / 任意 version
 *   - SafeFloorplanSchema       : readonly の描画段で要素ごとに safeParse する用
 */

import { z } from 'zod'
import type { CurrentPhase } from '@/types'
import { CURRENT_PHASE } from '@/types'

// ============================================================================
// 共通: union / プリミティブ
// ============================================================================

const SchemaVersionLiteral = z.union([z.literal('1.0'), z.literal('1.1'), z.literal('1.2')])

const BuildingTypeSchema = z.enum([
  'single-family',
  'condo-unit',
  'apartment-unit',
  'hotel',
  'office',
  'retail',
  'mixed',
])

const TemplateLicenseSchema = z.enum([
  'CC0',
  'CC-BY',
  'MIT',
  'original',
  'reference-only',
])

const PipeSystemSchema = z.enum([
  'water-supply',
  'drainage',
  'gas',
  'vent',
  'electrical',
])

const WallTypeSchema = z.enum([
  'exterior',
  'load-bearing',
  'shared',
  'partition',
  'non-bearing',
])

const DoorTypeSchema = z.enum([
  'single-swing',
  'double-swing',
  'sliding',
  'folding',
  'opening',
])

const WindowTypeSchema = z.enum([
  'fixed',
  'sliding-2',
  'sliding-4',
  'casement',
  'bay',
])

const ComplianceSeveritySchema = z.enum(['warning', 'info'])
const ComplianceCategorySchema = z.enum([
  'lighting',
  'ventilation',
  'circulation',
  'fire-egress',
  'structure',
  'equipment',
  'adjacency',
])

const PointSchema = z.tuple([z.number(), z.number()])
const SizeSchema = z.object({ w: z.number().positive(), h: z.number().positive() })

// ============================================================================
// §5.2.1 Shape
// ============================================================================

const RectShapeSchema = z.object({
  kind: z.literal('rect'),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  edgeIds: z.tuple([z.string(), z.string(), z.string(), z.string()]),
})

const PolygonShapeSchema = z.object({
  kind: z.literal('polygon'),
  points: z.array(PointSchema).min(3),
  edgeIds: z.array(z.string()).min(3),
}).refine((s) => s.edgeIds.length === s.points.length, {
  message: 'polygon.edgeIds.length は points.length と一致する必要があります',
  path: ['edgeIds'],
})

const ShapeSchema = z.union([RectShapeSchema, PolygonShapeSchema])

// ============================================================================
// §5.2.1 サブ型 (FurnitureInstance / HumanModel / Void)
// ============================================================================

const FurnitureInstanceSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  position: PointSchema,
  rotation: z.number(),
  scale: z.number().positive().optional(),
})

const HumanModelSchema = z.object({
  id: z.string(),
  position: PointSchema,
  rotation: z.number(),
  height: z.number().positive(),
})

const VoidSchema = z.object({
  id: z.string(),
  shape: ShapeSchema,
  fromLevel: z.number().int(),
  toLevel: z.number().int(),
})

// ============================================================================
// §5.2 EdgeRef / EdgeKey / AutoDoorSuppression
// ============================================================================

const EdgeRefSchema = z.object({
  roomId: z.string(),
  edgeId: z.string(),
})

const AutoDoorSuppressionSchema = z.object({
  edgeKey: z.tuple([EdgeRefSchema, EdgeRefSchema]),
  removedAt: z.string(),
})

// ============================================================================
// §5.3 Wall
// ============================================================================

const WallSchema = z.object({
  id: z.string(),
  from: PointSchema,
  to: PointSchema,
  thickness: z.number().positive(),
  wallType: WallTypeSchema,
  isLocked: z.boolean(),
  sharedBy: z.array(z.string()).max(2),
  height: z.number().positive().optional(),
})

// ============================================================================
// §5.4 Column / §5.5 PipeSpace
// ============================================================================

const ColumnSchema = z.object({
  id: z.string(),
  position: PointSchema,
  size: SizeSchema,
  isLocked: z.boolean(),
  loadBearing: z.boolean(),
})

const PipeSpaceSchema = z.object({
  id: z.string(),
  position: PointSchema,
  size: SizeSchema,
  systems: z.array(PipeSystemSchema),
  isLocked: z.boolean(),
})

// ============================================================================
// §5.6 Room
// ============================================================================

const RoomSchema = z.object({
  id: z.string(),
  presetId: z.string(),
  customName: z.string().optional(),
  shape: ShapeSchema,
  rotation: z.number(),
  equipmentOverride: z
    .object({
      requiresPipeSpace: z.boolean().optional(),
    })
    .optional(),
})

// ============================================================================
// §5.7 Door / §5.8 Window
// ============================================================================

const DoorSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  positionRatio: z.number().min(0).max(1),
  width: z.number().positive(),
  type: DoorTypeSchema,
  swingDirection: z.enum(['left', 'right']).optional(),
  swingTo: z.string().optional(),
  // §M43 v0.3
  swingInward: z.boolean().optional(),
})

const WindowSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  positionRatio: z.number().min(0).max(1),
  sashId: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  type: WindowTypeSchema,
  sillHeight: z.number().min(0),
})

// ============================================================================
// §5.10 仕上げ材
// ============================================================================

const RoomFinishSchema = z.object({
  roomId: z.string(),
  floorMaterialId: z.string().optional(),
  ceilingMaterialId: z.string().optional(),
  defaultWallMaterialId: z.string().optional(),
})

const WallFinishSchema = z.object({
  wallId: z.string(),
  side: z.enum(['inside', 'outside']),
  materialId: z.string(),
})

const CurtainStyleSchema = z.object({
  type: z.enum(['drape', 'lace', 'blind', 'roll']),
  color: z.string(),
})

const WindowDecorationSchema = z.object({
  windowId: z.string(),
  curtain: CurtainStyleSchema.optional(),
})

const DoorDecorationSchema = z.object({
  doorId: z.string(),
  styleId: z.string().optional(),
})

// ============================================================================
// §5.2 Floor (集約)
// ============================================================================

const FloorSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  name: z.string(),
  ceilingHeight: z.number().positive(),
  rooms: z.array(RoomSchema),
  walls: z.array(WallSchema),
  doors: z.array(DoorSchema),
  windows: z.array(WindowSchema),
  columns: z.array(ColumnSchema),
  pipeSpaces: z.array(PipeSpaceSchema),
  furniture: z.array(FurnitureInstanceSchema),
  humanModels: z.array(HumanModelSchema),
  voids: z.array(VoidSchema),
  roomFinishes: z.array(RoomFinishSchema),
  wallFinishes: z.array(WallFinishSchema),
  windowDecorations: z.array(WindowDecorationSchema),
  doorDecorations: z.array(DoorDecorationSchema),
  suppressedAutoDoors: z.array(AutoDoorSuppressionSchema),
  // §M30 Phase 3: optional - 部屋に紐づかない自立壁と、非表示扱いの壁 id
  freestandingWalls: z.array(WallSchema).optional(),
  hiddenWallIds: z.array(z.string()).optional(),
})

// ============================================================================
// §5.1 Floorplan
// ============================================================================

const TemplateMetadataSchema = z.object({
  id: z.string(),
  version: z.string(),
  description: z.string(),
  thumbnail: z.string().optional(),
  license: TemplateLicenseSchema,
  designer: z.string().optional(),
  area: z.number().nonnegative(),
  bedrooms: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()),
  recommendedBuildingType: BuildingTypeSchema.optional(),
})

const FloorplanMetadataSchema = z.object({
  name: z.string(),
  buildingType: BuildingTypeSchema,
  unit: z.literal('mm'),
  gridSize: z.number().positive(),
  orientation: z.number().min(0).max(359),
  siteArea: z.number().positive().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  template: TemplateMetadataSchema.optional(),
  acknowledgedWarnings: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
  templateOrigin: z
    .object({
      templateId: z.string(),
      templateVersion: z.string(),
    })
    .optional(),
})

const BuildingPropertiesSchema = z.object({
  structureType: z.enum(['wood', 'steel', 'rc', 'src']),
  isExistingBuilding: z.boolean(),
})

/**
 * Phase 不変条件を superRefine で検査する。
 * Phase 1   : floors.length === 1、columns/pipeSpaces/furniture/humanModels/voids すべて空
 * Phase 1.5 : floors.length === 1、furniture/humanModels/voids 空
 * Phase 2   : floors.length === 1、voids 空 (複数階は Phase 3 で解放)
 * Phase 3   : floors.length 1〜3、制約なし
 */
const PHASE_FORBIDDEN_KEYS: Record<CurrentPhase, ReadonlyArray<keyof z.infer<typeof FloorSchema>>> = {
  '1': ['columns', 'pipeSpaces', 'furniture', 'humanModels', 'voids'],
  '1.5': ['furniture', 'humanModels', 'voids'],
  '2': ['voids'],
  '3': [],
}

const PHASE_FLOORS_RANGE: Record<CurrentPhase, { min: number; max: number }> = {
  '1': { min: 1, max: 1 },
  '1.5': { min: 1, max: 1 },
  '2': { min: 1, max: 1 },
  '3': { min: 1, max: 3 },
}

/**
 * 通常モードの正本スキーマ。Phase 不変条件を superRefine で強制。
 */
export const FloorplanSchema = z
  .object({
    version: SchemaVersionLiteral,
    metadata: FloorplanMetadataSchema,
    floors: z.array(FloorSchema).min(1),
    building: BuildingPropertiesSchema,
  })
  .superRefine((plan, ctx) => {
    const range = PHASE_FLOORS_RANGE[CURRENT_PHASE]
    if (plan.floors.length < range.min || plan.floors.length > range.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['floors'],
        message: `Phase ${CURRENT_PHASE} では floors.length は ${range.min}〜${range.max} です (§11)`,
      })
    }

    const forbidden = PHASE_FORBIDDEN_KEYS[CURRENT_PHASE]
    for (const [i, f] of plan.floors.entries()) {
      for (const k of forbidden) {
        const arr = f[k] as unknown[]
        if (arr.length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['floors', i, k],
            message: `Phase ${CURRENT_PHASE} では ${k} は空配列でなければなりません (§11)`,
          })
        }
      }
    }
  })

// ============================================================================
// TolerantFloorplanSchema (readonly モードのローダー用)
// ============================================================================

/**
 * §M17 復旧プレビューのローダー段で使う寛容スキーマ。
 * 「形が大きく崩れていなければ通す」が目的。version は任意文字列、各フィールドは shape ゆるめ。
 */
export const TolerantFloorplanSchema = z.looseObject({
  version: z.string(),
  metadata: z.looseObject({ name: z.string().optional() }),
  floors: z.array(
    z.looseObject({
      id: z.string(),
      rooms: z.array(z.unknown()),
    }),
  ),
  building: z.unknown(),
})

// ============================================================================
// SafeFloorplanSchema (readonly モードの描画段で要素ごとに safeParse)
// ============================================================================

/**
 * §M17 復旧プレビューの薄いオーバーレイ描画専用。
 * 要素単位の `safeParse` を要素配列に対して回し、success のものだけ renderer に渡す。
 *
 * `FloorplanSchema` をそのまま流用すると `superRefine` の Phase 不変条件で落ちるため、
 * renderer が必要とする最小フィールドだけを採用する (passthrough で将来フィールドを残す)。
 */
export const SafeFloorplanSchema = {
  plan: z.looseObject({
    version: z.string(),
    floors: z.array(z.unknown()).min(1),
  }),

  room: z.looseObject({
    id: z.string(),
    shape: z.union([
      z.looseObject({
        kind: z.literal('rect'),
        x: z.number(),
        y: z.number(),
        w: z.number().positive(),
        h: z.number().positive(),
      }),
      z.looseObject({
        kind: z.literal('polygon'),
        points: z.array(z.tuple([z.number(), z.number()])).min(3),
      }),
    ]),
    rotation: z.number().optional(),
    presetId: z.string().optional(),
  }),

  wall: z.looseObject({
    id: z.string(),
    from: z.tuple([z.number(), z.number()]),
    to: z.tuple([z.number(), z.number()]),
    thickness: z.number().positive().optional(),
    wallType: z.string().optional(),
  }),

  door: z.looseObject({
    id: z.string(),
    wallId: z.string(),
    positionRatio: z.number().min(0).max(1),
    width: z.number().positive().optional(),
  }),

  window: z.looseObject({
    id: z.string(),
    wallId: z.string(),
    positionRatio: z.number().min(0).max(1),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
}

// ============================================================================
// 個別 export (テストや他モジュールから使う)
// ============================================================================

export {
  FloorSchema,
  FloorplanMetadataSchema,
  BuildingPropertiesSchema,
  TemplateMetadataSchema,
  RoomSchema,
  WallSchema,
  DoorSchema,
  WindowSchema,
  ShapeSchema,
  ColumnSchema,
  PipeSpaceSchema,
  ComplianceSeveritySchema,
  ComplianceCategorySchema,
}

// 警告: ComplianceWarning は読み書き対象だが、Floorplan のフィールドではなく
// ack 管理は metadata.acknowledgedWarnings (string[]) 経由。型は types に定義済。
export const ComplianceWarningSchema = z.object({
  id: z.string(),
  severity: ComplianceSeveritySchema,
  category: ComplianceCategorySchema,
  affectedRoomIds: z.array(z.string()).optional(),
  affectedWallIds: z.array(z.string()).optional(),
  message: z.string(),
  suggestion: z.string().optional(),
  rule: z.string(),
})

/** Zod 推論結果を export(型と Zod スキーマの一貫性チェックに使う) */
export type FloorplanInferred = z.infer<typeof FloorplanSchema>
