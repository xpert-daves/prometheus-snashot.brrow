'use client'

import * as THREE from 'three'
import { memo, useEffect, useMemo, useRef } from 'react'
import { invalidate } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { FOOT } from './types'
import { getGrassTexture } from './textures'

/** Grass texture repeats roughly every 6 ft so blades read at shed scale. */
const GROUND_RADIUS = 150 * FOOT
const GRASS_TILE = 6 * FOOT

/**
 * Sun from the front-left of the default camera (az -35°, el 50°), so the
 * door face is sunlit, the eave wall falls into soft shade, and the cast
 * shadow reads on the lawn to the right.
 */
const SUN_POSITION: [number, number, number] = [-25.3 * FOOT, 52.6 * FOOT, 36.2 * FOOT]

/** Shadow-camera half-size beyond the footprint: covers a 12 ft wall's shadow at 50° sun. */
const SHADOW_REACH = 14 * FOOT

/**
 * World-space macro variation for the lawn: two octaves of value noise blend
 * toward dry straw and modulate brightness, so the 6 ft grass tile never reads
 * as a grid. The hash avoids sin() so it stays stable at mobile precision.
 */
function addLawnVariation(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vLawnXZ;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLawnXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec2 vLawnXZ;
float lawnHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float lawnNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lawnHash(i), lawnHash(i + vec2(1.0, 0.0)), f.x), mix(lawnHash(i + vec2(0.0, 1.0)), lawnHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`
    )
    .replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
{
  // Blend in a rotated, rescaled second lookup in noise-driven regions so
  // neither tiling lattice runs continuously across the lawn.
  vec4 lawnA = texture2D(map, vMapUv);
  vec4 lawnB = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.61 + vec2(0.37, 0.11));
  diffuseColor *= mix(lawnA, lawnB, smoothstep(0.3, 0.7, lawnNoise(vLawnXZ / 3.7 + 17.0)));
}
#endif
{
  float n = lawnNoise(vLawnXZ / 7.6) * 0.65 + lawnNoise(vLawnXZ / 2.3) * 0.35;
  float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  vec3 desat = mix(vec3(l), diffuseColor.rgb, 0.75);
  vec3 straw = vec3(0.62, 0.52, 0.33) * l * 1.6;
  diffuseColor.rgb = mix(desat, straw, smoothstep(0.4, 0.8, n) * 0.6) * (0.85 + 0.3 * n);
}`
    )
}

/** Shadow map size: 1024 on low-DPR or touch devices, 2048 elsewhere. Fixed per mount. */
function pickShadowMapSize() {
  if (typeof window === 'undefined') return 2048
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return window.devicePixelRatio < 1.5 || coarse ? 1024 : 2048
}

type SceneEnvironmentProps = {
  /** Changes whenever the footprint does; re-renders the one-shot contact shadow. */
  footprintKey?: string
  /** Largest plan dimension in feet; fits the sun's shadow camera to the build. */
  spanFt?: number
}

/**
 * Outdoor scene tuned against Shed210 build photos: clear Texas sky, warm
 * afternoon sun, and a sun-dried lawn that fades into the fogged horizon.
 *
 * Reflections come from a procedural environment (sky dome, warm ground
 * bounce, and a sun card) rendered once at load. It needs no network fetch,
 * so metal roofs and window glass reflect sky the way they do in real photos.
 *
 * Everything here sits outside <CameraFit>, so it never affects camera fitting.
 */
const SceneEnvironment = memo(function SceneEnvironment({ footprintKey = '', spanFt = 12 }: SceneEnvironmentProps) {
  const grass = useMemo(() => {
    const texture = getGrassTexture().clone()
    texture.needsUpdate = true
    const reps = (GROUND_RADIUS * 2) / GRASS_TILE
    texture.repeat.set(reps, reps)
    return texture
  }, [])
  const groundMat = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
    material.onBeforeCompile = addLawnVariation
    return material
  }, [grass])
  useEffect(
    () => () => {
      groundMat.dispose()
      grass.dispose()
    },
    [groundMat, grass]
  )

  const shadowMapSize = useMemo(pickShadowMapSize, [])
  const shadowHalf = Math.max(spanFt, 8) * FOOT * 0.5 + SHADOW_REACH
  const sun = useRef<THREE.DirectionalLight>(null)
  // R3F sets the shadow-camera bounds but three only rebuilds the projection
  // when the shadow map is first allocated, so refresh it on footprint changes.
  useEffect(() => {
    const light = sun.current
    if (!light) return
    light.shadow.camera.updateProjectionMatrix()
    invalidate()
  }, [shadowHalf])

  return (
    <group>
      <Environment resolution={256} frames={1} environmentIntensity={0.62}>
        {/* sky dome and warm ground bounce */}
        <mesh scale={100}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#adc8dc" side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={200}>
          <planeGeometry />
          <meshBasicMaterial color="#8b7f62" />
        </mesh>
        {/* bright horizon band, the sun (matching the shadow-casting light), and sky fill */}
        <Lightformer form="ring" intensity={1.4} color="#f3f1e8" position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[60, 60, 1]} />
        <Lightformer form="rect" intensity={6} color="#fff1d6" position={[-14.3, 29.6, 20.4]} scale={[10, 10, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#cfe3f3" position={[25, 12, -10]} scale={[30, 10, 1]} target={[0, 0, 0]} />
      </Environment>

      <hemisphereLight args={['#dcebf7', '#8a7a55', 0.38]} />
      <directionalLight
        ref={sun}
        color="#fff4e4"
        intensity={3}
        position={SUN_POSITION}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} material={groundMat} receiveShadow>
        <circleGeometry args={[GROUND_RADIUS, 64]} />
      </mesh>

      {/* soft ambient occlusion where the building meets the lawn, rendered once per footprint */}
      <ContactShadows
        key={footprintKey}
        frames={1}
        position={[0, 0.004, 0]}
        scale={60 * FOOT}
        resolution={512}
        blur={2.6}
        opacity={0.5}
        far={10 * FOOT}
        color="#1f2414"
      />
    </group>
  )
})

export default SceneEnvironment
