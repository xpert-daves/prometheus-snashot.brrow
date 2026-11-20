'use client'

import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import {
  FOOT,
  getGambrelProfile,
  getRoofRiseMeters,
  type DoorSpec,
  type RoofStyle,
  type Side,
  type StructurePreviewParams,
  type WindowSpec
} from './types'
import { GreenhouseDoor, greenhouseSignBase } from './greenhouse'
import { RIB, getLogoTexture, LOGO_ASPECT, panelRepeatX } from './textures'
import { usePanelMaterial, useSimpleMaterial, useTrimMaterial, useWindowGlassMaterial } from './materials'
import { LouverVent, SolarVentPanel, useMergedBoxes, type BoxSpec, type RoofPose } from './ventVisuals'
import { LUMBER_HEX, deckPlankRepeat, getLumberGrainTexture, useDeckPlankTexture } from './woodTextures'
import { maxWindowHeightFromFloor } from '@/lib/quoteVisualPlacement'

export type ShedFrame = {
  length: number
  width: number
  wall: number
  /** Finished-floor height above grade in meters (foundation visuals). */
  floorY: number
  /** Effective roof style (see getEffectiveRoofStyle). */
  roofStyle: RoofStyle
  structureType?: StructurePreviewParams['structureType']
  /**
   * How far the wall siding runs below the floor over the rim or sill, meters
   * (FoundationInfo.sidingDrop). Door jambs run down to the same line.
   */
  sidingDrop?: number
}

export function sideTransform(
  side: Side,
  length: number,
  width: number,
  _height: number,
  alongOffset = 0,
  atHeight = 0
) {
  switch (side) {
    case 'front':
      return { position: new THREE.Vector3(alongOffset, atHeight, width / 2 + 0.001), rotationY: 0 }
    case 'back':
      return { position: new THREE.Vector3(-alongOffset, atHeight, -width / 2 - 0.001), rotationY: Math.PI }
    case 'left':
      return { position: new THREE.Vector3(-length / 2 - 0.001, atHeight, alongOffset), rotationY: -Math.PI / 2 }
    case 'right':
    default:
      return { position: new THREE.Vector3(length / 2 + 0.001, atHeight, -alongOffset), rotationY: Math.PI / 2 }
  }
}

/** Doors this wide render as roll-up garage doors (the default roll-up spec is 8 ft). */
const ROLLUP_MIN_WIDTH_FEET = 7

type DoorStyle = 'rollup' | 'house' | 'shed'

/** The quote's "House Door" option is carried on the default door's id. */
function getDoorStyle(door: DoorSpec): DoorStyle {
  if (door.width >= ROLLUP_MIN_WIDTH_FEET) return 'rollup'
  if (door.id.startsWith('door-default-house')) return 'house'
  return 'shed'
}

/**
 * Height of the wall top (floor-relative, meters) at a point along a side,
 * following the roof profile the building model draws: gable, gambrel, or
 * lean-to rising toward +X.
 */
export function wallTopAt(shed: ShedFrame, side: Side, along: number) {
  const half = shed.length / 2
  const rise = getRoofRiseMeters(shed.roofStyle, shed.length, shed.structureType)
  if (side === 'left') return shed.wall
  if (side === 'right') return shed.roofStyle === 'lean-to' ? shed.wall + rise : shed.wall
  // back wall is mirrored (see sideTransform)
  const x = Math.max(-half, Math.min(half, side === 'front' ? along : -along))
  if (shed.roofStyle === 'lean-to') return shed.wall + (rise * (x + half)) / shed.length
  const ax = Math.abs(x)
  if (shed.roofStyle === 'barn') {
    const { bx, r1 } = getGambrelProfile(shed.length)
    if (ax >= bx) return shed.wall + (r1 * (half - ax)) / (half - bx)
    return shed.wall + r1 + ((rise - r1) * (bx - ax)) / bx
  }
  return shed.wall + rise * (1 - ax / half)
}

/** Real Shed210 placards are about a foot across. */
const SIGN_WIDTH = 1 * FOOT
/** Black margin around the logo; real placards are solid black with no light border. */
const SIGN_BORDER = 0.05 * FOOT
/** Space kept under the roof edge and trim, and above the door casing. */
const SIGN_ROOF_CLEARANCE = 0.25 * FOOT
const SIGN_DOOR_GAP = 0.12 * FOOT
/** Below this scale the placard would be unreadable, so it is omitted. */
const SIGN_MIN_SCALE = 0.55

/**
 * Fits the logo placard between the door casing and the roof line above it.
 * Returns the placard center (relative to the door center) and its scale, or
 * null when there is no room, such as a side door under a 6 ft eave.
 */
export function fitSign(shed: ShedFrame, door: DoorSpec, doorTop: number, dH: number) {
  const along = door.offset * FOOT
  const roofLine = Math.min(
    wallTopAt(shed, door.side, along - SIGN_WIDTH / 2),
    wallTopAt(shed, door.side, along + SIGN_WIDTH / 2)
  )
  const bottom = doorTop + SIGN_DOOR_GAP
  const top = roofLine - SIGN_ROOF_CLEARANCE
  const available = top - bottom
  const fullH = SIGN_WIDTH / LOGO_ASPECT + SIGN_BORDER * 2
  const scale = Math.min(1, available / fullH)
  if (scale < SIGN_MIN_SCALE) return null
  const h = fullH * scale
  // Sit close above the door, like the photos, rather than floating mid-gable.
  const center = bottom + h / 2 + Math.min((available - h) / 2, 0.35 * FOOT)
  return { y: center - dH / 2, scale }
}

/**
 * Shed210 placard: the logo on a thin solid-black backer. Local frame: center
 * of the placard on the wall's outer plane, +Z out of the wall.
 */
function SignPlacard({ position, scale }: { position: [number, number, number]; scale: number }) {
  const backerMat = useSimpleMaterial({ color: 0x121212, metalness: 0.1, roughness: 0.5 })
  const logoMat = useSimpleMaterial({ map: getLogoTexture(), roughness: 0.55 })
  const depth = 0.03 * FOOT
  return (
    <group position={position} scale={[scale, scale, 1]}>
      <mesh material={backerMat} position={[0, 0, depth / 2]} castShadow>
        <boxGeometry args={[SIGN_WIDTH + SIGN_BORDER * 2, SIGN_WIDTH / LOGO_ASPECT + SIGN_BORDER * 2, depth]} />
      </mesh>
      <mesh material={logoMat} position={[0, 0, depth + 0.004 * FOOT]}>
        <planeGeometry args={[SIGN_WIDTH, SIGN_WIDTH / LOGO_ASPECT]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

/** Walk-door trim, measured on the Karnes, Helotes and San Antonio builds. */
const DOOR_REVEAL = 0.08 * FOOT // dark gap between the jamb trim and the leaf
const DOOR_JAMB = 0.28 * FOOT // jamb trim face (3-3.5")
const DOOR_HEADER = 0.28 * FOOT
const DOOR_HEADER_OVERHANG = 0.25 * FOOT // the header runs 2-3" past both jambs
const LEAF_FRAME = 0.21 * FOOT // trim angle on each leaf: top rail and stiles, no bottom rail
const LEAF_GAP = 0.03 * FOOT // between the two leaves of a double door
/** Jamb trim runs at least this far below the floor, over the bottom edge of the siding. */
const JAMB_DROP = 0.05 * FOOT

/** Jamb trim drop below the floor: down over the rim with the siding. */
function jambDrop(shed: ShedFrame) {
  return Math.max(JAMB_DROP, (shed.sidingDrop ?? 0) + 0.01 * FOOT)
}
/** Leaf panels sit just proud of the wall; the trim sits proud of the leaves. */
const LEAF_Z = 0.03 * FOOT

type TrimLayout = {
  /** Gap between the opening and the jamb trim. */
  reveal: number
  jamb: number
  header: number
  overhang: number
  depth: number
}

const WALK_DOOR_TRIM: TrimLayout = {
  reveal: DOOR_REVEAL,
  jamb: DOOR_JAMB,
  header: DOOR_HEADER,
  overhang: DOOR_HEADER_OVERHANG,
  depth: 0.08 * FOOT
}
/** Prehung house door: the slab fills the opening; brick-mould style casing. */
const HOUSE_DOOR_TRIM: TrimLayout = {
  reveal: 0.02 * FOOT,
  jamb: 0.3 * FOOT,
  header: 0.3 * FOOT,
  overhang: 0.06 * FOOT,
  depth: 0.12 * FOOT
}
/** Roll-up door: square jamb channels and a deep header box over the drum. */
const ROLLUP_TRIM: TrimLayout = {
  reveal: 0,
  jamb: 0.25 * FOOT,
  header: 0.35 * FOOT,
  overhang: 0.12 * FOOT,
  depth: 0.18 * FOOT
}

/**
 * Floor-relative top of a door's head trim (meters). The header is lowered,
 * and thinned, where the wall top or the rake trim would cut it, such as a
 * 6'9" door on a 7 ft eave wall. Never lower than a thin strip over the reveal.
 */
export function doorHeaderTop(shed: ShedFrame, door: DoorSpec, trim: TrimLayout = WALK_DOOR_TRIM) {
  const along = door.offset * FOOT
  const half = (door.width * FOOT) / 2 + trim.reveal + trim.jamb + trim.overhang
  // The profile is concave (gable, gambrel) or straight (lean-to), so its
  // lowest point over the header is at one of the ends.
  const roofLine = Math.min(wallTopAt(shed, door.side, along - half), wallTopAt(shed, door.side, along + half))
  // Rake trim hangs onto the gable panels; eave walls have no fascia.
  const gap = door.side === 'front' || door.side === 'back' ? 0.2 * FOOT : 0.03 * FOOT
  const base = door.height * FOOT + trim.reveal
  return Math.max(base + 0.08 * FOOT, Math.min(base + trim.header, roofLine - gap))
}

/**
 * Trim boxes around a door opening (door-local frame: opening center, +Z out
 * of the wall): two jambs from just below the floor and a header running past
 * them, one merged draw.
 */
function casingBoxes(dW: number, dH: number, headerTopLocal: number, trim: TrimLayout, drop = JAMB_DROP): BoxSpec[] {
  const yb = -dH / 2 - drop
  const headBottom = dH / 2 + trim.reveal
  const headH = Math.max(0.06 * FOOT, headerTopLocal - headBottom)
  const jx = dW / 2 + trim.reveal + trim.jamb / 2
  const headW = dW + 2 * (trim.reveal + trim.jamb + trim.overhang)
  return [
    { center: [-jx, (yb + headBottom) / 2, trim.depth / 2], size: [trim.jamb, headBottom - yb, trim.depth] },
    { center: [jx, (yb + headBottom) / 2, trim.depth / 2], size: [trim.jamb, headBottom - yb, trim.depth] },
    { center: [0, headBottom + headH / 2, (trim.depth + 0.02 * FOOT) / 2], size: [headW, headH, trim.depth + 0.02 * FOOT] }
  ]
}

export type WalkDoorParts = {
  /** Leaf centers (x) and width. */
  leafXs: number[]
  leafW: number
  trim: BoxSpec[]
  hinges: BoxSpec[]
  handle: BoxSpec[]
}

/**
 * Shed walk door, as built: jamb trim plus an overhanging header, a dark
 * reveal, a trim-color angle frame on each leaf (top rail and stiles, no
 * bottom rail), exposed butt hinges on the hinge edges and a locking
 * T-handle about 3.2 ft up. On doubles the two meeting stiles form the
 * 5-6" center band. Door-local frame (opening center, +Z out of the wall).
 */
export function buildWalkDoorParts(dW: number, dH: number, headerTopLocal: number, drop = JAMB_DROP): WalkDoorParts {
  const leaves = dW >= 5 * FOOT ? 2 : 1
  const leafW = (dW - (leaves - 1) * LEAF_GAP) / leaves
  const leafXs = Array.from({ length: leaves }, (_, i) => -dW / 2 + leafW / 2 + i * (leafW + LEAF_GAP))
  const trim = casingBoxes(dW, dH, headerTopLocal, WALK_DOOR_TRIM, drop)
  const hinges: BoxSpec[] = []
  const handle: BoxSpec[] = []
  const yb = -dH / 2
  const yt = dH / 2
  const frameZ = LEAF_Z + 0.025 * FOOT
  const hingeCount = leaves === 2 ? 4 : 3
  leafXs.forEach((cx, i) => {
    trim.push({ center: [cx, yt - LEAF_FRAME / 2, frameZ], size: [leafW, LEAF_FRAME, 0.05 * FOOT] })
    for (const s of [-1, 1]) {
      trim.push({
        center: [cx + s * (leafW / 2 - LEAF_FRAME / 2), (yb + yt - LEAF_FRAME) / 2, frameZ],
        size: [LEAF_FRAME, dH - LEAF_FRAME, 0.05 * FOOT]
      })
    }
    // Singles hinge on the left (seen from outside); doubles on their outer edges.
    const hingeSide = leaves === 2 && i === 1 ? 1 : -1
    const hx = cx + hingeSide * (leafW / 2 + DOOR_REVEAL / 2)
    for (let k = 0; k < hingeCount; k++) {
      const y = yb + 0.6 * FOOT + ((dH - 1.15 * FOOT) * k) / (hingeCount - 1)
      hinges.push({ center: [hx, y, 0.09 * FOOT], size: [0.17 * FOOT, 0.28 * FOOT, 0.025 * FOOT] })
    }
  })
  // Locking T-handle on the latch stile: the right edge of a single, the
  // meeting stile of a double's right leaf.
  const latchX =
    leaves === 2 ? leafXs[1] - leafW / 2 + LEAF_FRAME / 2 : leafXs[0] + leafW / 2 - LEAF_FRAME / 2
  const latchY = yb + Math.min(3.2 * FOOT, dH - 1.2 * FOOT)
  handle.push(
    { center: [latchX, latchY, 0.095 * FOOT], size: [0.09 * FOOT, 0.4 * FOOT, 0.03 * FOOT] },
    { center: [latchX, latchY + 0.09 * FOOT, 0.14 * FOOT], size: [0.05 * FOOT, 0.05 * FOOT, 0.09 * FOOT] },
    { center: [latchX, latchY + 0.09 * FOOT, 0.19 * FOOT], size: [0.26 * FOOT, 0.05 * FOOT, 0.045 * FOOT] }
  )
  return { leafXs, leafW, trim, hinges, handle }
}

/** Fresh treated-pine ramp: 2x6 boards running down the slope (Shady Oaks, Helotes). */
const RAMP_MAX_WIDTH = 9 * FOOT

/**
 * Ramp add-on, door-local frame (door center, floor at -dH/2, +Z out of the
 * wall): a plank deck sloping from the threshold to grade, closed by two
 * wedge side boards. About door + 1.2 ft wide.
 */
function DoorRamp({ dW, dH, floorY }: { dW: number; dH: number; floorY: number }) {
  const run = Math.max(3.5 * FOOT, floorY * 4)
  const len = Math.hypot(run, floorY)
  const width = Math.min(dW + 1.2 * FOOT, RAMP_MAX_WIDTH)
  const angle = Math.atan2(floorY, run)
  const thick = 0.12 * FOOT
  const deckTex = useDeckPlankTexture(...deckPlankRepeat(width / FOOT, len / FOOT))
  const deckMat = useMemo(() => new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0 }), [deckTex])
  useEffect(() => () => deckMat.dispose(), [deckMat])
  const sideMat = useSimpleMaterial({ color: LUMBER_HEX, map: getLumberGrainTexture(), roughness: 0.85 })
  // Side boards: right triangles from the threshold down to grade.
  const sideGeom = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.lineTo(0, floorY - thick * 0.5)
    shape.lineTo(run, 0)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12 * FOOT, bevelEnabled: false })
    // Shape X runs out from the wall (local +Z); extrusion depth runs across.
    geometry.rotateY(-Math.PI / 2)
    return geometry
  }, [floorY, run, thick])
  useEffect(() => () => sideGeom.dispose(), [sideGeom])
  const y0 = -dH / 2 - floorY
  return (
    <group>
      <group position={[0, y0 + floorY / 2 - (thick / 2) / Math.cos(angle), run / 2]} rotation={[angle, 0, 0]}>
        <mesh material={deckMat} castShadow receiveShadow>
          <boxGeometry args={[width, thick, len]} />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={sideGeom}
          material={sideMat}
          position={[s * (width / 2 - 0.06 * FOOT) + 0.06 * FOOT, y0, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}

/** Steps add-on: risers up to about 7", 11" treads with a 1" nosing. */
const STEP_MAX_RISE = 0.6 * FOOT
const STEP_TREAD = 0.95 * FOOT
const STEP_NOSING = 0.08 * FOOT

/** Tread and stringer boxes for wooden steps up to a floor `floorY` above grade, or none when one riser covers it. */
export function buildStepBoxes(dW: number, floorY: number): BoxSpec[] {
  const risers = Math.ceil(floorY / STEP_MAX_RISE - 1e-6)
  if (risers < 2) return []
  const rise = floorY / risers
  const width = Math.min(dW + 0.6 * FOOT, 8 * FOOT)
  const board = 0.12 * FOOT
  const boxes: BoxSpec[] = []
  for (let k = 1; k < risers; k++) {
    const top = k * rise
    const z0 = (risers - 1 - k) * STEP_TREAD
    // Two 2x6 tread boards with a small gap, nosing past a riser board, and
    // a stringer block at each end and in the middle.
    const depth = STEP_TREAD + STEP_NOSING
    for (const [zc, d] of [
      [z0 + depth * 0.25, depth * 0.48],
      [z0 + depth * 0.75, depth * 0.48]
    ]) {
      boxes.push({ center: [0, top - board / 2, zc], size: [width + 0.1 * FOOT, board, d] })
    }
    boxes.push({ center: [0, (top - board) / 2, z0 + STEP_TREAD - board / 2], size: [width - 0.04 * FOOT, top - board, board] })
    for (const x of [-(width / 2 - board / 2), 0, width / 2 - board / 2]) {
      boxes.push({ center: [x, (top - board) / 2, z0 + STEP_TREAD / 2], size: [board, top - board, STEP_TREAD - board] })
    }
  }
  return boxes
}

/** Steps add-on, door-local frame (see DoorRamp). */
function DoorSteps({ dW, dH, floorY }: { dW: number; dH: number; floorY: number }) {
  const boxes = useMemo(() => buildStepBoxes(dW, floorY), [dW, floorY])
  const geometry = useMergedBoxes(boxes)
  const lumberMat = useSimpleMaterial({ color: LUMBER_HEX, map: getLumberGrainTexture(), roughness: 0.85 })
  if (!boxes.length) return null
  return (
    <mesh geometry={geometry} material={lumberMat} position={[0, -dH / 2 - floorY, 0.002 * FOOT]} castShadow receiveShadow />
  )
}

const NO_BOXES: BoxSpec[] = []

export function DoorPanel({
  shed,
  door,
  trimColor,
  wallColor,
  selected = false,
  showRamp = false,
  showSteps = false
}: {
  shed: ShedFrame
  door: DoorSpec
  trimColor: string
  wallColor: string
  selected?: boolean
  /** Ramp add-on at this door (the main door). */
  showRamp?: boolean
  /** Steps add-on at this door; ignored when a ramp is shown. */
  showSteps?: boolean
}) {
  const dW = door.width * FOOT
  const dH = door.height * FOOT
  const style = getDoorStyle(door)
  const isRollup = style === 'rollup'
  // Greenhouses: the placard also clears the transom louver over tall doors.
  const isGreenhouse = shed.structureType === 'greenhouse'
  const isWalk = style === 'shed' && !isGreenhouse
  const { position, rotationY } = sideTransform(
    door.side,
    shed.length,
    shed.width,
    shed.wall,
    door.offset * FOOT,
    dH / 2
  )

  // Roll-ups read as trim-colored slats; walk doors as ribbed wall-color leaves.
  const leaves = door.width >= 5 ? 2 : 1
  const leafWFt = (door.width - ((leaves - 1) * LEAF_GAP) / FOOT) / leaves
  const panelHex = door.color || (isRollup ? trimColor : wallColor)
  const panelMat = usePanelMaterial(
    panelHex,
    isRollup ? 1 : panelRepeatX(leafWFt),
    isRollup ? door.height * 2 : door.height * RIB,
    true,
    isRollup ? { fasteners: false } : {},
    selected ? 0.22 : 0
  )
  const trimMat = useTrimMaterial(trimColor, selected ? 0.12 : 0)
  // Prehung steel house door: factory white unless a door color is chosen.
  const houseMat = useTrimMaterial(door.color || '#f2f1ed', selected ? 0.12 : 0)
  const housePanelMat = useSimpleMaterial(
    { color: new THREE.Color(door.color || '#f2f1ed').multiplyScalar(0.78), metalness: 0.2, roughness: 0.45 },
    [door.color]
  )
  const handleMat = useSimpleMaterial({ color: 0x161616, metalness: 0.6, roughness: 0.4 })
  const nickelMat = useSimpleMaterial({ color: 0xb9bcbf, metalness: 0.9, roughness: 0.28 })
  const revealMat = useSimpleMaterial({ color: 0x2b2622, roughness: 0.9 })

  const trimLayout = isRollup ? ROLLUP_TRIM : style === 'house' ? HOUSE_DOOR_TRIM : WALK_DOOR_TRIM
  const headerTop = doorHeaderTop(shed, door, trimLayout)
  const headerTopLocal = headerTop - dH / 2
  const drop = jambDrop(shed)
  const walk = useMemo(
    () => (isWalk ? buildWalkDoorParts(dW, dH, headerTopLocal, drop) : null),
    [isWalk, dW, dH, headerTopLocal, drop]
  )
  const casing = useMemo(
    () => (isWalk || isGreenhouse ? [] : casingBoxes(dW, dH, headerTopLocal, trimLayout, drop)),
    [isWalk, isGreenhouse, dW, dH, headerTopLocal, trimLayout, drop]
  )
  const trimGeom = useMergedBoxes(walk?.trim ?? casing)
  const hingeGeom = useMergedBoxes(walk?.hinges ?? NO_BOXES)
  const handleGeom = useMergedBoxes(walk?.handle ?? NO_BOXES)

  const casingTop = isGreenhouse ? greenhouseSignBase(shed.wall, door) : headerTop
  const sign = fitSign(shed, door, casingTop, dH)
  const placard = sign ? <SignPlacard position={[0, sign.y, 0.1 * FOOT]} scale={sign.scale} /> : null

  // Ramp or steps up to the threshold (skipped when the floor is near grade).
  const access =
    shed.floorY < 0.15 * FOOT ? null : showRamp ? (
      <DoorRamp dW={dW} dH={dH} floorY={shed.floorY} />
    ) : showSteps ? (
      <DoorSteps dW={dW} dH={dH} floorY={shed.floorY} />
    ) : null

  if (isRollup) {
    // Slats in the opening, square jamb channels and header box, an aluminum
    // bottom bar with a lift handle.
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh material={panelMat} position={[0, 0, 0.02 * FOOT]} castShadow receiveShadow>
          <planeGeometry args={[dW, dH]} />
        </mesh>
        <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow />
        <mesh material={nickelMat} position={[0, -dH / 2 + 0.06 * FOOT, 0.045 * FOOT]} castShadow>
          <boxGeometry args={[dW, 0.12 * FOOT, 0.05 * FOOT]} />
        </mesh>
        <mesh material={handleMat} position={[0, -dH / 2 + 0.42 * FOOT, 0.07 * FOOT]} castShadow>
          <boxGeometry args={[0.55 * FOOT, 0.07 * FOOT, 0.07 * FOOT]} />
        </mesh>
        {placard}
        {access}
      </group>
    )
  }

  // Greenhouse walk doors (singles and doubles): clear upper, metal lower.
  if (isGreenhouse && style === 'shed') {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <GreenhouseDoor door={door} trimColor={trimColor} wallColor={wallColor} selected={selected} />
        {placard}
        {access}
      </group>
    )
  }

  if (style === 'house') {
    // Classic six-panel layout: two short panels on top, four tall below.
    const stile = 0.32 * FOOT
    const rail = 0.3 * FOOT
    const lockRail = 0.45 * FOOT
    const innerW = dW - stile * 3
    const panelW = innerW / 2
    const innerH = dH - rail * 2 - lockRail * 2
    const rows = [0.22, 0.39, 0.39].map((f) => f * innerH)
    const panels: { x: number; y: number; w: number; h: number }[] = []
    let yTop = dH / 2 - rail
    rows.forEach((h, row) => {
      const y = yTop - h / 2
      for (const col of [-1, 1]) {
        panels.push({ x: col * (panelW / 2 + stile / 2), y, w: panelW, h })
      }
      yTop -= h + (row < 2 ? lockRail : 0)
    })
    const knobX = dW / 2 - 0.3 * FOOT
    const knobY = -dH / 2 + 3 * FOOT
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow />
        <mesh material={houseMat} position={[0, 0, 0.05 * FOOT]} castShadow receiveShadow>
          <boxGeometry args={[dW, dH, 0.08 * FOOT]} />
        </mesh>
        {panels.map((p, i) => (
          <group key={i} position={[p.x, p.y, 0.09 * FOOT]}>
            {/* recessed bevel, then the raised field */}
            <mesh material={housePanelMat}>
              <boxGeometry args={[p.w, p.h, 0.01 * FOOT]} />
            </mesh>
            <mesh material={houseMat} position={[0, 0, 0.012 * FOOT]}>
              <boxGeometry args={[p.w - 0.16 * FOOT, p.h - 0.16 * FOOT, 0.02 * FOOT]} />
            </mesh>
          </group>
        ))}
        {/* lever handle with rose, and a deadbolt above */}
        <mesh material={nickelMat} position={[knobX, knobY, 0.11 * FOOT]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1 * FOOT, 0.1 * FOOT, 0.04 * FOOT, 20]} />
        </mesh>
        <mesh material={nickelMat} position={[knobX - 0.15 * FOOT, knobY, 0.18 * FOOT]}>
          <boxGeometry args={[0.36 * FOOT, 0.06 * FOOT, 0.06 * FOOT]} />
        </mesh>
        <mesh material={nickelMat} position={[knobX, knobY + 0.5 * FOOT, 0.11 * FOOT]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08 * FOOT, 0.08 * FOOT, 0.05 * FOOT, 20]} />
        </mesh>
        {/* aluminum threshold */}
        <mesh material={nickelMat} position={[0, -dH / 2 + 0.02 * FOOT, 0.1 * FOOT]}>
          <boxGeometry args={[dW + 0.1 * FOOT, 0.04 * FOOT, 0.2 * FOOT]} />
        </mesh>
        {placard}
        {access}
      </group>
    )
  }

  // Shed walk door: dark reveal behind ribbed leaves, merged trim, hinges, T-handle.
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={revealMat} position={[0, DOOR_REVEAL / 2, 0.012 * FOOT]} receiveShadow>
        <planeGeometry args={[dW + DOOR_REVEAL * 2, dH + DOOR_REVEAL]} />
      </mesh>
      {walk?.leafXs.map((x) => (
        <mesh key={x} material={panelMat} position={[x, 0, LEAF_Z]} castShadow receiveShadow>
          <planeGeometry args={[walk.leafW, dH]} />
        </mesh>
      ))}
      <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow />
      <mesh geometry={hingeGeom} material={nickelMat} castShadow />
      <mesh geometry={handleGeom} material={handleMat} castShadow />
      {placard}
      {access}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/** White vinyl single-hung frame and sash: always white, whatever the trim color. */
const VINYL_HEX = '#f4f4f2'

let shedGlassTexture: THREE.Texture | null = null

/**
 * Pane seen from outside a closed shed (one tile per sash): the dim interior
 * low in the pane, a soft sky reflection toward the top and a faint diagonal
 * sheen, so it reads as glass rather than a black or mirrored panel.
 */
function getShedGlassTexture(): THREE.Texture {
  if (shedGlassTexture) return shedGlassTexture
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
  const ctx = canvas?.getContext('2d') ?? null
  if (!canvas || !ctx) {
    shedGlassTexture = new THREE.Texture()
    return shedGlassTexture
  }
  canvas.width = 64
  canvas.height = 128
  const grad = ctx.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#6c7b84')
  grad.addColorStop(0.35, '#3d484e')
  grad.addColorStop(0.75, '#22292d')
  grad.addColorStop(1, '#1b2124')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 128)
  ctx.fillStyle = 'rgba(220,232,240,0.07)'
  ctx.beginPath()
  ctx.moveTo(10, 128)
  ctx.lineTo(34, 128)
  ctx.lineTo(64, 40)
  ctx.lineTo(64, 0)
  ctx.closePath()
  ctx.fill()
  shedGlassTexture = new THREE.CanvasTexture(canvas)
  shedGlassTexture.colorSpace = THREE.SRGBColorSpace
  shedGlassTexture.wrapT = THREE.RepeatWrapping
  return shedGlassTexture
}

/** Painted shed window pane (two sashes) with a faint dielectric sky sheen. */
function useShedGlassMaterial(selected: boolean) {
  const material = useMemo(() => {
    const map = getShedGlassTexture().clone()
    map.needsUpdate = true
    map.repeat.set(1, 2)
    return new THREE.MeshStandardMaterial({ map, metalness: 0, roughness: 0.12 })
  }, [])
  material.emissive.set(selected ? '#16a34a' : '#000000')
  material.emissiveIntensity = selected ? 0.18 : 0
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material]
  )
  return material
}

const WINDOW_CASING = 0.29 * FOOT
const WINDOW_FRAME = 0.12 * FOOT
const WINDOW_SASH = 0.09 * FOOT
const WINDOW_MEETING_RAIL = 0.15 * FOOT

/**
 * Casing and vinyl boxes for a single-hung window (window-local frame: glass
 * center, +Z out of the wall). The flat trim-color casing sits on the wall
 * with no projecting sill; the white frame ring and sashes sit just inside it.
 */
export function buildWindowParts(wW: number, wH: number) {
  const c = WINDOW_CASING
  const cd = 0.06 * FOOT
  const casing: BoxSpec[] = [
    { center: [0, wH / 2 + c / 2, cd / 2], size: [wW + c * 2, c, cd] },
    { center: [0, -wH / 2 - c / 2, cd / 2], size: [wW + c * 2, c, cd] },
    { center: [-wW / 2 - c / 2, 0, cd / 2], size: [c, wH, cd] },
    { center: [wW / 2 + c / 2, 0, cd / 2], size: [c, wH, cd] }
  ]
  const f = WINDOW_FRAME
  const fd = 0.05 * FOOT
  const iw = wW - f * 2
  const ih = wH - f * 2
  const s = WINDOW_SASH
  const sd = 0.04 * FOOT
  const vinyl: BoxSpec[] = [
    { center: [0, wH / 2 - f / 2, fd / 2], size: [wW, f, fd] },
    { center: [0, -wH / 2 + f / 2, fd / 2], size: [wW, f, fd] },
    { center: [-wW / 2 + f / 2, 0, fd / 2], size: [f, ih, fd] },
    { center: [wW / 2 - f / 2, 0, fd / 2], size: [f, ih, fd] },
    // sash stiles and rails, and the meeting rail where the two sashes overlap
    { center: [-iw / 2 + s / 2, 0, sd / 2], size: [s, ih, sd] },
    { center: [iw / 2 - s / 2, 0, sd / 2], size: [s, ih, sd] },
    { center: [0, ih / 2 - s / 2, sd / 2], size: [iw, s, sd] },
    { center: [0, -ih / 2 + s / 2, sd / 2], size: [iw, s, sd] },
    { center: [0, 0, sd / 2 + 0.005 * FOOT], size: [iw, WINDOW_MEETING_RAIL, sd + 0.01 * FOOT] }
  ]
  return { casing, vinyl, glass: { w: iw, h: ih } }
}

export function WindowPanel({
  shed,
  win,
  trimColor,
  selected = false
}: {
  shed: ShedFrame
  win: WindowSpec
  trimColor: string
  selected?: boolean
}) {
  const wW = win.width * FOOT
  const wH = win.height * FOOT
  // Clamp at render time too, so saved or legacy placements never clip the roof.
  const base = Math.min(win.heightFromFloor, maxWindowHeightFromFloor(shed.wall / FOOT, win.height)) * FOOT
  const { position, rotationY } = sideTransform(
    win.side,
    shed.length,
    shed.width,
    shed.wall,
    win.offset * FOOT,
    base + wH / 2
  )

  const trimMat = useTrimMaterial(trimColor, selected ? 0.12 : 0)
  const vinylMat = useTrimMaterial(VINYL_HEX, selected ? 0.12 : 0)
  // Greenhouse envelopes cut the window opening, so clear glass shows the lit
  // interior. Shed walls run solid behind windows: their panes are painted.
  const isGreenhouse = shed.structureType === 'greenhouse'
  const clearGlassMat = useWindowGlassMaterial(selected, { seeThrough: true })
  const shedGlassMat = useShedGlassMaterial(selected)
  const glassMat = isGreenhouse ? clearGlassMat : shedGlassMat
  const parts = useMemo(() => buildWindowParts(wW, wH), [wW, wH])
  const casingGeom = useMergedBoxes(parts.casing)
  const vinylGeom = useMergedBoxes(parts.vinyl)

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={casingGeom} material={trimMat} castShadow receiveShadow />
      <mesh geometry={vinylGeom} material={vinylMat} castShadow receiveShadow />
      <mesh material={glassMat} position={[0, 0, 0.012 * FOOT]} renderOrder={2}>
        <planeGeometry args={[parts.glass.w, parts.glass.h]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Back-gable louver vent, back placard and Solar Vent Fan
// ---------------------------------------------------------------------------

type GableVentSpec = {
  /** Louver (inside the trim casing) width and height, ft. */
  width: number
  height: number
  /** Trim casing width, ft. */
  casing: number
  /** Aluminum flange inside the casing, ft. */
  flange: number
  banks: number
  /** Preferred casing center relative to the eave line, ft (negative = below). */
  centerFromEave: number
  /** Placard scale (1 = the 1 ft door placard). */
  placardScale: number
}

/**
 * Storage sheds: a 16" x 11" vent (2" casing around a 12" x 7" louver) on
 * Karnes, Boerne, San Antonio and Lakehills. Well houses: a wider three-bank
 * louver in a 1.65 x 1.0 ft frame (Karnes, Floresville, Rocksprings), with a
 * smaller 0.75 ft placard above it.
 */
const GABLE_VENTS: Partial<Record<NonNullable<ShedFrame['structureType']>, GableVentSpec>> = {
  storage_shed: { width: 1.0, height: 0.58, casing: 0.17, flange: 0.05, banks: 1, centerFromEave: -0.2, placardScale: 1 },
  well_pump: { width: 1.25, height: 0.6, casing: 0.2, flange: 0.05, banks: 3, centerFromEave: -0.15, placardScale: 0.78 }
}

/** Space between the top of the vent casing (or placard) and the rake trim. */
const VENT_ROOF_CLEARANCE = 0.25 * FOOT
/** Clear space kept between the vent casing and window or door trim. */
const VENT_OPENING_MARGIN = 0.25 * FOOT

export type GableVentLayout = {
  /** Center along the back wall (the door/window offset axis), meters. */
  along: number
  /** Center height above the floor, meters. */
  y: number
  width: number
  height: number
  casing: number
  flange: number
  banks: number
  /** Back placard center height above the floor and scale, when it fits. */
  placard: { y: number; scale: number } | null
}

/**
 * Where the back-gable vent goes: straddling the eave line, centered when it
 * can be, stepping sideways (6" at a time) to clear back windows and doors,
 * and dropping under a shallow rake. Null for types without a gable vent
 * (lean-to roofs, greenhouses, carports, loafing sheds) or when nothing fits.
 */
export function computeGableVent(shed: ShedFrame, doors: DoorSpec[], windows: WindowSpec[]): GableVentLayout | null {
  const spec = GABLE_VENTS[shed.structureType ?? 'storage_shed']
  if (!spec || shed.roofStyle === 'lean-to') return null
  const F = FOOT
  const outerW = (spec.width + spec.casing * 2) * F
  const outerH = (spec.height + spec.casing * 2) * F
  const span = shed.length
  // Obstacles on the back wall, in meters along/up the wall.
  const blocks: { a0: number; a1: number; y0: number; y1: number }[] = []
  for (const w of windows) {
    if (w.side !== 'back') continue
    const sill = Math.min(w.heightFromFloor, maxWindowHeightFromFloor(shed.wall / F, w.height)) * F
    const half = (w.width * F) / 2 + WINDOW_CASING
    blocks.push({
      a0: w.offset * F - half,
      a1: w.offset * F + half,
      y0: sill - WINDOW_CASING,
      y1: sill + w.height * F + WINDOW_CASING
    })
  }
  for (const d of doors) {
    if (d.side !== 'back') continue
    // The door, its trim and the placard above it, up to the roof.
    const half = (d.width * F) / 2 + 0.65 * F
    blocks.push({ a0: d.offset * F - half, a1: d.offset * F + half, y0: 0, y1: Infinity })
  }
  const maxAlong = span / 2 - outerW / 2 - 0.6 * F
  const steps = Math.max(0, Math.floor(maxAlong / (0.5 * F)))
  for (let k = 0; k <= steps; k++) {
    for (const dir of k === 0 ? [1] : [1, -1]) {
      const along = dir * k * 0.5 * F
      const roofLine = Math.min(
        wallTopAt(shed, 'back', along - outerW / 2),
        wallTopAt(shed, 'back', along + outerW / 2)
      )
      const y = Math.min(shed.wall + spec.centerFromEave * F, roofLine - VENT_ROOF_CLEARANCE - outerH / 2)
      // Keep it in the upper wall; a vent pushed below a 6 ft eave reads as a window.
      if (y - outerH / 2 < shed.wall - 1.6 * F) continue
      const clash = blocks.some(
        (b) =>
          along + outerW / 2 + VENT_OPENING_MARGIN > b.a0 &&
          along - outerW / 2 - VENT_OPENING_MARGIN < b.a1 &&
          y + outerH / 2 + VENT_OPENING_MARGIN > b.y0 &&
          y - outerH / 2 - VENT_OPENING_MARGIN < b.y1
      )
      if (clash) continue
      return {
        along,
        y,
        width: spec.width * F,
        height: spec.height * F,
        casing: spec.casing * F,
        flange: spec.flange * F,
        banks: spec.banks,
        placard: fitGablePlacard(shed, along, y + outerH / 2, spec.placardScale)
      }
    }
  }
  return null
}

/** Placard centered over the vent when the gable leaves room under the rake. */
function fitGablePlacard(shed: ShedFrame, along: number, ventTop: number, maxScale: number) {
  const fullW = SIGN_WIDTH + SIGN_BORDER * 2
  const fullH = SIGN_WIDTH / LOGO_ASPECT + SIGN_BORDER * 2
  const bottom = ventTop + 0.1 * FOOT
  const halfW = (fullW * maxScale) / 2
  const roofLine = Math.min(wallTopAt(shed, 'back', along - halfW), wallTopAt(shed, 'back', along + halfW))
  const scale = Math.min(maxScale, (roofLine - VENT_ROOF_CLEARANCE - bottom) / fullH)
  if (scale < 0.6) return null
  return { y: bottom + (fullH * scale) / 2, scale }
}

/**
 * Pose for the Solar Vent Fan panel on the +X roof plane near the back,
 * read off the wall profile so it follows gable, gambrel (upper slope) and
 * lean-to roofs. `lift` is the roof sheet's height above the wall profile.
 */
export function solarPanelPoseOnRoof(shed: ShedFrame, lift = 0.16 * FOOT, panelDepth = 1.15 * FOOT): RoofPose {
  const top = (x: number) => wallTopAt(shed, 'front', x)
  const d = 0.02 * FOOT
  const slopeAt = (x: number) => (top(x + d) - top(x - d)) / (2 * d)
  const half = shed.length / 2
  let x0 = half / 2
  if (shed.roofStyle === 'barn') {
    // Center it on the shallow upper slope: find the pitch break outward from the ridge.
    const s0 = slopeAt(0.1 * FOOT)
    let breakX = half
    for (let x = 0.2 * FOOT; x < half; x += 0.05 * FOOT) {
      if (Math.abs(slopeAt(x) - s0) > 0.05) {
        breakX = x
        break
      }
    }
    x0 = breakX / 2
  }
  const ang = Math.atan(slopeAt(x0))
  const y = top(x0) + lift / Math.cos(ang)
  const z = -shed.width / 2 + Math.min(1.4 * FOOT, shed.width * 0.18) + panelDepth / 2
  return { position: [x0, y, z], rotationZ: ang }
}

/**
 * Back-gable louver vent (storage sheds and well houses), the placard above
 * it, and for well houses with the Solar Vent Fan a small PV panel on the
 * roof plus the dark fan shroud behind the louver. Greenhouses draw their own
 * louvers. Floor-relative frame, like doors and windows.
 */
export function GableVent({
  shed,
  doors,
  windows,
  trimColor,
  ventilation = false
}: {
  shed: ShedFrame
  doors: DoorSpec[]
  windows: WindowSpec[]
  trimColor: string
  ventilation?: boolean
}) {
  const layout = useMemo(() => computeGableVent(shed, doors, windows), [shed, doors, windows])
  const fan = ventilation && shed.structureType === 'well_pump'
  const solarPose = useMemo(() => (fan ? solarPanelPoseOnRoof(shed) : null), [fan, shed])
  // The PV panel shows even where no gable louver fits (a stale lean-to roof).
  const solar = solarPose ? <SolarVentPanel pose={solarPose} /> : null
  if (!layout) return solar
  const { position, rotationY } = sideTransform('back', shed.length, shed.width, shed.wall, layout.along, layout.y)
  return (
    <group>
      <LouverVent
        width={layout.width}
        height={layout.height}
        trimColor={trimColor}
        casing={layout.casing}
        flange={layout.flange}
        banks={layout.banks}
        fan={fan}
        position={position.toArray()}
        rotationY={rotationY}
      />
      {layout.placard ? (
        <group position={position.toArray()} rotation={[0, rotationY, 0]}>
          <SignPlacard position={[0, layout.placard.y - layout.y, 0]} scale={layout.placard.scale} />
        </group>
      ) : null}
      {solar}
    </group>
  )
}
