import type { Metadata } from "next";
import Container from "@/components/Container";
import { getArticle, getArticlePageData, listArticleSlugs } from "@/lib/articles";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReactElement, ReactNode } from "react";
import TableOfContents, { Heading } from "@/components/TableOfContents";
import ReadingProgress from "@/components/ReadingProgress";
import ShareActions from "@/components/ShareActions";
import TrackedActionLink from "@/components/TrackedActionLink";
import type { ArticleFaqItem } from "@/lib/articleContent";
import {
  DEFAULT_OG_IMAGE,
  absoluteUrl,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import styles from "./article.module.css";

export async function generateStaticParams() {
  const slugs = await listArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { meta } = await getArticle(slug);
    const description = meta.excerpt || "Shed buying insights for San Antonio homeowners.";
    const image = meta.hero || DEFAULT_OG_IMAGE;
    return {
      title: meta.title,
      description,
      alternates: {
        canonical: `/news/${meta.slug}`,
      },
      openGraph: {
        type: "article",
        title: meta.title,
        description,
        url: absoluteUrl(`/news/${meta.slug}`),
        publishedTime: meta.date,
        modifiedTime: meta.modifiedDate || meta.date,
        images: [{ url: image, alt: meta.heroAlt || meta.title }],
      },
      twitter: {
        card: "summary_large_image",
        title: meta.title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: "Shed Guide",
      description: "Shed buying guides and local shed project insights from Shed210.",
    };
  }
}

// Consistent, safe date formatting
function formatDate(d: unknown) {
  try {
    const dt = new Date(String(d));
    if (isNaN(dt.getTime())) return String(d ?? "");
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(dt);
  } catch {
    return String(d ?? "");
  }
}

export default async function NewsArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  let meta;
  let processedSource: string;
  let headings: Heading[];
  let faqItems: ArticleFaqItem[];
  try {
    const result = await getArticlePageData(slug);
    meta = result.meta;
    processedSource = result.processedSource;
    headings = result.headings;
    faqItems = result.faqItems ?? [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      notFound();
    }
    throw err;
  }
  let headingIndex = 0;
  const hasUpdatedDate = Boolean(meta.modifiedDate && meta.modifiedDate !== meta.date);

  function toText(children: ReactNode): string {
    if (children == null) return "";
    if (typeof children === "string" || typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map(toText).join("");
    // @ts-expect-error - children may be a ReactElement
    if (children?.props?.children) return toText(children.props.children);
    return "";
  }

  function nextHeadingId(level: Heading["level"], text: string) {
    const nextHeading = headings[headingIndex];
    if (nextHeading && nextHeading.level === level) {
      headingIndex += 1;
      return nextHeading.id;
    }

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  const H2 = ({ children }: { children: ReactNode }) => {
    const text = toText(children).trim();
    const id = nextHeadingId(2, text);
    return <h2 id={id}>{children}</h2>;
  };

  const H3 = ({ children }: { children: ReactNode }) => {
    const text = toText(children).trim();
    const id = nextHeadingId(3, text);
    return <h3 id={id}>{children}</h3>;
  };

  const components = {
    h2: H2,
    h3: H3,
  } as const;

  const { compileMDX } = await import("next-mdx-remote/rsc");
  const { default: remarkGfm } = await import("remark-gfm");
  const compiled = await compileMDX({
    source: processedSource,
    components,
    options: {
      parseFrontmatter: false,
      mdxOptions: { remarkPlugins: [remarkGfm] },
    },
  });
  const MDXContentElement = compiled.content;

  const isExternalHero = typeof meta.hero === "string" && /^https?:\/\//i.test(meta.hero);
  const externalHeroProps = isExternalHero
    ? {
        loader: ({ src }: { src: string; width: number; quality?: number }) => src,
        unoptimized: true as const,
      }
    : undefined;
  const heroImage = meta.hero || DEFAULT_OG_IMAGE;
  const artworkHero = meta.heroLayout === "artwork" ? meta.hero : undefined;
  const canonicalUrl = absoluteUrl(`/news/${meta.slug}`);
  const blogPostingJsonLd = buildArticleJsonLd({
    title: meta.title,
    description: meta.excerpt,
    path: `/news/${meta.slug}`,
    image: heroImage,
    datePublished: meta.date,
    dateModified: meta.modifiedDate || meta.date,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/news" },
    { name: meta.title, path: `/news/${meta.slug}` },
  ]);
  const faqPageJsonLd = faqItems.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <main id="main" tabIndex={-1} className="interior-page pb-16 pt-6 font-sans sm:pt-10" aria-label="Article">
      <ReadingProgress targetId="article-root" height={4} />
      {/* Hero / Header */}
      <div className="mb-8">
        <Container>
          <nav aria-label="Breadcrumb" className="mb-5 text-xs text-white/60">
            <Link href="/news" className="underline decoration-white/35 underline-offset-2 hover:decoration-white">
              Guides
            </Link>
            <span className="mx-2 opacity-60">/</span>
            <span className="text-white/75">{meta.title}</span>
          </nav>
        {artworkHero ? (
          <section
            aria-label={`${meta.title} cover`}
            className="interior-card overflow-hidden"
          >
            <h1 className="sr-only">{meta.title}</h1>
            <Image
              src={artworkHero}
              alt={meta.heroAlt || meta.title}
              width={1600}
              height={900}
              className="h-auto w-full"
              sizes="(min-width: 1200px) 1200px, 100vw"
              priority={false}
              {...(externalHeroProps ?? {})}
            />
            <div className="border-t border-white/10 px-6 py-5 sm:px-8">
              {meta.excerpt ? (
                <p className="max-w-4xl text-base leading-7 text-white/72">{meta.excerpt}</p>
              ) : null}
              <div className="motif-spec mt-4 flex flex-wrap items-center gap-2 text-[0.62rem] text-white/60">
                <time dateTime={meta.date}>
                  {hasUpdatedDate ? "Published " : ""}{formatDate(meta.date)}
                </time>
                {hasUpdatedDate ? (
                  <time dateTime={meta.modifiedDate}>· Updated {formatDate(meta.modifiedDate)}</time>
                ) : null}
                {meta.readingTime ? <span>· {meta.readingTime}</span> : null}
                {Array.isArray(meta.tags) && meta.tags.length > 0 ? (
                  <span>· {meta.tags.slice(0, 4).join(" · ")}</span>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="interior-hero relative min-h-[28rem]">
            {meta.hero && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/60 to-black/15" />
                <div className="relative h-full w-full">
                  {isExternalHero ? (
                    <Image
                      src={meta.hero}
                      alt={meta.heroAlt || meta.title}
                      fill
                      className="object-cover"
                      sizes="100vw"
                      priority={false}
                      {...(externalHeroProps ?? {})}
                    />
                  ) : (
                    <Image src={meta.hero} alt={meta.heroAlt || meta.title} fill className="object-cover" sizes="100vw" priority={false} />
                  )}
                </div>
              </div>
            )}
            {!meta.hero && (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,122,26,0.17),transparent_36%),linear-gradient(145deg,#1b1c1f,#0b0c0e)]" />
            )}
            <div className="relative z-20">
                <div className="flex min-h-[28rem] max-w-4xl flex-col justify-end px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
                  <p className="interior-kicker mb-4">Shed210 field guide</p>
                  <h1 className="brand-heading mb-3 text-3xl text-white sm:text-4xl lg:text-6xl">
                    {meta.title}
                  </h1>
                  {meta.excerpt ? <p className="mt-1 max-w-2xl text-base leading-7 text-white/72">{meta.excerpt}</p> : null}
                  <div className="motif-spec mt-5 flex flex-wrap items-center gap-2 text-[0.62rem] text-white/60">
                    <time dateTime={String(meta.date)} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 backdrop-blur">
                      {hasUpdatedDate ? "Published " : ""}{formatDate(meta.date)}
                    </time>
                    {hasUpdatedDate ? (
                      <time dateTime={meta.modifiedDate} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 backdrop-blur">
                        Updated {formatDate(meta.modifiedDate)}
                      </time>
                    ) : null}
                    {meta.readingTime && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 backdrop-blur">
                        {meta.readingTime}
                      </span>
                    )}
                    {Array.isArray(meta.tags) && meta.tags.length > 0 && (
                      <span className="hidden w-px self-stretch bg-white/20 sm:inline-block" aria-hidden="true" />
                    )}
                    {Array.isArray(meta.tags) && meta.tags.slice(0, 4).map((t) => (
                      <span key={t} className="brand-button inline-flex items-center rounded-full bg-amber-500/90 px-3 py-1.5 text-[0.62rem] text-zinc-950">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
            </div>
          </section>
        )}
        </Container>
      </div>

      {/* Content */}
      <Container>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <article id="article-root" className="lg:col-span-8 xl:col-span-9">
            <div className={styles.articleBody}>
              {MDXContentElement}
            </div>
            <div className="interior-card mt-8 p-6 sm:p-7">
              <p className="interior-kicker">Your next step</p>
              <h3 className="brand-subheading mb-0 mt-4 text-xl">Planning your own shed project?</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Get an instant quote, browse recent builds, or contact us with your lot details.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <TrackedActionLink
                  href="/quote"
                  eventName="quote_cta_clicked"
                  eventProperties={{ location: "article_footer", article: meta.slug }}
                  className="btn btn-primary btn-md text-sm"
                >
                  Get Instant Price
                </TrackedActionLink>
                <Link href="/gallery" className="btn btn-outline btn-md text-sm">
                  View Our Work
                </Link>
                <TrackedActionLink
                  href="/contact"
                  eventName="contact_cta_clicked"
                  eventProperties={{ location: "article_footer", article: meta.slug }}
                  className="btn btn-outline btn-md text-sm"
                >
                  Contact Shed210
                </TrackedActionLink>
              </div>
            </div>
          </article>
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 space-y-4">
              <ShareActions title={meta.title} path={canonicalUrl} />
              <TableOfContents headings={headings} />
              <div className="interior-card p-5 text-sm">
                <div className="brand-subheading mb-2">Details</div>
                <dl className="space-y-1 text-[var(--text-muted)]">
                  <div className="flex items-center justify-between gap-4">
                    <dt>{hasUpdatedDate ? "Published" : "Date"}</dt>
                    <dd className="text-right text-[var(--foreground)]">{formatDate(meta.date)}</dd>
                  </div>
                  {hasUpdatedDate ? (
                    <div className="flex items-center justify-between gap-4">
                      <dt>Updated</dt>
                      <dd className="text-right text-[var(--foreground)]">{formatDate(meta.modifiedDate)}</dd>
                    </div>
                  ) : null}
                  {meta.readingTime && (
                    <div className="flex items-center justify-between gap-4">
                      <dt>Reading time</dt>
                      <dd className="text-right text-[var(--foreground)]">{meta.readingTime}</dd>
                    </div>
                  )}
                  {Array.isArray(meta.tags) && meta.tags.length > 0 && (
                    <div className="flex items-center justify-between gap-4">
                      <dt>Tags</dt>
                      <dd className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {meta.tags.map((t) => (
                            <span key={t} className="rounded-full border border-[var(--border-color)] bg-[var(--input-bg)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                              {t}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogPostingJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      {faqPageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPageJsonLd) }}
        />
      )}
    </main>
  );
}
