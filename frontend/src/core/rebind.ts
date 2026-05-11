/**
 * §5.2 壁再生成時の Door / Window / WallFinish 再バインド。
 *
 * 設計書の優先順位:
 *   (a) 完全一致         : 新 EdgeKey が旧 edgeKey → wallId に存在
 *   (b) 片側一致 (外周→共有): 新 EdgeKey が長さ 2 で、いずれかの EdgeRef が旧片側インデックスにある
 *   (c) 片側一致 (共有→外周): 新 EdgeKey が長さ 1 で、その EdgeRef が旧片側インデックスにある
 *   (d) いずれも不一致     : 新 ID
 *
 * 重要: prev 側のインデックス化は **「変更を適用する前の Room.shape (prevRooms)」** で行う。
 * 呼び出し側が prevRooms を渡す責務を持つ。
 */

import type {
  Door,
  EdgeKey,
  EdgeRef,
  Room,
  Wall,
  WallFinish,
  Window,
} from '@/types'
import {
  edgeKeyOf,
  edgeKeyHash,
  edgeRefHash,
} from './edgeKey'

// ============================================================================
// rebindWalls
// ============================================================================

export type RebindReport = {
  /** newWalls (id 置換後) */
  walls: Wall[]
  /** prev wallId のうち新集合に出てこなかったもの */
  invalidatedWallIds: Set<string>
  /** 引き継いだ (旧 wallId, 新 wallId) のマッピング (片側フォールバック含む) */
  reused: Map<string, string> // newWallId -> reusedOldWallId
}

type IndexedPrev = {
  /** edgeKeyHash -> wallId */
  fullIndex: Map<string, string>
  /**
   * 片側 EdgeRef ハッシュ -> wallId のリスト。
   * 同じ片側 EdgeRef を持つ複数の wall が登場し得るので配列で持つ。
   */
  oneSidedIndex: Map<string, string[]>
}

/**
 * §5.2 再生成手順 1: prev 壁を 2 種類のインデックスにする。
 * `prevRooms` は **shape 更新前** のスナップショットを渡すこと。
 */
export function indexPrevWalls(prevWalls: readonly Wall[], prevRooms: readonly Room[]): IndexedPrev {
  const fullIndex = new Map<string, string>()
  const oneSidedIndex = new Map<string, string[]>()

  for (const w of prevWalls) {
    const key = edgeKeyOf(w, prevRooms)
    if (key == null) continue
    fullIndex.set(edgeKeyHash(key), w.id)
    for (const ref of key) {
      const refHash = edgeRefHash(ref)
      const list = oneSidedIndex.get(refHash) ?? []
      list.push(w.id)
      oneSidedIndex.set(refHash, list)
    }
  }
  return { fullIndex, oneSidedIndex }
}

/**
 * §5.2 再生成手順 3〜4: 新壁集合に旧 wallId を引き継ぐ。
 *
 * 戻り値の `walls` は **新しい id 配列** (引き継いだ wall は旧 id、引き継げないものは新 UUID)。
 * `invalidatedWallIds` は旧の中で完全に消えたもの。
 * `reused` は newWallId -> oldWallId のマップ (= 完全一致なら同一文字列、片側だけマッチなら旧 -> 新の対応関係)。
 */
export function rebindWalls(
  newWalls: readonly Wall[],
  newRooms: readonly Room[],
  prev: IndexedPrev,
  options: { newId?: () => string } = {},
): RebindReport {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const reused = new Map<string, string>()
  const consumed = new Set<string>() // 一度引き継いだ旧 wallId は再利用しない

  const finalWalls: Wall[] = newWalls.map((w) => {
    const key = edgeKeyOf(w, newRooms)
    if (key == null) {
      return { ...w, id: newId() }
    }

    // (a) 完全一致
    const fullHit = prev.fullIndex.get(edgeKeyHash(key))
    if (fullHit != null && !consumed.has(fullHit)) {
      consumed.add(fullHit)
      reused.set(fullHit, fullHit)
      return { ...w, id: fullHit }
    }

    // (b)/(c) 片側一致。新 key の各 EdgeRef を辞書順で評価し、最初に見つかったものを採用
    const sortedRefs = [...key].sort((a, b) => edgeRefHash(a).localeCompare(edgeRefHash(b)))
    for (const ref of sortedRefs) {
      const candidates = prev.oneSidedIndex.get(edgeRefHash(ref)) ?? []
      const available = candidates.find((id) => !consumed.has(id))
      if (available != null) {
        consumed.add(available)
        reused.set(available, available)
        return { ...w, id: available }
      }
    }

    // (d) 新規 ID
    return { ...w, id: newId() }
  })

  // 失効した旧 wallId
  const allPrevIds = new Set<string>()
  for (const id of prev.fullIndex.values()) allPrevIds.add(id)
  const invalidatedWallIds = new Set<string>()
  for (const id of allPrevIds) {
    if (!consumed.has(id)) invalidatedWallIds.add(id)
  }

  return { walls: finalWalls, invalidatedWallIds, reused }
}

// ============================================================================
// Door / Window / WallFinish 再バインド
// ============================================================================

export type EntityRebindReport = {
  doors: Door[]
  windows: Window[]
  wallFinishes: WallFinish[]
  /** 再バインド先がなく削除された Door / Window の id */
  removedDoorIds: string[]
  removedWindowIds: string[]
  /** Room.defaultWallMaterialId にフォールバックさせる WallFinish の wallId */
  fallbackWallFinishIds: string[]
}

/**
 * 旧 walls → 新 walls の wallId マッピングをもとに、Door/Window/WallFinish を更新する。
 *
 * 失効した wall を参照していた要素は:
 *  - Door / Window : 削除 (positionRatio は保持されるが参照先がないので消す)
 *  - WallFinish    : 削除 (呼び出し側で Room.defaultWallMaterialId にフォールバック)
 *
 * `wallIdMap` の意味: oldWallId -> newWallId
 * (rebindWalls の reused は newId が旧 id を引き継ぐので oldId -> oldId のマップになる。
 *  外周→共有の片側マッチ等で id が変わるケースは将来追加予定だが、Phase 1 では同一 id を使い回す)
 */
export function rebindReferences(args: {
  doors: readonly Door[]
  windows: readonly Window[]
  wallFinishes: readonly WallFinish[]
  /** 旧 wallId -> 新 wallId (引き継いだ場合は同じ id、失効した場合は undefined) */
  wallIdMap: ReadonlyMap<string, string>
  /** 失効した旧 wallId (`wallIdMap` に存在しないもの) */
  invalidatedWallIds: ReadonlySet<string>
}): EntityRebindReport {
  const removedDoorIds: string[] = []
  const removedWindowIds: string[] = []
  const fallbackWallFinishIds: string[] = []

  const doors: Door[] = []
  for (const d of args.doors) {
    if (args.invalidatedWallIds.has(d.wallId)) {
      removedDoorIds.push(d.id)
      continue
    }
    const mapped = args.wallIdMap.get(d.wallId)
    doors.push(mapped != null && mapped !== d.wallId ? { ...d, wallId: mapped } : d)
  }

  const windows: Window[] = []
  for (const w of args.windows) {
    if (args.invalidatedWallIds.has(w.wallId)) {
      removedWindowIds.push(w.id)
      continue
    }
    const mapped = args.wallIdMap.get(w.wallId)
    windows.push(mapped != null && mapped !== w.wallId ? { ...w, wallId: mapped } : w)
  }

  const wallFinishes: WallFinish[] = []
  for (const f of args.wallFinishes) {
    if (args.invalidatedWallIds.has(f.wallId)) {
      fallbackWallFinishIds.push(f.wallId)
      continue
    }
    const mapped = args.wallIdMap.get(f.wallId)
    wallFinishes.push(mapped != null && mapped !== f.wallId ? { ...f, wallId: mapped } : f)
  }

  return {
    doors,
    windows,
    wallFinishes,
    removedDoorIds,
    removedWindowIds,
    fallbackWallFinishIds,
  }
}

// ============================================================================
// 片側フォールバック付き wallIdMap 構築
// ============================================================================

/**
 * §5.2 再生成手順 5 のサポート: `rebindWalls` の reused (旧 -> 旧) と
 * 「失効した旧 wallId をどの新 wallId に再バインド試行するか」のヒントを混ぜて、
 * Door/Window/WallFinish 用の `wallIdMap` (oldId -> newId) を構築する。
 *
 * Phase 1 の単純ケースでは reused そのものが oldId -> oldId のマップなので
 * これだけで十分。Phase 2 で「id が新規発行された側に旧 EdgeRef を引き継ぐ」ケースが
 * 出てきたら、ここで wallIdMap を拡張する。
 */
export function buildWallIdMap(prev: IndexedPrev, report: RebindReport): {
  wallIdMap: Map<string, string>
  invalidatedWallIds: Set<string>
} {
  const wallIdMap = new Map<string, string>()
  for (const [oldId] of report.reused) {
    wallIdMap.set(oldId, oldId)
  }
  // prev に存在し、reused にいなかった id は失効
  const invalidated = new Set<string>()
  for (const oldId of prev.fullIndex.values()) {
    if (!wallIdMap.has(oldId)) invalidated.add(oldId)
  }
  return { wallIdMap, invalidatedWallIds: invalidated }
}

// Re-export for tests
export type { EdgeKey, EdgeRef }
