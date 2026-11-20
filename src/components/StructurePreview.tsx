'use client'

import { Canvas, ThreeEvent, invalidate, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  FOOT,
  feetToFtIn,
  getEffectiveRoofStyle,
  getFoundationInfo,
  getWallHeightFeet,
  type DoorSpec,
  type RoofStyle,
  type Side,
  type StructurePreviewParams,
  type VisualExtras,
  type WindowSpec
} from '@/components/structure-preview/types'
import ShedBuilderModel from '@/components/structure-preview/ShedBuilderModel'
import SceneEnvironment from '@/components/structure-preview/SceneEnvironment'
import CameraFit from '@/components/structure-preview/CameraFit'
import {
  SCENE_BACKGROUND,
  SCENE_FOG_ARGS,
  SCENE_GL,
  SCENE_SHADOWS,
  getSceneFootprint
} from '@/components/structure-preview/sceneConfig'
import {
  DoorPanel,
  GableVent,
  WindowPanel,
  type ShedFrame
} from '@/components/structure-preview/featureVisuals'
import {
  DoorOpen,
  PanelsTopLeft,
  Ruler,
  Sparkles,
  Trash2,
  AppWindow as WindowIcon
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { maxWindowHeightFromFloor } from '@/lib/quoteVisualPlacement'

export type { RoofStyle, DoorSpec, WindowSpec, VisualExtras } from '@/components/structure-preview/types'

export type StructurePreviewProps = {
  params: StructurePreviewParams
  onChangeFeatures?: (next: { doors: DoorSpec[]; windows: WindowSpec[] }) => void
  editMode?: boolean
  showFeatureControls?: boolean
  syncFeaturesFromProps?: boolean
  /** R3F render loop. Omitted = 'demand' (redraw on changes); 'never' pauses an off-screen preview. */
  frameloop?: 'always' | 'demand' | 'never'
  /** Upper bound of the device pixel ratio range. Omitted = 2. */
  maxDpr?: number
  /** Called once the first frame is on screen (keep it stable, e.g. useCallback). */
  onFirstFrame?: () => void
}

type SelectedFeature = { kind: 'door'; value: DoorSpec } | { kind: 'window'; value: WindowSpec }

const SIDES: Side[] = ['front', 'back', 'left', 'right']

const roofLabels: Record<RoofStyle, string> = {
  gabled: 'Gable roof',
  barn: 'Gambrel roof',
  'lean-to': 'Lean-to roof'
}

function formatSide(side: Side) {
  return side.charAt(0).toUpperCase() + side.slice(1)
}

function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function snapToInches(meters: number, inches = 3) {
  const inchM = 0.0254
  const step = inchM * inches
  return Math.round(meters / step) * step
}

function getDefaultDoorHeight(wallHeightFeet: number) {
  return wallHeightFeet >= 7 ? 6.75 : 5.75
}

function planeForSide(side: Side, length: number, width: number) {
  const plane = new THREE.Plane()
  if (side === 'front') {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, width / 2))
  } else if (side === 'back') {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -width / 2))
  } else if (side === 'left') {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-length / 2, 0, 0))
  } else {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(length / 2, 0, 0))
  }
  return plane
}

function worldToAlongOffset(side: Side, p: THREE.Vector3) {
  if (side === 'front') return p.x
  if (side === 'back') return -p.x
  if (side === 'left') return p.z
  return -p.z
}

function clampAlongOffset(
  side: Side,
  shed: { length: number; width: number },
  featureWidthMeters: number,
  along: number
) {
  const halfW = featureWidthMeters / 2
  const margin = 0.03
  if (side === 'front' || side === 'back') {
    const min = -shed.length / 2 + halfW + margin
    const max = shed.length / 2 - halfW - margin
    return clamp(along, min, max)
  }
  const min = -shed.width / 2 + halfW + margin
  const max = shed.width / 2 - halfW - margin
  return clamp(along, min, max)
}

function sideSpanMeters(side: Side, shed: { length: number; width: number }) {
  return side === 'front' || side === 'back' ? shed.length : shed.width
}

function findWallHit(
  ray: THREE.Ray,
  shed: ShedFrame
): { side: Side; point: THREE.Vector3; distance: number } | null {
  const candidates = SIDES.flatMap((side) => {
    const point = new THREE.Vector3()
    if (!ray.intersectPlane(planeForSide(side, shed.length, shed.width), point)) return []

    const span = sideSpanMeters(side, shed)
    const along = worldToAlongOffset(side, point)
    const sideTolerance = 0.35
    const verticalTolerance = 0.45
    if (along < -span / 2 - sideTolerance || along > span / 2 + sideTolerance) return []
    if (point.y < shed.floorY - verticalTolerance || point.y > shed.floorY + shed.wall + verticalTolerance) return []

    return [
      {
        side,
        point,
        distance: ray.origin.distanceTo(point)
      }
    ]
  })

  return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null
}

function capturePointer(e: ThreeEvent<PointerEvent>) {
  const target = e.target as EventTarget & {
    setPointerCapture?: (pointerId: number) => void
  }
  target.setPointerCapture?.(e.pointerId)
}

function releasePointer(e: ThreeEvent<PointerEvent>) {
  const target = e.target as EventTarget & {
    releasePointerCapture?: (pointerId: number) => void
  }
  target.releasePointerCapture?.(e.pointerId)
}




function MovableDoor({
  shed,
  value,
  onChange,
  trimColor,
  wallColor,
  showRamp,
  showSteps,
  setOrbitEnabled,
  selected,
  onSelect,
  edit
}: {
  shed: ShedFrame
  value: DoorSpec
  onChange: (next: DoorSpec) => void
  trimColor: string
  wallColor: string
  showRamp: boolean
  showSteps: boolean
  setOrbitEnabled: (v: boolean) => void
  selected: boolean
  onSelect: () => void
  edit: boolean
}) {
  const dragging = useRef(false)
  const dragStart = useRef<{ side: Side; deltaAlong: number } | null>(null)

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!edit) return
    e.stopPropagation()
    capturePointer(e)
    onSelect()
    dragging.current = true
    setOrbitEnabled(false)
    const hit = findWallHit(e.ray, shed)
    const side = hit?.side ?? value.side
    const along = hit ? worldToAlongOffset(side, hit.point) : value.offset * FOOT
    dragStart.current = {
      side,
      deltaAlong: along - value.offset * FOOT
    }
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!edit || !dragging.current) return
    e.stopPropagation()
    const hit = findWallHit(e.ray, shed)
    if (!hit) return

    const featureWidth = value.width * FOOT
    const rawAlong = hit.side === dragStart.current?.side
      ? worldToAlongOffset(hit.side, hit.point) - dragStart.current.deltaAlong
      : worldToAlongOffset(hit.side, hit.point)
    const clampedAlong = clampAlongOffset(hit.side, shed, featureWidth, rawAlong)
    const nextFeet = snapToInches(clampedAlong) / FOOT
    onChange({ ...value, side: hit.side, offset: nextFeet, placement: 'custom' })
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!edit) return
    e.stopPropagation()
    releasePointer(e)
    dragging.current = false
    dragStart.current = null
    setOrbitEnabled(true)
  }

  return (
    <group onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <DoorPanel
        shed={shed}
        door={value}
        trimColor={trimColor}
        wallColor={wallColor}
        selected={selected}
        showRamp={showRamp}
        showSteps={showSteps}
      />
    </group>
  )
}

function MovableWindow({
  shed,
  value,
  onChange,
  trimColor,
  setOrbitEnabled,
  selected,
  onSelect,
  edit
}: {
  shed: ShedFrame
  value: WindowSpec
  onChange: (next: WindowSpec) => void
  trimColor: string
  setOrbitEnabled: (v: boolean) => void
  selected: boolean
  onSelect: () => void
  edit: boolean
}) {
  const dragging = useRef(false)
  const dragStart = useRef<{ side: Side; deltaAlong: number; deltaY: number } | null>(
    null
  )

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!edit) return
    e.stopPropagation()
    capturePointer(e)
    onSelect()
    dragging.current = true
    setOrbitEnabled(false)
    const hit = findWallHit(e.ray, shed)
    const side = hit?.side ?? value.side
    const along = hit ? worldToAlongOffset(side, hit.point) : value.offset * FOOT
    // world-space center: features render inside a group raised by floorY
    const centerY = shed.floorY + value.heightFromFloor * FOOT + (value.height * FOOT) / 2
    dragStart.current = {
      side,
      deltaAlong: along - value.offset * FOOT,
      deltaY: (hit?.point.y ?? centerY) - centerY
    }
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!edit || !dragging.current) return
    e.stopPropagation()
    const hit = findWallHit(e.ray, shed)
    if (!hit) return

    const featureWidth = value.width * FOOT
    const rawAlong = hit.side === dragStart.current?.side
      ? worldToAlongOffset(hit.side, hit.point) - dragStart.current.deltaAlong
      : worldToAlongOffset(hit.side, hit.point)
    const clampedAlong = clampAlongOffset(hit.side, shed, featureWidth, rawAlong)
    const yMin = 0.2
    const yMax = maxWindowHeightFromFloor(shed.wall / FOOT, value.height) * FOOT
    const nextCenterY = clamp(
      hit.point.y - (dragStart.current?.deltaY ?? 0),
      shed.floorY + yMin + (value.height * FOOT) / 2,
      shed.floorY + yMax + (value.height * FOOT) / 2
    )
    const nextOffsetFeet = snapToInches(clampedAlong) / FOOT
    const nextHeightFromFloorFeet =
      snapToInches(nextCenterY - shed.floorY - (value.height * FOOT) / 2) / FOOT
    onChange({
      ...value,
      side: hit.side,
      offset: nextOffsetFeet,
      heightFromFloor: nextHeightFromFloorFeet,
      placement: 'custom'
    })
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!edit) return
    e.stopPropagation()
    releasePointer(e)
    dragging.current = false
    dragStart.current = null
    setOrbitEnabled(true)
  }

  return (
    <group onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <WindowPanel shed={shed} win={value} trimColor={trimColor} selected={selected} />
    </group>
  )
}
function FeatureChip({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm ring-1 ring-black/5 backdrop-blur">
      {Icon ? <Icon className="h-3.5 w-3.5 text-zinc-500" /> : <span className="h-3.5 w-3.5 rounded-full bg-zinc-300" />}
      <span className="text-zinc-900">{value}</span>
      <span className="text-zinc-500">{label}</span>
    </span>
  )
}

function SelectionInspector({
  selection,
  trimColor,
  onDelete,
  canDelete
}: {
  selection: SelectedFeature | null
  trimColor: string
  onDelete: () => void
  canDelete: boolean
}) {
  if (!selection) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-4 text-xs text-zinc-600 shadow-sm backdrop-blur">
        <p className="font-semibold text-zinc-500">No feature selected</p>
        <p className="mt-1 leading-relaxed">
          Select a door or window in the preview to see its details and remove it if needed.
        </p>
      </div>
    )
  }

  const { kind, value } = selection
  const Icon = kind === 'door' ? DoorOpen : WindowIcon
  const offsetLabel = `${value.offset < 0 ? '-' : ''}${feetToFtIn(Math.abs(value.offset))}`

  return (
    <div className="w-full rounded-2xl bg-white/92 p-4 shadow-xl ring-1 ring-black/5 backdrop-blur md:w-64">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Selected {kind === 'door' ? 'Door' : 'Window'}
          </p>
          <p className="text-sm font-medium text-zinc-900">{formatSide(value.side)} wall</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/5">
          <Icon className="h-4 w-4 text-zinc-500" />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
        <div>
          <dt className="font-medium text-zinc-500">Width</dt>
          <dd className="text-sm font-semibold text-zinc-900">{feetToFtIn(value.width)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Height</dt>
          <dd className="text-sm font-semibold text-zinc-900">{feetToFtIn(value.height)}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Offset</dt>
          <dd className="text-sm font-semibold text-zinc-900">{offsetLabel}</dd>
        </div>
        {kind === 'window' ? (
          <div>
            <dt className="font-medium text-zinc-500">Sill height</dt>
            <dd className="text-sm font-semibold text-zinc-900">{feetToFtIn((value as WindowSpec).heightFromFloor)}</dd>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <dt className="font-medium text-zinc-500">Panel</dt>
            <dd className="flex items-center gap-1 text-sm font-semibold text-zinc-900">
              <span
                className="inline-flex h-3 w-3 rounded-full border border-white/70 shadow-sm"
                style={{ backgroundColor: (value as DoorSpec).color || trimColor }}
              />
              {(value as DoorSpec).color ? 'Custom' : 'Trim'}
            </dd>
          </div>
        )}
      </dl>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        className="inline-flex h-7 items-center gap-2 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove from model
      </button>
    </div>
  )
}


function AddMenu({ label, icon: Icon, onAdd }: { label: 'Door' | 'Window'; icon?: LucideIcon; onAdd: (side: Side) => void }) {
  const [side, setSide] = useState<Side>('front')
  const selectClass =
    'min-w-[96px] rounded-full border border-zinc-300/90 bg-white/95 px-3 py-2 text-sm font-semibold leading-[1.1] text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/5 transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200'
  const optionStyle = { color: '#0f172a', backgroundColor: '#ffffff' }
  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm">
      <span className="inline-flex items-center gap-1 text-zinc-600">
        {Icon ? <Icon className="h-3.5 w-3.5 text-zinc-500" /> : null}
        {label}
      </span>
      <select
        value={side}
        onChange={(e) => setSide(e.target.value as Side)}
        aria-label={`${label} side`}
        className={selectClass}
        style={{
          color: '#0f172a',
          backgroundColor: '#ffffff',
          colorScheme: 'light',
          fontWeight: 600,
          paddingTop: '6px',
          paddingBottom: '6px',
          marginBottom: 0
        }}
      >
        <option value="front" style={optionStyle}>
          Front
        </option>
        <option value="back" style={optionStyle}>
          Back
        </option>
        <option value="left" style={optionStyle}>
          Left
        </option>
        <option value="right" style={optionStyle}>
          Right
        </option>
      </select>
      <button
        type="button"
        onClick={() => onAdd(side)}
        className="inline-flex h-7 items-center gap-1 rounded-full bg-zinc-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
      >
        <span className="leading-none">+</span>
        <span className="leading-none">Add</span>
      </button>
    </div>
  )
}


function SceneOverlay({
  params,
  doorsCount,
  windowsCount,
  trimColor,
  selection,
  onAddDoor,
  onAddWindow,
  onDelete,
  canDelete,
  showFeatureControls
}: {
  params: StructurePreviewParams
  doorsCount: number
  windowsCount: number
  trimColor: string
  selection: SelectedFeature | null
  onAddDoor: (side: Side) => void
  onAddWindow: (side: Side) => void
  onDelete: () => void
  canDelete: boolean
  showFeatureControls: boolean
}) {
  const roofLabel = roofLabels[getEffectiveRoofStyle(params)]
  const optionChips: Array<{ label: string; value: string | number }> = []
  if (params.roofMaterial) optionChips.push({ label: 'roof metal', value: params.roofMaterial })
  if (params.frameGauge) optionChips.push({ label: 'frame', value: params.frameGauge })
  if (params.ventilation) optionChips.push({ label: 'ventilation', value: 'Solar' })
  if (params.foundation) optionChips.push({ label: 'foundation', value: humanize(params.foundation) })
  if (params.addOns?.length) optionChips.push({ label: 'add-ons', value: params.addOns.length })

  return (
    <div className="mx-auto w-full max-w-[360px] rounded-3xl border border-zinc-200/80 bg-white/95 px-4 py-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm ring-1 ring-black/5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Shed studio visualizer
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            <FeatureChip icon={DoorOpen} label="doors" value={doorsCount} />
            <FeatureChip icon={WindowIcon} label="windows" value={windowsCount} />
            <FeatureChip icon={PanelsTopLeft} label="roof" value={roofLabel} />
          </div>
        </div>

        {optionChips.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {optionChips.map((chip) => (
              <FeatureChip key={chip.label} label={chip.label} value={chip.value} />
            ))}
          </div>
        ) : null}

        {showFeatureControls && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <AddMenu label="Door" icon={DoorOpen} onAdd={onAddDoor} />
              <AddMenu label="Window" icon={WindowIcon} onAdd={onAddWindow} />
              <button
                type="button"
                onClick={onDelete}
                disabled={!canDelete}
                className="inline-flex h-7 items-center gap-2 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 text-xs text-zinc-600">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 font-medium text-zinc-700">
              <Ruler className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-800">
                {`${feetToFtIn(params.length ?? 8)} x ${feetToFtIn(params.width ?? 8)} footprint - ${feetToFtIn(getWallHeightFeet(params))} walls`}
              </span>
            </div>
            {showFeatureControls ? (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Drag doors and windows to reposition. Scroll to zoom, right-click or two-finger drag to orbit.
              </p>
            ) : null}
          </div>
          {showFeatureControls ? (
            <SelectionInspector selection={selection} trimColor={trimColor} onDelete={onDelete} canDelete={canDelete} />
          ) : null}
        </div>
      </div>
    </div>
  )
}


function buildInitialDoors(params: Pick<StructurePreviewParams, 'doors' | 'door'>): DoorSpec[] {
  if (params.doors) return params.doors
  if (params.door) {
    return [
      {
        id: uuid(),
        side: params.door.side,
        width: params.door.width,
        height: params.door.height,
        offset: params.door.offset ?? 0,
        color: params.door.color
      }
    ]
  }
  return []
}

// With frameloop="demand", R3F only redraws when something asks for a frame.
// Removing an object or mutating a material in place (the selection highlight)
// doesn't ask, so request one after every commit of the scene tree.
function RedrawOnCommit() {
  useLayoutEffect(() => {
    invalidate()
  })
  return null
}

// A canvas resize clears its drawing buffer. Render the new size right away so
// the browser never paints the empty canvas while waiting for the next frame.
function RedrawOnResize() {
  const width = useThree((state) => state.size?.width)
  const height = useThree((state) => state.size?.height)
  const advance = useThree((state) => state.advance)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    // The first frame is R3F's own; only later resizes need the extra render.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    advance?.(performance.now())
  }, [width, height, advance])
  return null
}

// Reports once, after the first frame has drawn (shaders compiled, scene lit).
function FirstFrameSignal({ onFirstFrame }: { onFirstFrame: () => void }) {
  const sent = useRef(false)
  const callback = useRef(onFirstFrame)
  useLayoutEffect(() => {
    callback.current = onFirstFrame
  }, [onFirstFrame])
  useFrame(() => {
    if (sent.current) return
    sent.current = true
    // useFrame runs just before this frame renders; report on the next one.
    requestAnimationFrame(() => callback.current())
  })
  return null
}

function StructurePreviewComponent({
  params,
  onChangeFeatures,
  editMode = true,
  showFeatureControls = editMode,
  syncFeaturesFromProps = !editMode,
  frameloop,
  maxDpr = 2,
  onFirstFrame
}: StructurePreviewProps) {
  const length = (params.length ?? 8) * FOOT
  const width = (params.width ?? 8) * FOOT
  // Visual wall height: fixed for types without a wall-height input (shared with the quote's door defaults).
  const wallHeightFeet = getWallHeightFeet(params)
  const wall = wallHeightFeet * FOOT
  const trimColor = params.trimColor || '#f8fafc'
  const wallColor = params.color || '#b8bcc2'
  const { floorY, sidingDrop } = getFoundationInfo(params)
  const showRamp = Boolean(params.addOns?.some((addOn) => addOn.startsWith('Ramp')))
  const showSteps = !showRamp && Boolean(params.addOns?.includes('Steps'))
  const shedFrame: ShedFrame = useMemo(
    () => ({
      length,
      width,
      wall,
      floorY,
      roofStyle: getEffectiveRoofStyle({ structureType: params.structureType, roofStyle: params.roofStyle }),
      structureType: params.structureType,
      sidingDrop
    }),
    [length, width, wall, floorY, params.roofStyle, params.structureType, sidingDrop]
  )
  const defaultDoorHeight = getDefaultDoorHeight(wallHeightFeet)
  const maxOrbitDistance = Math.max(6, Math.max(length, width, wall) * 1.5 + 3)
  const sceneFootprint = getSceneFootprint(params)
  const previewDescription = `${humanize(
    params.structureType || 'shed'
  )} 3D preview: ${feetToFtIn(params.length ?? 8)} by ${feetToFtIn(
    params.width ?? 8
  )} footprint, ${feetToFtIn(wallHeightFeet)} walls, ${
    roofLabels[getEffectiveRoofStyle(params)]
  }.`
  const paramDoor = params.door
  const paramDoors = params.doors
  const paramWindows = params.windows
  const propDoors = useMemo(
    () => buildInitialDoors({ doors: paramDoors, door: paramDoor }),
    [paramDoor, paramDoors]
  )
  const propWindows = useMemo(() => paramWindows ?? [], [paramWindows])

  const [doors, setDoors] = useState<DoorSpec[]>(() => propDoors)
  const [windows, setWindows] = useState<WindowSpec[]>(() => propWindows)
  const [selected, setSelected] = useState<{ kind: 'door' | 'window'; id: string } | null>(null)
  const [orbitEnabled, setOrbitEnabled] = useState(true)

  useEffect(() => {
    onChangeFeatures?.({ doors, windows })
  }, [doors, windows, onChangeFeatures])

  useEffect(() => {
    if (!editMode) return
    setDoors((ds) => {
      const needsUpdate = ds.some((door) => door.height !== defaultDoorHeight)
      if (!needsUpdate) return ds
      return ds.map((door) => ({ ...door, height: defaultDoorHeight }))
    })
  }, [defaultDoorHeight, editMode])

  useEffect(() => {
    if (!syncFeaturesFromProps) return
    setDoors((current) => (doorListsEqual(current, propDoors) ? current : propDoors))
    setWindows((current) => (windowListsEqual(current, propWindows) ? current : propWindows))
  }, [propDoors, propWindows, syncFeaturesFromProps])

  useEffect(() => {
    if (!selected) return
    const exists =
      (selected.kind === 'door' && doors.some((d) => d.id === selected.id)) ||
      (selected.kind === 'window' && windows.some((w) => w.id === selected.id))
    if (!exists) setSelected(null)
  }, [selected, doors, windows])

  useEffect(() => {
    if (!editMode) setSelected(null)
  }, [editMode])

  const handleDoorChange = useCallback((next: DoorSpec) => {
    setDoors((ds) => ds.map((d) => (d.id === next.id ? next : d)))
  }, [])

  const handleWindowChange = useCallback((next: WindowSpec) => {
    setWindows((ws) => ws.map((w) => (w.id === next.id ? next : w)))
  }, [])

  const addDoor = useCallback(
    (side: Side) => {
      const door: DoorSpec = {
        id: uuid(),
        side,
        width: 3,
        height: defaultDoorHeight,
        offset: 0,
        color: params.trimColor ? params.trimColor : undefined,
        placement: 'custom'
      }
      setDoors((ds) => [...ds, door])
      setSelected({ kind: 'door', id: door.id })
    },
    [defaultDoorHeight, params.trimColor]
  )

  const addWindow = useCallback((side: Side) => {
    const win: WindowSpec = {
      id: uuid(),
      side,
      width: 2.5,
      height: 3,
      offset: 0,
      heightFromFloor: Math.min(3, maxWindowHeightFromFloor(wall / FOOT, 3)),
      placement: 'custom'
    }
    setWindows((ws) => [...ws, win])
    setSelected({ kind: 'window', id: win.id })
  }, [wall])

  const removeSelected = useCallback(() => {
    if (!selected) return
    if (selected.kind === 'door') {
      setDoors((ds) => ds.filter((d) => d.id !== selected.id))
    } else {
      setWindows((ws) => ws.filter((w) => w.id !== selected.id))
    }
    setSelected(null)
  }, [selected])

  const selectedFeature: SelectedFeature | null = useMemo(() => {
    if (!selected) return null
    if (selected.kind === 'door') {
      const value = doors.find((d) => d.id === selected.id)
      if (!value) return null
      return { kind: 'door', value }
    }
    const value = windows.find((w) => w.id === selected.id)
    if (!value) return null
    return { kind: 'window', value }
  }, [selected, doors, windows])

  return (
    <div className="w-full space-y-4">
      <div
        role="img"
        aria-label={previewDescription}
        className="relative h-64 sm:h-80 md:h-[28rem] w-full overflow-hidden rounded-3xl border border-zinc-200 shadow-2xl"
        style={{ background: SCENE_BACKGROUND }}>
        {/* OrbitControls sets touch-action:none on the Canvas element even when
            disabled, so a view-only preview turns off pointer events and lets
            swipes reach this wrapper and scroll the page. The scene is static
            between prop changes, so it renders on demand instead of every frame. */}
        <Canvas
          aria-hidden="true"
          data-testid="structure-canvas"
          frameloop={frameloop ?? 'demand'}
          style={{ pointerEvents: editMode ? 'auto' : 'none' }}
          shadows={SCENE_SHADOWS}
          dpr={[1, maxDpr]}
          camera={{
            position: [Math.max(1.5, length) * 0.85 + 2.4, Math.max(1.2, wall) * 0.6 + 1.6, Math.max(1.5, width) * 0.85 + 2.4],
            fov: 33
          }}
          gl={SCENE_GL}
          // On-demand rendering never repaints after the GPU drops and restores
          // the context (common on iOS after backgrounding), so ask for a frame.
          onCreated={({ gl, invalidate: requestFrame }) => {
            gl.domElement.addEventListener('webglcontextrestored', () => requestFrame())
          }}
          className="absolute inset-0 h-full w-full"
          onPointerMissed={() => {
            if (!editMode) return
            setSelected(null)
          }}>
          <fog attach="fog" args={SCENE_FOG_ARGS} />
          <SceneEnvironment footprintKey={sceneFootprint.footprintKey} spanFt={sceneFootprint.spanFt} />

          <CameraFit fitKey={`${sceneFootprint.footprintKey}|${params.showDimensions ? 'dims' : ''}`}>
            <group>
              <ShedBuilderModel params={params} doors={doors} windows={windows} />
              <group position={[0, floorY, 0]}>
                {/* Ramp and Steps add-ons go at the main (first) door only. */}
                {doors.map((door, index) => (
                  <MovableDoor
                    key={door.id}
                    shed={shedFrame}
                    value={door}
                    onChange={handleDoorChange}
                    trimColor={trimColor}
                    wallColor={wallColor}
                    showRamp={showRamp && index === 0}
                    showSteps={showSteps && index === 0}
                    setOrbitEnabled={setOrbitEnabled}
                    selected={selected?.kind === 'door' && selected.id === door.id}
                    onSelect={() => setSelected({ kind: 'door', id: door.id })}
                    edit={editMode}
                  />
                ))}
                {windows.map((win) => (
                  <MovableWindow
                    key={win.id}
                    shed={shedFrame}
                    value={win}
                    onChange={handleWindowChange}
                    trimColor={trimColor}
                    setOrbitEnabled={setOrbitEnabled}
                    selected={selected?.kind === 'window' && selected.id === win.id}
                    onSelect={() => setSelected({ kind: 'window', id: win.id })}
                    edit={editMode}
                  />
                ))}
                {/* back-gable louver (storage, well house) and the Solar Vent Fan */}
                <GableVent
                  shed={shedFrame}
                  doors={doors}
                  windows={windows}
                  trimColor={trimColor}
                  ventilation={Boolean(params.ventilation)}
                />
              </group>
            </group>
          </CameraFit>

          <RedrawOnCommit />
          <RedrawOnResize />
          {onFirstFrame ? <FirstFrameSignal onFirstFrame={onFirstFrame} /> : null}

          <OrbitControls
            makeDefault
            enabled={editMode && orbitEnabled}
            autoRotate={false}
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.05}
            maxDistance={maxOrbitDistance}
          />
        </Canvas>
      </div>

      {showFeatureControls ? (
        <SceneOverlay
          params={params}
          doorsCount={doors.length}
          windowsCount={windows.length}
          trimColor={trimColor}
          selection={selectedFeature}
          onAddDoor={addDoor}
          onAddWindow={addWindow}
          onDelete={removeSelected}
          canDelete={Boolean(selected)}
          showFeatureControls={showFeatureControls}
        />
      ) : null}
    </div>
  )
}

type DoorLike = DoorSpec | VisualExtras['door']

function doorsEqual(a?: DoorLike, b?: DoorLike) {
  if (a === b) return true
  if (!a || !b) return false
  const aId = 'id' in a ? a.id : undefined
  const bId = 'id' in b ? b.id : undefined
  const aPlacement = 'placement' in a ? a.placement : undefined
  const bPlacement = 'placement' in b ? b.placement : undefined
  return (
    aId === bId &&
    a.side === b.side &&
    a.width === b.width &&
    a.height === b.height &&
    (a.offset ?? 0) === (b.offset ?? 0) &&
    a.color === b.color &&
    aPlacement === bPlacement
  )
}

function doorListsEqual(a?: DoorSpec[], b?: DoorSpec[]) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!doorsEqual(a[i], b[i])) return false
  }
  return true
}

function windowsEqual(a?: WindowSpec, b?: WindowSpec) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.side === b.side &&
    a.width === b.width &&
    a.height === b.height &&
    a.offset === b.offset &&
    a.heightFromFloor === b.heightFromFloor &&
    a.placement === b.placement
  )
}

function windowListsEqual(a?: WindowSpec[], b?: WindowSpec[]) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!windowsEqual(a[i], b[i])) return false
  }
  return true
}

function stringListsEqual(a?: string[], b?: string[]) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function areStructurePreviewPropsEqual(
  prev: StructurePreviewProps,
  next: StructurePreviewProps
) {
  if (prev.editMode !== next.editMode) return false
  if (prev.showFeatureControls !== next.showFeatureControls) return false
  if (prev.syncFeaturesFromProps !== next.syncFeaturesFromProps) return false
  if (prev.frameloop !== next.frameloop) return false
  if (prev.maxDpr !== next.maxDpr) return false
  if (prev.onChangeFeatures !== next.onChangeFeatures) return false
  if (prev.onFirstFrame !== next.onFirstFrame) return false

  const scalarKeys: Array<keyof StructurePreviewProps['params']> = [
    'structureType',
    'length',
    'width',
    'wallHeight',
    'color',
    'roofColor',
    'trimColor',
    'roofStyle',
    'roofMaterial',
    'frameGauge',
    'windowPackage',
    'windowCount',
    'ventilation',
    'foundation',
    'siding',
    'deliveryRadius',
    'showDimensions',
    'showGrid'
  ]

  for (const key of scalarKeys) {
    if (prev.params?.[key] !== next.params?.[key]) {
      return false
    }
  }

  if (!doorsEqual(prev.params.door, next.params.door)) return false
  if (!doorListsEqual(prev.params.doors, next.params.doors)) return false
  if (!windowListsEqual(prev.params.windows, next.params.windows)) return false
  if (!stringListsEqual(prev.params.addOns, next.params.addOns)) return false

  return true
}

const StructurePreview = memo(StructurePreviewComponent, areStructurePreviewPropsEqual)

export default StructurePreview
