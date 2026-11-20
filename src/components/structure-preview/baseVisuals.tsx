'use client'

import * as THREE from 'three'
import { memo, useEffect, useMemo } from 'react'
import { BASE_FT, FOOT, type FoundationInfo } from './types'
import { useSimpleMaterial, useTrimMaterial } from './materials'
import { useMergedBoxes, type BoxSpec } from './ventVisuals'
import { LUMBER_HEX, deckPlankRepeat, getLumberGrainTexture, useDeckPlankTexture } from './woodTextures'
import { BOX_FACE, boxWithOneFace } from './roofGeometry'

// ---------------------------------------------------------------------------
// Foundation and base visuals (world/grade coordinates), plus the instanced
// treated-lumber helper shared with the open-structure framing.
// Axes follow ShedBuilderModel: `length` on X, `width` on Z, front at +Z.
// ---------------------------------------------------------------------------

const F = FOOT

/** Weathered skids and sills on grade read a little darker and greener than fresh framing. */
export const SKID_HEX = '#b3a27a'
/** Bare treated rim band (Luling and Boerne greenhouses show a tan rim under the knee siding). */
const RIM_WOOD_HEX = '#b9a27a'

/** A lumber member: center and size in meters, optional rotation about X or Z (radians). */
export type LumberMember = {
  c: [number, number, number]
  s: [number, number, number]
  rx?: number
  rz?: number
}

const AXIS_Y = new THREE.Vector3(0, 1, 0)
const AXIS_Z = new THREE.Vector3(0, 0, 1)

/**
 * Instance transform for a member, turned so its long axis is the unit box's
 * local X (the grain map runs along U on the faces that face along Y and Z).
 */
function composeMember(m: LumberMember, out: THREE.Matrix4) {
  const [sx, sy, sz] = m.s
  const align = new THREE.Quaternion()
  let size: [number, number, number] = [sx, sy, sz]
  if (sy > sx && sy >= sz) {
    align.setFromAxisAngle(AXIS_Z, Math.PI / 2)
    size = [sy, sx, sz]
  } else if (sz > sx && sz > sy) {
    align.setFromAxisAngle(AXIS_Y, -Math.PI / 2)
    size = [sz, sy, sx]
  }
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(m.rx ?? 0, 0, m.rz ?? 0)).multiply(align)
  return out.compose(new THREE.Vector3(...m.c), q, new THREE.Vector3(...size))
}

/**
 * Treated-pine members drawn as one InstancedMesh (one draw call) with a
 * grain map and per-board tone variation, like the greenhouse framing.
 */
export const LumberInstances = memo(function LumberInstances({
  members,
  hex = LUMBER_HEX,
  seed = 11
}: {
  members: LumberMember[]
  hex?: string
  seed?: number
}) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', map: getLumberGrainTexture(), roughness: 0.85, metalness: 0 }),
    []
  )
  useEffect(() => () => material.dispose(), [material])
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => () => unitBox.dispose(), [unitBox])
  const mesh = useMemo(() => {
    const instanced = new THREE.InstancedMesh(unitBox, material, Math.max(1, members.length))
    const matrix = new THREE.Matrix4()
    const base = new THREE.Color(hex)
    const color = new THREE.Color()
    let s = seed
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    members.forEach((m, i) => {
      instanced.setMatrixAt(i, composeMember(m, matrix))
      color.copy(base).multiplyScalar((0.92 + rnd() * 0.14) * 1.04)
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
  }, [members, unitBox, material, hex, seed])
  useEffect(
    () => () => {
      mesh.dispose()
    },
    [mesh]
  )
  if (members.length === 0) return null
  return <primitive object={mesh} />
})

/** Evenly spaced positions from a to b (inclusive), at least `min` of them. */
export function spread(a: number, b: number, n: number) {
  if (n <= 1) return [(a + b) / 2]
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))
}

type BaseLayout = {
  skids: LumberMember[]
  sills: LumberMember[]
  blocks: BoxSpec[]
}

/**
 * Members and blocks for a foundation. Wood floors: 4x6 skids front to back
 * (2-5 by length), each on cap blocks at the ends and about every 5 ft.
 * Well houses: a flat 2x6 sill around the perimeter, on cap blocks at the
 * corners and about every 5 ft.
 */
function buildBaseLayout(info: FoundationInfo, length: number, width: number, skidInsetFt: number): BaseLayout {
  const lengthFt = length / F
  const widthFt = width / F
  const blockH = BASE_FT.capBlock * F
  const base = info.onBlocks ? blockH : 0
  const skids: LumberMember[] = []
  const sills: LumberMember[] = []
  const blocks: BoxSpec[] = []
  // Solid 4"x8"x16" cap block, set a little into the ground.
  const block = (x: number, z: number, alongX: boolean): BoxSpec => ({
    center: [x, blockH / 2 - 0.02 * F, z],
    size: alongX ? [1.3 * F, blockH + 0.04 * F, 0.63 * F] : [0.63 * F, blockH + 0.04 * F, 1.3 * F]
  })

  if (info.kind === 'skids' && !info.skirted) {
    const skidH = BASE_FT.skid * F
    const inset = Math.min(skidInsetFt, lengthFt / 4) * F
    const xs = spread(-length / 2 + inset, length / 2 - inset, Math.max(2, Math.ceil((lengthFt - 2 * inset / F) / 7) + 1))
    const zs = spread(-width / 2 + 0.6 * F, width / 2 - 0.6 * F, Math.max(2, Math.ceil(widthFt / 5) + 1))
    for (const x of xs) {
      // Skid ends show an inch or so past the rim band, like the build photos.
      skids.push({ c: [x, base + skidH / 2 - 0.003 * F, 0], s: [0.29 * F, skidH, width + 0.2 * F] })
      if (info.onBlocks) for (const z of zs) blocks.push(block(x, z, true))
    }
  }

  if (info.kind === 'sill') {
    const sillW = 5.5 / 12
    const sillH = BASE_FT.sill * F
    const y = base + sillH / 2
    // Inset a hair so the sill face never shares a plane with the siding.
    const ix = length / 2 - 0.02 * F - (sillW * F) / 2
    const iz = width / 2 - 0.02 * F - (sillW * F) / 2
    for (const s of [-1, 1]) {
      sills.push({ c: [s * ix, y, 0], s: [sillW * F, sillH, width - 0.04 * F] })
      sills.push({ c: [0, y, s * iz], s: [length - 0.04 * F - sillW * 2 * F, sillH, sillW * F] })
    }
    if (info.onBlocks) {
      const bx = length / 2 - 0.65 * F
      const bz = width / 2 - 0.3 * F
      for (const s of [-1, 1]) {
        for (const x of spread(-bx, bx, Math.max(2, Math.ceil((lengthFt - 1.3) / 5) + 1))) blocks.push(block(x, s * bz, true))
        const sideZs = spread(-width / 2 + 0.65 * F, width / 2 - 0.65 * F, Math.max(2, Math.ceil((widthFt - 1.3) / 5) + 1))
        for (const z of sideZs.slice(1, -1)) blocks.push(block(s * (length / 2 - 0.3 * F), z, false))
      }
    }
  }
  return { skids, sills, blocks }
}

/**
 * Foundation visuals under the building (world coordinates, grade at y = 0):
 * skids, cap blocks and the floor frame (a rim band, trim-painted or bare
 * treated wood, with a plank deck on top) for wood floors; a treated sill or
 * a flush poured curb for well houses; a concrete pad for the anchored slab.
 */
export const FoundationBase = memo(function FoundationBase({
  info,
  length,
  width,
  trimColor,
  woodRim = false,
  skidInsetFt = 0.5
}: {
  info: FoundationInfo
  length: number
  width: number
  trimColor: string
  /** Bare treated rim band (greenhouses) instead of trim paint (most sheds). */
  woodRim?: boolean
  /** Outer skids' distance in from the side walls, ft. */
  skidInsetFt?: number
}) {
  const layout = useMemo(() => buildBaseLayout(info, length, width, skidInsetFt), [info, length, width, skidInsetFt])
  const blockGeom = useMergedBoxes(layout.blocks)
  const blockMat = useSimpleMaterial({ color: 0xbcb9b1, roughness: 1 })
  const concreteMat = useSimpleMaterial({ color: 0xb9b6ae, roughness: 0.95 })
  const curbMat = useSimpleMaterial({ color: 0xd9d2c8, roughness: 0.95 })
  const trimRimMat = useTrimMaterial(trimColor)
  const woodRimMat = useSimpleMaterial({ color: RIM_WOOD_HEX, roughness: 0.85 })
  const rimMat = woodRim ? woodRimMat : trimRimMat
  const [deckRepX, deckRepY] = deckPlankRepeat(length / F, width / F)
  const deckTex = useDeckPlankTexture(deckRepX, deckRepY)
  const deckMat = useMemo(() => new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0 }), [deckTex])
  useEffect(() => () => deckMat.dispose(), [deckMat])
  // Floor frame: rim band on the sides, plank deck on top (two draw groups).
  const floorFrameMats = useMemo(() => [rimMat, deckMat], [rimMat, deckMat])
  const frameH = BASE_FT.floorFrame * F
  const floorFrameGeom = useMemo(
    () => boxWithOneFace(length - 0.04 * F, frameH, width - 0.04 * F, BOX_FACE.py),
    [length, width, frameH]
  )
  useEffect(() => () => floorFrameGeom.dispose(), [floorFrameGeom])

  return (
    <group>
      {info.kind === 'slab' ? (
        <mesh material={concreteMat} position={[0, info.floorY / 2, 0]} receiveShadow>
          <boxGeometry args={[length + 2 * F, info.floorY, width + 2 * F]} />
        </mesh>
      ) : null}
      {info.kind === 'curb' ? (
        <mesh material={curbMat} position={[0, info.floorY / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[length + 0.34 * F, info.floorY, width + 0.34 * F]} />
        </mesh>
      ) : null}
      {info.kind === 'skids' ? (
        // Floor frame: the 2x6 rim band shows under the siding; inset so it never shares a plane with it.
        <mesh
          geometry={floorFrameGeom}
          material={floorFrameMats}
          position={[0, info.floorY - frameH / 2, 0]}
          castShadow
          receiveShadow
        />
      ) : null}
      {layout.blocks.length ? <mesh geometry={blockGeom} material={blockMat} castShadow receiveShadow /> : null}
      <LumberInstances members={layout.skids} hex={SKID_HEX} seed={5} />
      <LumberInstances members={layout.sills} seed={7} />
    </group>
  )
})
