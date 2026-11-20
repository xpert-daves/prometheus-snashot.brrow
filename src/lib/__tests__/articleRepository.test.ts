import {
  getArticlePageData,
  listArticleSlugs,
} from '../articleRepository';

describe('articleRepository', () => {
  it('lists article slugs from the repo source', async () => {
    const slugs = await listArticleSlugs();

    expect(slugs).toContain('san-antonio-shed-cost-guide');
  });

  it('returns cached prepared page data for article rendering', async () => {
    const firstPromise = getArticlePageData('san-antonio-shed-cost-guide');
    const secondPromise = getArticlePageData('san-antonio-shed-cost-guide');
    const first = await firstPromise;
    const second = await secondPromise;

    expect(first).toStrictEqual(second);
    expect(first.meta.title).toBeTruthy();
    expect(first.content.length).toBeGreaterThan(0);
    expect(first.headings.length).toBeGreaterThan(0);
    expect(first.faqItems.length).toBe(7);
    expect(first.faqItems[0].question).toBe('How much does a shed cost in San Antonio?');
    expect(first.processedSource.length).toBeGreaterThan(0);
  });

  it.each(['missing-article', '[slug]', 'shed.guide', '../secrets'])(
    'treats %s as a missing article so the page can 404',
    async (slug) => {
      await expect(getArticlePageData(slug)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  );

  it('loads editorial cover metadata from article frontmatter', async () => {
    const article = await getArticlePageData('san-antonio-shed-cost-guide');

    expect(article.meta).toMatchObject({
      date: '2026-07-20',
      modifiedDate: '2026-11-09',
      hero: '/article-covers/san-antonio-shed-cost-guide.webp',
      heroAlt:
        'Editorial cover for the 2026 San Antonio shed cost guide using an authentic finished Shed210 project photo.',
      heroLayout: 'artwork',
    });
  });

  it('loads source-safe planning cover metadata', async () => {
    const article = await getArticlePageData('sanantonio_shed_guide');

    expect(article.meta).toMatchObject({
      hero: '/article-covers/san-antonio-shed-permits-hoa-guide.webp',
      heroAlt:
        'Editorial cover for the San Antonio shed permits and HOA guide using an authentic Shed210 framing-stage project photo.',
      heroLayout: 'artwork',
    });
    expect(article.meta.modifiedDate).toBeUndefined();
  });
});
