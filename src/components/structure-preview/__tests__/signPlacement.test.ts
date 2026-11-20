import { FOOT, getGambrelProfile, getRoofRiseMeters, type DoorSpec } from '../types'
import { fitSign, wallTopAt, type ShedFrame } from '../featureVisuals'

const frame = (
  roofStyle: ShedFrame['roofStyle'],
  wallFt = 6,
  structureType: ShedFrame['structureType'] = 'storage_shed'
): ShedFrame => ({
  length: 12 * FOOT,
  width: 10 * FOOT,
  wall: wallFt * FOOT,
  floorY: 1.2 * FOOT,
  roofStyle,
  structureType,
})

const door = (overrides: Partial<DoorSpec> = {}): DoorSpec => ({
  id: 'door-default-double_shed',
  side: 'front',
  width: 6,
  height: 5.75,
  offset: 0,
  ...overrides,
})

// Mirrors DoorPanel: sign fit is measured from the top of the door casing.
function signTop(shed: ShedFrame, spec: DoorSpec) {
  const dH = spec.height * FOOT
  const fit = fitSign(shed, spec, dH + 0.175 * FOOT, dH)
  if (!fit) return null
  const fullH = 1 * FOOT / (364 / 249) + 0.1 * FOOT
  return fit.y + dH / 2 + (fullH * fit.scale) / 2
}

describe('wallTopAt', () => {
  it('follows the lean-to slope across the front wall', () => {
    const shed = frame('lean-to')
    expect(wallTopAt(shed, 'front', -6 * FOOT) / FOOT).toBeCloseTo(6)
    expect(wallTopAt(shed, 'front', 0) / FOOT).toBeCloseTo(7)
    expect(wallTopAt(shed, 'front', 6 * FOOT) / FOOT).toBeCloseTo(8)
  })

  it('peaks at the ridge for gable roofs and stays at the eave on side walls', () => {
    const shed = frame('gabled')
    // Enclosed gables rise a constant 1.5 ft whatever the span.
    expect(wallTopAt(shed, 'front', 0) / FOOT).toBeCloseTo(7.5)
    expect(wallTopAt(shed, 'front', 3 * FOOT) / FOOT).toBeCloseTo(6.75)
    expect(wallTopAt(shed, 'left', 0) / FOOT).toBeCloseTo(6)
  })

  it('follows the gambrel profile with the pitch break 0.16 of the span in from the eave', () => {
    const shed = frame('barn')
    const { bx, r1, rise } = getGambrelProfile(shed.length)
    expect(rise / FOOT).toBeCloseTo(0.32 * 12)
    expect(wallTopAt(shed, 'front', bx) / FOOT).toBeCloseTo(6 + r1 / FOOT)
    expect(wallTopAt(shed, 'back', 0) / FOOT).toBeCloseTo(6 + rise / FOOT)
  })
})

describe('getRoofRiseMeters', () => {
  it('keeps enclosed gables at 1.5 ft and pitches carports and greenhouses at 4:12', () => {
    for (const spanFt of [6, 8, 12, 16]) {
      expect(getRoofRiseMeters('gabled', spanFt * FOOT, 'storage_shed') / FOOT).toBeCloseTo(1.5)
      expect(getRoofRiseMeters('gabled', spanFt * FOOT, 'well_pump') / FOOT).toBeCloseTo(1.5)
      expect(getRoofRiseMeters('gabled', spanFt * FOOT, 'carport') / FOOT).toBeCloseTo((4 / 12) * (spanFt / 2))
    }
    expect(getRoofRiseMeters('gabled', 6 * FOOT, 'greenhouse') / FOOT).toBeCloseTo(1.5)
    expect(getRoofRiseMeters('gabled', 12 * FOOT, 'greenhouse') / FOOT).toBeCloseTo(2)
    expect(getRoofRiseMeters('lean-to', 12 * FOOT, 'storage_shed') / FOOT).toBeCloseTo(2)
  })
})

describe('fitSign', () => {
  it.each(['lean-to', 'gabled', 'barn'] as const)(
    'keeps the placard below the roof line on a 6 ft %s front wall',
    (roofStyle) => {
      const shed = frame(roofStyle)
      const spec = door()
      const top = signTop(shed, spec)
      expect(top).not.toBeNull()
      const roofLine = Math.min(
        wallTopAt(shed, 'front', -0.5 * FOOT),
        wallTopAt(shed, 'front', 0.5 * FOOT)
      )
      expect(top!).toBeLessThan(roofLine)
    }
  )

  it('omits the placard when a side door leaves no room under a 6 ft eave', () => {
    expect(fitSign(frame('gabled'), door({ side: 'left' }), 5.925 * FOOT, 5.75 * FOOT)).toBeNull()
  })
})
