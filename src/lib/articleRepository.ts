import fs from 'fs/promises';
import path from 'path';
import { cache } from 'react';
import type { Heading } from '@/components/TableOfContents';
import {
  extractArticleFaqItems,
  extractArticleHeadings,
  preprocessArticleSource,
  type ArticleFaqItem,
} from '@/lib/articleContent';

export interface ArticleMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  modifiedDate?: string;
  hero?: string;
  heroAlt?: string;
  heroLayout?: 'artwork';
  tags?: string[];
  readingTime?: string;
}

export type ArticleDocument = {
  meta: ArticleMeta;
  content: string;
};

export type ArticlePageData = ArticleDocument & {
  headings: Heading[];
  faqItems: ArticleFaqItem[];
  processedSource: string;
};

const ARTICLES_DIR = path.join(process.cwd(), 'src', 'articles');
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseFrontmatter(text: string): { data: Partial<ArticleMeta>; body: string } {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: text };

  const lines = match[1].split(/\r?\n/);
  const data: Partial<ArticleMeta> = {};

  for (const line of lines) {
    const index = line.indexOf(':');
    if (index === -1) continue;

    const key = line.slice(0, index).trim() as keyof ArticleMeta;
    const value = line.slice(index + 1).trim();
    if (!key) continue;

    if (key === 'tags') {
      data.tags = value
        .replace(/^\[|\]$/g, '')
        .split(/,\s*/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      continue;
    }

    switch (key) {
      case 'title':
        data.title = value;
        break;
      case 'excerpt':
        data.excerpt = value;
        break;
      case 'date':
        data.date = value;
        break;
      case 'modifiedDate':
        data.modifiedDate = value || undefined;
        break;
      case 'hero':
        data.hero = value;
        break;
      case 'heroAlt':
        data.heroAlt = value;
        break;
      case 'heroLayout':
        if (value === 'artwork') data.heroLayout = value;
        break;
      default:
        break;
    }
  }

  return { data, body: text.slice(match[0].length) };
}

function extractTitle(body: string, filePath: string): string {
  const match = body.match(/^#+\s*(.*)/m);
  return match ? match[1].replace(/\*\*/g, '') : path.basename(filePath);
}

function extractExcerpt(body: string): string {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('#')) {
      continue;
    }
    return trimmed.replace(/\*\*/g, '');
  }
  return '';
}

async function fileDate(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  return stat.mtime.toISOString().split('T')[0];
}

function computeReadingTime(body: string) {
  const wordCount = body
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_>#\-\[\](){}/\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} min read`;
}

const listArticleFiles = cache(async () => {
  const files = await fs.readdir(ARTICLES_DIR);
  return files
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => ({
      slug: file.replace(/\.mdx?$/, ''),
      filePath: path.join(ARTICLES_DIR, file),
    }));
});

function articleNotFound(slug: string) {
  const error = new Error(`Article not found: ${slug}`) as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

const readArticleFile = cache(async (slug: string): Promise<ArticleDocument> => {
  // A malformed slug (a crawler requesting /news/[slug], say) can never match
  // an article, so it is a 404 like any other missing article, not a 500.
  if (!/^[\w-]+$/.test(slug)) {
    throw articleNotFound(slug);
  }

  const files = await listArticleFiles();
  const entry = files.find((file) => file.slug === slug);
  if (!entry) {
    throw articleNotFound(slug);
  }

  const raw = await fs.readFile(entry.filePath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const meta: ArticleMeta = {
    slug,
    title: data.title || extractTitle(body, entry.filePath),
    excerpt: data.excerpt || extractExcerpt(body),
    date: data.date || (await fileDate(entry.filePath)),
    modifiedDate: data.modifiedDate,
    hero: data.hero,
    heroAlt: data.heroAlt,
    heroLayout: data.heroLayout,
    tags: data.tags,
    readingTime: computeReadingTime(body),
  };

  return {
    meta,
    content: body,
  };
});

export const listArticleSlugs = cache(async () => {
  const files = await listArticleFiles();
  return files.map((file) => file.slug);
});

export const listArticles = cache(async (): Promise<ArticleMeta[]> => {
  const slugs = await listArticleSlugs();
  const articles = await Promise.all(slugs.map((slug) => readArticleFile(slug)));
  return articles
    .map((article) => article.meta)
    .sort((a, b) => {
      if (a.slug === 'sanantonio_shed_guide') return -1;
      if (b.slug === 'sanantonio_shed_guide') return 1;
      return a.title.localeCompare(b.title);
    });
});

export const getArticle = cache(async (slug: string): Promise<ArticleDocument> => {
  return readArticleFile(slug);
});

export const getArticlePageData = cache(
  async (slug: string): Promise<ArticlePageData> => {
    const article = await readArticleFile(slug);
    return {
      ...article,
      headings: extractArticleHeadings(article.content),
      faqItems: extractArticleFaqItems(article.content),
      processedSource: preprocessArticleSource(article.content),
    };
  }
);
