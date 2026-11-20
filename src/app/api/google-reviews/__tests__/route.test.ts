import { GET, dynamic } from '../route'

const originalApiKey = process.env.GOOGLE_PLACES_API_KEY
const originalFetch = global.fetch
const originalResponse = global.Response

class TestHeaders {
  private readonly values = new Map<string, string>()

  constructor(init: HeadersInit = {}) {
    Object.entries(init as Record<string, string>).forEach(([name, value]) => {
      this.values.set(name.toLowerCase(), value)
    })
  }

  get(name: string) {
    return this.values.get(name.toLowerCase()) ?? null
  }
}

class TestResponse {
  readonly status: number
  readonly headers: TestHeaders
  private readonly bodyText: string

  constructor(body: BodyInit | null = null, init: ResponseInit = {}) {
    this.bodyText = typeof body === 'string' ? body : ''
    this.status = init.status ?? 200
    this.headers = new TestHeaders(init.headers)
  }

  static json(value: unknown, init: ResponseInit = {}) {
    return new TestResponse(JSON.stringify(value), init)
  }

  async json() {
    return JSON.parse(this.bodyText) as unknown
  }

  async text() {
    return this.bodyText
  }
}

describe('Google reviews API route', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
    process.env.GOOGLE_PLACES_API_KEY = 'reviews-route-test-key'
    global.Response = TestResponse as unknown as typeof Response
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalApiKey
    }
    jest.restoreAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
    global.Response = originalResponse
  })

  it('returns the normalized review snapshot with policy-compliant no-store headers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        rating: 4.8,
        userRatingCount: 36,
        googleMapsLinks: {
          placeUri: 'https://www.google.com/maps/place/sheds-210',
          reviewsUri: 'https://www.google.com/maps/place/sheds-210/reviews',
        },
        reviews: [
          {
            name: 'places/review-1',
            rating: 5,
            text: { text: 'Excellent work and a smooth build day.' },
            authorAttribution: { displayName: 'Maria R.' },
            googleMapsUri: 'https://www.google.com/maps/reviews/review-1',
          },
        ],
      }),
    } as unknown as Response)

    const response = await GET()

    expect(dynamic).toBe('force-dynamic')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    await expect(response.json()).resolves.toMatchObject({
      rating: 4.8,
      reviewCount: 36,
      placeUri: 'https://www.google.com/maps/place/sheds-210',
      reviewsUri: 'https://www.google.com/maps/place/sheds-210/reviews',
      reviews: [
        {
          id: 'places/review-1',
          authorName: 'Maria R.',
          rating: 5,
          text: 'Excellent work and a smooth build day.',
          sourceUri: 'https://www.google.com/maps/reviews/review-1',
        },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ cache: 'no-store' })
    )
  })

  it('returns an uncached unavailable response when Google cannot be queried', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    delete process.env.GOOGLE_PLACES_API_KEY

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('retry-after')).toBe('5')
    await expect(response.text()).resolves.toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] GOOGLE_PLACES_API_KEY is not configured'
    )
  })
})
