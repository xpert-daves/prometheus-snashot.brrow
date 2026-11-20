'use client'

import * as THREE from 'three'
import { memo, useEffect, useMemo } from 'react'
import { FOOT, type RoofStyle } from './types'
import { usePanelMaterial, useSimpleMaterial, useTrimMaterial, type PanelOptions } from './materials'
import { useMergedBoxes, type BoxSpec } from './ventVisuals'
import { DECK_TILE_ACROSS_FT, DECK_TILE_ALONG_FT, useDeckPlankTexture } from './woodTextures'
import { LumberInstances, spread, type LumberMember } from './baseVisuals'
import { ROOF_SLAB_T, buildGableInfillShape, profileHeightAt, segPoint, type RoofSeg } from './roofGeometry'

// ---------------------------------------------------------------------------
// Open structures (floor-relative, meters): the welded red-iron carport frame
// and the open loafing shed's posts, header, knee braces, interior framing,
// kick wall and dirt floor. Axes follow ShedBuilderModel.
// ---------------------------------------------------------------------------

const F = FOOT
const HALF_SLAB = ROOF_SLAB_T / 2

/** Red-oxide primer on welded square tube (San Antonio 20x24 carport). */
const RED_IRON_HEX = '#5c2e27'
/** Posts land only at the corners up to this clear span (ft), like the photo build. */
const CARPORT_MAX_BAY_FT = 25
const POST = 0.25 * F
const BEAM_H = 0.5 * F
/** Gable infill sits this far outside the end frames' outer face (m). */
const CARPORT_INFILL_OUT = 0.01 * F

/**
 * Tube member under a roof segment: local X range [x0, x1], its depth, set
 * `drop` below the slab underside, centered at `z` with Z extent `zLen`.
 */
function underSlab(seg: RoofSeg, x0: number, x1: number, depth: number, z: number, zLen: number, drop = 0): BoxSpec {
  const ly = -HALF_SLAB - 0.005 * F - drop - depth / 2
  const [x, y] = segPoint(seg, (x0 + x1) / 2, ly)
  return { center: [x, y, z], size: [x1 - x0, depth, zLen], rotZ: seg.rot }
}

export type CarportFrameProps = {
  length: number
  width: number
  wall: number
  rise: number
  roofStyle: RoofStyle
  segs: RoofSeg[]
  /** Roof (and gable infill) paint color and finish. */
  roofHex: string
  roofOpts: PanelOptions
}

/**
 * Welded red-iron carport: square-tube posts at the corners (more only when a
 * side exceeds 25 ft), eave headers and gable tie beams at the eave, rafters
 * on each frame line and purlins under the panels, and gable-end infill in
 * the roof color with vertical ribs. No base rails (posts go into the ground).
 */
export const CarportFrame = memo(function CarportFrame({
  length,
  width,
  wall,
  rise,
  roofStyle,
  segs,
  roofHex,
  roofOpts
}: CarportFrameProps) {
  const frameMat = useSimpleMaterial({ color: RED_IRON_HEX, metalness: 0.35, roughness: 0.55 })
  // Gable infill: roof-color panel with vertical ribs about 12" o.c. (ShapeGeometry UVs are meters).
  const infillMat = usePanelMaterial(roofHex, 1 / F, 1, false, { ...roofOpts, profile: 'rib', fasteners: false })
  const infillGeom = useMemo(
    () => new THREE.ShapeGeometry(buildGableInfillShape(roofStyle, length, wall, rise)),
    [roofStyle, length, wall, rise]
  )
  useEffect(() => () => infillGeom.dispose(), [infillGeom])

  const boxes = useMemo(() => {
    const out: BoxSpec[] = []
    const widthFt = width / F
    const frameZs = spread(-width / 2 + POST / 2, width / 2 - POST / 2, Math.max(2, Math.ceil(widthFt / CARPORT_MAX_BAY_FT) + 1))
    for (const s of [-1, 1]) {
      const h = roofStyle === 'lean-to' && s > 0 ? wall + rise : wall
      const x = s * (length / 2 - POST / 2)
      for (const z of frameZs) out.push({ center: [x, (h - BEAM_H) / 2, z], size: [POST, h - BEAM_H, POST] })
      // Eave header, its outer face flush with the posts.
      out.push({ center: [x, h - BEAM_H / 2, 0], size: [POST, BEAM_H, width] })
      // Gable-end tie beam at the eave (just under the header tops).
      out.push({
        center: [0, wall - BEAM_H / 2 - 0.005 * F, s * (width / 2 - POST / 2)],
        size: [length - POST * 2, BEAM_H, POST]
      })
    }
    for (const seg of segs) {
      const [a, b] = seg.inner
      // Rafters (2x5 tube) on every frame line, purlins (2x3 hat) on top of them about 4 ft o.c.
      for (const z of frameZs) out.push(underSlab(seg, a, b, 0.42 * F, z, POST, 0.22 * F))
      const n = Math.max(2, Math.ceil((b - a) / (4 * F)))
      for (const p of spread(a + 0.5 * F, b - 0.3 * F, n)) {
        out.push(underSlab(seg, p - 0.085 * F, p + 0.085 * F, 0.22 * F, 0, width - 0.1 * F))
      }
    }
    return out
  }, [length, width, wall, rise, roofStyle, segs])
  const frameGeom = useMergedBoxes(boxes)

  return (
    <group>
      <mesh geometry={frameGeom} material={frameMat} castShadow receiveShadow />
      {/* infill on the outer face of the end frames (rafters and tie beams sit behind it) */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          geometry={infillGeom}
          material={infillMat}
          position={[0, 0, s * (width / 2 + CARPORT_INFILL_OUT)]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
})

// ---------------------------------------------------------------------------
// Open loafing shed
// ---------------------------------------------------------------------------

/** 2x4 and 4x4 lumber (ft), and the doubled 2x6 header. */
const T = 1.5 / 12
const D4 = 3.5 / 12
const HEADER_H = 0.5
const HEADER_T = 0.25
/** Header trim band on the outside face (ft). */
const HEADER_TRIM_H = 0.42
const TRIM_T = 0.04
/** Studs sit just inside the siding; the kick wall is nailed to their inner faces. */
const STUD_GAP = 0.02
const KICK_INSET = STUD_GAP + D4 + 0.015
const KICK_WALL_FT = 4
/** Knee braces: 45 degrees with 2 ft legs. */
const BRACE_LEG = 2

/** Which side of a loafing shed is open: the +Z gable end, or the +X long eave side. */
export type LoafingOpenSide = 'front' | 'right'

/** Run-in sheds open along the long eave side; a deep, narrow one opens at the gable end. */
export function getLoafingOpenSide(lengthFt: number, widthFt: number): LoafingOpenSide {
  return widthFt > lengthFt ? 'right' : 'front'
}

type WallRun = {
  /** Wall plane: x = const (side walls) or z = const (end walls). */
  axis: 'x' | 'z'
  at: number
  /** Inward normal sign along the plane axis. */
  inward: 1 | -1
  /** Extent along the wall (meters). */
  from: number
  to: number
  /** Wall-top (plate) height; end walls also carry gable studs above it. */
  top: number
  gable: boolean
}

function closedWalls(open: LoafingOpenSide, length: number, width: number, wall: number, rise: number, roofStyle: RoofStyle): WallRun[] {
  const hx = length / 2
  const hz = width / 2
  const rightTop = roofStyle === 'lean-to' ? wall + rise : wall
  const runs: WallRun[] = [{ axis: 'x', at: -hx, inward: 1, from: -hz, to: hz, top: wall, gable: false }]
  if (open === 'front') {
    runs.push({ axis: 'x', at: hx, inward: -1, from: -hz, to: hz, top: rightTop, gable: false })
    runs.push({ axis: 'z', at: -hz, inward: 1, from: -hx, to: hx, top: wall, gable: true })
  } else {
    runs.push({ axis: 'z', at: -hz, inward: 1, from: -hx, to: hx, top: wall, gable: true })
    runs.push({ axis: 'z', at: hz, inward: -1, from: -hx, to: hx, top: wall, gable: true })
  }
  return runs
}

/** Point on a wall run: `along` the wall, `y` up, `inset` (ft) in from the siding. */
function runPoint(run: WallRun, along: number, y: number, inset: number): [number, number, number] {
  const n = run.at + run.inward * inset * F
  return run.axis === 'x' ? [n, y, along] : [along, y, n]
}

function buildLoafingMembers({
  length,
  width,
  wall,
  rise,
  roofStyle,
  segs,
  open
}: {
  length: number
  width: number
  wall: number
  rise: number
  roofStyle: RoofStyle
  segs: RoofSeg[]
  open: LoafingOpenSide
}) {
  const members: LumberMember[] = []
  const hx = length / 2
  const hz = width / 2

  // Studs at 24" o.c. and a doubled top plate on each closed wall; gable studs above the end-wall plate.
  for (const run of closedWalls(open, length, width, wall, rise, roofStyle)) {
    const span = run.to - run.from
    const n = Math.max(2, Math.round(span / (2 * F)) + 1)
    const plateH = 0.25 * F
    const studDepth: [number, number] = run.axis === 'x' ? [D4 * F, T * F] : [T * F, D4 * F]
    for (const a of spread(run.from + 0.1 * F, run.to - 0.1 * F, n)) {
      const h = run.top - plateH
      const [x, , z] = runPoint(run, a, 0, STUD_GAP + D4 / 2)
      members.push({ c: [x, h / 2, z], s: [studDepth[0], h, studDepth[1]] })
      if (run.gable) {
        const x0 = run.axis === 'z' ? a : 0
        const roofLine = profileHeightAt(roofStyle, length, wall, rise, x0) - 0.05 * F
        const gh = roofLine - run.top
        if (gh > 0.3 * F) members.push({ c: [x, run.top + gh / 2, z], s: [studDepth[0], gh, studDepth[1]] })
      }
    }
    const [px, , pz] = runPoint(run, (run.from + run.to) / 2, 0, STUD_GAP + D4 / 2)
    const plateLen = span - 0.04 * F
    members.push({
      c: [px, run.top - plateH / 2, pz],
      s: run.axis === 'x' ? [D4 * F, plateH, plateLen] : [plateLen, plateH, D4 * F]
    })
  }

  // Open side: posts, doubled header and knee braces in the plane of the opening.
  const openTop = open === 'right' && roofStyle === 'lean-to' ? wall + rise : wall
  const headerBottom = openTop - HEADER_H * F
  const along0 = open === 'front' ? -hx : -hz
  const along1 = -along0
  const inset = TRIM_T + D4 / 2
  const postCenter = (a: number) => (open === 'front' ? [a, hz - inset * F] : [hx - inset * F, a]) as [number, number]
  // Corner posts stand just inside the siding (never sharing its plane).
  const postEnd = (D4 / 2 + 0.03) * F
  const postAlong = spread(along0 + postEnd, along1 - postEnd, Math.max(2, Math.ceil((along1 - along0) / (10 * F)) + 1))
  for (const a of postAlong) {
    const [x, z] = postCenter(a)
    members.push({ c: [x, headerBottom / 2, z], s: [D4 * F, headerBottom, D4 * F] })
  }
  {
    const [x, z] = postCenter(0)
    const hInset = TRIM_T + HEADER_T / 2
    const hx2 = open === 'front' ? x : hx - hInset * F
    const hz2 = open === 'front' ? hz - hInset * F : z
    const len = along1 - along0 - 0.02 * F
    members.push({
      c: [hx2, openTop - (HEADER_H * F) / 2, hz2],
      s: open === 'front' ? [len, HEADER_H * F, HEADER_T * F] : [HEADER_T * F, HEADER_H * F, len]
    })
  }
  const braceLen = BRACE_LEG * Math.SQRT2 * F
  postAlong.forEach((a, i) => {
    for (const dir of [1, -1] as const) {
      if ((i === 0 && dir < 0) || (i === postAlong.length - 1 && dir > 0)) continue
      const along = a + dir * ((D4 / 2) * F + (BRACE_LEG / 2) * F)
      const y = headerBottom - (BRACE_LEG / 2) * F
      const [x, z] = postCenter(along)
      if (open === 'front') members.push({ c: [x, y, z], s: [braceLen, D4 * F, T * F], rz: (dir * Math.PI) / 4 })
      else members.push({ c: [x, y, z], s: [T * F, D4 * F, braceLen], rx: (-dir * Math.PI) / 4 })
    }
  })

  // Rafters at 24" o.c. under every slope.
  const zs = spread(-hz + 0.15 * F, hz - 0.15 * F, Math.max(2, Math.round(width / (2 * F)) + 1))
  for (const seg of segs) {
    const [a, b] = seg.inner
    const ly = -HALF_SLAB - 0.005 * F - (D4 / 2) * F
    const [x, y] = segPoint(seg, (a + b) / 2, ly)
    for (const z of zs) members.push({ c: [x, y, z], s: [b - a, D4 * F, T * F], rz: seg.rot })
  }
  return members
}

/** Kick-wall boards on the inner stud faces: UVs in deck-plank tiles so boards run horizontally. */
function buildKickWallGeometry(runs: WallRun[], open: LoafingOpenSide) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const h = KICK_WALL_FT * F
  for (const run of runs) {
    // Boards meet in the closed corners and stop just short of the open edge
    // (always the positive end: the +Z front or the +X side).
    const openAtEnd = (run.axis === 'x' && open === 'front') || (run.axis === 'z' && open === 'right')
    const a0 = run.from + KICK_INSET * F
    const a1 = run.to - (openAtEnd ? 0.03 : KICK_INSET) * F
    const base = positions.length / 3
    const corners: [number, number][] = [
      [a0, 0],
      [a1, 0],
      [a1, h],
      [a0, h]
    ]
    for (const [a, y] of corners) {
      positions.push(...runPoint(run, a, y, KICK_INSET))
      normals.push(...(run.axis === 'x' ? [run.inward, 0, 0] : [0, 0, run.inward]))
      uvs.push(y / F / DECK_TILE_ACROSS_FT, (a - a0) / F / DECK_TILE_ALONG_FT)
    }
    // Face the inside of the shed: unflipped, the quad faces -X on side walls and +Z on end walls.
    const flip = run.axis === 'x' ? run.inward > 0 : run.inward < 0
    if (flip) indices.push(base, base + 2, base + 1, base, base + 3, base + 2)
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

let dirtTexture: THREE.Texture | null = null

/** Packed dirt with a soft, irregular edge that fades into the lawn (alpha in the canvas). */
function getDirtTexture(): THREE.Texture {
  if (dirtTexture) return dirtTexture
  const size = 128
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas?.getContext('2d') ?? null
  } catch {
    ctx = null
  }
  if (!canvas || !ctx) {
    dirtTexture = new THREE.Texture()
    return dirtTexture
  }
  canvas.width = size
  canvas.height = size
  const img = ctx.createImageData(size, size)
  let seed = 19
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const edge = Math.min(u, 1 - u, v, 1 - v)
      const wobble = 0.012 * Math.sin(u * 37 + v * 11) + 0.01 * Math.sin(v * 29 - u * 7)
      const a = Math.max(0, Math.min(1, (edge - 0.01 + wobble) / 0.09))
      const n = (rnd() - 0.5) * 26
      const i = (y * size + x) * 4
      img.data[i] = 168 + n
      img.data[i + 1] = 148 + n * 0.9
      img.data[i + 2] = 110 + n * 0.8
      img.data[i + 3] = Math.round(a * 235)
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  dirtTexture = texture
  return texture
}

export type LoafingFrameProps = {
  length: number
  width: number
  wall: number
  rise: number
  roofStyle: RoofStyle
  segs: RoofSeg[]
  open: LoafingOpenSide
  trimColor: string
  /** Bare ground inside (no slab): draw the worn dirt floor. */
  dirtFloor: boolean
}

/**
 * Open loafing shed internals: treated 4x4 posts on the open side carrying
 * a doubled 2x6 header wrapped in a trim band, 45 degree knee braces, 2x4
 * studs and doubled top plates on the closed walls, rafters at 24" o.c., a
 * 4 ft board kick wall, and a packed-dirt floor. All framing is one
 * InstancedMesh.
 */
export const LoafingFrame = memo(function LoafingFrame({
  length,
  width,
  wall,
  rise,
  roofStyle,
  segs,
  open,
  trimColor,
  dirtFloor
}: LoafingFrameProps) {
  const members = useMemo(
    () => buildLoafingMembers({ length, width, wall, rise, roofStyle, segs, open }),
    [length, width, wall, rise, roofStyle, segs, open]
  )
  const kickGeom = useMemo(
    () => buildKickWallGeometry(closedWalls(open, length, width, wall, rise, roofStyle), open),
    [open, length, width, wall, rise, roofStyle]
  )
  useEffect(() => () => kickGeom.dispose(), [kickGeom])
  const kickTex = useDeckPlankTexture(1, 1)
  const kickMat = useMemo(() => new THREE.MeshStandardMaterial({ map: kickTex, roughness: 0.9, metalness: 0 }), [kickTex])
  useEffect(() => () => kickMat.dispose(), [kickMat])

  const trimMat = useTrimMaterial(trimColor)
  const trimBoxes = useMemo<BoxSpec[]>(() => {
    const top = open === 'right' && roofStyle === 'lean-to' ? wall + rise : wall
    const y = top - (HEADER_TRIM_H * F) / 2
    const t = TRIM_T * F
    return open === 'front'
      ? [{ center: [0, y, width / 2 - t / 2], size: [length, HEADER_TRIM_H * F, t] }]
      : [{ center: [length / 2 - t / 2, y, 0], size: [t, HEADER_TRIM_H * F, width] }]
  }, [open, length, width, wall, rise, roofStyle])
  const trimGeom = useMergedBoxes(trimBoxes)

  const dirtMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: getDirtTexture(),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0
      }),
    []
  )
  useEffect(() => () => dirtMat.dispose(), [dirtMat])
  // Footprint plus a worn apron out the open side.
  const apron = 1.5 * F
  const dirtSize: [number, number] = open === 'front' ? [length + 0.4 * F, width + apron] : [length + apron, width + 0.4 * F]
  const dirtPos: [number, number, number] =
    open === 'front' ? [0, 0.002, apron / 2] : [apron / 2, 0.002, 0]

  return (
    <group>
      <LumberInstances members={members} seed={13} />
      <mesh geometry={kickGeom} material={kickMat} receiveShadow />
      <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow />
      {dirtFloor ? (
        <mesh material={dirtMat} rotation={[-Math.PI / 2, 0, 0]} position={dirtPos} receiveShadow renderOrder={1}>
          <planeGeometry args={dirtSize} />
        </mesh>
      ) : null}
    </group>
  )
})
