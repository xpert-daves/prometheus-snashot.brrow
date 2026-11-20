import { normalizeUS } from '../phone'

describe('normalizeUS', () => {
  it('normalizes 10-digit to +1XXXXXXXXXX', () => {
    expect(normalizeUS('210-772-3028')).toBe('+12107723028')
    expect(normalizeUS('(210) 772-3028')).toBe('+12107723028')
  })

  it('normalizes 11-digit starting with 1', () => {
    expect(normalizeUS('1 210 772 3028')).toBe('+12107723028')
    expect(normalizeUS('+1 (210) 772-3028')).toBe('+12107723028')
  })

  it('throws on invalid numbers', () => {
    expect(() => normalizeUS('077-2302')).toThrow()
    expect(() => normalizeUS('210772302')).toThrow()
    expect(() => normalizeUS('2107723028123')).toThrow()
  })
})


