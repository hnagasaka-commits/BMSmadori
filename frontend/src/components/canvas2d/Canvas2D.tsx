/**
 * 2D メインキャンバス。Konva Stage を 1 つ、レイヤーをグリッド → 部屋 → 壁 の順で重ねる。
 *
 * Phase 1 はパン・ズーム最低限。スケール固定 (1mm = 0.1px、1m = 100px) で固定領域を確保する。
 * 本格的なズーム / 慣性パンは M3 後半 〜 Phase 2 で。
 */
import { useEffect, useRef, useState } from 'react'
import { Layer, Stage } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store/editorStore'
import {
  selectFloor,
  selectRooms,
  selectWalls,
  useFloorplanStore,
} from '@/store/floorplanStore'
import { OrientationCompass } from '@/components/editor/OrientationCompass'
import { ColumnMark } from './ColumnMark'
import { DoorMark } from './DoorMark'
import { DrawingPreview } from './DrawingPreview'
import { FurnitureMark } from './FurnitureMark'
import { GridLayer } from './GridLayer'
import { RoomResizeHandles } from './RoomResizeHandles'
import { pointsToPolygonShape, simplifyFreehandPath } from '@/core/drawing'
// §M91 v0.20: PipeSpaceMark 削除 (2D 上に PS の四角を出さない)
import { RoomShape } from './RoomShape'
import { WallLine } from './WallLine'
import { WindowMark } from './WindowMark'

// §M31: ワールド領域は無限。GridLayer がビュー範囲だけを描画するので
// 旧 WORLD_W / WORLD_H 定数は不要。

export function Canvas2D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const rooms = useFloorplanStore(selectRooms)
  const rawWalls = useFloorplanStore(selectWalls)
  const floor = useFloorplanStore(selectFloor)
  // §M30: 部屋由来の壁から hiddenWallIds を除き、freestandingWalls を末尾に連結
  const hiddenSet = new Set(floor?.hiddenWallIds ?? [])
  const visibleDerivedWalls = rawWalls.filter((w) => !hiddenSet.has(w.id))
  const freestanding = floor?.freestandingWalls ?? []
  const walls = [...visibleDerivedWalls, ...freestanding]
  // floor.windows は render 内で導出するので毎回新配列でも問題ない (selector ではない)。
  const windows = floor?.windows ?? []
  const wallById = new Map(walls.map((w) => [w.id, w]))
  const zoom = useEditorStore((s) => s.zoom)
  const pan = useEditorStore((s) => s.pan)
  const setPan = useEditorStore((s) => s.setPan)
  const gridSize = useEditorStore((s) => s.gridSize)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  useEffect(() => {
    if (containerRef.current == null) return
    const el = containerRef.current
    const observer = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    observer.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => observer.disconnect()
  }, [])

  // Stage インスタンスを editorStore に登録 (PDF/PNG 出力で使う)
  useEffect(() => {
    if (stageRef.current == null) return
    useEditorStore.getState().setStage(stageRef.current)
    return () => {
      useEditorStore.getState().setStage(null)
    }
  }, [size.w, size.h])

  /**
   * §M29 Phase 3: 新しい階 (新しいプラン or 階切替) に切り替わったときだけ
   * 自動でビューポート中央にフィットさせる。同じ階内の編集では再フィットしない
   * (ユーザーがズームやパンしている可能性があるため)。
   */
  const fittedForFloorIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return
    if (floor == null) return
    if (fittedForFloorIdRef.current === floor.id) return
    fittedForFloorIdRef.current = floor.id

    // 部屋がなければ AABB は null (= 既定 zoom/pan にリセット)
    if (rooms.length === 0) {
      useEditorStore.getState().fitToContent({ w: size.w, h: size.h }, null)
      return
    }
    // 全部屋の AABB を取る (回転後の AABB を簡易にして minX/Y/maxX/Y で集計)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of rooms) {
      if (r.shape.kind === 'rect') {
        minX = Math.min(minX, r.shape.x)
        minY = Math.min(minY, r.shape.y)
        maxX = Math.max(maxX, r.shape.x + r.shape.w)
        maxY = Math.max(maxY, r.shape.y + r.shape.h)
      } else if (r.shape.kind === 'polygon') {
        for (const [px, py] of r.shape.points) {
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
        }
      }
    }
    if (!Number.isFinite(minX)) return
    useEditorStore.getState().fitToContent(
      { w: size.w, h: size.h },
      { minX, minY, maxX, maxY },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor?.id, size.w, size.h])

  const tool = useEditorStore((s) => s.tool)
  const selected = useEditorStore((s) => s.selected)
  // §M26: 選択中の rect 部屋がある場合のみリサイズハンドルを描画する
  const selectedRoom =
    selected?.kind === 'room' ? rooms.find((r) => r.id === selected.id) : undefined

  /**
   * §M33 Phase 3: ホイール / ピンチでカーソル位置を基準にズーム。
   *
   * 仕様:
   *  - Ctrl/⌘ または macOS ピンチ (=Ctrl が立つ) でズーム
   *  - カーソル位置のワールド座標が固定されるよう pan も同時に補正
   *  - クランプ後にズームが変わらなかった場合は pan を変えない
   *
   * 計算:
   *   worldX = (sx - pan.x) / zoom              (旧ズーム)
   *   pan'.x = sx - worldX * zoom'              (新ズームでも cursor を固定)
   */
  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const editor = useEditorStore.getState()
    const oldZoom = editor.zoom
    const oldPan = editor.pan
    const factor = Math.exp(-e.deltaY * 0.003) // §M58 v0.8: 係数 0.001 → 0.003 で感度約 2.6×
    const rawNext = oldZoom * factor
    // クランプ前後で差分が無い (上下限) なら pan も触らない
    const nextZoom = Math.max(0.02, Math.min(0.5, rawNext))
    if (Math.abs(nextZoom - oldZoom) < 1e-6) return
    // カーソル位置 (canvas-relative px) を計算
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    // 旧ズームでのワールド座標
    const worldX = (sx - oldPan.x) / oldZoom
    const worldY = (sy - oldPan.y) / oldZoom
    // 新ズームでカーソル位置のワールド座標が変わらないよう pan を再計算
    const nextPan = {
      x: sx - worldX * nextZoom,
      y: sy - worldY * nextZoom,
    }
    editor.setZoom(nextZoom)
    editor.setPan(nextPan)
  }

  /**
   * §M28 Phase 3: 描画モードはドラッグフリーハンド。
   * - mousedown : ドラッグ開始、最初の点を確定して描画バッファを開始
   * - mousemove : ドラッグ中なら raw 点を追加 (軸並行化はしない、生のパスを記録)
   * - mouseup   : ドラッグ終了 → simplifyFreehandPath で軸並行ポリラインに圧縮
   *              → pointsToPolygonShape で polygon Shape に変換 → addRoom
   *
   * 制約 (PoC):
   * - 単一ストロークで閉図形を意図 (drag リリース時点で自動的に閉じる)
   * - 自動直線化はリリース時に一括適用するので、ドラッグ中はゴーストプレビューだけ追従
   */
  const isDraggingDrawRef = useRef(false)
  // §M30: 壁ドラッグ用の状態 (start 点を保持し、move で preview を出す)
  const wallDragStartRef = useRef<readonly [number, number] | null>(null)
  // §M55 v0.7: 壁ツールのスナップは gridSize (910mm = 半間) では粗いため、専用の細かい
  // ステップを使う。50mm = メーター/20、半間/18 相当で、自由な長さを刻める
  const WALL_DRAW_GRID_MM = 50

  function stageToWorldMm(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): readonly [number, number] | null {
    const stage = e.target.getStage()
    if (stage == null) return null
    // §M31 fix: getPointerPosition は Stage の transform (x/y) を考慮しない生のコンテナ座標を返す。
    // 我々は Stage に pan ({x,y}) を適用しているので、screen = pan + world*zoom の逆変換が必要。
    //   world = (screen - pan) / zoom
    // getRelativePointerPosition() は Stage の transform を反映して返してくれるので、
    // それを使えばあと zoom で割るだけになる。
    const pointer = stage.getRelativePointerPosition()
    if (pointer == null) return null
    return [pointer.x / zoom, pointer.y / zoom]
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const world = stageToWorldMm(e)
    if (tool === 'draw') {
      if (world == null) return
      isDraggingDrawRef.current = true
      useEditorStore.getState().startDrawing(world)
      return
    }
    if (tool === 'wall') {
      // §M30: 壁ツールはドラッグで 1 本の自立壁を描く
      if (world == null) return
      wallDragStartRef.current = snapToGridMm(world, WALL_DRAW_GRID_MM)
      // プレビューにも記録する (drawing バッファ流用: points = [start, cursor])
      useEditorStore.getState().startDrawing(wallDragStartRef.current)
      return
    }
    if (e.target === e.target.getStage()) clearSelection()
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const world = stageToWorldMm(e)
    if (world == null) return
    const editor = useEditorStore.getState()
    if (tool === 'draw' && isDraggingDrawRef.current) {
      editor.addDrawPoint(world)
      return
    }
    if (tool === 'wall' && wallDragStartRef.current != null) {
      // 壁: start から world への線を軸並行化してプレビュー
      const start = wallDragStartRef.current
      const end = snapToGridMm(axisAlign(start, world), WALL_DRAW_GRID_MM)
      // drawing.points = [start, end] でプレビュー
      editor.startDrawing(start)
      editor.addDrawPoint(end)
      return
    }
    if (tool === 'draw') editor.moveDrawCursor(world)
  }

  function handleStageMouseUp() {
    const editor = useEditorStore.getState()
    if (tool === 'draw' && isDraggingDrawRef.current) {
      isDraggingDrawRef.current = false
      const raw = editor.finishDrawing()
      if (raw == null || raw.length < 4) return
      const simplified = simplifyFreehandPath(raw, gridSize)
      if (simplified.length < 3) return
      const polygon = pointsToPolygonShape(simplified, () => crypto.randomUUID())
      if (polygon == null) {
        window.alert(
          '描いたパスが部屋として認識できませんでした (3 辺以上の閉じた図形が必要です)',
        )
        return
      }
      const ok = useFloorplanStore
        .getState()
        .addRoom({ presetId: 'living', shape: polygon })
      if (!ok) {
        window.alert('描いた図形が既存の部屋と重なるため追加できませんでした')
        return
      }
      editor.setTool('select')
      return
    }
    if (tool === 'wall' && wallDragStartRef.current != null) {
      const start = wallDragStartRef.current
      const buffered = editor.finishDrawing()
      wallDragStartRef.current = null
      const end = buffered?.[buffered.length - 1] ?? null
      if (end == null) return
      const dx = Math.abs(end[0] - start[0])
      const dy = Math.abs(end[1] - start[1])
      if (dx < 100 && dy < 100) return // 100mm 未満は捨てる
      const newId = useFloorplanStore.getState().addFreestandingWall({
        from: start,
        to: end,
        wallType: 'partition',
      })
      if (newId != null) {
        useEditorStore.getState().select({ kind: 'wall', id: newId })
      }
    }
  }

  function snapToGridMm(p: readonly [number, number], g: number): readonly [number, number] {
    return [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g]
  }
  function axisAlign(prev: readonly [number, number], cand: readonly [number, number]): readonly [number, number] {
    const dx = Math.abs(cand[0] - prev[0])
    const dy = Math.abs(cand[1] - prev[1])
    return dx >= dy ? [cand[0], prev[1]] : [prev[0], cand[1]]
  }

  return (
    <div
      ref={containerRef}
      className="editor-canvas"
      data-testid="canvas-2d"
      onWheel={handleWheel}
      style={
        tool === 'window' || tool === 'door' || tool === 'draw' || tool === 'wall'
          ? { cursor: 'crosshair' }
          : tool === 'select'
            ? { cursor: 'grab' }
            : undefined
      }
    >
      <OrientationCompass />
      {size.w > 0 && size.h > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          x={pan.x}
          y={pan.y}
          // §M49 v0.5: select ツール時のみ Stage 自体を draggable に。
          // 子要素 (Room/Wall/Furniture/Handle) は自身が draggable なので Konva の
          // 階層 hit-test で子のドラッグが優先される → 既存挙動と非干渉。
          draggable={tool === 'select'}
          onDragMove={(e) => {
            // ドラッグ中は editorStore.pan も同期 (GridLayer の可視域計算に必要)
            const stage = e.target
            if (stage === e.target.getStage()) {
              setPan({ x: stage.x(), y: stage.y() })
            }
          }}
          onDragEnd={(e) => {
            const stage = e.target
            if (stage === e.target.getStage()) {
              setPan({ x: stage.x(), y: stage.y() })
            }
          }}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onTouchStart={handleStageMouseDown}
          onTouchMove={handleStageMouseMove}
          onTouchEnd={handleStageMouseUp}
        >
          <GridLayer
            canvasSize={size}
            pan={pan}
            scale={zoom}
            gridSize={gridSize}
          />
          <Layer>
            {rooms.map((r) => (
              <RoomShape key={r.id} room={r} scale={zoom} gridSize={gridSize} />
            ))}
          </Layer>
          <Layer>
            {walls.map((w) => (
              <WallLine key={w.id} wall={w} scale={zoom} />
            ))}
          </Layer>
          <Layer>
            {(floor?.doors ?? []).map((d) => {
              const wall = wallById.get(d.wallId)
              if (wall == null) return null
              return <DoorMark key={d.id} door={d} wall={wall} scale={zoom} />
            })}
          </Layer>
          <Layer>
            {windows.map((win) => {
              const wall = wallById.get(win.wallId)
              if (wall == null) return null
              return <WindowMark key={win.id} window={win} wall={wall} scale={zoom} />
            })}
          </Layer>
          <Layer>
            {/* §M20: 柱はクリック選択するため listening:true。
                §M25: 家具は同レイヤーではなく上に重ねる (家具は柱より上位レイヤー) */}
            {(floor?.columns ?? []).map((c) => (
              <ColumnMark key={c.id} column={c} scale={zoom} />
            ))}
          </Layer>
          {/* §M91 v0.20: PipeSpaceMark (2D の四角) は UI 上不要というユーザー要望で撤去。
              データ (floor.pipeSpaces) は引き続き残るが 2D には描画しない */}
          <Layer>
            {/* §M25 家具: 部屋・壁よりも上に描いてドラッグ可 */}
            {(floor?.furniture ?? []).map((f) => (
              <FurnitureMark
                key={f.id}
                furniture={f}
                scale={zoom}
                gridSize={gridSize}
              />
            ))}
          </Layer>
          <Layer>
            {/* §M26 リサイズハンドル: 選択中の rect 部屋にだけ表示
                §M54 v0.7: select ツール中のみ表示 (壁/描画ツール時の誤操作を防ぐ) */}
            {tool === 'select' && selectedRoom != null && (
              <RoomResizeHandles
                room={selectedRoom}
                scale={zoom}
                gridSize={gridSize}
              />
            )}
          </Layer>
          <Layer listening={false}>
            {/* §M27 描画ライブプレビュー */}
            <DrawingPreview scale={zoom} />
          </Layer>
        </Stage>
      )}
    </div>
  )
}
