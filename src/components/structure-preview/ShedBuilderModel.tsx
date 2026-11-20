'use client'

import * as THREE from 'three'
import { memo, useEffect, useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import {
  FOOT,
  feetToFtIn,
  getEffectiveRoofStyle,
  getFoundationInfo,
  getRoofRiseMeters,
  getWallHeightFeet,
  type DoorSpec,
  type RoofStyle,
  type StructurePreviewParams,
  type WindowSpec
} from './types'
import { PANEL_REPEAT_X_PER_M, RIB, panelRepeatX } from './textures'
import {
  GREENHOUSE_SIDING_DROP_FT,
  GreenhouseEnclosure,
  greenhouseHasBenches,
  greenhouseRoofRepeat,
  useClearPanelMaterial
} from './greenhouse'
import {
  getRoofFinish,
  usePanelMaterial,
  useRoofPanelMaterial,
  useSimpleMaterial,
  useTrimMaterial
} from './materials'
import { useMergedBoxes, type BoxSpec } from './ventVisuals'
import { FoundationBase } from './baseVisuals'
import { CarportFrame, LoafingFrame, getLoafingOpenSide } from './openFrames'
import {
  BOX_FACE,
  ROOF_LIFT,
  ROOF_SLAB_T,
  boxWithOneFace,
  buildEndWallBaseShape,
  buildEndWallShape,
  buildGableInfillShape,
  buildRoofSegments,
  getRoofOverhangs,
  ridgeAngle,
  segPoint,
  type RoofSeg
} from './roofGeometry'

const F = FOOT

function DimLine({ start, end, label }: { start: THREE.Vector3; end: THREE.Vector3; label: string }) {
  const mid = start.clone().add(end).multiplyScalar(0.5)
  return (
    <group>
      <Line points={[start, end]} lineWidth={1} dashed dashSize={0.16} gapSize={0.12}>
        <meshBasicMaterial color="#111827" />
      </Line>
      <Html position={mid} center transform>
        <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm ring-1 ring-black/5">
          {label}
        </div>
      </Html>
    </group>
  )
}

function DimensionLines({
  params,
  length,
  width,
  wall,
  floorY
}: {
  params: StructurePreviewParams
  length: number
  width: number
  wall: number
  floorY: number
}) {
  const wallLabel = params.structureType === 'carport' ? 'Leg height' : 'Wall'
  return (
    <group>
      <DimLine
        start={new THREE.Vector3(-length / 2, 0.05, width / 2 + 0.7)}
        end={new THREE.Vector3(length / 2, 0.05, width / 2 + 0.7)}
        label={`Length ${feetToFtIn(params.length ?? 8)}`}
      />
      <DimLine
        start={new THREE.Vector3(length / 2 + 0.7, 0.05, -width / 2)}
        end={new THREE.Vector3(length / 2 + 0.7, 0.05, width / 2)}
        label={`Width ${feetToFtIn(params.width ?? 8)}`}
      />
      <DimLine
        start={new THREE.Vector3(-length / 2 - 0.7, floorY, -width / 2)}
        end={new THREE.Vector3(-length / 2 - 0.7, floorY + wall, -width / 2)}
        label={`${wallLabel} ${feetToFtIn(wall / FOOT)}`}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// Metal building model ported from shed-builder.html. Axes: the gable profile
// spans `length` along X (ridge runs along Z), front wall at +Z — matching the
// previous preview's orientation, so the drag/raycast machinery is unchanged.
// The lean-to roof rises toward +X like the old lean-to.
//
// All structure types share this geometry system. Enclosure varies by type:
// carport is an open red-iron post-and-roof frame, open loafing keeps three
// walls with one open side, greenhouse swaps the walls for its enclosure.
// Roof/end-wall profiles and overhangs live in roofGeometry.ts.
// ---------------------------------------------------------------------------

/**
 * How much of the building envelope is enclosed: carports are open; loafing
 * sheds are open along the long +X eave side when the gable end is the
 * short side, otherwise at the +Z gable end.
 */
type WallMode = 'full' | 'open' | 'open-front' | 'open-side'

function getWallMode(structureType: StructurePreviewParams['structureType'], lengthFt: number, widthFt: number): WallMode {
  if (structureType === 'carport') return 'open'
  if (structureType === 'open_loafing') return getLoafingOpenSide(lengthFt, widthFt) === 'right' ? 'open-side' : 'open-front'
  return 'full'
}

/** Bent trim sizes (m): rake face about 4", corner legs 3.5", standing 3/4" proud. */
const RAKE_H = 0.35 * F
const RAKE_LIFT = 0.03 * F
const TRIM_PROUD = 0.06 * F
const CORNER_LEG = 0.29 * F
const RIDGE_LEG = 0.45 * F
const RIDGE_T = 0.04 * F
/** Off-white backer side of the wall panels, seen inside open structures. */
const PANEL_BACK_HEX = '#dcdcd4'

/**
 * Rake trim: a bent box over each gable edge, its top lifted clear of the
 * roof sheet (no coplanar faces, so no z-fighting comb), wrapping back to
 * the gable wall (`zIn`) and hanging about 2" onto it. It runs a little past
 * the eave and meets its partner at the ridge.
 */
function rakeTrimBoxes(segs: RoofSeg[], roofDepth: number, zIn: number, halfT: number): BoxSpec[] {
  const zOut = roofDepth / 2 + 0.05 * F
  const cy = halfT + RAKE_LIFT - RAKE_H / 2
  const out: BoxSpec[] = []
  for (const seg of segs) {
    const [x, y] = segPoint(seg, 0, cy)
    for (const s of [1, -1]) {
      out.push({ center: [x, y, (s * (zIn + zOut)) / 2], size: [seg.len + 0.16 * F, RAKE_H, zOut - zIn], rotZ: seg.rot })
    }
  }
  return out
}

/**
 * Bent-V ridge cap: two legs following the slopes (`ang`), about 5" per
 * side, resting just above the roof sheet whose top is `halfT` above its
 * center line. Floor-relative.
 */
function ridgeCapBoxes(wall: number, rise: number, ang: number, roofDepth: number, halfT: number): BoxSpec[] {
  const cos = Math.cos(ang)
  const apexY = wall + rise + ROOF_LIFT + halfT / cos + (RIDGE_T + 0.004 * F) / cos
  return [1, -1].map((s) => {
    const rot = -s * ang
    const lx = (s * RIDGE_LEG) / 2
    const ly = -RIDGE_T / 2
    return {
      center: [lx * Math.cos(rot) - ly * Math.sin(rot), apexY + lx * Math.sin(rot) + ly * Math.cos(rot), 0],
      size: [RIDGE_LEG, RIDGE_T, roofDepth + 0.04 * F],
      rotZ: rot
    }
  })
}

/**
 * Outside-corner trim: an L of two 3.5" legs standing 3/4" proud of the
 * walls, from `-drop` (below the floor) to each corner's top.
 */
function cornerTrimBoxes(length: number, width: number, drop: number, tops: { sx: number; sz: number; top: number }[]): BoxSpec[] {
  const out: BoxSpec[] = []
  for (const { sx, sz, top } of tops) {
    const h = top + drop
    const cy = (top - drop) / 2
    out.push({
      center: [sx * (length / 2 + TRIM_PROUD - CORNER_LEG / 2), cy, sz * (width / 2 + TRIM_PROUD / 2)],
      size: [CORNER_LEG, h, TRIM_PROUD]
    })
    out.push({
      center: [sx * (length / 2 + TRIM_PROUD / 2), cy, sz * (width / 2 - (CORNER_LEG - TRIM_PROUD) / 2)],
      size: [TRIM_PROUD, h, CORNER_LEG - TRIM_PROUD]
    })
  }
  return out
}

/**
 * Lean-to eave trims: a trim-color high-eave box that wraps the high roof
 * edge back to the wall, and a small roof-color drip at the low edge.
 */
function leanToEaveBoxes(seg: RoofSeg, length: number, roofDepth: number, halfT: number) {
  const [hxTop, hyTop] = segPoint(seg, seg.len / 2, halfT)
  const [hxBot] = segPoint(seg, seg.len / 2, -halfT)
  const xIn = length / 2 - 0.02 * F
  const xOut = Math.max(hxTop, hxBot) + 0.06 * F
  const top = hyTop + RAKE_LIFT
  const high: BoxSpec = {
    center: [(xIn + xOut) / 2, top - 0.2 * F, 0],
    size: [xOut - xIn, 0.4 * F, roofDepth + 0.1 * F]
  }
  const [lxTop, lyTop] = segPoint(seg, -seg.len / 2, halfT)
  const [, lyBot] = segPoint(seg, -seg.len / 2, -halfT)
  const drip: BoxSpec = {
    center: [lxTop - 0.01 * F, (lyTop + 0.01 * F + lyBot - 0.07 * F) / 2, 0],
    size: [0.07 * F, lyTop - lyBot + 0.08 * F, roofDepth]
  }
  return { high, drip }
}

/**
 * Inside face of an open loafing shed's walls: the off-white backer side of
 * the panels, just inside the siding so the painted face never shows
 * through the opening. Each entry reuses a wall geometry.
 */
function PanelBackLiners({
  plane,
  shape,
  repX,
  repY
}: {
  plane: { geometry: THREE.BufferGeometry; position: [number, number, number] }[]
  shape: { geometry: THREE.BufferGeometry; position: [number, number, number] }[]
  repX: number
  repY: number
}) {
  const opts = { metalness: 0.05, roughness: 0.6, fasteners: false }
  const planeMat = usePanelMaterial(PANEL_BACK_HEX, repX, repY, true, opts)
  const shapeMat = usePanelMaterial(PANEL_BACK_HEX, PANEL_REPEAT_X_PER_M, RIB / FOOT, true, opts)
  return (
    <group>
      {plane.map((p, i) => (
        <mesh key={`p${i}`} geometry={p.geometry} material={planeMat} position={p.position} rotation={[0, Math.PI / 2, 0]} receiveShadow />
      ))}
      {shape.map((s, i) => (
        <mesh key={`s${i}`} geometry={s.geometry} material={shapeMat} position={s.position} receiveShadow />
      ))}
    </group>
  )
}

type ShedBuilderModelProps = {
  params: StructurePreviewParams
  /** Live doors/windows (they may be dragged), so greenhouse framing follows them. */
  doors?: DoorSpec[]
  windows?: WindowSpec[]
}

const NO_DOORS: DoorSpec[] = []
const NO_WINDOWS: WindowSpec[] = []

const MetalBuildingModel = memo(function MetalBuildingModel({
  params,
  doors = params.doors ?? NO_DOORS,
  windows = params.windows ?? NO_WINDOWS
}: ShedBuilderModelProps) {
  const lengthFt = params.length ?? 8
  const widthFt = params.width ?? 8
  const wallFt = getWallHeightFeet(params)
  const length = lengthFt * FOOT
  const width = widthFt * FOOT
  const wall = wallFt * FOOT

  const baseColor = params.color || '#b8bcc2'
  const trimColor = params.trimColor || '#f8fafc'
  const roofStyle: RoofStyle = getEffectiveRoofStyle(params)
  const wallMode = getWallMode(params.structureType, lengthFt, widthFt)
  const isGreenhouse = params.structureType === 'greenhouse'
  const isCarport = wallMode === 'open'
  // 2-Tone: trim-color gable triangles (the greenhouse draws its own gables).
  const twoTone = Boolean(params.addOns?.includes('2-Tone')) && wallMode === 'full' && !isGreenhouse

  const foundation = useMemo(
    () => getFoundationInfo({ structureType: params.structureType, foundation: params.foundation, addOns: params.addOns }),
    [params.structureType, params.foundation, params.addOns]
  )
  const { floorY, skirted } = foundation
  // Siding runs to grade over skirting, otherwise a little over the rim band or sill.
  const ext = skirted ? floorY : isGreenhouse ? GREENHOUSE_SIDING_DROP_FT * F : foundation.sidingDrop
  const extFt = ext / FOOT

  const rise = getRoofRiseMeters(roofStyle, length, params.structureType)
  const leftWallH = wall
  const rightWallH = roofStyle === 'lean-to' ? wall + rise : wall

  // Geometries that depend on dimensions are created imperatively (not via
  // JSX) so they are disposed deterministically when the footprint changes.
  const endWallGeom = useMemo(
    () =>
      new THREE.ShapeGeometry(
        twoTone ? buildEndWallBaseShape(length, wall, ext) : buildEndWallShape(roofStyle, length, wall, rise, ext)
      ),
    [twoTone, roofStyle, length, wall, rise, ext]
  )
  const leftWallGeom = useMemo(() => new THREE.PlaneGeometry(width, leftWallH + ext), [width, leftWallH, ext])
  const rightWallGeom = useMemo(() => new THREE.PlaneGeometry(width, rightWallH + ext), [width, rightWallH, ext])
  const gableInfillGeom = useMemo(
    () => new THREE.ShapeGeometry(buildGableInfillShape(roofStyle, length, wall, rise)),
    [roofStyle, length, wall, rise]
  )
  useEffect(() => () => endWallGeom.dispose(), [endWallGeom])
  useEffect(() => () => leftWallGeom.dispose(), [leftWallGeom])
  useEffect(() => () => rightWallGeom.dispose(), [rightWallGeom])
  useEffect(() => () => gableInfillGeom.dispose(), [gableInfillGeom])

  const over = useMemo(
    () => getRoofOverhangs({ structureType: params.structureType, addOns: params.addOns }, roofStyle),
    [params.structureType, params.addOns, roofStyle]
  )
  const roofDepth = width + over.rake * 2
  const roofDepthFt = roofDepth / FOOT

  // Plane UVs span 0..1, so repeats are laps for the whole span (in feet);
  // ShapeGeometry UVs are in meters, so end walls repeat at laps-per-meter.
  const leftWallMat = usePanelMaterial(baseColor, panelRepeatX(widthFt), (leftWallH / FOOT + extFt) * RIB, true)
  const rightWallMat = usePanelMaterial(baseColor, panelRepeatX(widthFt), (rightWallH / FOOT + extFt) * RIB, true)
  const endWallMat = usePanelMaterial(baseColor, PANEL_REPEAT_X_PER_M, RIB / FOOT, true)
  const gableMat = usePanelMaterial(trimColor, PANEL_REPEAT_X_PER_M, RIB / FOOT, true)
  // Side-wall ribs keep the end walls' phase (a rib line at the floor) whatever the siding drop.
  for (const m of [leftWallMat, rightWallMat]) {
    if (m.map) m.map.offset.y = -extFt * RIB
    if (m.normalMap) m.normalMap.offset.y = -extFt * RIB
  }
  const roofPanelMat = useRoofPanelMaterial(params, 1, roofDepthFt)
  // Light roof underside (panel back): a dark metallic box bottom read black under eaves and carports.
  const soffitMat = usePanelMaterial('#d9dad5', 1, roofDepthFt, true, { profile: 'rib', metalness: 0.1, roughness: 0.7 })
  const roofSlabMats = useMemo(() => [roofPanelMat, soffitMat], [roofPanelMat, soffitMat])
  const roofFinish = getRoofFinish(params)
  // Ridge cap, carport rakes and drips: plain roof-color metal (no rib map).
  const roofCapMat = useSimpleMaterial(
    { color: roofFinish.hex, metalness: roofFinish.opts.metalness ?? 0.15, roughness: roofFinish.opts.roughness ?? 0.42 },
    [roofFinish.hex, roofFinish.opts.metalness, roofFinish.opts.roughness]
  )
  const trimMat = useTrimMaterial(trimColor)

  const roofSegs = useMemo(
    () => buildRoofSegments(roofStyle, length, wall, rise, over),
    [roofStyle, length, wall, rise, over]
  )
  // Opaque roof slabs: ribbed panel on top and edges, the light underside as a second draw group.
  const roofSlabGeoms = useMemo(
    () => (isGreenhouse ? [] : roofSegs.map((seg) => boxWithOneFace(seg.len, ROOF_SLAB_T, roofDepth, BOX_FACE.ny))),
    [isGreenhouse, roofSegs, roofDepth]
  )
  useEffect(() => () => roofSlabGeoms.forEach((g) => g.dispose()), [roofSlabGeoms])
  // Greenhouse roof: clear polycarbonate, ribs down-slope (never roof-color tinted).
  const clearRoofMat = useClearPanelMaterial(
    'roof',
    ...greenhouseRoofRepeat((roofSegs[0]?.len ?? length) / FOOT, roofDepth / FOOT)
  )

  // Trim pieces merged per material: one draw for trim color, one for roof color.
  const halfT = isGreenhouse ? 0 : ROOF_SLAB_T / 2
  const { trimBoxes, capBoxes } = useMemo(() => {
    const trim: BoxSpec[] = []
    const cap: BoxSpec[] = []
    // Rakes wrap back to the gable wall (carport: over the infill, in the roof color).
    const rakes = rakeTrimBoxes(roofSegs, roofDepth, width / 2 - 0.03 * F, halfT)
    ;(isCarport ? cap : trim).push(...rakes)
    if (roofStyle !== 'lean-to') {
      const ridge = ridgeCapBoxes(wall, rise, ridgeAngle(roofStyle, length, rise), roofDepth, halfT)
      ;(isGreenhouse ? trim : cap).push(...ridge)
    } else if (roofSegs[0]) {
      const { high, drip } = leanToEaveBoxes(roofSegs[0], length, roofDepth, halfT)
      ;(isCarport ? cap : trim).push(high)
      cap.push(drip)
    }
    if (!isCarport) {
      // Corner trims run down as far as the siding does.
      const tops = [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1]
      ].map(([sx, sz]) => ({ sx, sz, top: roofStyle === 'lean-to' && sx > 0 ? wall + rise : wall }))
      trim.push(...cornerTrimBoxes(length, width, ext, tops))
    }
    if (twoTone) {
      for (const s of [1, -1]) {
        trim.push({ center: [0, wall - 0.04 * F, s * (width / 2 + TRIM_PROUD / 2)], size: [length + TRIM_PROUD * 2, 0.2 * F, TRIM_PROUD] })
      }
    }
    return { trimBoxes: trim, capBoxes: cap }
  }, [roofSegs, roofDepth, isCarport, isGreenhouse, width, halfT, roofStyle, wall, rise, length, ext, twoTone])
  const trimGeom = useMergedBoxes(trimBoxes)
  const capGeom = useMergedBoxes(capBoxes)

  // Open loafing: the inside faces show the panel back, not painted siding.
  const liners = useMemo(() => {
    if (wallMode !== 'open-front' && wallMode !== 'open-side') return null
    const inset = 0.015 * F
    const plane: { geometry: THREE.BufferGeometry; position: [number, number, number] }[] = [
      { geometry: leftWallGeom, position: [-length / 2 + inset, (leftWallH - ext) / 2, 0] }
    ]
    const shape: { geometry: THREE.BufferGeometry; position: [number, number, number] }[] = [
      { geometry: endWallGeom, position: [0, 0, -width / 2 + inset] }
    ]
    if (wallMode === 'open-front') {
      plane.push({ geometry: rightWallGeom, position: [length / 2 - inset, (rightWallH - ext) / 2, 0] })
      shape.push({ geometry: gableInfillGeom, position: [0, 0, width / 2 - inset] })
    } else {
      shape.push({ geometry: endWallGeom, position: [0, 0, width / 2 - inset] })
    }
    return { plane, shape }
  }, [wallMode, leftWallGeom, rightWallGeom, endWallGeom, gableInfillGeom, length, width, leftWallH, rightWallH, ext])

  return (
    <group>
      {/* ---- foundation (world/grade coordinates) ---- */}
      {/* greenhouses: bare treated rim, skids about 2 ft in from the side walls (Luling, Boerne) */}
      <FoundationBase
        info={foundation}
        length={length}
        width={width}
        trimColor={trimColor}
        woodRim={isGreenhouse}
        skidInsetFt={isGreenhouse ? 2 : 0.5}
      />

      {/* ---- building (floor-relative coordinates) ---- */}
      <group position={[0, floorY, 0]}>
        {/* greenhouse: knee walls, clear walls, gables, framing, benches, floor, vents */}
        {isGreenhouse ? (
          <GreenhouseEnclosure
            lengthFt={lengthFt}
            widthFt={widthFt}
            wallFt={wallFt}
            riseFt={rise / FOOT}
            baseColor={baseColor}
            trimColor={trimColor}
            doors={doors}
            windows={windows}
            ventilation={Boolean(params.ventilation)}
            benches={greenhouseHasBenches(params.addOns)}
            deck={foundation.kind === 'skids'}
            sidingBottomFt={skirted ? -floorY / FOOT : -GREENHOUSE_SIDING_DROP_FT}
            roofLiftFt={ROOF_LIFT / FOOT}
          />
        ) : null}
        {/* side walls at +/-X (no +X wall on a side-open loafing shed); skirted walls run to grade */}
        {wallMode !== 'open' && !isGreenhouse ? (
          <>
            <mesh
              geometry={leftWallGeom}
              material={leftWallMat}
              rotation={[0, Math.PI / 2, 0]}
              position={[-length / 2, (leftWallH - ext) / 2, 0]}
              castShadow
              receiveShadow
            />
            {wallMode !== 'open-side' ? (
              <mesh
                geometry={rightWallGeom}
                material={rightWallMat}
                rotation={[0, Math.PI / 2, 0]}
                position={[length / 2, (rightWallH - ext) / 2, 0]}
                castShadow
                receiveShadow
              />
            ) : null}
            {/* back end wall at -Z with the roof profile */}
            <mesh geometry={endWallGeom} material={endWallMat} position={[0, 0, -width / 2]} castShadow receiveShadow />
          </>
        ) : null}
        {/* front end wall at +Z: full profile, or just the gable above an open front */}
        {(wallMode === 'full' || wallMode === 'open-side') && !isGreenhouse ? (
          <mesh geometry={endWallGeom} material={endWallMat} position={[0, 0, width / 2]} castShadow receiveShadow />
        ) : null}
        {wallMode === 'open-front' ? (
          <mesh geometry={gableInfillGeom} material={endWallMat} position={[0, 0, width / 2]} castShadow receiveShadow />
        ) : null}
        {/* 2-Tone: trim-color gable triangles above the eave line */}
        {twoTone
          ? [1, -1].map((s) => (
              <mesh
                key={s}
                geometry={gableInfillGeom}
                material={gableMat}
                position={[0, 0, (s * width) / 2]}
                castShadow
                receiveShadow
              />
            ))
          : null}
        {liners ? (
          <PanelBackLiners
            plane={liners.plane}
            shape={liners.shape}
            repX={panelRepeatX(widthFt)}
            repY={(leftWallH / FOOT + extFt) * RIB}
          />
        ) : null}

        {wallMode === 'open-front' || wallMode === 'open-side' ? (
          <LoafingFrame
            length={length}
            width={width}
            wall={wall}
            rise={rise}
            roofStyle={roofStyle}
            segs={roofSegs}
            open={wallMode === 'open-side' ? 'right' : 'front'}
            trimColor={trimColor}
            dirtFloor={foundation.kind === 'grade'}
          />
        ) : null}
        {isCarport ? (
          <CarportFrame
            length={length}
            width={width}
            wall={wall}
            rise={rise}
            roofStyle={roofStyle}
            segs={roofSegs}
            roofHex={roofFinish.hex}
            roofOpts={roofFinish.opts}
          />
        ) : null}

        {/* roof: ribbed slabs with a light underside (no eave fascia: the panel edge shows) */}
        {roofSegs.map((seg, i) => (
          <group key={i} position={[seg.x, seg.y, 0]} rotation={[0, 0, seg.rot]}>
            {isGreenhouse ? (
              // One clear sheet (a box would stack two translucent layers); casts no shadow.
              <mesh material={clearRoofMat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
                <planeGeometry args={[seg.len, roofDepth]} />
              </mesh>
            ) : roofSlabGeoms[i] ? (
              <mesh geometry={roofSlabGeoms[i]} material={roofSlabMats} castShadow receiveShadow />
            ) : null}
          </group>
        ))}

        {/* rake, corner, lean-to eave and 2-Tone trims (trim color); ridge cap and drips (roof color) */}
        {trimBoxes.length ? <mesh geometry={trimGeom} material={trimMat} castShadow receiveShadow /> : null}
        {capBoxes.length ? <mesh geometry={capGeom} material={roofCapMat} castShadow receiveShadow /> : null}
      </group>

      {params.showDimensions && (
        <DimensionLines params={params} length={length} width={width} wall={wall} floorY={floorY} />
      )}
    </group>
  )
})

const ShedBuilderModel = memo(function ShedBuilderModel({ params, doors, windows }: ShedBuilderModelProps) {
  return <MetalBuildingModel params={params} doors={doors} windows={windows} />
})

export default ShedBuilderModel
