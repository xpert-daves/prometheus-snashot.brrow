import * as THREE from 'three'
import { useEffect, useMemo, type DependencyList } from 'react'
import { usePanelNormalTexture, useRibbedTexture, type PanelProfile } from './textures'

/** Bare galvalume steel (unpainted roofs, galvanized knee walls). */
export const GALVALUME_HEX = '#c7ccd0'

/** Galvalume roof panel: bright, fairly smooth bare metal with a ribbed profile. */
export const GALV = { metalness: 0.88, roughness: 0.35, profile: 'rib' } as const

/**
 * Painted roof panel. Paint is a dielectric coat; metal-level metalness would
 * mirror the sky and turn dark roof colors chrome-blue.
 */
export const PAINTED_ROOF = { metalness: 0.15, roughness: 0.42, profile: 'rib' } as const

// Note: reflections come from scene.environment, and three then uses
// scene.environmentIntensity for every standard material, so a per-material
// envMapIntensity has no effect here. Tune reflections in SceneEnvironment.
export type PanelOptions = {
  metalness?: number
  roughness?: number
  profile?: PanelProfile
  /** Relief strength of the normal map (default 1); 0 disables it. */
  normalScale?: number
  /** Bake the 24" o.c. fastener dots into ag-panel textures (default true). */
  fasteners?: boolean
  /** @deprecated Bump maps were replaced by normal maps; 0 still disables relief. */
  bumpScale?: number
}

const SELECT_EMISSIVE = '#16a34a'

function applyEmissive(material: THREE.MeshStandardMaterial, intensity: number) {
  material.emissive.set(intensity > 0 ? SELECT_EMISSIVE : '#000000')
  material.emissiveIntensity = intensity
}

/**
 * Ribbed metal panel material. `repX`/`repY` are texture tile counts — for
 * PlaneGeometry (0..1 UVs) pass ribs for the whole span (`heightFt * RIB`)
 * and `panelRepeatX(spanFt)` across it; for ShapeGeometry (UVs in meters)
 * pass ribs per meter (`RIB / FOOT`) and `PANEL_REPEAT_X_PER_M`. The ag
 * profile bakes one fastener per tile, so `repX` sets the 24" screw spacing.
 */
export function usePanelMaterial(
  hex: string,
  repX: number,
  repY: number,
  horizontal = false,
  opts: PanelOptions = {},
  emissiveIntensity = 0
) {
  const profile = opts.profile ?? 'ag'
  const fasteners = opts.fasteners ?? true
  const map = useRibbedTexture(hex, repX, repY, horizontal, profile, fasteners)
  const normalMap = usePanelNormalTexture(repX, repY, horizontal, profile, fasteners)
  // Painted steel siding by default: paint is a dielectric satin coat.
  const metalness = opts.metalness ?? 0.05
  const roughness = opts.roughness ?? 0.4
  const relief = opts.bumpScale === 0 ? 0 : (opts.normalScale ?? 1)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map,
        normalMap: relief > 0 ? normalMap : null,
        normalScale: new THREE.Vector2(relief, relief),
        metalness,
        roughness,
        side: THREE.DoubleSide
      }),
    [map, normalMap, relief, metalness, roughness]
  )
  applyEmissive(material, emissiveIntensity)
  useEffect(() => () => material.dispose(), [material])
  return material
}

type RoofFinishInput = { structureType?: string; roofColor?: string; color?: string }

/**
 * Roof finish. The quote never sets a roof color, so enclosed buildings get
 * bare galvalume, and a carport is painted its one color input. An explicit
 * `roofColor` always renders as painted metal.
 */
export function getRoofFinish({ structureType, roofColor, color }: RoofFinishInput): {
  hex: string
  opts: PanelOptions
} {
  if (roofColor) return { hex: roofColor, opts: PAINTED_ROOF }
  if (structureType === 'carport' && color) return { hex: color, opts: PAINTED_ROOF }
  return { hex: GALVALUME_HEX, opts: GALV }
}

/** Ribbed roof panel material using `getRoofFinish` (ribs run down-slope). */
export function useRoofPanelMaterial(params: RoofFinishInput, repX: number, repY: number) {
  const { hex, opts } = getRoofFinish(params)
  return usePanelMaterial(hex, repX, repY, true, opts)
}

/**
 * Translucent greenhouse glazing. Depth writes stay off so overlapping
 * transparent panels don't occlude each other at glancing angles.
 */
export function useGlassPanelMaterial(hex: string, opacity = 0.38) {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: hex,
        transparent: true,
        opacity,
        roughness: 0.15,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
    [hex, opacity]
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

/** Painted trim metal (rakes, frames, corner trim): a dielectric paint coat. */
export function useTrimMaterial(color: string, emissiveIntensity = 0) {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.08, roughness: 0.38 }),
    [color]
  )
  applyEmissive(material, emissiveIntensity)
  useEffect(() => () => material.dispose(), [material])
  return material
}

type WindowGlassOptions = {
  /**
   * Clear, mostly transparent glass for buildings whose interior is lit and
   * worth seeing (greenhouses). Default glass is opaque: it reads as a dark
   * shed interior with a soft sky reflection.
   */
  seeThrough?: boolean
}

/**
 * Window glass. Reflections come from the scene environment; the selected
 * state adds the shared green emissive highlight.
 */
export function useWindowGlassMaterial(selected = false, opts: WindowGlassOptions = {}) {
  const seeThrough = opts.seeThrough ?? false
  const material = useMemo(
    () =>
      seeThrough
        ? new THREE.MeshStandardMaterial({
            color: '#e4ecef',
            metalness: 0,
            roughness: 0.05,
            transparent: true,
            opacity: 0.22,
            depthWrite: false
          })
        : new THREE.MeshStandardMaterial({
            // A little metalness keeps a soft sky sheen at grazing angles
            // without turning the pane into a mirror.
            color: '#2c363c',
            metalness: 0.4,
            roughness: 0.08
          }),
    [seeThrough]
  )
  applyEmissive(material, selected ? 0.18 : 0)
  useEffect(() => () => material.dispose(), [material])
  return material
}

/** Plain (untextured) standard material with dispose handling. */
export function useSimpleMaterial(params: THREE.MeshStandardMaterialParameters, deps: DependencyList = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => new THREE.MeshStandardMaterial(params), deps)
  useEffect(() => () => material.dispose(), [material])
  return material
}
