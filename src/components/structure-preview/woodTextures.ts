import * as THREE from 'three'
import { useEffect, useMemo } from 'react'

/*
 * Procedural textures for the wood and plastic parts of a build: treated-pine
 * lumber, deck planks, louver slats and clear corrugated polycarbonate.
 * Base textures are cached singletons drawn once per page (never disposed);
 * the hooks hand out clones that carry their own repeat and are disposed with
 * the component, like the panel textures in textures.ts.
 */

/**
 * Fresh treated-pine lumber albedo, calibrated against framing seen through
 * greenhouse glazing (photo studs #aea185-#baa679) under the Neutral tone
 * mapping. The spec's #c8a468 was tuned under ACES and renders orange here.
 */
export const LUMBER_HEX = '#c9b088'

/** One deck texture tile: eight 5.5" boards with 1/4" gaps (46") across, one 12 ft board along. */
export const DECK_TILE_ACROSS_FT = 46 / 12
export const DECK_TILE_ALONG_FT = 12

/** Repeat for a deck surface `acrossFt` wide (across the boards) and `alongFt` long (along them). */
export function deckPlankRepeat(acrossFt: number, alongFt: number): [number, number] {
  return [acrossFt / DECK_TILE_ACROSS_FT, alongFt / DECK_TILE_ALONG_FT]
}

/** Louver slats per foot of louver height (aluminum gable vents run about 10-12 per foot). */
export const LOUVER_SLATS_PER_FT = 10

/**
 * One polycarbonate tile is 8 ft along the ribs by one 36" sheet (four 9"
 * major ribs) across them. Fastener columns sit at u = 0, 1/4, 1/2, 3/4 and
 * the sheet lap at v = 0.
 */
export const POLY_TILE_ALONG_FT = 8
export const POLY_TILE_ACROSS_FT = 3

type Drawing = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

function makeCanvas(width: number, height: number): Drawing | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return null
  return { canvas, ctx }
}

function finalize(texture: THREE.Texture, color: boolean, anisotropy = 8) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = anisotropy
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  return texture
}

/** Canvas texture, or a blank texture where canvases are unavailable (jsdom). */
function drawTexture(width: number, height: number, color: boolean, draw: (d: Drawing) => void) {
  const drawing = makeCanvas(width, height)
  if (!drawing) return finalize(new THREE.Texture(), color)
  draw(drawing)
  return finalize(new THREE.CanvasTexture(drawing.canvas), color)
}

/** Deterministic random stream so textures are identical between renders. */
function rng(seed: number) {
  let x = seed
  return () => (x = (x * 16807) % 2147483647) / 2147483647
}

/** Per-use clone with its own repeat/offset; disposed with the component. */
function useClone(base: THREE.Texture, repX: number, repY: number, offsetY = 0) {
  const texture = useMemo(() => {
    const clone = base.clone()
    clone.needsUpdate = true
    return clone
  }, [base])
  texture.repeat.set(repX, repY)
  texture.offset.set(0, offsetY)
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

// ---------------------------------------------------------------------------
// Lumber
// ---------------------------------------------------------------------------

let lumberGrain: THREE.Texture | null = null

/**
 * Low-contrast grain streaks running along U, multiplied over the lumber
 * color. Members are oriented with their long axis on local X so the streaks
 * follow the board.
 */
export function getLumberGrainTexture(): THREE.Texture {
  if (lumberGrain) return lumberGrain
  lumberGrain = drawTexture(256, 32, true, ({ ctx }) => {
    const rnd = rng(23)
    ctx.fillStyle = 'rgb(246,243,236)'
    ctx.fillRect(0, 0, 256, 32)
    for (let i = 0; i < 22; i++) {
      const y = rnd() * 32
      ctx.strokeStyle = `rgba(${130 + rnd() * 30},${100 + rnd() * 25},${60 + rnd() * 20},${0.08 + rnd() * 0.16})`
      ctx.lineWidth = 0.6 + rnd() * 1.4
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(85, y + (rnd() - 0.5) * 3, 170, y + (rnd() - 0.5) * 3, 256, y)
      ctx.stroke()
    }
  })
  return lumberGrain
}

// ---------------------------------------------------------------------------
// Deck planks
// ---------------------------------------------------------------------------

let deckPlanks: THREE.Texture | null = null

/**
 * Treated-pine 2x6 decking: eight boards across (U) running along V, with
 * per-board tone, grain, knots, 1/4" gaps and one staggered butt joint each.
 * Use `deckPlankRepeat` for the repeat.
 */
export function getDeckPlankTexture(): THREE.Texture {
  if (deckPlanks) return deckPlanks
  deckPlanks = drawTexture(512, 1024, true, ({ ctx }) => {
    const rnd = rng(7)
    const h = 1024
    const bw = 64
    // Mostly fresh yellow pine; one slightly greener and one browner board per tile.
    const tones: [number, number, number][] = [
      [214, 193, 136],
      [211, 191, 133],
      [206, 196, 146],
      [208, 182, 124]
    ]
    for (let i = 0; i < 8; i++) {
      const v = 0.95 + rnd() * 0.09
      const tone = tones[i === 2 ? 2 : i === 5 ? 3 : Math.floor(rnd() * 2)]
      const base = tone.map((c) => Math.round(Math.min(255, c * v)))
      ctx.fillStyle = `rgb(${base.join(',')})`
      ctx.fillRect(i * bw, 0, bw, h)
      for (let k = 0; k < 46; k++) {
        const x = i * bw + 3 + rnd() * (bw - 8)
        ctx.strokeStyle = `rgba(${140 + rnd() * 30},${110 + rnd() * 20},${62 + rnd() * 16},${0.06 + rnd() * 0.12})`
        ctx.lineWidth = 0.8 + rnd() * 1.6
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.bezierCurveTo(x + rnd() * 6 - 3, h * 0.3, x + rnd() * 6 - 3, h * 0.7, x, h)
        ctx.stroke()
      }
      for (let k = 0; k < 3; k++) {
        const kx = i * bw + 10 + rnd() * (bw - 20)
        const ky = rnd() * h
        ctx.fillStyle = 'rgba(105,72,42,0.8)'
        ctx.beginPath()
        ctx.ellipse(kx, ky, 2.5 + rnd() * 2.5, 3.5 + rnd() * 4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(150,112,64,0.35)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.ellipse(kx, ky, 6 + rnd() * 3, 9 + rnd() * 5, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      // Staggered butt joint and the 1/4" gap to the next board.
      ctx.fillStyle = 'rgba(80,64,40,0.85)'
      ctx.fillRect(i * bw, Math.floor(rnd() * h), bw - 3, 2)
      ctx.fillStyle = 'rgb(92,76,48)'
      ctx.fillRect(i * bw + bw - 3, 0, 3, h)
    }
  })
  return deckPlanks
}

/** Deck plank texture clone with its own repeat (see `deckPlankRepeat`). */
export function useDeckPlankTexture(repX: number, repY: number) {
  return useClone(getDeckPlankTexture(), repX, repY)
}

// ---------------------------------------------------------------------------
// Louver slats
// ---------------------------------------------------------------------------

const louverCache = new Map<string, THREE.Texture>()

/**
 * One aluminum louver slat per tile (V): a bright nose, a face shading
 * downward, and the dark gap under it. `dark` deepens the gap, as when a fan
 * shroud sits behind the louver. Repeat V = height in ft x LOUVER_SLATS_PER_FT.
 */
export function getLouverSlatTexture(dark = false): THREE.Texture {
  const key = dark ? 'dark' : 'open'
  const cached = louverCache.get(key)
  if (cached) return cached
  const texture = drawTexture(32, 64, true, ({ ctx }) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 64)
    grad.addColorStop(0, '#fbfbf8')
    grad.addColorStop(0.1, '#f1f1ec')
    grad.addColorStop(0.62, '#d9dad5')
    grad.addColorStop(0.7, '#c3c5c1')
    grad.addColorStop(0.71, dark ? '#202427' : '#4c5155')
    grad.addColorStop(1, dark ? '#2c3033' : '#6b7074')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 64)
  })
  louverCache.set(key, texture)
  return texture
}

/** Louver slat texture clone; `repY` = louver height in ft x LOUVER_SLATS_PER_FT. */
export function useLouverSlatTexture(repY: number, dark = false) {
  return useClone(getLouverSlatTexture(dark), 1, repY)
}

let solarCells: THREE.Texture | null = null

/** Small PV module face: dark blue cells in a 6 x 4 grid with silver busbars. One tile per module. */
export function getSolarCellTexture(): THREE.Texture {
  if (solarCells) return solarCells
  solarCells = drawTexture(192, 128, true, ({ ctx }) => {
    ctx.fillStyle = '#c9cdd0'
    ctx.fillRect(0, 0, 192, 128)
    const cw = 192 / 6
    const ch = 128 / 4
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        const grad = ctx.createLinearGradient(0, j * ch, 0, (j + 1) * ch)
        grad.addColorStop(0, '#22345a')
        grad.addColorStop(1, '#1a2746')
        ctx.fillStyle = grad
        ctx.fillRect(i * cw + 1.5, j * ch + 1.5, cw - 3, ch - 3)
        ctx.fillStyle = 'rgba(200,210,225,0.35)'
        ctx.fillRect(i * cw + cw / 3, j * ch + 2, 1, ch - 4)
        ctx.fillRect(i * cw + (2 * cw) / 3, j * ch + 2, 1, ch - 4)
      }
    }
  })
  return solarCells
}

// ---------------------------------------------------------------------------
// Clear corrugated polycarbonate
// ---------------------------------------------------------------------------

export type PolycarbonateKind = 'wall' | 'roof'

type PolyTextures = { map: THREE.Texture; alphaMap: THREE.Texture }

const POLY_W = 512
const POLY_H = 256
/** Rows (canvas pixels from the tile bottom) per 9" major rib. */
const POLY_RIB_PX = POLY_H / 4

const polyCache = new Map<PolycarbonateKind, PolyTextures>()

/**
 * Colorless corrugated sheet: a nearly clear pan, a bright streak on each 9"
 * major rib (brightness drifts along the rib like sky reflections), faint
 * minor ribs at the thirds, a sheet lap every 36" and a screw at each
 * fastener column on every major rib. Walls are near-clear so framing reads
 * through; roof sheets are milkier. Use `map` with `alphaMap`.
 */
export function getPolycarbonateTextures(kind: PolycarbonateKind): PolyTextures {
  const cached = polyCache.get(kind)
  if (cached) return cached
  const roof = kind === 'roof'
  const baseAlpha = roof ? 0.25 : 0.1
  const ribAlpha: [number, number] = roof ? [0.55, 0.85] : [0.42, 0.75]
  // Roof corrugations are broader (and seen from farther) than the wall ribs.
  const crest = roof ? 6 : 4
  const trough = roof ? 4 : 2
  // Color and alpha share one layout; draw both from the same row/column plan.
  const rows: { y: number; h: number; color: string; alpha: number | ((u: number) => number) }[] = []
  const rnd = rng(roof ? 31 : 17)
  // Smooth per-rib brightness drift along U (a few low-frequency waves).
  const drift = () => {
    const waves = Array.from({ length: 3 }, (_, i) => ({ f: (i + 1) * (1 + Math.floor(rnd() * 2)), p: rnd() * Math.PI * 2, a: 0.5 / (i + 1) }))
    return (u: number) => {
      let s = 0
      for (const w of waves) s += w.a * Math.sin(u * Math.PI * 2 * w.f + w.p)
      return Math.max(0, Math.min(1, 0.5 + s * 0.6))
    }
  }
  for (let k = 0; k < 4; k++) {
    const y0 = k * POLY_RIB_PX
    const d = drift()
    // Major rib: bright crest over a darker trough.
    rows.push({ y: y0 + 3 + trough, h: crest, color: '#ffffff', alpha: (u) => ribAlpha[0] + (ribAlpha[1] - ribAlpha[0]) * d(u) })
    rows.push({ y: y0 + 3, h: trough, color: '#aeb6ba', alpha: roof ? 0.45 : 0.26 })
    rows.push({ y: y0 + 3 + trough + crest, h: 1, color: '#e9eef0', alpha: roof ? 0.42 : 0.24 })
    for (const m of [1 / 3, 2 / 3]) {
      rows.push({ y: y0 + 6 + Math.round(POLY_RIB_PX * m), h: 1, color: '#f4f7f8', alpha: roof ? 0.36 : 0.17 })
    }
  }
  // Sheet lap: a doubled bright edge at the bottom of each 36" sheet.
  rows.push({ y: 0, h: 2, color: '#ffffff', alpha: roof ? 0.7 : 0.55 })
  // Random sheen streaks in the pans (wrinkles in the thin sheet).
  const streaks: { x: number; y: number; w: number; a: number }[] = []
  for (let i = 0; i < 26; i++) {
    streaks.push({
      x: rnd() * POLY_W,
      y: Math.floor(rnd() * POLY_H),
      w: 50 + rnd() * 260,
      a: (roof ? 0.12 : 0.06) + rnd() * (roof ? 0.16 : 0.12)
    })
  }

  const drawLayer = (ctx: CanvasRenderingContext2D, mode: 'color' | 'alpha') => {
    const gray = (a: number) => {
      const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
      return `rgb(${v},${v},${v})`
    }
    ctx.fillStyle = mode === 'color' ? '#f3f6f6' : gray(baseAlpha)
    ctx.fillRect(0, 0, POLY_W, POLY_H)
    // Canvas rows run down; tile rows are measured up from the sheet bottom.
    const top = (y: number, h: number) => POLY_H - y - h
    for (const s of streaks) {
      ctx.fillStyle = mode === 'color' ? '#ffffff' : gray(baseAlpha + s.a)
      ctx.fillRect(s.x, top(s.y, 1), s.w, 1)
      ctx.fillRect(s.x - POLY_W, top(s.y, 1), s.w, 1)
    }
    for (const r of rows) {
      if (mode === 'color') {
        ctx.fillStyle = r.color
        ctx.fillRect(0, top(r.y, r.h), POLY_W, r.h)
      } else if (typeof r.alpha === 'number') {
        ctx.fillStyle = gray(r.alpha)
        ctx.fillRect(0, top(r.y, r.h), POLY_W, r.h)
      } else {
        for (let x = 0; x < POLY_W; x += 4) {
          ctx.fillStyle = gray(r.alpha(x / POLY_W))
          ctx.fillRect(x, top(r.y, r.h), 4, r.h)
        }
      }
    }
    // Screws with neoprene washers on every major rib at each fastener column.
    for (let k = 0; k < 4; k++) {
      for (let c = 0; c < 4; c++) {
        const cx = (c * POLY_W) / 4
        const cy = top(k * POLY_RIB_PX + 3 + trough + crest / 2, 0)
        for (const x of [cx, cx + POLY_W]) {
          ctx.fillStyle = mode === 'color' ? '#7d858a' : gray(0.92)
          ctx.beginPath()
          ctx.ellipse(x, cy, 3, 3, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = mode === 'color' ? '#e8ecee' : gray(1)
          ctx.fillRect(x - 1, cy - 1, 2, 1)
        }
      }
    }
  }

  const map = drawTexture(POLY_W, POLY_H, true, ({ ctx }) => drawLayer(ctx, 'color'))
  const alphaMap = drawTexture(POLY_W, POLY_H, false, ({ ctx }) => drawLayer(ctx, 'alpha'))
  const textures = { map, alphaMap }
  polyCache.set(kind, textures)
  return textures
}

/**
 * Polycarbonate color + alpha clones with a shared repeat. For walls pass
 * repX = run along the ribs / POLY_TILE_ALONG_FT and repY = height /
 * POLY_TILE_ACROSS_FT; `offsetY` shifts the sheet laps.
 */
export function usePolycarbonateTextures(kind: PolycarbonateKind, repX: number, repY: number, offsetY = 0) {
  const base = getPolycarbonateTextures(kind)
  const map = useClone(base.map, repX, repY, offsetY)
  const alphaMap = useClone(base.alphaMap, repX, repY, offsetY)
  return { map, alphaMap }
}
