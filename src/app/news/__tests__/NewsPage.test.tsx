import { render, screen, within } from '@testing-library/react'
import News from '../page'
import { listArticles } from '../../../lib/articles'

jest.mock('../../../lib/articles')

describe('News page', () => {
  it('keeps the featured article in the browse list', async () => {
    ;(listArticles as jest.Mock).mockResolvedValue([
      { slug: 'a', title: 'Article A', excerpt: 'Excerpt A', date: '2024-01-01' },
      { slug: 'b', title: 'Article B', excerpt: 'Excerpt B', date: '2024-01-02' },
    ])

    render(await News())

    expect(screen.getByRole('heading', { level: 1, name: 'Guides' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Featured article' })).toHaveTextContent('Article B')

    const browseArticles = within(screen.getByRole('region', { name: 'Browse articles' }))
    expect(browseArticles.getByRole('link', { name: 'Read: Article A' })).toHaveAttribute('href', '/news/a')
    expect(browseArticles.getByRole('link', { name: 'Read: Article B' })).toHaveAttribute('href', '/news/b')
    expect(screen.getByRole('link', { name: 'Compare Buildings' })).toHaveAttribute(
      'href',
      '/buildings'
    )
  })

  it('publishes Blog JSON-LD listing every article newest first', async () => {
    ;(listArticles as jest.Mock).mockResolvedValue([
      { slug: 'a', title: 'Article A', excerpt: 'Excerpt A', date: '2024-01-01' },
      { slug: 'b', title: 'Article B', excerpt: 'Excerpt B', date: '2024-01-02', modifiedDate: '2024-02-01' },
    ])

    const { container } = render(await News())
    const jsonLd = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.innerHTML))

    expect(jsonLd).toHaveLength(1)
    expect(jsonLd[0]['@type']).toBe('Blog')
    expect(jsonLd[0].blogPost.map((post: { headline: string }) => post.headline)).toEqual([
      'Article B',
      'Article A',
    ])
    expect(jsonLd[0].blogPost[0]).toMatchObject({
      url: expect.stringMatching(/\/news\/b$/),
      dateModified: '2024-02-01',
    })
  })

  it('renders featured editorial artwork without a duplicate title overlay', async () => {
    ;(listArticles as jest.Mock).mockResolvedValue([
      {
        slug: 'article-b',
        title: 'Article B',
        excerpt: 'Excerpt B',
        date: '2024-01-02',
        hero: '/article-b.webp',
        heroAlt: 'Editorial cover using an authentic Shed210 project photo.',
        heroLayout: 'artwork',
      },
    ])

    render(await News())

    const featured = screen.getByRole('region', { name: 'Featured article' })
    expect(within(featured).getByRole('img')).toHaveAttribute(
      'alt',
      'Editorial cover using an authentic Shed210 project photo.'
    )
    expect(within(featured).getByRole('heading', { level: 2, name: 'Article B' })).toHaveClass(
      'sr-only'
    )
    expect(within(featured).getByText('Excerpt B')).toBeVisible()
  })

  it('uses source-safe cover alt text on article cards', async () => {
    ;(listArticles as jest.Mock).mockResolvedValue([
      {
        slug: 'article-b',
        title: 'Article B',
        excerpt: 'Excerpt B',
        date: '2024-01-02',
        hero: '/article-b.webp',
        heroAlt: 'Authentic Shed210 editorial cover.',
        heroLayout: 'artwork',
      },
    ])

    render(await News())

    const browseArticles = within(screen.getByRole('region', { name: 'Browse articles' }))
    expect(browseArticles.getByRole('img')).toHaveAttribute(
      'alt',
      'Authentic Shed210 editorial cover.'
    )
  })
})
