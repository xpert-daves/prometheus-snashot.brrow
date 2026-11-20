import { FOOT, getEffectiveRoofStyle, type DoorSpec, type WindowSpec } from '../types'
import {
  GREENHOUSE_BENCHES_DEFAULT,
  buildGreenhouseFraming,
  computeGreenhouseVents,
  greenhouseHasBenches,
  greenhouseSignBase
} from '../greenhouse'

const door = (overrides: Partial<DoorSpec> = {}): DoorSpec => ({
  id: 'door-default-single_shed',
  side: 'front',
  width: 3,
  height: 6.75,
  offset: 0,
  ...overrides
})

const win = (overrides: Partial<WindowSpec> = {}): WindowSpec => ({
  id: 'window-default-1',
  side: 'right',
  width: 2,
  height: 3,
  offset: 0,
  heightFromFloor: 3,
  ...overrides
})

function layout(lengthFt: number, widthFt: number, wallFt: number, doors: DoorSpec[], windows: WindowSpec[], ventilation = false) {
  const vents = computeGreenhouseVents({ lengthFt, widthFt, wallFt, doors, windows, ventilation })
  const members = buildGreenhouseFraming({
    lengthFt,
    widthFt,
    wallFt,
    riseFt: (lengthFt / 2) * (4 / 12),
    doors,
    windows,
    vents,
    benches: true
  })
  return { vents, members }
}

describe('greenhouse framing', () => {
  it.each([
    [6, 8, 6],
    [8, 12, 7],
    [10, 12, 7],
    [10, 16, 8],
    [12, 20, 8],
    [16, 24, 8]
  ])('builds a finite, modest member list for %ix%i at %i ft walls', (l, w, wh) => {
    const doorHeight = wh >= 7 ? 6.75 : 5.75
    const { members } = layout(l, w, wh, [door({ height: doorHeight })], [win({ heightFromFloor: Math.min(3, wh - 3.5) })])
    expect(members.length).toBeGreaterThan(40)
    expect(members.length).toBeLessThan(220)
    for (const m of members) {
      for (const v of [...m.c, ...m.s, m.rz ?? 0]) expect(Number.isFinite(v)).toBe(true)
      for (const s of m.s) expect(s).toBeGreaterThan(0)
    }
  })

  it('keeps studs out of the door opening and follows a dragged door', () => {
    const front = layout(10, 12, 7, [door()], [])
    // Front-wall members sit just inside z = +6 ft; none may stand inside the 3 ft door below its head.
    const inDoor = front.members.filter(
      (m) => m.c[2] > 5.5 && m.c[2] < 6 && Math.abs(m.c[0]) < 1.4 && m.c[1] - m.s[1] / 2 < 6.5 && !m.rz
    )
    expect(inDoor).toHaveLength(0)

    const moved = layout(10, 12, 7, [door({ side: 'left', offset: 2 })], [])
    const leftWall = moved.members.filter((m) => m.c[0] < -4.5 && m.c[0] > -5 && !m.rz)
    const blocking = leftWall.filter((m) => Math.abs(m.c[2] - 2) < 1.4 && m.c[1] - m.s[1] / 2 < 6 && m.s[1] > 1)
    expect(blocking).toHaveLength(0)
  })
})

describe('greenhouse vents', () => {
  it('always has a centered back louver and adds the eave louver only with the Solar Vent Fan', () => {
    const plain = layout(10, 12, 7, [door()], [win()]).vents
    expect(plain.filter((v) => v.side === 'back')).toEqual([expect.objectContaining({ along: 0, fan: false })])
    expect(plain.some((v) => v.side === 'left' || v.side === 'right')).toBe(false)

    const fan = layout(10, 12, 7, [door()], [win()], true).vents
    expect(fan.find((v) => v.side === 'back')?.fan).toBe(true)
    expect(fan.some((v) => v.side === 'left')).toBe(true)
  })

  it('moves the back louver aside for a back window it would hit', () => {
    const vents = layout(10, 12, 6, [door({ height: 5.75 })], [win({ side: 'back', heightFromFloor: 2.5 })]).vents
    const back = vents.find((v) => v.side === 'back')
    expect(back).toBeDefined()
    expect(Math.abs(back!.along)).toBeGreaterThan(1.5)
  })

  it('adds a transom louver over the door only on tall walls, and lifts the sign above it', () => {
    expect(layout(10, 12, 7, [door()], []).vents.some((v) => v.overDoor)).toBe(false)
    const tall = layout(10, 12, 8, [door()], []).vents.find((v) => v.overDoor)
    expect(tall).toBeDefined()
    expect(greenhouseSignBase(8 * FOOT, door()) / FOOT).toBeGreaterThan(tall!.y1)
    expect(greenhouseSignBase(7 * FOOT, door()) / FOOT).toBeCloseTo(6.75 + 0.22)
  })
})

describe('greenhouse options', () => {
  it('renders benches by default and always draws a gable roof', () => {
    expect(GREENHOUSE_BENCHES_DEFAULT).toBe(true)
    expect(greenhouseHasBenches([])).toBe(true)
    expect(getEffectiveRoofStyle({ structureType: 'greenhouse', roofStyle: 'barn' })).toBe('gabled')
    expect(getEffectiveRoofStyle({ structureType: 'greenhouse', roofStyle: 'lean-to' })).toBe('gabled')
    expect(getEffectiveRoofStyle({ structureType: 'storage_shed', roofStyle: 'barn' })).toBe('barn')
    expect(getEffectiveRoofStyle({ structureType: 'storage_shed' })).toBe('gabled')
  })
})
