import * as THREE from 'three'
import { invalidate } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { FOOT } from './types'

/** Wall panel ribs per foot (9" o.c., matching Shed210 build photos). */
export const RIB = 1.33

/** Exposed wall fasteners: one screw per major rib at each stud, 24" o.c. */
export const FASTENER_SPACING_FT = 2

/**
 * Horizontal repeat (`repX`) for ag-panel walls and door leaves built from
 * PlaneGeometry (0..1 UVs) spanning `spanFt`, so the baked fastener column
 * lands every 24".
 */
export function panelRepeatX(spanFt: number) {
  return Math.max(spanFt, 0.5) / FASTENER_SPACING_FT
}

/** Horizontal repeat for ShapeGeometry walls, whose UVs are in meters. */
export const PANEL_REPEAT_X_PER_M = 1 / (FASTENER_SPACING_FT * FOOT)

/** Native aspect ratio of the embedded Shed210 logo image (width / height). */
export const LOGO_ASPECT = 364 / 249

/** Canvas resolution for procedural panel textures (power of two for mipmaps). */
const TEX = 256

function makeCanvas(size = TEX, height = size): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx }
}

function finalizeTexture(texture: THREE.Texture, color = true) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Panel profiles, sampled across one repeat (t = 0 at the top/left edge).
 * - `ag`: the horizontal ag-panel siding on Shed210 builds (9" o.c.): a narrow
 *   trapezoid major rib whose top bevel catches the sky and casts a thin
 *   shadow, two pencil ribs at the thirds, and a flat pan. One exposed
 *   fastener per rib is baked in at u = 0.5 (see `panelRepeatX`).
 * - `lap`: deprecated alias of `ag` (the old clapboard look read as wood).
 * - `rib`: exposed-fastener roof panel (12" o.c.): a wide raised major rib on
 *   a flat pan with minor ribs at the thirds.
 * Each sample is [shade, height]. Shade is added lightness (-1..1) for the
 * color map; height (0..1) drives the normal map.
 */
export type PanelProfile = 'ag' | 'lap' | 'rib'

/** Ag-panel pencil ribs, a third and two thirds of the way between major ribs. */
const PENCIL_RIBS = [0.39, 0.72]
/** Fastener row: on the pan just below the major rib's shadow. */
const FASTENER_T = 0.2

function sampleProfile(profile: PanelProfile, t: number): [number, number] {
  if (profile === 'rib') {
    const d = Math.abs(t - 0.5)
    if (d < 0.06) return [0.12, 1]
    if (d < 0.09) return [t < 0.5 ? 0.22 : -0.26, 0.55]
    for (const m of [0.167, 0.833]) {
      if (Math.abs(t - m) < 0.012) return [0.06, 0.25]
    }
    return [0, 0]
  }
  if (t < 0.02) return [0.24, 0.6]
  if (t < 0.09) return [0.08, 1]
  if (t < 0.115) return [-0.2, 0.55]
  if (t < 0.15) return [-0.12, 0]
  for (const m of PENCIL_RIBS) {
    const d = t - m
    if (d >= 0 && d < 0.01) return [0.06, 0.25]
    if (d >= 0.01 && d < 0.02) return [-0.05, 0.08]
  }
  return [0, 0]
}

/** Relief per profile: height-field slope scale (rib height / period). */
const NORMAL_STRENGTH: Record<PanelProfile, number> = { ag: 0.1, lap: 0.1, rib: 0.2 }

function hasFasteners(profile: PanelProfile, fasteners: boolean) {
  return fasteners && profile !== 'rib'
}

/** Deterministic grain so textures are identical between renders. */
function grain(ctx: CanvasRenderingContext2D, size: number, amount: number, seed = 7) {
  const img = ctx.getImageData(0, 0, size, size)
  let x = seed
  for (let i = 0; i < img.data.length; i += 4) {
    x = (x * 16807) % 2147483647
    const n = (x / 2147483647 - 0.5) * amount
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}

function drawProfile(
  ctx: CanvasRenderingContext2D,
  profile: PanelProfile,
  horizontal: boolean,
  channel: 'shade' | 'height'
) {
  for (let i = 0; i < TEX; i++) {
    const [shade, height] = sampleProfile(profile, (i + 0.5) / TEX)
    if (channel === 'shade') {
      ctx.fillStyle = shade >= 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`
    } else {
      const v = Math.round(height * 255)
      ctx.fillStyle = `rgb(${v},${v},${v})`
    }
    if (horizontal) ctx.fillRect(0, i, TEX, 1)
    else ctx.fillRect(i, 0, 1, TEX)
  }
}

/** Fastener head center and radii in texels. The tile spans 24" along the ribs and one rib period across them. */
function fastenerEllipse(horizontal: boolean) {
  const along = TEX / 2
  const across = FASTENER_T * TEX
  return horizontal ? { x: along, y: across, rx: 3, ry: 8.5 } : { x: across, y: along, rx: 8.5, ry: 3 }
}

const ribbedCache = new Map<string, THREE.Texture>()

/**
 * Panel color texture for a paint color and profile. Cached per
 * color/orientation/profile; callers clone it so each use carries its own repeat.
 */
export function getRibbedBaseTexture(
  hex: string,
  horizontal = false,
  profile: PanelProfile = 'ag',
  fasteners = true
): THREE.Texture {
  const screws = hasFasteners(profile, fasteners)
  const key = `${hex}|${horizontal ? 'h' : 'v'}|${profile}|${screws ? 's' : ''}`
  const cached = ribbedCache.get(key)
  if (cached) return cached

  const drawing = makeCanvas()
  let texture: THREE.Texture
  if (drawing) {
    const { ctx } = drawing
    ctx.fillStyle = hex
    ctx.fillRect(0, 0, TEX, TEX)
    drawProfile(ctx, profile, horizontal, 'shade')
    if (screws) {
      // Painted screw head on a dark neoprene washer.
      const f = fastenerEllipse(horizontal)
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.beginPath()
      ctx.ellipse(f.x, f.y - (horizontal ? f.ry * 0.3 : 0), f.rx * 0.5, f.ry * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    grain(ctx, TEX, 7)
    texture = new THREE.CanvasTexture(drawing.canvas)
  } else {
    // jsdom / non-browser fallback: a plain texture keeps materials functional.
    texture = new THREE.Texture()
  }
  finalizeTexture(texture)
  ribbedCache.set(key, texture)
  return texture
}

const normalCache = new Map<string, THREE.Texture>()

/**
 * Tangent-space normal map for a panel profile (plus fastener domes),
 * precomputed from the same height profile the color map shades. Unlike a
 * derivative bump map it mipmaps cleanly, so roofs don't sparkle at a
 * distance. Cached per orientation/profile; not color managed.
 */
export function getPanelNormalTexture(horizontal = false, profile: PanelProfile = 'ag', fasteners = true): THREE.Texture {
  const screws = hasFasteners(profile, fasteners)
  const key = `${horizontal ? 'h' : 'v'}|${profile}|${screws ? 's' : ''}`
  const cached = normalCache.get(key)
  if (cached) return cached
  const drawing = makeCanvas()
  let texture: THREE.Texture
  if (drawing) {
    const { ctx } = drawing
    const img = ctx.createImageData(TEX, TEX)
    // Pre-blur the stepped profile so the slopes are a few texels wide.
    const blur = 1 / 512
    const height = (t: number) => {
      let sum = 0
      for (let k = -2; k <= 2; k++) sum += sampleProfile(profile, (((t + k * blur) % 1) + 1) % 1)[1]
      return sum / 5
    }
    const strength = NORMAL_STRENGTH[profile]
    const f = fastenerEllipse(horizontal)
    for (let i = 0; i < TEX; i++) {
      const t = (i + 0.5) / TEX
      // Height slope across the ribs, in period units. Canvas rows run down
      // (-v) and columns run right (+u), hence the sign difference. Flanks are
      // capped near 50° so they never face straight down into the warm
      // ground bounce (the color map already draws the shadow line).
      const raw = ((height(t + 1 / TEX) - height(t - 1 / TEX)) / 2) * TEX * strength
      const slope = Math.max(-1.2, Math.min(1.2, raw))
      const len = Math.hypot(slope, 1)
      const across = slope / len
      const nz = 1 / len
      for (let j = 0; j < TEX; j++) {
        const row = horizontal ? i : j
        const col = horizontal ? j : i
        let nx = horizontal ? 0 : -across
        let ny = horizontal ? across : 0
        let z = nz
        if (screws) {
          const dx = (col - f.x) / f.rx
          const dy = (row - f.y) / f.ry
          const r2 = dx * dx + dy * dy
          if (r2 < 1) {
            nx = dx * 0.7
            ny = -dy * 0.7
            z = Math.max(Math.sqrt(1 - r2), 0.5)
            const l = Math.hypot(nx, ny, z)
            nx /= l
            ny /= l
            z /= l
          }
        }
        const p = (row * TEX + col) * 4
        img.data[p] = Math.round((nx * 0.5 + 0.5) * 255)
        img.data[p + 1] = Math.round((ny * 0.5 + 0.5) * 255)
        img.data[p + 2] = Math.round((z * 0.5 + 0.5) * 255)
        img.data[p + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    texture = new THREE.CanvasTexture(drawing.canvas)
  } else {
    texture = new THREE.Texture()
  }
  finalizeTexture(texture, false)
  normalCache.set(key, texture)
  return texture
}

const bumpCache = new Map<string, THREE.Texture>()

/** Grayscale height map matching a panel profile (not color managed). */
export function getPanelBumpTexture(horizontal = false, profile: PanelProfile = 'ag'): THREE.Texture {
  const key = `${horizontal ? 'h' : 'v'}|${profile}`
  const cached = bumpCache.get(key)
  if (cached) return cached
  const drawing = makeCanvas()
  let texture: THREE.Texture
  if (drawing) {
    drawProfile(drawing.ctx, profile, horizontal, 'height')
    texture = new THREE.CanvasTexture(drawing.canvas)
  } else {
    texture = new THREE.Texture()
  }
  finalizeTexture(texture, false)
  bumpCache.set(key, texture)
  return texture
}

/**
 * Per-use panel texture with its own repeat. Clones share the cached canvas
 * image, so this is cheap; the clone is disposed when inputs change or the
 * component unmounts (cached bases are never disposed).
 */
export function useRibbedTexture(
  hex: string,
  repX: number,
  repY: number,
  horizontal = false,
  profile: PanelProfile = 'ag',
  fasteners = true
) {
  const texture = useMemo(() => {
    const clone = getRibbedBaseTexture(hex, horizontal, profile, fasteners).clone()
    clone.needsUpdate = true
    return clone
  }, [hex, horizontal, profile, fasteners])
  texture.repeat.set(repX, repY)
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** Per-use normal map clone with its own repeat (see useRibbedTexture). */
export function usePanelNormalTexture(
  repX: number,
  repY: number,
  horizontal = false,
  profile: PanelProfile = 'ag',
  fasteners = true
) {
  const texture = useMemo(() => {
    const clone = getPanelNormalTexture(horizontal, profile, fasteners).clone()
    clone.needsUpdate = true
    return clone
  }, [horizontal, profile, fasteners])
  texture.repeat.set(repX, repY)
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** Per-use bump map clone with its own repeat (see useRibbedTexture). */
export function usePanelBumpTexture(repX: number, repY: number, horizontal = false, profile: PanelProfile = 'ag') {
  const texture = useMemo(() => {
    const clone = getPanelBumpTexture(horizontal, profile).clone()
    clone.needsUpdate = true
    return clone
  }, [horizontal, profile])
  texture.repeat.set(repX, repY)
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

let grassTexture: THREE.Texture | null = null

/**
 * Sun-dried South Texas lawn: low-saturation green and straw patches with
 * short blade strokes. SceneEnvironment adds world-space macro variation on
 * top so the tile never reads as a grid. Shared singleton, never disposed.
 */
export function getGrassTexture(): THREE.Texture {
  if (grassTexture) return grassTexture
  const size = 512
  const drawing = makeCanvas(size)
  if (drawing) {
    const { ctx } = drawing
    ctx.fillStyle = '#8e8a5c'
    ctx.fillRect(0, 0, size, size)
    let x = 11
    const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 70; i++) {
      const px = rnd() * size
      const py = rnd() * size
      const r = 20 + rnd() * 70
      const g = ctx.createRadialGradient(px, py, 0, px, py, r)
      const col = rnd() > 0.5 ? '112,124,70' : '160,146,100'
      g.addColorStop(0, `rgba(${col},0.35)`)
      g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g
      ctx.fillRect(px - r, py - r, r * 2, r * 2)
    }
    const blades = ['#6b7040', '#8d8a58', '#a39a6a', '#76783f', '#b0a477']
    ctx.lineWidth = 1
    for (let i = 0; i < 9000; i++) {
      const px = rnd() * size
      const py = rnd() * size
      ctx.strokeStyle = blades[Math.floor(rnd() * blades.length)]
      ctx.globalAlpha = 0.5 + rnd() * 0.4
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + (rnd() - 0.5) * 4, py - 2 - rnd() * 5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    grassTexture = new THREE.CanvasTexture(drawing.canvas)
  } else {
    grassTexture = new THREE.Texture()
  }
  finalizeTexture(grassTexture)
  return grassTexture
}

// Shed210 logo, embedded so the placard never depends on a network fetch.
const LOGO_DATA_URL =
  'data:image/png;base64,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'

let logoTexture: THREE.Texture | null = null

/** Shed210 logo placard texture. Shared singleton — never dispose. */
export function getLogoTexture(): THREE.Texture {
  if (logoTexture) return logoTexture
  try {
    // The image decodes asynchronously; the preview renders on demand, so
    // request a frame or the placard can stay blank.
    logoTexture = new THREE.TextureLoader().load(LOGO_DATA_URL, () => invalidate())
  } catch {
    logoTexture = new THREE.Texture()
  }
  logoTexture.anisotropy = 4
  logoTexture.colorSpace = THREE.SRGBColorSpace
  return logoTexture
}
