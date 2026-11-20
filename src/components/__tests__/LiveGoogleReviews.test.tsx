import { render, screen, waitFor } from '@testing-library/react'
import LiveGoogleReviews from '../LiveGoogleReviews'
import type { GoogleReviewsSnapshot } from '@/lib/googleReviews.server'

const originalFetch = global.fetch

const googleReviews: GoogleReviewsSnapshot = {
  rating: 4.8,
  reviewCount: 36,
  placeUri: 'https://www.google.com/maps/place/sheds-210',
  reviewsUri: 'https://www.google.com/maps/place/sheds-210/reviews',
  attributions: [],
  reviews: [
    {
      id: 'places/review-1',
      authorName: 'Maria R.',
      rating: 5,
      text: 'The live review loaded after hydration.',
      sourceUri: 'https://www.google.com/maps/reviews/review-1',
    },
  ],
}

describe('LiveGoogleReviews', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('renders a complete Google profile fallback while the live request is pending', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined))

    render(<LiveGoogleReviews />)

    expect(screen.getAllByRole('link', { name: /read current reviews on google/i }).length)
      .toBeGreaterThan(0)
    expect(screen.queryByText('4.8')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/google-reviews',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) })
    )
  })

  it('hydrates the fallback with the full live review snapshot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(googleReviews),
    } as unknown as Response)

    render(<LiveGoogleReviews />)

    await waitFor(() => {
      expect(screen.getByText('4.8')).toBeInTheDocument()
    })
    expect(screen.getByText('36 Google reviews')).toBeInTheDocument()
    expect(screen.getByText(/live review loaded after hydration/i)).toBeInTheDocument()
  })

  it('keeps the fallback when the reviews endpoint is unavailable', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response)

    render(<LiveGoogleReviews />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByRole('link', { name: /read current reviews on google/i }).length)
      .toBeGreaterThan(0)
    expect(screen.queryByText('4.8')).not.toBeInTheDocument()
  })
})
