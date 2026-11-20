'use client'

import * as THREE from 'three'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'

/** Breathing room around the building on its tightest axis (1 = touching the edge). */
const FIT_MARGIN = 1.1

type FitControls = { target: THREE.Vector3; maxDistance: number; update: () => void }

/**
 * Frames its children for the canvas's real aspect ratio. drei's <Bounds>
 * sizes the view from the box's largest side and the vertical FOV only, which
 * crops wide buildings in the quote page's tall, narrow preview. This keeps
 * the current view direction and solves, per bounding-box corner, the camera
 * distance that keeps that corner inside both the horizontal and vertical FOV.
 *
 * Refits when `fitKey` or the canvas size changes, not while features are
 * dragged, so the view never jumps under the pointer.
 */
export default function CameraFit({ fitKey, children }: { fitKey: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const camera = useThree((state) => state.camera)
  const width = useThree((state) => state.size?.width)
  const height = useThree((state) => state.size?.height)
  // OrbitControls registers itself as the default controls after mounting,
  // which re-runs the fit so its target matches the framed center.
  const controls = useThree((state) => state.controls) as unknown as FitControls | null
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    const root = group.current
    if (!root || !(camera instanceof THREE.PerspectiveCamera) || !width || !height) return
    root.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(root)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const dir = camera.position.clone().sub(controls?.target ?? center)
    if (dir.lengthSq() < 1e-8) dir.set(1, 0.6, 1)
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, right)
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const tanH = tanV * (width / height)

    // A corner at depth z toward the camera, offset x/y across the view, fits
    // when the camera sits at least z + margin·|x|/tanH (and ·|y|/tanV) away.
    let distance = 0
    const corner = new THREE.Vector3()
    for (let i = 0; i < 8; i++) {
      corner
        .set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
        .sub(center)
      const depth = corner.dot(dir)
      distance = Math.max(
        distance,
        depth + (FIT_MARGIN * Math.abs(corner.dot(right))) / tanH,
        depth + (FIT_MARGIN * Math.abs(corner.dot(up))) / tanV
      )
    }

    camera.position.copy(center).addScaledVector(dir, distance)
    camera.lookAt(center)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(center)
      // Never let the orbit limit pull the camera back inside the fit.
      controls.maxDistance = Math.max(controls.maxDistance, distance * 1.2)
      controls.update()
    }
    invalidate()
  }, [fitKey, camera, width, height, controls, invalidate])

  return <group ref={group}>{children}</group>
}
