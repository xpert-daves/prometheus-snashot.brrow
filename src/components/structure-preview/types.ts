import type { QuoteParams } from '@/lib/pricing/calculateQuote'
import { getVisualWallHeight } from '@/lib/quoteVisualPlacement'

export const FOOT = 0.3048

export type RoofStyle = 'gabled' | 'barn' | 'lean-to'

type StructureType = QuoteParams['structureType']

/** The quote flow has no pitch input. Carport and greenhouse gables are 4:12;
 * lean-to is a shallower 2:12 because its rise accrues over the full span. */
const PITCH = 4
const LEAN_TO_PITCH = 2
/**
 * Enclosed Shed210 gables rise about 1.35-1.6 ft whatever the span (8 ft gables
 * are about 4:12, 16 ft gables about 2:12), so the rise is a constant rather
 * than a pitch. Greenhouses keep 4:12 but never go below this rise. Spans
 * wider than any photographed build (over 18 ft) keep at least 2:12 so they
 * don't read as flat.
 */
const ENCLOSED_GABLE_RISE_FT = 1.5
const MIN_ENCLOSED_PITCH = 2

/**
 * Gambrel (barn) profile for a footprint `length` (meters), measured on the
 * Shady Oaks barn: total rise 0.32·L, the pitch break 0.16·L in from each
 * eave (bx from center) at 0.68 of the rise. A steep, short lower slope and
 * a shallow (about 3:12) upper one.
 */
export function getGambrelProfile(length: number) {
  const rise = 0.32 * length
  return { rise, bx: 0.34 * length, r1: 0.68 * rise }
}

/**
 * Roof rise above the eave, in meters, for a footprint `length` (meters).
 * Gables depend on the structure type (see ENCLOSED_GABLE_RISE_FT).
 */
export function getRoofRiseMeters(style: RoofStyle, length: number, structureType?: StructureType) {
  if (style === 'barn') return getGambrelProfile(length).rise
  if (style === 'lean-to') return (LEAN_TO_PITCH / 12) * length
  const pitched = (PITCH / 12) * (length / 2)
  if (structureType === 'carport') return pitched
  if (structureType === 'greenhouse') return Math.max(pitched, ENCLOSED_GABLE_RISE_FT * FOOT)
  return Math.max(ENCLOSED_GABLE_RISE_FT * FOOT, (MIN_ENCLOSED_PITCH / 12) * (length / 2))
}

export type Side = 'front' | 'back' | 'left' | 'right'

export type DoorSpec = {
  id: string
  side: Side
  width: number
  height: number
  offset: number
  color?: string
  placement?: 'default' | 'custom'
}

export type WindowSpec = {
  id: string
  side: Side
  width: number
  height: number
  offset: number
  heightFromFloor: number
  placement?: 'default' | 'custom'
}

export type VisualExtras = {
  color?: string
  roofStyle?: RoofStyle
  roofColor?: string
  trimColor?: string
  showDimensions?: boolean
  showGrid?: boolean
  door?: { side: Side; width: number; height: number; offset?: number; color?: string }
  doors?: DoorSpec[]
  windows?: WindowSpec[]
}

export type StructurePreviewParams = Omit<QuoteParams, 'door'> &
  Partial<VisualExtras> & {
    door?: VisualExtras['door']
  }

/** Structure types whose quote step offers a roof-style choice (quoteFlow showRoofStyle). */
const ROOF_STYLE_CHOICE_TYPES: ReadonlySet<StructureType> = new Set(['storage_shed', 'portable_garage'])

/**
 * Roof style the preview actually draws. Types without a roof-style choice are
 * always gabled: the quote hides the input for them but can carry a stale barn
 * or lean-to value over from another structure type.
 */
export function getEffectiveRoofStyle(
  params: Pick<StructurePreviewParams, 'structureType' | 'roofStyle'>
): RoofStyle {
  if (!ROOF_STYLE_CHOICE_TYPES.has(params.structureType)) return 'gabled'
  const style = params.roofStyle as RoofStyle | undefined
  return style === 'barn' || style === 'lean-to' ? style : 'gabled'
}

export function feetToFtIn(feet: number) {
  const totalIn = Math.round(feet * 12)
  const ft = Math.floor(totalIn / 12)
  const inch = totalIn % 12
  return `${ft}' ${inch}"`
}

/**
 * Wall (eave) height the preview draws, in feet. Carports, loafing sheds and
 * well houses have no wall-height input, so they use a fixed visual height
 * shared with the quote's default door placement.
 */
export function getWallHeightFeet(params: Pick<StructurePreviewParams, 'structureType' | 'wallHeight'>) {
  return getVisualWallHeight(params.structureType, params.wallHeight)
}

// Open-air structures have no enclosed floor: they stand directly on grade,
// or on a slab when one is selected — never on blocks and skids.
export function isOpenAirStructureType(structureType: StructurePreviewParams['structureType']) {
  return structureType === 'carport' || structureType === 'open_loafing'
}

/**
 * Base and floor-frame dimensions in feet, from Shed210 build photos
 * (Lakehills, SA 8x8, Rocksprings, Floresville):
 * - wood-floored buildings sit on treated 4x6 skids under a 2x6 floor frame
 *   (rim band) and 3/4" deck, on grade or on solid 4" cap blocks;
 * - well houses are floorless: a flat 2x6 sill on grade or cap blocks, or a
 *   poured curb flush with the walls on the anchored-slab option.
 */
export const BASE_FT = {
  capBlock: 0.3,
  skid: 0.375,
  /** Rim band (2x6 floor frame) plus deck sheathing. */
  floorFrame: 0.52,
  rim: 0.46,
  sill: 0.125,
  curb: 0.55,
  slab: 0.35,
  /** Siding laps this far down over the rim band (matches the greenhouse knee siding). */
  sidingDrop: 2 / 12,
  /** Siding over a well-house sill leaves about an inch of treated sill showing. */
  sillReveal: 1 / 12
} as const

export type FoundationInfo = {
  /**
   * skids: wood floor frame on skids; sill: floorless well house on a
   * treated sill; slab: concrete pad; curb: flush poured curb (well house);
   * grade: open-air structures on the ground.
   */
  kind: 'skids' | 'sill' | 'slab' | 'curb' | 'grade'
  /** Skids or sill rest on solid cap blocks (the blocks_level option). */
  onBlocks: boolean
  /** World-space height of the finished floor above grade, in meters. */
  floorY: number
  skirted: boolean
  /** How far the wall siding runs below the floor (meters), over the rim or sill. */
  sidingDrop: number
}

/**
 * Foundation option -> base visuals. `none` puts the skids (or a well
 * house's sill) on grade, `blocks_level` (the quote default) on cap blocks,
 * `anchored_slab` on a slab (a flush curb for well houses). Open-air
 * structures sit on grade unless an anchored slab is selected.
 */
export function getFoundationInfo(
  params: Pick<StructurePreviewParams, 'structureType' | 'foundation' | 'addOns'>
): FoundationInfo {
  const slab = params.foundation === 'anchored_slab'
  const onBlocks = !slab && params.foundation !== 'none'
  if (isOpenAirStructureType(params.structureType)) {
    return slab
      ? { kind: 'slab', onBlocks: false, floorY: BASE_FT.slab * FOOT, skirted: false, sidingDrop: 0 }
      : { kind: 'grade', onBlocks: false, floorY: 0, skirted: false, sidingDrop: 0 }
  }
  if (params.structureType === 'well_pump') {
    if (slab) return { kind: 'curb', onBlocks: false, floorY: BASE_FT.curb * FOOT, skirted: false, sidingDrop: 0 }
    const floorFt = (onBlocks ? BASE_FT.capBlock : 0) + BASE_FT.sill
    return {
      kind: 'sill',
      onBlocks,
      floorY: floorFt * FOOT,
      skirted: false,
      sidingDrop: (BASE_FT.sill - BASE_FT.sillReveal) * FOOT
    }
  }
  if (slab) return { kind: 'slab', onBlocks: false, floorY: BASE_FT.slab * FOOT, skirted: false, sidingDrop: 0 }
  const floorFt = (onBlocks ? BASE_FT.capBlock : 0) + BASE_FT.skid + BASE_FT.floorFrame
  return {
    kind: 'skids',
    onBlocks,
    floorY: floorFt * FOOT,
    skirted: Boolean(params.addOns?.includes('Skirting')),
    sidingDrop: BASE_FT.sidingDrop * FOOT
  }
}
