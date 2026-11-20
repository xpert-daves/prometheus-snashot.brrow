import * as THREE from 'three'
import { FOOT, type StructurePreviewParams } from './types'

/*
 * Shared look for every 3D preview canvas (StructurePreview and the local
 * render harness), so renderer, sky and fog tuning lives in one place.
 */

/**
 * Renderer settings. Neutral tone mapping keeps paint close to its swatch:
 * R3F's ACES default dulls light paints, crushes dark ones and pushes reds
 * toward magenta. Exposure is tuned so Brilliant/Ivory walls keep their rib
 * detail without clipping and Hunter green stays green.
 */
export const SCENE_GL = {
  antialias: true,
  alpha: true,
  toneMapping: THREE.NeutralToneMapping,
  toneMappingExposure: 1.3
}

export const SCENE_SHADOWS = 'soft' as const

/** Horizon haze. The CSS sky's bottom stop matches it, so fogged ground meets the sky seamlessly. */
export const FOG_COLOR = '#dfe5e0'
export const SCENE_FOG_ARGS: [string, number, number] = [FOG_COLOR, 70 * FOOT, 220 * FOOT]

/** CSS sky behind the transparent canvas: Texas blue fading to the fog color. */
export const SCENE_BACKGROUND = `linear-gradient(180deg,#6e9fd3 0%,#a9cbe6 55%,${FOG_COLOR} 100%)`

/**
 * Inputs SceneEnvironment needs from the build: a key that changes whenever
 * the footprint does (re-renders the one-shot contact shadow) and the largest
 * plan dimension in feet (fits the sun's shadow camera).
 */
export function getSceneFootprint(params: StructurePreviewParams) {
  const lengthFt = params.length ?? 8
  const widthFt = params.width ?? 8
  const key = [
    params.structureType,
    lengthFt,
    widthFt,
    params.wallHeight,
    params.roofStyle,
    params.foundation,
    (params.addOns ?? []).join(',')
  ].join('|')
  return { footprintKey: key, spanFt: Math.max(lengthFt, widthFt) }
}
