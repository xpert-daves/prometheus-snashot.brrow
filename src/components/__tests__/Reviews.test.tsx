import { render, screen } from '@testing-library/react'
import Reviews from '../Reviews'
import type { GoogleReviewsSnapshot } from '@/lib/googleReviews.server'

const googleReviews: GoogleReviewsSnapshot = {
  rating: 4.8,
  reviewCount: 36,
  placeUri: 'https://www.google.com/maps/place/sheds-210',
  reviewsUri: 'https://www.google.com/maps/place/sheds-210/reviews',
  writeReviewUri: 'https://www.google.com/maps/place/sheds-210/write-review',
  attributions: [],
  reviews: [
    {
      id: 'places/review-1',
      authorName: 'Maria R.',
      authorUri: 'https://www.google.com/maps/contrib/maria',
      authorPhotoUri: 'https://lh3.googleusercontent.com/maria',
      rating: 5,
      text: 'The crew was professional and the finished shed looks great.',
      relativePublishTime: '2 months ago',
      publishTime: '2026-05-01T12:00:00Z',
      sourceUri: 'https://www.google.com/maps/reviews/review-1',
      reportUri: 'https://www.google.com/local/review/rap/report',
    },
  ],
}

describe('Reviews component', () => {
  it('renders the live Google rating, count, attribution, and review source', () => {
    const { container } = render(<Reviews googleReviews={googleReviews} />)

    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('36 Google reviews')).toBeInTheDocument()
    expect(screen.getByText(/crew was professional/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view on google maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/reviews/review-1'
    )
    expect(screen.getByText(/selected and ordered by Google based on relevance/i)).toBeInTheDocument()

    const avatar = container.querySelector('img[src="https://lh3.googleusercontent.com/maria"]')
    expect(avatar).toHaveAttribute('loading', 'lazy')
    expect(avatar).toHaveAttribute('decoding', 'async')
    expect(avatar).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  it('uses the current Google profile without showing invented totals when live data is unavailable', () => {
    const { container } = render(<Reviews googleReviews={null} />)

    const links = screen.getAllByRole('link', { name: /read current reviews on google/i })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute(
        'href',
        'https://www.google.com/maps/place/?q=place_id:ChIJueBVkBv3XIYR6eSUXgDTEv8'
      )
    }
    expect(screen.queryByText(/57 verified reviews/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/20\+ reviews/i)).not.toBeInTheDocument()
    expect(container.querySelector('iframe')).toBeNull()
    expect(
      screen.getByRole('link', { name: /watch a recent shed build/i })
    ).toHaveAttribute(
      'href',
      'https://www.facebook.com/shed210/videos/592495263524622/'
    )
  })
})
