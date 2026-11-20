import { GOOGLE_REVIEW_URL, normalizeReviewLinkCode, reviewLinkDevice } from '../reviewPage'

describe('normalizeReviewLinkCode', () => {
  it('accepts the CRM code and forgiving hand-typed variants', () => {
    expect(normalizeReviewLinkCode('7KQ2M9XA')).toBe('7KQ2M9XA')
    expect(normalizeReviewLinkCode(' 7kq2m9xa ')).toBe('7KQ2M9XA')
    // Crockford reads O as 0 and I or L as 1.
    expect(normalizeReviewLinkCode('7KQ2MOXL')).toBe('7KQ2M0X1')
  })

  it('rejects anything that is not an 8-character code', () => {
    expect(normalizeReviewLinkCode(undefined)).toBeNull()
    expect(normalizeReviewLinkCode('')).toBeNull()
    expect(normalizeReviewLinkCode('7KQ2M9X')).toBeNull()
    expect(normalizeReviewLinkCode('7KQ2M9XAA')).toBeNull()
    expect(normalizeReviewLinkCode('7KQ2M9XU')).toBeNull()
    expect(normalizeReviewLinkCode('../admin')).toBeNull()
  })
})

it('opens the review form for the Shed210 Google listing', () => {
  expect(GOOGLE_REVIEW_URL).toBe(
    'https://search.google.com/local/writereview?placeid=ChIJueBVkBv3XIYR6eSUXgDTEv8'
  )
})

describe('reviewLinkDevice', () => {
  const nav = (userAgent: string, platform = '', maxTouchPoints = 0) => ({ userAgent, platform, maxTouchPoints })
  it('sorts browsers into coarse device classes', () => {
    expect(reviewLinkDevice(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)'))).toBe('iphone')
    // iPadOS reports a Mac but has a touchscreen.
    expect(reviewLinkDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5))).toBe('iphone')
    expect(reviewLinkDevice(nav('Mozilla/5.0 (Linux; Android 14; Pixel 8)'))).toBe('android')
    expect(reviewLinkDevice(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe('desktop')
    expect(reviewLinkDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0))).toBe('desktop')
    expect(reviewLinkDevice(nav('SomeBot/1.0'))).toBe('other')
  })
})
