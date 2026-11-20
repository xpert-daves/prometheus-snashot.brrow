import * as THREE from 'three'
import { FOOT, getGambrelProfile, type RoofStyle, type StructurePreviewParams } from './types'
import { GREENHOUSE_EAVE_OVERHANG_FT, GREENHOUSE_RAKE_OVERHANG_FT } from './greenhouse'

// ---------------------------------------------------------------------------
// Roof and end-wall profile geometry shared by the building model and the
// open-structure frames. Meters, floor-relative. The gable profile spans
// `length` along X (ridge along Z); lean-to rises toward +X.
// ---------------------------------------------------------------------------

const F = FOOT

/** Roof sheet center line sits this far above the eave-to-ridge profile line. */
export const ROOF_LIFT = 0.08 * F
/** Opaque roof slab thickness (panel plus rib height, slightly exaggerated). */
export const ROOF_SLAB_T = 0.12 * F
/** Gap left at the ridge between the two slopes (the ridge cap covers it). */
const RIDGE_PULL = 0.06 * F

export type RoofOverhangs = {
  /** Horizontal eave overhang (gable and gambrel eaves, lean-to low eave), meters. */
  eave: number
  /** Lean-to high eave overhang, meters. */
  highEave: number
  /** Gable-end (rake) overhang, meters. */
  rake: number
  /** Gambrel lower-slope extension past the eave, measured along the slope, meters. */
  barnEaveAlongSlope: number
}

/**
 * Overhangs from Shed210 photos: storage, well and loafing eaves about 4"
 * with a 2-3" rake; carports about 3-4"; greenhouses a deeper 0.7 ft eave;
 * the lean-to low eave about 6-7". The Roof Overhang add-on extends eaves to 12".
 */
export function getRoofOverhangs(
  params: Pick<StructurePreviewParams, 'structureType' | 'addOns'>,
  style: RoofStyle
): RoofOverhangs {
  const addOn = Boolean(params.addOns?.includes('Roof Overhang'))
  const type = params.structureType
  let eaveFt = type === 'greenhouse' ? GREENHOUSE_EAVE_OVERHANG_FT : type === 'carport' ? 0.3 : 0.35
  if (style === 'lean-to') eaveFt = Math.max(eaveFt, 0.55)
  if (addOn) eaveFt = Math.max(eaveFt, 1)
  const rakeFt = type === 'greenhouse' ? GREENHOUSE_RAKE_OVERHANG_FT : 0.2
  return {
    eave: eaveFt * F,
    highEave: 0.2 * F,
    rake: rakeFt * F,
    barnEaveAlongSlope: (addOn ? 0.8 : 0.4) * F
  }
}

export type RoofSeg = {
  len: number
  rot: number
  x: number
  y: number
  /**
   * Local X range of the slab over the building (wall line to ridge or
   * pitch break), excluding overhangs: where rafters and purlins go.
   */
  inner: [number, number]
}

/** BoxGeometry face (group) order. */
export const BOX_FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const

/**
 * Box whose index is regrouped into two draw groups: material 0 for five
 * faces and material 1 for `face` (a plain 6-material box costs 6 draws).
 */
export function boxWithOneFace(w: number, h: number, d: number, face: number) {
  const geometry = new THREE.BoxGeometry(w, h, d)
  const index = geometry.getIndex()
  if (!index) return geometry
  const rest: number[] = []
  const one: number[] = []
  for (const group of geometry.groups) {
    const target = group.materialIndex === face ? one : rest
    for (let i = group.start; i < group.start + group.count; i++) target.push(index.getX(i))
  }
  geometry.setIndex([...rest, ...one])
  geometry.clearGroups()
  geometry.addGroup(0, rest.length, 0)
  geometry.addGroup(rest.length, one.length, 1)
  return geometry
}

/** World (floor-relative) X/Y of a point given in a segment's local frame. */
export function segPoint(seg: RoofSeg, lx: number, ly: number): [number, number] {
  const c = Math.cos(seg.rot)
  const s = Math.sin(seg.rot)
  return [seg.x + lx * c - ly * s, seg.y + lx * s + ly * c]
}

export function buildRoofSegments(style: RoofStyle, length: number, wall: number, rise: number, over: RoofOverhangs): RoofSeg[] {
  if (style === 'gabled') {
    const ang = Math.atan2(rise, length / 2)
    const sA = Math.sin(ang)
    const cA = Math.cos(ang)
    const eave = over.eave / cA
    const segLen = Math.hypot(length / 2, rise) + eave - RIDGE_PULL
    const d = RIDGE_PULL + segLen / 2
    return [1, -1].map((dir) => ({
      len: segLen,
      rot: dir * ang,
      x: -dir * cA * d,
      y: wall + rise - sA * d + ROOF_LIFT,
      // dir 1 is the -X slope: its eave is at local -X.
      inner: dir === 1 ? [-segLen / 2 + eave, segLen / 2] : [-segLen / 2, segLen / 2 - eave]
    }))
  }
  if (style === 'barn') {
    const { bx, r1 } = getGambrelProfile(length)
    // Segment between two points, local +X pointing toward +X world.
    const seg = (a: [number, number], b: [number, number], trimA: number, trimB: number): RoofSeg => {
      const [p, q, tp, tq] = b[0] < a[0] ? [b, a, trimB, trimA] : [a, b, trimA, trimB]
      const len = Math.hypot(q[0] - p[0], q[1] - p[1])
      return {
        len,
        rot: Math.atan2(q[1] - p[1], q[0] - p[0]),
        x: (p[0] + q[0]) / 2,
        y: (p[1] + q[1]) / 2 + ROOF_LIFT,
        inner: [-len / 2 + tp, len / 2 - tq]
      }
    }
    const segs: RoofSeg[] = []
    for (const s of [1, -1]) {
      const E: [number, number] = [(s * length) / 2, wall]
      const B: [number, number] = [s * bx, wall + r1]
      const R: [number, number] = [0, wall + rise]
      // lower (steep): extend past the eave, pull back a hair from the pitch break
      const l1 = Math.hypot(E[0] - B[0], E[1] - B[1])
      const u1: [number, number] = [(E[0] - B[0]) / l1, (E[1] - B[1]) / l1]
      const ext = over.barnEaveAlongSlope
      const pull = 0.05 * F
      segs.push(
        seg([E[0] + u1[0] * ext, E[1] + u1[1] * ext], [B[0] + u1[0] * pull, B[1] + u1[1] * pull], ext, 0)
      )
      // upper (shallow): pull back from the ridge (the cap covers the gap)
      const l2 = Math.hypot(B[0] - R[0], B[1] - R[1])
      const u2: [number, number] = [(B[0] - R[0]) / l2, (B[1] - R[1]) / l2]
      segs.push(seg(B, [R[0] + u2[0] * RIDGE_PULL, R[1] + u2[1] * RIDGE_PULL], 0, 0))
    }
    return segs
  }
  // lean-to: single slab rising toward +X, a deeper low eave than high eave
  const ang = Math.atan2(rise, length)
  const cA = Math.cos(ang)
  const lo = over.eave / cA
  const hi = over.highEave / cA
  const len = Math.hypot(length, rise) + lo + hi
  const shift = (hi - lo) / 2
  return [
    {
      len,
      rot: ang,
      x: cA * shift,
      y: wall + rise / 2 + Math.sin(ang) * shift + ROOF_LIFT,
      inner: [-len / 2 + lo, len / 2 - hi]
    }
  ]
}

/** Angle of the slopes that meet at the ridge (gambrel: the upper slopes). */
export function ridgeAngle(style: RoofStyle, length: number, rise: number) {
  if (style === 'barn') {
    const { bx, r1 } = getGambrelProfile(length)
    return Math.atan2(rise - r1, bx)
  }
  return Math.atan2(rise, length / 2)
}

/** Roof-line height above the floor at `x` along the end-wall profile. */
export function profileHeightAt(style: RoofStyle, length: number, wall: number, rise: number, x: number) {
  const half = length / 2
  const cx = Math.max(-half, Math.min(half, x))
  if (style === 'lean-to') return wall + (rise * (cx + half)) / length
  const ax = Math.abs(cx)
  if (style === 'barn') {
    const { bx, r1 } = getGambrelProfile(length)
    if (ax >= bx) return wall + (r1 * (half - ax)) / (half - bx)
    return wall + r1 + ((rise - r1) * (bx - ax)) / bx
  }
  return wall + rise * (1 - ax / half)
}

/** Full end-wall outline from `-ext` (below the floor) up the roof profile. */
export function buildEndWallShape(style: RoofStyle, length: number, wall: number, rise: number, ext: number) {
  const half = length / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half, -ext)
  shape.lineTo(half, -ext)
  if (style === 'barn') {
    const { bx, r1 } = getGambrelProfile(length)
    shape.lineTo(half, wall)
    shape.lineTo(bx, wall + r1)
    shape.lineTo(0, wall + rise)
    shape.lineTo(-bx, wall + r1)
    shape.lineTo(-half, wall)
  } else if (style === 'lean-to') {
    shape.lineTo(half, wall + rise)
    shape.lineTo(-half, wall)
  } else {
    shape.lineTo(half, wall)
    shape.lineTo(0, wall + rise)
    shape.lineTo(-half, wall)
  }
  shape.closePath()
  return shape
}

/** End wall below the eave line only (the 2-Tone add-on paints the gable above it). */
export function buildEndWallBaseShape(length: number, wall: number, ext: number) {
  const half = length / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half, -ext)
  shape.lineTo(half, -ext)
  shape.lineTo(half, wall)
  shape.lineTo(-half, wall)
  shape.closePath()
  return shape
}

/** Just the roof-profile portion of an end wall (from the eave line up). */
export function buildGableInfillShape(style: RoofStyle, length: number, wall: number, rise: number) {
  const half = length / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half, wall)
  if (style === 'barn') {
    const { bx, r1 } = getGambrelProfile(length)
    shape.lineTo(-bx, wall + r1)
    shape.lineTo(0, wall + rise)
    shape.lineTo(bx, wall + r1)
    shape.lineTo(half, wall)
  } else if (style === 'lean-to') {
    shape.lineTo(half, wall + rise)
    shape.lineTo(half, wall)
  } else {
    shape.lineTo(0, wall + rise)
    shape.lineTo(half, wall)
  }
  shape.closePath()
  return shape
}
