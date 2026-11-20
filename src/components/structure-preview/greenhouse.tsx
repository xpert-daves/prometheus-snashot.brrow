'use client'

import * as THREE from 'three'
import { memo, useEffect, useMemo } from 'react'
import { maxWindowHeightFromFloor } from '@/lib/quoteVisualPlacement'
import { FOOT, type DoorSpec, type Side, type WindowSpec } from './types'
import { RIB, usePanelNormalTexture } from './textures'
import { usePanelMaterial, useSimpleMaterial, useTrimMaterial } from './materials'
import {
  LUMBER_HEX,
  POLY_TILE_ACROSS_FT,
  POLY_TILE_ALONG_FT,
  deckPlankRepeat,
  getLumberGrainTexture,
  useDeckPlankTexture,
  usePolycarbonateTextures,
  type PolycarbonateKind
} from './woodTextures'
import { LouverVent, SolarVentPanel, solarPanelPoseOnGable, useMergedBoxes, type BoxSpec } from './ventVisuals'

// ---------------------------------------------------------------------------
// Shed210 greenhouse, modeled on the Luling / Boerne / Floresville / Natalia
// builds: a wall-color ribbed metal knee wall on all four walls, clear
// corrugated polycarbonate above it, opaque metal gables, a clear roof, and
// the treated-pine framing, benches and deck that show through. Everything
// here is floor-relative; layout math is in feet, geometry in meters.
// Axes follow ShedBuilderModel: gable span `length` on X, ridge along Z,
// front (door) wall at +Z.
// ---------------------------------------------------------------------------

const F = FOOT

/** Top of the metal knee wall above the floor (34", Luling and Boerne). */
export const GREENHOUSE_KNEE_FT = 34 / 12
/** Potting benches on both long walls. Most builds have them; flip to make them Workbench-only. */
export const GREENHOUSE_BENCHES_DEFAULT = true
/** Horizontal eave overhang and gable (rake) overhang of the clear roof. */
export const GREENHOUSE_EAVE_OVERHANG_FT = 0.7
export const GREENHOUSE_RAKE_OVERHANG_FT = 0.25
/** The knee siding runs this far below the floor, over the rim joist. */
export const GREENHOUSE_SIDING_DROP_FT = 2 / 12

/** Benches render by default, or whenever the Workbench add-on is chosen. */
export function greenhouseHasBenches(addOns?: string[]) {
  return GREENHOUSE_BENCHES_DEFAULT || Boolean(addOns?.includes('Workbench'))
}

const KNEE = GREENHOUSE_KNEE_FT
const BENCH_TOP = KNEE + 1 / 12
/** Lumber: 1.5" thickness, 2x4 and 2x6 depths. */
const T = 1.5 / 12
const D4 = 3.5 / 12
const D6 = 5.5 / 12
/** Gap between the wall sheet and the stud faces (keeps them from z-fighting). */
const STUD_GAP = 0.025
const STUD_N = -(STUD_GAP + D4 / 2)
/** Long-wall eave band (double plate + rafter seats) and end-wall double plate. */
const EAVE_BAND = 0.5
const END_PLATE = 0.25
/** Purlin tops sit just under the roof sheet. */
const PURLIN_TOP = 0.04
/** Inside face of the knee and gables, just inside the outer sheet. */
const INNER_N = -0.012
const INSIDE_HEX = '#dcdcd4'
/** Greenhouse door casing head and jamb boards. */
const DOOR_HEAD = 0.22
const DOOR_JAMB = 0.29
/** Louver opening and its casing. */
const VENT_SIZE = 1.1
const VENT_CASING = 0.15

const SIDES: Side[] = ['front', 'back', 'left', 'right']

function isEndWall(side: Side) {
  return side === 'front' || side === 'back'
}

/** Equal stud bays per wall: 24-36" o.c. like the builds (4 bays minimum). */
function bays(spanFt: number) {
  return Math.max(4, Math.ceil(spanFt / 3))
}

/**
 * Wall-local point (along the wall, height, outward offset) to floor-relative
 * coordinates, using the same along-axis as `sideTransform`.
 */
function wallPoint(side: Side, L: number, W: number, a: number, y: number, n: number): [number, number, number] {
  switch (side) {
    case 'front':
      return [a, y, W / 2 + n]
    case 'back':
      return [-a, y, -W / 2 - n]
    case 'left':
      return [-L / 2 - n, y, a]
    default:
      return [L / 2 + n, y, -a]
  }
}

const SIDE_NORMAL: Record<Side, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0]
}

const SIDE_ROTATION: Record<Side, number> = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }

type Interval = [number, number]
type Rect = { a0: number; a1: number; y0: number; y1: number }
type Opening = Rect & { side: Side; kind: 'door' | 'window' }

function subtractInterval(segs: Interval[], [c0, c1]: Interval): Interval[] {
  const out: Interval[] = []
  for (const [s0, s1] of segs) {
    if (c1 <= s0 || c0 >= s1) {
      out.push([s0, s1])
      continue
    }
    if (c0 > s0) out.push([s0, c0])
    if (c1 < s1) out.push([c1, s1])
  }
  return out
}

/** Splits a wall zone into rectangles that avoid the holes (doors, windows). */
function subtractRects(zone: Rect, holes: Rect[]): Rect[] {
  const clipped = holes
    .map((h) => ({
      a0: Math.max(zone.a0, h.a0),
      a1: Math.min(zone.a1, h.a1),
      y0: Math.max(zone.y0, h.y0),
      y1: Math.min(zone.y1, h.y1)
    }))
    .filter((h) => h.a1 - h.a0 > 1e-6 && h.y1 - h.y0 > 1e-6)
  const xs = Array.from(new Set([zone.a0, zone.a1, ...clipped.flatMap((h) => [h.a0, h.a1])])).sort((p, q) => p - q)
  const out: Rect[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    const a0 = xs[i]
    const a1 = xs[i + 1]
    if (a1 - a0 < 1e-6) continue
    let ys: Interval[] = [[zone.y0, zone.y1]]
    for (const h of clipped) {
      if (h.a0 <= a0 + 1e-9 && h.a1 >= a1 - 1e-9) ys = subtractInterval(ys, [h.y0, h.y1])
    }
    for (const [y0, y1] of ys) if (y1 - y0 > 1e-6) out.push({ a0, a1, y0, y1 })
  }
  return out
}

function doorOpening(door: DoorSpec): Opening {
  return {
    side: door.side,
    kind: 'door',
    a0: door.offset - door.width / 2,
    a1: door.offset + door.width / 2,
    y0: 0,
    y1: door.height
  }
}

function windowOpening(win: WindowSpec, wallFt: number): Opening {
  // Same clamp WindowPanel applies, so the opening matches the drawn window.
  const base = Math.min(win.heightFromFloor, maxWindowHeightFromFloor(wallFt, win.height))
  return {
    side: win.side,
    kind: 'window',
    a0: win.offset - win.width / 2,
    a1: win.offset + win.width / 2,
    y0: base,
    y1: base + win.height
  }
}

// ---------------------------------------------------------------------------
// Louvered vents
// ---------------------------------------------------------------------------

export type GreenhouseVent = {
  side: Side
  /** Center along the wall (same axis as door/window offsets), ft. */
  along: number
  /** Louver opening bottom/top above the floor, ft. */
  y0: number
  y1: number
  width: number
  /** Solar Vent Fan shroud behind this louver. */
  fan: boolean
  /** Sits on the door header (front transom vent). */
  overDoor: boolean
  doorTop?: number
}

/**
 * Front louver over a walk door, as on the taller Floresville and Natalia
 * builds: only when the wall leaves at least 1.1 ft above the door.
 */
export function frontLouverForDoor(wallFt: number, door: DoorSpec): GreenhouseVent | null {
  if (door.side !== 'front' || door.width >= 7) return null
  if (wallFt - door.height < 1.1) return null
  const y0 = door.height + DOOR_HEAD + VENT_CASING
  // Sits on the door head, up to the plate (never taller than a gable louver).
  const y1 = Math.min(wallFt - END_PLATE, y0 + VENT_SIZE)
  if (y1 - y0 < 0.4) return null
  return {
    side: 'front',
    along: door.offset,
    y0,
    y1,
    width: Math.min(1.25, Math.max(0.8, door.width - 0.6)),
    fan: false,
    overDoor: true,
    doorTop: door.height
  }
}

/**
 * Floor-relative height (meters) the door placard must clear on a greenhouse:
 * the door casing head, or the transom louver above it.
 */
export function greenhouseSignBase(wall: number, door: DoorSpec) {
  const louver = frontLouverForDoor(wall / FOOT, door)
  if (louver) return (louver.y1 + VENT_CASING) * FOOT
  return (door.height + DOOR_HEAD) * FOOT
}

function ventFits(side: Side, along: number, width: number, y0: number, y1: number, spanFt: number, openings: Opening[]) {
  const half = width / 2 + VENT_CASING
  if (Math.abs(along) + half > spanFt / 2 - 0.35) return false
  return !openings.some(
    (o) =>
      o.side === side &&
      along + half + 0.15 > o.a0 - 0.3 &&
      along - half - 0.15 < o.a1 + 0.3 &&
      y1 + VENT_CASING + 0.1 > o.y0 - 0.3 &&
      y0 - VENT_CASING - 0.1 < o.y1 + 0.3
  )
}

/** Nearest spot to `preferred` (0.5 ft steps) where the louver clears doors and windows. */
function placeVent(side: Side, preferred: number, y0: number, y1: number, spanFt: number, openings: Opening[]) {
  for (let k = 0; k <= Math.ceil(spanFt * 2); k++) {
    for (const s of k === 0 ? [1] : [1, -1]) {
      const along = preferred + s * k * 0.5
      if (ventFits(side, along, VENT_SIZE, y0, y1, spanFt, openings)) return along
    }
  }
  return null
}

/**
 * Louvers on a greenhouse: the back gable vent (every build), a transom
 * louver over tall front doors, and with the Solar Vent Fan an eave-wall
 * intake louver plus the fan shroud behind the back louver.
 */
export function computeGreenhouseVents({
  lengthFt,
  widthFt,
  wallFt,
  doors,
  windows,
  ventilation
}: {
  lengthFt: number
  widthFt: number
  wallFt: number
  doors: DoorSpec[]
  windows: WindowSpec[]
  ventilation: boolean
}): GreenhouseVent[] {
  const openings = [...doors.map(doorOpening), ...windows.map((w) => windowOpening(w, wallFt))]
  const vents: GreenhouseVent[] = []
  for (const door of doors) {
    const louver = frontLouverForDoor(wallFt, door)
    if (louver) vents.push(louver)
  }
  const by1 = wallFt - END_PLATE
  const by0 = by1 - VENT_SIZE
  const back = placeVent('back', 0, by0, by1, lengthFt, openings)
  if (back !== null) {
    vents.push({ side: 'back', along: back, y0: by0, y1: by1, width: VENT_SIZE, fan: ventilation, overDoor: false })
  }
  if (ventilation) {
    const ey1 = wallFt - EAVE_BAND
    const ey0 = ey1 - VENT_SIZE
    // Toward the front of the left eave wall, opposite the first default window.
    const limit = Math.max(0, widthFt / 2 - 1.2)
    const preferred = Math.max(-limit, Math.min(limit, widthFt / 2 - 4))
    for (const side of ['left', 'right'] as const) {
      const along = placeVent(side, preferred, ey0, ey1, widthFt, openings)
      if (along !== null) {
        vents.push({ side, along, y0: ey0, y1: ey1, width: VENT_SIZE, fan: false, overDoor: false })
        break
      }
    }
  }
  return vents
}

// ---------------------------------------------------------------------------
// Framing (one InstancedMesh of treated-pine boxes)
// ---------------------------------------------------------------------------

export type FramingMember = {
  /** Center and size in feet, floor-relative; optional rotation about Z. */
  c: [number, number, number]
  s: [number, number, number]
  rz?: number
}

type FramingInput = {
  lengthFt: number
  widthFt: number
  wallFt: number
  riseFt: number
  doors: DoorSpec[]
  windows: WindowSpec[]
  vents: GreenhouseVent[]
  benches: boolean
}

/**
 * Member list for the greenhouse frame, following the build photos: studs at
 * equal 24-36" bays with jacks, headers and sills around live doors, windows
 * and vents; long-wall eave bands; end-wall double plates; corner posts;
 * rafters in line with the long-wall studs; ridge; purlins; gable king posts;
 * and wall-hung potting benches.
 */
export function buildGreenhouseFraming({
  lengthFt: L,
  widthFt: W,
  wallFt: H,
  riseFt: rise,
  doors,
  windows,
  vents,
  benches
}: FramingInput): FramingMember[] {
  const members: FramingMember[] = []
  const openings = [...doors.map(doorOpening), ...windows.map((w) => windowOpening(w, H))]

  const wallBox = (side: Side, a0: number, a1: number, y0: number, y1: number, depth = D4, n = STUD_N) => {
    if (a1 - a0 < 1e-3 || y1 - y0 < 1e-3) return
    const along = a1 - a0
    const h = y1 - y0
    members.push({
      c: wallPoint(side, L, W, (a0 + a1) / 2, (y0 + y1) / 2, n),
      s: isEndWall(side) ? [along, h, depth] : [depth, h, along]
    })
  }

  // Studs and plates come out of the long walls' corner posts; end walls fill between them.
  const longStuds = Array.from({ length: bays(W) - 1 }, (_, i) => -W / 2 + ((i + 1) * W) / bays(W))

  for (const side of SIDES) {
    const end = isEndWall(side)
    const span = end ? L : W
    const half = span / 2
    const aMax = end ? half - STUD_GAP - D4 : half - STUD_GAP
    const aMin = -aMax
    const clampA = (a: number) => Math.max(aMin, Math.min(aMax, a))
    const inside = (a0: number, a1: number) => a0 >= aMin - 1e-6 && a1 <= aMax + 1e-6
    const plateBottom = end ? H - END_PLATE : H - EAVE_BAND
    const here = openings.filter((o) => o.side === side)
    const doorsHere = here.filter((o) => o.kind === 'door')
    const windowsHere = here.filter((o) => o.kind === 'window')
    const ventsHere = vents.filter((v) => v.side === side)

    // Eave band or double top plate; bottom plate broken at doors.
    wallBox(side, aMin, aMax, plateBottom, H)
    let plate: Interval[] = [[aMin, aMax]]
    for (const o of doorsHere) plate = subtractInterval(plate, [o.a0, o.a1])
    for (const [a0, a1] of plate) wallBox(side, a0, a1, 0, T)
    if (!end) {
      wallBox(side, aMin, aMin + D4, T, plateBottom, D4)
      wallBox(side, aMax - D4, aMax, T, plateBottom, D4)
    }

    const studs = end ? Array.from({ length: bays(L) - 1 }, (_, i) => -L / 2 + ((i + 1) * L) / bays(L)) : longStuds
    for (const p of studs) {
      let pieces: Interval[] = [[T, plateBottom]]
      let skip = false
      for (const o of here) {
        if (o.kind === 'door') {
          if (p > o.a0 - 2 * T - 0.17 && p < o.a1 + 2 * T + 0.17) skip = true
        } else if (p > o.a0 && p < o.a1) {
          // Cripples under the sill and over the header.
          pieces = subtractInterval(pieces, [o.y0 - T, o.y1 + T])
        } else if (p > o.a0 - T - 0.17 && p < o.a1 + T + 0.17) {
          skip = true
        }
      }
      for (const v of ventsHere) {
        if (p > v.along - v.width / 2 - T - 0.08 && p < v.along + v.width / 2 + T + 0.08) {
          pieces = subtractInterval(pieces, [v.y0 - T, Infinity])
        }
      }
      if (skip) continue
      for (const [y0, y1] of pieces) if (y1 - y0 > 0.2) wallBox(side, p - T / 2, p + T / 2, y0, y1)
    }

    // Door rough openings: jack + king studs and a 2x6 header, unless the
    // door reaches within 6.5" of the plate (then the jambs run to the plate).
    for (const o of doorsHere) {
      const top = Math.min(o.y1, plateBottom)
      const header = plateBottom - top >= 6.5 / 12
      const jackTop = header ? top : plateBottom
      const edges: [Interval, Interval][] = [
        [[o.a0 - T, o.a0], [o.a0 - 2 * T, o.a0 - T]],
        [[o.a1, o.a1 + T], [o.a1 + T, o.a1 + 2 * T]]
      ]
      for (const [jack, king] of edges) {
        if (inside(...jack)) wallBox(side, jack[0], jack[1], 0, jackTop)
        if (header && inside(...king)) wallBox(side, king[0], king[1], 0, plateBottom)
      }
      if (header) wallBox(side, clampA(o.a0 - 2 * T), clampA(o.a1 + 2 * T), top, Math.min(top + D6, plateBottom))
    }

    // Window rough openings: full-height jacks, a flat sill, and a header when there is room.
    for (const o of windowsHere) {
      for (const [j0, j1] of [
        [o.a0 - T, o.a0],
        [o.a1, o.a1 + T]
      ]) {
        if (inside(j0, j1)) wallBox(side, j0, j1, T, plateBottom)
      }
      const a0 = clampA(o.a0)
      const a1 = clampA(o.a1)
      if (o.y0 - T > T + 0.05) wallBox(side, a0, a1, o.y0 - T, o.y0)
      if (plateBottom - o.y1 > T + 0.04) wallBox(side, a0, a1, o.y1, o.y1 + T)
    }

    // Vents: jamb cripples to the plate on a flat sill spanning to the
    // neighboring studs (or on the door header for a transom louver).
    for (const v of ventsHere) {
      const a0 = v.along - v.width / 2
      const a1 = v.along + v.width / 2
      const base = v.overDoor ? Math.min((v.doorTop ?? v.y0) + D6, plateBottom) : v.y0
      for (const [j0, j1] of [
        [a0 - T, a0],
        [a1, a1 + T]
      ]) {
        if (inside(j0, j1)) wallBox(side, j0, j1, base, plateBottom)
      }
      if (!v.overDoor) {
        const left = Math.max(aMin, ...studs.filter((p) => p < a0 - T - 0.08).map((p) => p + T / 2))
        const right = Math.min(aMax, ...studs.filter((p) => p > a1 + T + 0.08).map((p) => p - T / 2))
        wallBox(side, left, right, v.y0 - T, v.y0)
      }
      if (plateBottom - v.y1 > T + 0.04) wallBox(side, a0, a1, v.y1, v.y1 + T)
    }
  }

  // ---- roof: rafters in line with the long-wall studs, ridge, purlins ----
  const ang = Math.atan2(rise, L / 2)
  const cosA = Math.cos(ang)
  const tanA = Math.tan(ang)
  /** Eave-to-ridge roof plane height at horizontal distance r from the ridge. */
  const plane = (r: number) => H + rise - r * tanA
  const rafterTop = (r: number) => plane(r) + PURLIN_TOP - T
  const xOut = L / 2 - STUD_GAP
  const xIn = T / 2
  const rc = (xOut + xIn) / 2
  const rafterLen = (xOut - xIn) / cosA
  const nR = bays(W)
  const zSpan = W - 2 * STUD_GAP - T
  for (let j = 0; j <= nR; j++) {
    const z = -zSpan / 2 + (j * zSpan) / nR
    for (const s of [1, -1]) {
      members.push({ c: [s * rc, rafterTop(rc) - D4 / 2 / cosA, z], s: [rafterLen, D4, T], rz: -s * ang })
    }
  }
  const ridgeTop = rafterTop(0)
  members.push({ c: [0, ridgeTop - D4 / 2, 0], s: [T, D4, W - 2 * STUD_GAP] })
  const slope = L / 2 / cosA
  const nMid = Math.max(1, Math.round(slope / 3) - 1)
  const rRidge = T / 2 + D4 / 2 + 0.05
  const purlinRs = [rRidge]
  for (let k = 1; k <= nMid; k++) purlinRs.push(rRidge + ((xOut - D4 / 2 - rRidge) * k) / (nMid + 1))
  for (const r of purlinRs) {
    for (const s of [1, -1]) {
      members.push({ c: [s * r, plane(r) + PURLIN_TOP - T / 2 / cosA, 0], s: [D4, T, W - 2 * STUD_GAP], rz: -s * ang })
    }
  }
  // Gable king posts (3.5" face toward the inside), plate to ridge.
  const kingTop = ridgeTop - D4
  if (kingTop - H > 0.15) {
    for (const z of [1, -1]) {
      members.push({ c: [0, (H + kingTop) / 2, z * (W / 2 - STUD_GAP - T / 2)], s: [D4, kingTop - H, T] })
    }
  }

  // ---- potting benches: wall-hung on both long walls, no legs ----
  if (benches) {
    const xin = L / 2 - STUD_GAP - D4
    const depth = Math.max(1, Math.min(22.75 / 12, (L - 3) / 2))
    const boards = Math.max(2, Math.min(4, Math.round((depth * 12 + 0.25) / 5.75)))
    const D = (boards * 5.75 - 0.25) / 12
    for (const s of [-1, 1]) {
      const side: Side = s < 0 ? 'left' : 'right'
      // Bench footprint across X, mirrored onto +X: [xin - D, xin] plus elbow room.
      const band: Interval = [xin - D - 0.3, xin]
      const overlapsBand = (x0: number, x1: number) => x1 > band[0] && x0 < band[1]
      let zStart = -W / 2 + STUD_GAP + D4
      let zEnd = W / 2 - STUD_GAP - D4 - 0.5
      for (const door of doors) {
        // Keep end-wall doors near the corner clear of the bench.
        const x0 = door.side === 'front' ? door.offset - door.width / 2 : -door.offset - door.width / 2
        const x1 = x0 + door.width
        const hits = s > 0 ? overlapsBand(x0, x1) : overlapsBand(-x1, -x0)
        if (door.side === 'front' && hits) zEnd = Math.min(zEnd, W / 2 - 3.2)
        if (door.side === 'back' && hits) zStart = Math.max(zStart, -W / 2 + 3.2)
      }
      let runs: Interval[] = zEnd > zStart ? [[zStart, zEnd]] : []
      for (const o of openings) {
        if (o.side !== side || o.kind !== 'door') continue
        const z0 = side === 'left' ? o.a0 : -o.a1
        const z1 = side === 'left' ? o.a1 : -o.a0
        runs = subtractInterval(runs, [z0 - 0.35, z1 + 0.35])
      }
      for (const [z0, z1] of runs) {
        const len = z1 - z0
        if (len < 1.5) continue
        const zc = (z0 + z1) / 2
        for (let k = 0; k < boards; k++) {
          members.push({ c: [s * (xin - (k * 5.75 + 2.75) / 12), BENCH_TOP - T / 2, zc], s: [5.5 / 12, T, len] })
        }
        members.push({ c: [s * (xin - D + T / 2), BENCH_TOP - T - D6 / 2, zc], s: [T, D6, len] })
        members.push({ c: [s * (xin - T / 2), BENCH_TOP - T - D4 / 2, zc], s: [T, D4, len] })
        // Knee braces at every other stud, stud to apron.
        const studZs = longStuds.map((p) => (side === 'left' ? p : -p)).sort((p, q) => p - q)
        let braceZs = studZs.filter((z) => z > z0 + 0.3 && z < z1 - 0.3).filter((_, i) => i % 2 === 0)
        if (braceZs.length === 0 && len >= 2.5) braceZs = [z0 + 0.6, z1 - 0.6]
        for (const z of braceZs) {
          const x0 = s * xin
          const y0 = 0.7
          const x1 = s * (xin - D + 2 * T)
          const y1 = BENCH_TOP - T - D6 + 0.05
          members.push({
            c: [(x0 + x1) / 2, (y0 + y1) / 2, z + T],
            s: [Math.hypot(x1 - x0, y1 - y0), D4, T],
            rz: Math.atan2(y1 - y0, x1 - x0)
          })
        }
      }
    }
  }

  return members
}

const AXIS_Y = new THREE.Vector3(0, 1, 0)
const AXIS_Z = new THREE.Vector3(0, 0, 1)

/**
 * Instance transform for a member, turned so the long axis is local X (the
 * grain map runs along U on the box faces that face along Y and Z).
 */
function composeMember(m: FramingMember, out: THREE.Matrix4) {
  const [sx, sy, sz] = m.s
  let size: [number, number, number] = [sx, sy, sz]
  const align = new THREE.Quaternion()
  if (sy > sx && sy >= sz) {
    align.setFromAxisAngle(AXIS_Z, Math.PI / 2)
    size = [sy, sx, sz]
  } else if (sz > sx && sz > sy) {
    align.setFromAxisAngle(AXIS_Y, -Math.PI / 2)
    size = [sz, sy, sx]
  }
  const q = new THREE.Quaternion().setFromAxisAngle(AXIS_Z, m.rz ?? 0).multiply(align)
  return out.compose(
    new THREE.Vector3(m.c[0] * F, m.c[1] * F, m.c[2] * F),
    q,
    new THREE.Vector3(size[0] * F, size[1] * F, size[2] * F)
  )
}

function useLumberMaterial() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', map: getLumberGrainTexture(), roughness: 0.85, metalness: 0 }),
    []
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

const GreenhouseFraming = memo(function GreenhouseFraming({ members }: { members: FramingMember[] }) {
  const material = useLumberMaterial()
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => unitBox.dispose(), [unitBox])
  const mesh = useMemo(() => {
    const instanced = new THREE.InstancedMesh(unitBox, material, Math.max(1, members.length))
    const matrix = new THREE.Matrix4()
    const base = new THREE.Color(LUMBER_HEX)
    const color = new THREE.Color()
    let seed = 11
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    members.forEach((m, i) => {
      instanced.setMatrixAt(i, composeMember(m, matrix))
      // Board-to-board tone: value x0.92-1.06 (lifted for the grain map), some greener boards.
      const v = (0.92 + rnd() * 0.14) * 1.04
      color.copy(base).multiplyScalar(v)
      if (rnd() < 0.3) color.g = Math.min(1, color.g * 1.035)
      instanced.setColorAt(i, color)
    })
    instanced.count = members.length
    instanced.castShadow = true
    instanced.receiveShadow = true
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.computeBoundingSphere()
    return instanced
  }, [members, unitBox, material])
  useEffect(
    () => () => {
      mesh.dispose()
    },
    [mesh]
  )
  return <primitive object={mesh} />
})

// ---------------------------------------------------------------------------
// Envelope: knee walls, clear walls, gables
// ---------------------------------------------------------------------------

class SheetBuilder {
  private positions: number[] = []
  private normals: number[] = []
  private uvs: number[] = []
  private indices: number[] = []

  /** Adds a flat polygon (3 or 4 points, counter-clockwise seen from the normal side). */
  add(points: [number, number, number][], normal: [number, number, number], uvs: [number, number][], flip: boolean) {
    const base = this.positions.length / 3
    const n = flip ? normal.map((c) => -c) : normal
    points.forEach((p, i) => {
      this.positions.push(p[0] * F, p[1] * F, p[2] * F)
      this.normals.push(n[0], n[1], n[2])
      this.uvs.push(uvs[i][0], uvs[i][1])
    })
    for (let i = 1; i < points.length - 1; i++) {
      if (flip) this.indices.push(base, base + i + 1, base + i)
      else this.indices.push(base, base + i, base + i + 1)
    }
  }

  build() {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2))
    geometry.setIndex(this.indices)
    geometry.computeBoundingSphere()
    return geometry
  }
}

type EnvelopeInput = {
  lengthFt: number
  widthFt: number
  wallFt: number
  riseFt: number
  sidingBottomFt: number
  doors: DoorSpec[]
  windows: WindowSpec[]
}

/**
 * Sheet geometry with door and window holes: the wall-color metal (knee
 * walls + gables), its off-white inside face, and the clear walls. Metal UVs
 * are in ag-panel tiles (24" across, one 9" rib up, a whole rib at the knee
 * top so the door's lower panel lines up); clear UVs put a fastener column
 * on every stud and a sheet lap at the knee top.
 */
function buildEnvelope({ lengthFt: L, widthFt: W, wallFt: H, riseFt: rise, sidingBottomFt, doors, windows }: EnvelopeInput) {
  const outer = new SheetBuilder()
  const inner = new SheetBuilder()
  const clear = new SheetBuilder()
  const openings = [...doors.map(doorOpening), ...windows.map((w) => windowOpening(w, H))]
  const metalUV = (a: number, y: number): [number, number] => [a / 2, (y - KNEE) * RIB]

  for (const side of SIDES) {
    const span = isEndWall(side) ? L : W
    const half = span / 2
    const normal = SIDE_NORMAL[side]
    const holes: Rect[] = openings
      .filter((o) => o.side === side)
      .map((o) => ({ a0: o.a0, a1: o.a1, y0: o.kind === 'door' ? 0 : o.y0, y1: o.y1 }))
    const bay = span / bays(span)
    const clearUV = (a: number, y: number): [number, number] => [(a + half) / bay / 4, (y - KNEE) / POLY_TILE_ACROSS_FT]
    const rects = (sheet: SheetBuilder, zone: Rect, n: number, flip: boolean, uv: (a: number, y: number) => [number, number]) => {
      for (const r of subtractRects(zone, holes)) {
        const pts: [number, number][] = [
          [r.a0, r.y0],
          [r.a1, r.y0],
          [r.a1, r.y1],
          [r.a0, r.y1]
        ]
        sheet.add(
          pts.map(([a, y]) => wallPoint(side, L, W, a, y, n)),
          normal,
          pts.map(([a, y]) => uv(a, y)),
          flip
        )
      }
    }
    rects(outer, { a0: -half, a1: half, y0: sidingBottomFt, y1: KNEE }, 0, false, metalUV)
    rects(inner, { a0: -half, a1: half, y0: 0, y1: KNEE }, INNER_N, true, metalUV)
    rects(clear, { a0: -half, a1: half, y0: KNEE, y1: H }, 0, false, clearUV)
    if (isEndWall(side)) {
      const tri: [number, number][] = [
        [-half, H],
        [half, H],
        [0, H + rise]
      ]
      for (const [sheet, n, flip] of [
        [outer, 0, false],
        [inner, INNER_N, true]
      ] as const) {
        sheet.add(
          tri.map(([a, y]) => wallPoint(side, L, W, a, y, n)),
          normal,
          tri.map(([a, y]) => metalUV(a, y)),
          flip
        )
      }
    }
  }
  return { outer: outer.build(), inner: inner.build(), clear: clear.build() }
}

/** Grazing-angle opacity boost [strength, falloff power] per sheet kind. */
const CLEAR_FRESNEL: Record<PolycarbonateKind, [number, number]> = { wall: [0.55, 2.6], roof: [1, 1.4] }

/**
 * Corrugation relief from the shared panel normal maps (one rib per tile):
 * profile, relief strength, and the phase that puts its rib crest on the
 * bright streak of the polycarbonate texture (4 ribs per polycarbonate tile).
 */
const CLEAR_RELIEF: Record<PolycarbonateKind, { profile: 'ag' | 'rib'; scale: number; phase: number }> = {
  wall: { profile: 'ag', scale: 0.8, phase: 0.836 },
  roof: { profile: 'rib', scale: 2.4, phase: 0.344 }
}

/**
 * Clear corrugated polycarbonate: colorless (never wall- or roof-tinted),
 * standard material, no depth writes. `repX`/`repY` are polycarbonate tiles
 * (POLY_TILE_ALONG_FT along the ribs, POLY_TILE_ACROSS_FT across them); pass
 * 1/1 for geometry whose UVs are already in tiles.
 *
 * Like the real sheets, it turns milky and reflective at grazing angles (a
 * low view of the roof from outside reads silver-white, while the same roof
 * seen from inside is clear), via a small Fresnel term on the alpha.
 */
export function useClearPanelMaterial(kind: PolycarbonateKind, repX = 1, repY = 1, offsetY = 0) {
  const { map, alphaMap } = usePolycarbonateTextures(kind, repX, repY, offsetY)
  const relief = CLEAR_RELIEF[kind]
  const normalMap = usePanelNormalTexture(1, repY * 4, true, relief.profile, false)
  normalMap.offset.y = offsetY * 4 + relief.phase
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map,
      alphaMap,
      normalMap,
      normalScale: new THREE.Vector2(relief.scale, relief.scale),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: kind === 'roof' ? 0.3 : 0.24,
      metalness: 0,
      envMapIntensity: 1.25
    })
    // Thin single sheets: one pass is enough and halves the transparent draws.
    m.forceSinglePass = true
    const [strength, power] = CLEAR_FRESNEL[kind]
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float ghGrazing = 1.0 - abs( dot( normalize( vViewPosition ), normal ) );
        diffuseColor.a = mix( diffuseColor.a, 1.0, ${strength.toFixed(3)} * pow( ghGrazing, ${power.toFixed(3)} ) );
        #include <opaque_fragment>`
      )
    }
    m.customProgramCacheKey = () => `greenhouse-clear-${kind}`
    return m
  }, [map, alphaMap, normalMap, relief.scale, kind])
  useEffect(() => () => material.dispose(), [material])
  return material
}

/** Polycarbonate repeat for a roof slab plane `segLenFt` down the slope by `depthFt` along the ridge. */
export function greenhouseRoofRepeat(segLenFt: number, depthFt: number): [number, number] {
  return [segLenFt / POLY_TILE_ALONG_FT, depthFt / POLY_TILE_ACROSS_FT]
}

export type GreenhouseEnclosureProps = {
  lengthFt: number
  widthFt: number
  wallFt: number
  riseFt: number
  baseColor: string
  trimColor: string
  doors: DoorSpec[]
  windows: WindowSpec[]
  ventilation: boolean
  benches: boolean
  /** Plank deck floor (wood-floored foundations; a slab shows concrete). */
  deck: boolean
  /** Bottom of the knee siding, ft above the floor (negative = below). */
  sidingBottomFt: number
  /** Height of the roof sheet above the eave-to-ridge plane, ft. */
  roofLiftFt: number
}

/**
 * Greenhouse walls, gables, framing, benches, floor and vents. Rendered
 * inside ShedBuilderModel's floor-relative group; the roof slabs, rake trim,
 * ridge cap and corner trim stay in ShedBuilderModel.
 */
export const GreenhouseEnclosure = memo(function GreenhouseEnclosure({
  lengthFt,
  widthFt,
  wallFt,
  riseFt,
  baseColor,
  trimColor,
  doors,
  windows,
  ventilation,
  benches,
  deck,
  sidingBottomFt,
  roofLiftFt
}: GreenhouseEnclosureProps) {
  const vents = useMemo(
    () => computeGreenhouseVents({ lengthFt, widthFt, wallFt, doors, windows, ventilation }),
    [lengthFt, widthFt, wallFt, doors, windows, ventilation]
  )
  const members = useMemo(
    () => buildGreenhouseFraming({ lengthFt, widthFt, wallFt, riseFt, doors, windows, vents, benches }),
    [lengthFt, widthFt, wallFt, riseFt, doors, windows, vents, benches]
  )
  const envelope = useMemo(
    () => buildEnvelope({ lengthFt, widthFt, wallFt, riseFt, sidingBottomFt, doors, windows }),
    [lengthFt, widthFt, wallFt, riseFt, sidingBottomFt, doors, windows]
  )
  useEffect(
    () => () => {
      envelope.outer.dispose()
      envelope.inner.dispose()
      envelope.clear.dispose()
    },
    [envelope]
  )

  // Geometry UVs are already in panel tiles, so the materials repeat 1:1.
  const outerMat = usePanelMaterial(baseColor, 1, 1, true)
  const innerMat = usePanelMaterial(INSIDE_HEX, 1, 1, true, { metalness: 0.05, roughness: 0.6 })
  const clearMat = useClearPanelMaterial('wall')
  const [deckRepX, deckRepY] = deckPlankRepeat(lengthFt, widthFt)
  const deckTex = useDeckPlankTexture(deckRepX, deckRepY)
  const deckMat = useMemo(() => new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0 }), [deckTex])
  useEffect(() => () => deckMat.dispose(), [deckMat])

  const length = lengthFt * F
  const width = widthFt * F
  const solarPose = ventilation
    ? solarPanelPoseOnGable({ length, width, wall: wallFt * F, rise: riseFt * F, lift: (roofLiftFt + 0.01) * F })
    : null

  return (
    <group>
      <mesh geometry={envelope.outer} material={outerMat} castShadow receiveShadow />
      <mesh geometry={envelope.inner} material={innerMat} receiveShadow />
      <GreenhouseFraming members={members} />
      {deck ? (
        <mesh material={deckMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01 * F, 0]} receiveShadow>
          <planeGeometry args={[length, width]} />
        </mesh>
      ) : null}
      {/* clear sheets: no shadows, drawn after the opaque interior */}
      <mesh geometry={envelope.clear} material={clearMat} renderOrder={2} />
      {vents.map((v, i) => (
        <LouverVent
          key={`${v.side}-${i}`}
          width={v.width * F}
          height={(v.y1 - v.y0) * F}
          trimColor={trimColor}
          casing={VENT_CASING * F}
          fan={v.fan}
          position={wallPoint(v.side, length, width, v.along * F, ((v.y0 + v.y1) / 2) * F, 0.002 * F)}
          rotationY={SIDE_ROTATION[v.side]}
        />
      ))}
      {solarPose ? <SolarVentPanel pose={solarPose} /> : null}
    </group>
  )
})

// ---------------------------------------------------------------------------
// Greenhouse walk door
// ---------------------------------------------------------------------------

/**
 * Greenhouse walk door: trim-color frame and casing, wall-color ribbed metal
 * lower panel up to the knee line (ribs aligned with the knee wall), clear
 * polycarbonate upper, a treated 2x4 Z-frame behind the panels, butt hinges
 * and a T-handle latch. Doubles get two leaves and a center astragal.
 * Local frame: door center, +Z out of the wall (DoorPanel positions it).
 */
export function GreenhouseDoor({
  door,
  trimColor,
  wallColor,
  selected = false
}: {
  door: DoorSpec
  trimColor: string
  wallColor: string
  selected?: boolean
}) {
  const dW = door.width * F
  const dH = door.height * F
  const leaves = door.width >= 5 ? 2 : 1
  const leafWFt = door.width / leaves
  const leafW = leafWFt * F
  const kneeFt = Math.min(KNEE, door.height - 1)
  const upperFt = door.height - kneeFt

  const trimMat = useTrimMaterial(trimColor, selected ? 0.12 : 0)
  const ribs = kneeFt * RIB
  const panelMat = usePanelMaterial(door.color || wallColor, leafWFt / 2, ribs, true, {}, selected ? 0.22 : 0)
  const backMat = usePanelMaterial(INSIDE_HEX, leafWFt / 2, ribs, true, { metalness: 0.05, roughness: 0.6 })
  // A whole rib at the knee line, matching the knee wall's rib phase.
  const ribOffset = Math.floor(ribs) - ribs
  for (const texture of [panelMat.map, panelMat.normalMap, panelMat.bumpMap, backMat.map, backMat.normalMap]) {
    if (texture) texture.offset.y = ribOffset
  }
  const clearMat = useClearPanelMaterial('wall', leafWFt / POLY_TILE_ALONG_FT, upperFt / POLY_TILE_ACROSS_FT)
  const lumberMat = useSimpleMaterial({ color: LUMBER_HEX, map: getLumberGrainTexture(), roughness: 0.85 })
  const hardwareMat = useSimpleMaterial({ color: 0xc9ccce, metalness: 0.85, roughness: 0.3 })

  const yb = -dH / 2
  const yk = yb + kneeFt * F
  const yt = dH / 2
  const leafCenters = useMemo(
    () => Array.from({ length: leaves }, (_, i) => -dW / 2 + leafW * (i + 0.5)),
    [leaves, dW, leafW]
  )

  const parts = useMemo(() => {
    const jamb = DOOR_JAMB * F
    const head = DOOR_HEAD * F
    const drop = GREENHOUSE_SIDING_DROP_FT * F
    const stile = 0.2 * F
    const rail = 0.2 * F
    const trim: BoxSpec[] = [
      // casing: jambs down over the siding, head 2-3" wider than the jambs
      { center: [-(dW / 2 + jamb / 2), (yb - drop + yt) / 2, 0.04 * F], size: [jamb, yt - yb + drop, 0.08 * F] },
      { center: [dW / 2 + jamb / 2, (yb - drop + yt) / 2, 0.04 * F], size: [jamb, yt - yb + drop, 0.08 * F] },
      { center: [0, yt + head / 2, 0.045 * F], size: [dW + 2 * jamb + 0.2 * F, head, 0.09 * F] }
    ]
    const wood: BoxSpec[] = []
    const hardware: BoxSpec[] = []
    const t = T * F
    const d4 = D4 * F
    const zWood = 0.05 * F - t / 2 - 0.004 * F
    const brace = (x0: number, y0: number, x1: number, y1: number) => {
      wood.push({
        center: [(x0 + x1) / 2, (y0 + y1) / 2, zWood],
        size: [Math.hypot(x1 - x0, y1 - y0) - d4 * 0.6, d4, t],
        rotZ: Math.atan2(y1 - y0, x1 - x0)
      })
    }
    leafCenters.forEach((cx, i) => {
      // Single doors hinge on the left; doubles hinge on their outer edges.
      const hinge = leaves === 2 && i === 1 ? 1 : -1
      for (const s of [-1, 1]) {
        trim.push({ center: [cx + s * (leafW / 2 - stile / 2), 0, 0.075 * F], size: [stile, dH, 0.05 * F] })
        wood.push({ center: [cx + s * (leafW / 2 - d4 / 2), 0, zWood], size: [d4, dH - 0.04 * F, t] })
      }
      for (const [y, h] of [
        [yt - rail / 2, rail],
        [yk, rail],
        [yb + 0.13 * F, 0.26 * F]
      ]) {
        trim.push({ center: [cx, y, 0.075 * F], size: [leafW - 2 * stile, h, 0.05 * F] })
      }
      for (const y of [yt - d4 / 2 - 0.02 * F, yk, yb + d4 / 2 + 0.02 * F]) {
        wood.push({ center: [cx, y, zWood], size: [leafW - 2 * d4, d4, t] })
      }
      // Z-frame: hinge-side bottom to latch-side top in each panel.
      const xh = cx + hinge * (leafW / 2 - d4)
      const xl = cx - hinge * (leafW / 2 - d4)
      brace(xh, yk + d4 / 2, xl, yt - d4)
      brace(xh, yb + d4, xl, yk - d4 / 2)
      // Butt hinges on the hinge edge.
      for (const y of [yb + 0.75 * F, yk + 0.35 * F, yt - 0.6 * F]) {
        hardware.push({ center: [cx + hinge * (leafW / 2 + 0.01 * F), y, 0.1 * F], size: [0.13 * F, 0.28 * F, 0.03 * F] })
      }
    })
    if (leaves === 2) trim.push({ center: [0, 0, 0.11 * F], size: [0.12 * F, dH, 0.03 * F] })
    // T-handle latch just above the mid rail, on the latch stile.
    const latchX = leaves === 2 ? leafCenters[1] - (leafW / 2 - stile / 2) - 0.12 * F : dW / 2 - stile / 2
    const latchY = yb + Math.min(3.25, door.height - 1.2) * F
    hardware.push({ center: [latchX, latchY, 0.112 * F], size: [0.075 * F, 0.36 * F, 0.025 * F] })
    hardware.push({ center: [latchX, latchY + 0.08 * F, 0.15 * F], size: [0.045 * F, 0.045 * F, 0.07 * F] })
    hardware.push({ center: [latchX, latchY + 0.08 * F, 0.19 * F], size: [0.22 * F, 0.045 * F, 0.04 * F] })
    return { trim, wood, hardware }
  }, [dW, dH, door.height, leaves, leafW, leafCenters, yb, yk, yt])

  const trimGeom = useMergedBoxes(parts.trim)
  const woodGeom = useMergedBoxes(parts.wood)
  const hardwareGeom = useMergedBoxes(parts.hardware)

  return (
    <group>
      <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow />
      <mesh geometry={woodGeom} material={lumberMat} castShadow receiveShadow />
      <mesh geometry={hardwareGeom} material={hardwareMat} castShadow />
      {leafCenters.map((cx) => (
        <group key={cx}>
          <mesh material={panelMat} position={[cx, (yb + yk) / 2, 0.05 * F]} castShadow receiveShadow>
            <planeGeometry args={[leafW, yk - yb]} />
          </mesh>
          {/* off-white backer seen from inside, like the knee walls */}
          <mesh material={backMat} position={[cx, (yb + yk) / 2, 0.046 * F]} rotation={[0, Math.PI, 0]} receiveShadow>
            <planeGeometry args={[leafW, yk - yb]} />
          </mesh>
          <mesh material={clearMat} position={[cx, (yk + yt) / 2, 0.05 * F]} renderOrder={2}>
            <planeGeometry args={[leafW, yt - yk]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
