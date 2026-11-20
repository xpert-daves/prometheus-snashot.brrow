import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsArticle, {
  generateMetadata,
  generateStaticParams,
} from '../[slug]/page';
import {
  getArticle,
  getArticlePageData,
  listArticleSlugs,
} from '../../../lib/articles';
import type { Heading } from '../../../components/TableOfContents';
import type { ArticleFaqItem } from '../../../lib/articleContent';

jest.mock('../../../lib/articles');
jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('next-mdx-remote/rsc', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function renderSimpleMarkdown(
    source: string,
    components: {
      h2?: ({ children }: { children: React.ReactNode }) => React.ReactNode;
      h3?: ({ children }: { children: React.ReactNode }) => React.ReactNode;
    }
  ) {
    return source.split(/\n+/).filter(Boolean).map((line, index) => {
      if (line.startsWith('### ')) {
        const children = line.slice(4);
        return React.createElement(
          React.Fragment,
          { key: `h3-${index}` },
          components.h3 ? components.h3({ children }) : React.createElement('h3', null, children)
        );
      }

      if (line.startsWith('## ')) {
        const children = line.slice(3);
        return React.createElement(
          React.Fragment,
          { key: `h2-${index}` },
          components.h2 ? components.h2({ children }) : React.createElement('h2', null, children)
        );
      }

      return React.createElement('p', { key: `p-${index}` }, line);
    });
  }

  return {
    __esModule: true,
    compileMDX: jest.fn(async ({ source, components }) => ({
      content: React.createElement(
        React.Fragment,
        null,
        ...renderSimpleMarkdown(source, components ?? {})
      ),
    })),
  };
});

function buildArticleData() {
  return {
    meta: {
      slug: 'test',
      title: 'Test Title',
      excerpt: 'excerpt',
      date: '2024-01-01',
      modifiedDate: undefined as string | undefined,
      hero: undefined as string | undefined,
      heroAlt: undefined as string | undefined,
      heroLayout: undefined as 'artwork' | undefined,
    },
    content: '## Heading\n\nParagraph',
    processedSource: '## Heading\n\nParagraph',
    headings: [{ id: 'heading', text: 'Heading', level: 2 as const }] as Heading[],
    faqItems: [] as ArticleFaqItem[],
  };
}

describe('NewsArticle page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listArticleSlugs as jest.Mock).mockResolvedValue(['test']);
  });

  it('renders markdown content', async () => {
    const articleData = buildArticleData();
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    render(element);

    expect(screen.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Title');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading');
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('escapes article and FAQ text inside its JSON-LD scripts', async () => {
    const articleData = buildArticleData();
    articleData.meta.title = 'Sheds </script><script>alert(1)</script>';
    articleData.faqItems = [
      { question: 'Close </script>?', answer: 'No </script> here.' },
    ] as ArticleFaqItem[];
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);
    (getArticle as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    const { container } = render(element);
    const scripts = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => script.textContent ?? '');

    expect(scripts).toHaveLength(3);
    expect(scripts.join(' ')).not.toContain('</script>');
    expect(scripts.join(' ')).toContain('\\u003c/script\\u003e');
    expect(scripts.map((script) => JSON.parse(script)['@type'])).toEqual([
      'BlogPosting',
      'BreadcrumbList',
      'FAQPage',
    ]);
  });

  it('renders FAQPage structured data for extracted FAQ items', async () => {
    const articleData = buildArticleData();
    articleData.faqItems = [
      {
        question: 'How much does it cost?',
        answer: 'Pricing starts at $1,900.',
      },
    ];
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    const { container } = render(element);
    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent ?? '{}'));
    const faqSchema = schemas.find((schema) => schema['@type'] === 'FAQPage');

    expect(faqSchema).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How much does it cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Pricing starts at $1,900.',
          },
        },
      ],
    });
  });

  it.each([undefined, 'artwork'] as const)(
    'keeps publication and update dates distinct in the %s header and search metadata',
    async (heroLayout) => {
      const articleData = buildArticleData();
      articleData.meta.date = '2026-07-20';
      articleData.meta.modifiedDate = '2026-09-22';
      articleData.meta.heroLayout = heroLayout;
      articleData.meta.hero = heroLayout ? '/article-cover.webp' : undefined;
      (getArticlePageData as jest.Mock).mockResolvedValue(articleData);
      (getArticle as jest.Mock).mockResolvedValue(articleData);

      const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
      const { container } = render(element);
      const articleSchema = Array.from(
        container.querySelectorAll('script[type="application/ld+json"]')
      ).map((script) => JSON.parse(script.textContent ?? '{}'))
        .find((schema) => schema['@type'] === 'BlogPosting');
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test' }) });

      expect(container.querySelector('time[datetime="2026-07-20"]')).toHaveTextContent('Published Jul 20, 2026');
      expect(container.querySelector('time[datetime="2026-09-22"]')).toHaveTextContent('Updated Sep 22, 2026');
      expect(articleSchema).toMatchObject({
        datePublished: '2026-07-20', dateModified: '2026-09-22',
      });
      expect(metadata.openGraph).toMatchObject({
        publishedTime: '2026-07-20', modifiedTime: '2026-09-22',
      });
    }
  );

  it('uses the publication date as the metadata fallback without implying an update', async () => {
    const articleData = buildArticleData();
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);
    (getArticle as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    const { container } = render(element);
    const articleSchema = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent ?? '{}'))
      .find((schema) => schema['@type'] === 'BlogPosting');
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test' }) });

    expect(container.querySelector('time')).toHaveTextContent('Jan 1, 2024');
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    expect(articleSchema).toMatchObject({
      datePublished: '2024-01-01', dateModified: '2024-01-01',
    });
    expect(metadata.openGraph).toMatchObject({
      publishedTime: '2024-01-01', modifiedTime: '2024-01-01',
    });
  });

  it('shows hero image when provided', async () => {
    const articleData = buildArticleData();
    articleData.meta.hero = '/hero.jpg';
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    render(element);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', expect.stringContaining('hero.jpg'));
  });

  it('renders editorial artwork without a duplicate visible title overlay', async () => {
    const articleData = buildArticleData();
    articleData.meta.hero = '/article-cover.webp';
    articleData.meta.heroAlt = 'Editorial article cover using an authentic project photo.';
    articleData.meta.heroLayout = 'artwork';
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    render(element);

    const coverRegion = screen.getByRole('region', { name: 'Test Title cover' });
    expect(within(coverRegion).getByRole('img')).toHaveAttribute(
      'alt',
      'Editorial article cover using an authentic project photo.'
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Test Title' })).toHaveClass('sr-only');
    expect(within(coverRegion).getByText('excerpt')).toBeVisible();
  });

  it('generates table of contents from shared heading data', async () => {
    const articleData = buildArticleData();
    articleData.processedSource = '## Intro\n\n### Overview\nText';
    articleData.headings = [
      { id: 'intro', text: 'Intro', level: 2 as const },
      { id: 'overview', text: 'Overview', level: 3 as const },
    ];
    (getArticlePageData as jest.Mock).mockResolvedValue(articleData);

    const element = await NewsArticle({ params: Promise.resolve({ slug: 'test' }) });
    render(element);

    const nav = screen.getByRole('navigation', { name: /table of contents/i });
    const toggle = within(nav).getByRole('button', { name: /table of contents/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#intro',
      '#overview',
      '#top',
    ]);
  });

  it('uses the cached article source for metadata', async () => {
    (getArticle as jest.Mock).mockResolvedValue({
      meta: {
        slug: 'test',
        title: 'Test Title',
        excerpt: 'excerpt',
        date: '2024-01-01',
        hero: '/hero.jpg',
      },
      content: 'Body',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test' }),
    });

    const image = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph?.images[0]
      : metadata.openGraph?.images;

    expect(metadata.title).toBe('Test Title');
    expect(metadata.description).toBe('excerpt');
    expect(image).toMatchObject({ url: '/hero.jpg' });
  });

  it('uses source-safe cover alt text in article metadata', async () => {
    (getArticle as jest.Mock).mockResolvedValue({
      meta: {
        slug: 'test',
        title: 'Test Title',
        excerpt: 'excerpt',
        date: '2024-01-01',
        hero: '/article-cover.webp',
        heroAlt: 'Editorial cover using an authentic Shed210 project photo.',
      },
      content: 'Body',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test' }),
    });
    const image = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph?.images[0]
      : metadata.openGraph?.images;

    expect(image).toMatchObject({
      url: '/article-cover.webp',
      alt: 'Editorial cover using an authentic Shed210 project photo.',
    });
  });

  it('builds static params from article slugs', async () => {
    (listArticleSlugs as jest.Mock).mockResolvedValue(['test', 'another']);

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'test' },
      { slug: 'another' },
    ]);
  });

  it('throws 404 for unknown slug', async () => {
    const error = Object.assign(new Error('not found'), { code: 'ENOENT' });
    (getArticlePageData as jest.Mock).mockRejectedValue(error);

    await expect(
      NewsArticle({ params: Promise.resolve({ slug: 'missing' }) })
    ).rejects.toHaveProperty('digest', expect.stringContaining('404'));
  });
});
