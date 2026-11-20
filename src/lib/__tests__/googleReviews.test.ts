import { GOOGLE_PLACE_ID } from '@/lib/contact'
import {
  getGoogleReviewSummary,
  getGoogleReviews,
  getGoogleReviewsRetryAfterSeconds,
  resetGoogleReviewsRequestStateForTests,
} from '@/lib/googleReviews.server'

const originalApiKey = process.env.GOOGLE_PLACES_API_KEY
const originalFetch = global.fetch

describe('getGoogleReviews', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    resetGoogleReviewsRequestStateForTests()
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
    delete process.env.GOOGLE_PLACES_API_KEY
  })

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalApiKey
    }
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('returns the link-only fallback without making a request when the key is missing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(getGoogleReviews()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] GOOGLE_PLACES_API_KEY is not configured'
    )
  })

  it('requests and normalizes the current Google place without storing review content', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        rating: 4.8,
        userRatingCount: 36,
        googleMapsLinks: {
          placeUri: 'https://www.google.com/maps/place/sheds-210',
          reviewsUri: 'https://www.google.com/maps/place/sheds-210/reviews',
          writeAReviewUri: 'https://www.google.com/maps/place/sheds-210/write-review',
        },
        reviews: [
          {
            name: 'places/review-1',
            rating: 5,
            text: { text: 'Excellent shed and a professional crew.' },
            relativePublishTimeDescription: 'a month ago',
            publishTime: '2026-06-01T12:00:00Z',
            googleMapsUri: 'https://www.google.com/maps/reviews/review-1',
            flagContentUri: 'https://www.google.com/local/review/rap/report',
            authorAttribution: {
              displayName: 'Customer One',
              uri: 'https://www.google.com/maps/contrib/customer-one',
              photoUri: '//lh3.googleusercontent.com/customer-one',
            },
          },
        ],
      }),
    } as unknown as Response)

    const snapshot = await getGoogleReviews()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toContain(`/v1/places/${GOOGLE_PLACE_ID}`)
    expect(requestInit).toMatchObject({ cache: 'no-store' })
    expect(requestInit.signal).toBeInstanceOf(AbortSignal)
    expect(requestInit.headers).toMatchObject({
      'X-Goog-Api-Key': 'test-key',
    })
    expect(requestInit.headers['X-Goog-FieldMask']).toContain('reviews')
    expect(snapshot).toMatchObject({
      rating: 4.8,
      reviewCount: 36,
      reviews: [
        {
          authorName: 'Customer One',
          authorPhotoUri: 'https://lh3.googleusercontent.com/customer-one',
          rating: 5,
          text: 'Excellent shed and a professional crew.',
        },
      ],
    })
  })

  it('coalesces concurrent full-review requests without caching the settled result', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    let resolveRequest!: (response: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        })
    )

    const first = getGoogleReviews()
    const second = getGoogleReviews()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveRequest({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rating: 4.8, userRatingCount: 36 }),
    } as unknown as Response)

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rating: 4.9, userRatingCount: 37 }),
    } as unknown as Response)
    await getGoogleReviews()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('derives a concurrent summary from an already-running full-details request', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    let resolveRequest!: (response: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve
        })
    )

    const full = getGoogleReviews()
    const summary = getGoogleReviewSummary()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolveRequest({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rating: 4.8, userRatingCount: 36 }),
    } as unknown as Response)

    await full
    await expect(summary).resolves.toEqual({ rating: 4.8, reviewCount: 36 })
  })

  it('backs off repeated failures without retaining Google response content', async () => {
    jest.useFakeTimers()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(getGoogleReviews()).resolves.toBeNull()
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(5)

    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rating: 4.8, userRatingCount: 36 }),
    } as unknown as Response)

    await expect(getGoogleReviews()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(5_000)
    await expect(getGoogleReviews()).resolves.toMatchObject({
      rating: 4.8,
      reviewCount: 36,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(0)
  })

  it('requests only the uncached rating and count for the hero summary', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'summary-test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        rating: 4.8,
        userRatingCount: 36,
      }),
    } as unknown as Response)

    await expect(getGoogleReviewSummary()).resolves.toEqual({
      rating: 4.8,
      reviewCount: 36,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toContain(`/v1/places/${GOOGLE_PLACE_ID}`)
    expect(requestInit).toMatchObject({ cache: 'no-store' })
    expect(requestInit.signal).toBeInstanceOf(AbortSignal)
    expect(requestInit.headers).toMatchObject({
      'X-Goog-Api-Key': 'summary-test-key',
      'X-Goog-FieldMask': 'rating,userRatingCount',
    })
    expect(requestInit.headers['X-Goog-FieldMask']).not.toContain('reviews')
  })

  it('returns the link-only fallback after aborting a slow Google request', async () => {
    jest.useFakeTimers()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.GOOGLE_PLACES_API_KEY = 'timeout-test-key'
    fetchMock.mockImplementation((_request: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const abortError = new Error('aborted')
            abortError.name = 'AbortError'
            reject(abortError)
          },
          { once: true }
        )
      })
    )

    const resultPromise = getGoogleReviews()
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit

    await jest.advanceTimersByTimeAsync(5_000)

    await expect(resultPromise).resolves.toBeNull()
    expect(requestInit.signal?.aborted).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] Place Details timed out after 5000ms'
    )
  })

  it('logs safe Google API error details without logging the API key', async () => {
    const apiKey = 'super-secret-key'
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.GOOGLE_PLACES_API_KEY = apiKey
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: jest.fn().mockResolvedValue({
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          message: `API key ${apiKey} is blocked`,
        },
      }),
    } as unknown as Response)

    await expect(getGoogleReviews()).resolves.toBeNull()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] Place Details rejected request',
      {
        httpStatus: 403,
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'API key [redacted] is blocked',
      }
    )
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(apiKey)
  })

  it('logs a safe diagnostic when a successful response has no usable review data', async () => {
    const apiKey = 'empty-payload-secret-key'
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.GOOGLE_PLACES_API_KEY = apiKey
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    } as unknown as Response)

    await expect(getGoogleReviews()).resolves.toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] Place Details returned no usable rating, review count, or reviews'
    )
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(5)
    await expect(getGoogleReviews()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(apiKey)
  })

  it('backs off when a successful summary response is missing required fields', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.GOOGLE_PLACES_API_KEY = 'summary-schema-test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rating: 4.9 }),
    } as unknown as Response)

    await expect(getGoogleReviewSummary()).resolves.toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[google-reviews] Place Details returned no usable rating or review count'
    )
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(5)
  })

  it('ignores malformed review collections and elements without crashing', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'collection-schema-test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        rating: 4.8,
        userRatingCount: 36,
        reviews: [null, 42, {}],
        attributions: [null, 42, { provider: 'Google' }],
      }),
    } as unknown as Response)

    await expect(getGoogleReviews()).resolves.toMatchObject({
      rating: 4.8,
      reviewCount: 36,
      reviews: [],
      attributions: [{ provider: 'Google' }],
    })
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(0)
  })

  it('ignores malformed nested review and attribution fields without throwing', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'nested-schema-test-key'
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        rating: 4.8,
        userRatingCount: 36,
        reviews: [
          { rating: 5, text: { text: 42 } },
          {
            name: 42,
            rating: 5,
            text: { text: 'A valid review with malformed optional fields.' },
            relativePublishTimeDescription: 42,
            publishTime: 42,
            googleMapsUri: 42,
            flagContentUri: 42,
            authorAttribution: {
              displayName: 42,
              uri: 42,
              photoUri: 42,
            },
          },
        ],
        attributions: [
          { provider: 42, providerUri: 'https://example.com' },
          { provider: 'Google', providerUri: 42 },
        ],
      }),
    } as unknown as Response)

    await expect(getGoogleReviews()).resolves.toMatchObject({
      rating: 4.8,
      reviewCount: 36,
      reviews: [
        {
          authorName: 'Google reviewer',
          rating: 5,
          text: 'A valid review with malformed optional fields.',
        },
      ],
      attributions: [{ provider: 'Google' }],
    })
    expect(getGoogleReviewsRetryAfterSeconds()).toBe(0)
  })
})
