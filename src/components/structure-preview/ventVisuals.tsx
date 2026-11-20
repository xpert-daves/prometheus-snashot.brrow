'use client'

import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { FOOT } from './types'
import { useSimpleMaterial, useTrimMaterial } from './materials'
import { LOUVER_SLATS_PER_FT, getSolarCellTexture, useLouverSlatTexture } from './woodTextures'

const F = FOOT

export type BoxSpec = {
  center: [number, number, number]
  size: [number, number, number]
  /** Rotation about local Z (radians), for diagonal braces. */
  rotZ?: number
}

/**
 * Merges a list of boxes into one indexed BufferGeometry (one draw call).
 * Each box keeps BoxGeometry's normals and 0..1 face UVs.
 */
export function mergeBoxGeometry(boxes: BoxSpec[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const axisScale = new THREE.Vector3(1, 1, 1)
  for (const b of boxes) {
    const box = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2])
    m.compose(new THREE.Vector3(...b.center), q.setFromEuler(e.set(0, 0, b.rotZ ?? 0)), axisScale)
    box.applyMatrix4(m)
    const base = positions.length / 3
    positions.push(...(box.getAttribute('position').array as Float32Array))
    normals.push(...(box.getAttribute('normal').array as Float32Array))
    uvs.push(...(box.getAttribute('uv').array as Float32Array))
    const index = box.getIndex()
    if (index) for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + base)
    box.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

/** Memoized merged-box geometry, disposed when the boxes change or on unmount. */
export function useMergedBoxes(boxes: BoxSpec[]) {
  const geometry = useMemo(() => mergeBoxGeometry(boxes), [boxes])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

export type LouverVentProps = {
  /** Louver (slat area) width and height in meters. */
  width: number
  height: number
  trimColor: string
  /** Flat trim casing width around the louver, meters. */
  casing?: number
  /** Solar Vent Fan: a dark fan shroud and motor behind the louver. */
  fan?: boolean
  /**
   * Louver banks side by side (well-house vents have three), split by thin
   * aluminum mullions. Default 1.
   */
  banks?: number
  /**
   * Width of the louver's own white aluminum flange inside the trim casing,
   * meters (shed gable vents). Default 0: the slats meet the casing.
   */
  flange?: number
  position?: [number, number, number]
  rotationY?: number
}

/**
 * Gable louver vent: white aluminum slats inside a flat trim-color casing.
 * Local frame: origin at the opening center on the wall's outer plane, +Z
 * pointing out of the wall. The slat plane is double-sided so the louver
 * also reads from inside clear-walled buildings.
 */
export function LouverVent({
  width,
  height,
  trimColor,
  casing = 0.15 * F,
  fan = false,
  banks = 1,
  flange = 0,
  position = [0, 0, 0],
  rotationY = 0
}: LouverVentProps) {
  const trimMat = useTrimMaterial(trimColor)
  const slats = useLouverSlatTexture(((height - flange * 2) / F) * LOUVER_SLATS_PER_FT, fan)
  const slatMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ map: slats, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }),
    [slats]
  )
  useEffect(() => () => slatMat.dispose(), [slatMat])
  const shroudMat = useSimpleMaterial({ color: 0x2c3135, metalness: 0.35, roughness: 0.6 })
  const flangeMat = useSimpleMaterial({ color: 0xeeeeea, metalness: 0.1, roughness: 0.45 })

  const depth = 0.07 * F
  const boxes = useMemo<BoxSpec[]>(() => {
    const outerW = width + casing * 2
    return [
      { center: [0, height / 2 + casing / 2, depth / 2], size: [outerW, casing, depth] },
      { center: [0, -height / 2 - casing / 2, depth / 2], size: [outerW, casing, depth] },
      { center: [-width / 2 - casing / 2, 0, depth / 2], size: [casing, height, depth] },
      { center: [width / 2 + casing / 2, 0, depth / 2], size: [casing, height, depth] }
    ]
  }, [width, height, casing, depth])
  const frameGeom = useMergedBoxes(boxes)
  // The louver's aluminum flange ring and bank mullions, one draw.
  const flangeBoxes = useMemo<BoxSpec[]>(() => {
    const out: BoxSpec[] = []
    const fd = depth * 0.55
    if (flange > 0) {
      out.push(
        { center: [0, height / 2 - flange / 2, fd / 2], size: [width, flange, fd] },
        { center: [0, -height / 2 + flange / 2, fd / 2], size: [width, flange, fd] },
        { center: [-width / 2 + flange / 2, 0, fd / 2], size: [flange, height - flange * 2, fd] },
        { center: [width / 2 - flange / 2, 0, fd / 2], size: [flange, height - flange * 2, fd] }
      )
    }
    const inner = width - flange * 2
    const mullion = Math.max(0.035 * F, flange * 0.8)
    for (let i = 1; i < banks; i++) {
      out.push({ center: [-inner / 2 + (inner * i) / banks, 0, fd / 2], size: [mullion, height - flange * 2, fd] })
    }
    return out
  }, [width, height, flange, banks, depth])
  const flangeGeom = useMergedBoxes(flangeBoxes)
  // Fan shroud box behind the louver with the motor housing on its back.
  const shroudBoxes = useMemo<BoxSpec[]>(
    () => [
      { center: [0, 0, -0.22 * F], size: [width + 0.06 * F, height + 0.06 * F, 0.4 * F] },
      { center: [0, 0, -0.52 * F], size: [0.34 * F, 0.34 * F, 0.24 * F] }
    ],
    [width, height]
  )
  const shroudGeom = useMergedBoxes(shroudBoxes)

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={frameGeom} material={trimMat} castShadow receiveShadow />
      {flangeBoxes.length ? <mesh geometry={flangeGeom} material={flangeMat} receiveShadow /> : null}
      <mesh material={slatMat} position={[0, 0, depth * 0.35]} receiveShadow>
        <planeGeometry args={[width - flange * 2, height - flange * 2]} />
      </mesh>
      {fan ? <mesh geometry={shroudGeom} material={shroudMat} castShadow /> : null}
    </group>
  )
}

export type RoofPose = {
  position: [number, number, number]
  /** Roof slope rotation about Z (radians). */
  rotationZ: number
}

/**
 * Pose for a small solar panel lying on the +X slope of a gable roof, near
 * the back (-Z) end. Inputs are in meters and floor-relative; `lift` is the
 * height of the roof sheet above the eave-to-ridge plane.
 */
export function solarPanelPoseOnGable({
  length,
  width,
  wall,
  rise,
  panelDepth = 1.15 * F,
  lift = 0.1 * F
}: {
  length: number
  width: number
  wall: number
  rise: number
  panelDepth?: number
  lift?: number
}): RoofPose {
  const half = length / 2
  const ang = Math.atan2(rise, half)
  const x = half / 2
  const y = wall + rise * (1 - x / half) + lift / Math.cos(ang)
  const z = -width / 2 + Math.min(1.4 * F, width * 0.18) + panelDepth / 2
  return { position: [x, y, z], rotationZ: -ang }
}

/**
 * Solar Vent Fan panel: a small framed PV module on short standoffs. Local
 * frame: X runs down the slope, Z along the ridge, +Y off the roof surface,
 * origin on the roof sheet. Place it with `solarPanelPoseOnGable` (or any
 * pose that sits on a roof plane).
 */
export function SolarVentPanel({
  pose,
  size = [1.7 * F, 1.15 * F]
}: {
  pose: RoofPose
  size?: [number, number]
}) {
  const [w, d] = size
  const frameMat = useSimpleMaterial({ color: 0xb9bec2, metalness: 0.75, roughness: 0.35 })
  const cells = useMemo(() => {
    const t = getSolarCellTexture().clone()
    t.needsUpdate = true
    return t
  }, [])
  useEffect(() => () => cells.dispose(), [cells])
  const cellMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: cells, metalness: 0.35, roughness: 0.22, envMapIntensity: 1.3 }),
    [cells]
  )
  useEffect(() => () => cellMat.dispose(), [cellMat])
  const thick = 0.1 * F
  const standoff = 0.12 * F
  // Module frame and its two mounting rails in one draw.
  const boxes = useMemo<BoxSpec[]>(
    () => [
      { center: [0, standoff + thick / 2, 0], size: [w, thick, d] },
      ...[-1, 1].map((s): BoxSpec => ({ center: [s * (w / 2 - 0.15 * F), standoff / 2, 0], size: [0.08 * F, standoff, d * 0.9] }))
    ],
    [w, d, thick, standoff]
  )
  const frameGeom = useMergedBoxes(boxes)
  return (
    <group position={pose.position} rotation={[0, 0, pose.rotationZ]}>
      <mesh geometry={frameGeom} material={frameMat} castShadow receiveShadow />
      <mesh material={cellMat} position={[0, standoff + thick + 0.004 * F, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.1 * F, d - 0.1 * F]} />
      </mesh>
    </group>
  )
}
