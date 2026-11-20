import { FOOT, type DoorSpec, type WindowSpec } from '../types'
import {
  buildStepBoxes,
  buildWalkDoorParts,
  buildWindowParts,
  computeGableVent,
  doorHeaderTop,
  solarPanelPoseOnRoof,
  wallTopAt,
  type ShedFrame
} from '../featureVisuals'

const frame = (overrides: Partial<ShedFrame> = {}): ShedFrame => ({
  length: 8 * FOOT,
  width: 10 * FOOT,
  wall: 7 * FOOT,
  floorY: 1 * FOOT,
  roofStyle: 'gabled',
  structureType: 'storage_shed',
  ...overrides
})

const door = (overrides: Partial<DoorSpec> = {}): DoorSpec => ({
  id: 'door-default-single_shed',
  side: 'front',
  width: 3,
  height: 6.75,
  offset: 0,
  ...overrides
})

const backWindow = (overrides: Partial<WindowSpec> = {}): WindowSpec => ({
  id: 'window-default-3',
  side: 'back',
  width: 2,
  height: 3,
  offset: 0,
  heightFromFloor: 3,
  ...overrides
})

describe('computeGableVent', () => {
  it('centers the storage vent on the back gable, straddling the eave line under the rake', () => {
    const shed = frame()
    const vent = computeGableVent(shed, [door()], [])
    expect(vent).not.toBeNull()
    const outerH = vent!.height + vent!.casing * 2
    const outerW = vent!.width + vent!.casing * 2
    expect(vent!.along).toBe(0)
    expect(outerW / FOOT).toBeCloseTo(1.34, 2)
    expect(outerH / FOOT).toBeCloseTo(0.92, 2)
    expect(vent!.y - outerH / 2).toBeLessThan(shed.wall)
    expect(vent!.y + outerH / 2).toBeGreaterThan(shed.wall)
    const roofLine = Math.min(wallTopAt(shed, 'back', -outerW / 2), wallTopAt(shed, 'back', outerW / 2))
    expect(vent!.y + outerH / 2).toBeLessThan(roofLine)
  })

  it('gives well houses the wider three-bank vent', () => {
    const vent = computeGableVent(frame({ structureType: 'well_pump', length: 6 * FOOT }), [door()], [])
    expect(vent?.banks).toBe(3)
    expect((vent!.width + vent!.casing * 2) / FOOT).toBeCloseTo(1.65, 2)
  })

  it.each([
    ['lean-to roofs', { roofStyle: 'lean-to' as const }],
    ['greenhouses (they draw their own louvers)', { structureType: 'greenhouse' as const }],
    ['carports', { structureType: 'carport' as const }]
  ])('skips %s', (_label, overrides) => {
    expect(computeGableVent(frame(overrides), [], [])).toBeNull()
  })

  it('steps sideways to clear a centered back window', () => {
    const shed = frame({ wall: 6 * FOOT, width: 8 * FOOT })
    const win = backWindow({ heightFromFloor: 2.5 })
    const vent = computeGableVent(shed, [door()], [win])
    expect(vent).not.toBeNull()
    const outerW = vent!.width + vent!.casing * 2
    const windowHalf = (win.width / 2 + 0.29) * FOOT
    expect(Math.abs(vent!.along) - outerW / 2).toBeGreaterThan(windowHalf)
  })

  it('keeps the placard above the vent and under the rake', () => {
    const shed = frame()
    const vent = computeGableVent(shed, [door()], [])!
    expect(vent.placard).not.toBeNull()
    const ventTop = vent.y + vent.height / 2 + vent.casing
    expect(vent.placard!.y).toBeGreaterThan(ventTop)
    expect(vent.placard!.y).toBeLessThan(wallTopAt(shed, 'back', 0))
  })
})

describe('doorHeaderTop', () => {
  it('runs the full header into the gable over a front door', () => {
    const top = doorHeaderTop(frame(), door())
    expect(top / FOOT).toBeCloseTo(6.75 + 0.08 + 0.28, 3)
  })

  it('lowers the header under the eave on a side wall', () => {
    const shed = frame()
    const top = doorHeaderTop(shed, door({ side: 'left' }))
    expect(top).toBeLessThan(shed.wall)
    expect(top).toBeGreaterThan(6.75 * FOOT)
  })
})

describe('buildWalkDoorParts', () => {
  it('builds a double door with a meeting-stile band and the T-handle on the right leaf', () => {
    const dW = 6 * FOOT
    const parts = buildWalkDoorParts(dW, 6.75 * FOOT, 3.6 * FOOT)
    expect(parts.leafXs).toHaveLength(2)
    expect(parts.hinges).toHaveLength(8)
    const handleX = parts.handle[0].center[0]
    expect(handleX).toBeGreaterThan(0)
    expect(handleX).toBeLessThan(0.5 * FOOT)
  })

  it('hinges a single door on the left with three hinges', () => {
    const parts = buildWalkDoorParts(3 * FOOT, 6.75 * FOOT, 3.6 * FOOT)
    expect(parts.leafXs).toHaveLength(1)
    expect(parts.hinges).toHaveLength(3)
    expect(parts.hinges.every((h) => h.center[0] < 0)).toBe(true)
    expect(parts.handle[0].center[0]).toBeGreaterThan(0)
  })
})

describe('buildWindowParts', () => {
  it('has no projecting sill below the flat casing', () => {
    const wH = 3 * FOOT
    const parts = buildWindowParts(2 * FOOT, wH)
    const lowest = Math.min(...[...parts.casing, ...parts.vinyl].map((b) => b.center[1] - b.size[1] / 2))
    expect(lowest).toBeCloseTo(-wH / 2 - 0.29 * FOOT, 6)
    const deepest = Math.max(...parts.casing.map((b) => b.center[2] + b.size[2] / 2))
    expect(deepest / FOOT).toBeLessThan(0.07)
  })
})

describe('buildStepBoxes', () => {
  it('builds no steps when the floor is one riser above grade', () => {
    expect(buildStepBoxes(3 * FOOT, 0.35 * FOOT)).toHaveLength(0)
  })

  it('keeps every tread below the floor', () => {
    const floorY = 1.15 * FOOT
    const boxes = buildStepBoxes(3 * FOOT, floorY)
    expect(boxes.length).toBeGreaterThan(0)
    const top = Math.max(...boxes.map((b) => b.center[1] + b.size[1] / 2))
    expect(top).toBeLessThan(floorY)
    expect(top).toBeGreaterThan(floorY * 0.4)
  })
})

describe('solarPanelPoseOnRoof', () => {
  it('lies on the +X gable slope near the back, above the roof line', () => {
    const shed = frame({ structureType: 'well_pump' })
    const pose = solarPanelPoseOnRoof(shed)
    expect(pose.position[0]).toBeGreaterThan(0)
    expect(pose.position[2]).toBeLessThan(0)
    expect(pose.rotationZ).toBeLessThan(0)
    expect(pose.position[1]).toBeGreaterThan(wallTopAt(shed, 'front', pose.position[0]))
  })

  it('follows the rising lean-to slope', () => {
    const pose = solarPanelPoseOnRoof(frame({ roofStyle: 'lean-to' }))
    expect(pose.rotationZ).toBeGreaterThan(0)
  })
})
