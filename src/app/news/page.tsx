import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircle } from "lucide-react";
import Container from "@/components/Container";
import ArticlesExplorer from "@/components/ArticlesExplorer";
import { listArticles } from "@/lib/articles";
import { DEFAULT_OG_IMAGE, absoluteUrl, buildBlogJsonLd, serializeJsonLd } from "@/lib/seo";

const title = "Shed Guides and Tips in San Antonio";
const description =
  "Read shed buying guides, permit and HOA tips, and cost breakdowns for San Antonio homeowners planning a custom shed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/news",
  },
  openGraph: {
    title,
    description,
    url: absoluteUrl("/news"),
    images: [{ url: DEFAULT_OG_IMAGE, alt: "Shed210 Guides article library." }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_OG_IMAGE],
  },
};

// Helper to safely format dates without throwing on bad inputs
function formatDate(d: unknown) {
  try {
    const dt = new Date(String(d));
    if (isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(dt);
  } catch {
    return "";
  }
}

// A simple featured hero using the newest article
function FeaturedArticle({
  slug,
  title,
  excerpt,
  date,
  hero,
  heroAlt,
  heroLayout,
}: {
  slug: string;
  title: string;
  excerpt?: string;
  date?: string;
  hero?: string;
  heroAlt?: string;
  heroLayout?: "artwork";
}) {
  if (hero && heroLayout === "artwork") {
    return (
      <section className="mb-12" aria-label="Featured article">
        <Container>
          <div className="interior-card overflow-hidden">
            <h2 className="sr-only">{title}</h2>
            <Link href={`/news/${slug}`} className="block">
              <Image
                src={hero}
                alt={heroAlt || title}
                width={1600}
                height={900}
                className="h-auto w-full"
                sizes="(min-width: 1200px) 1200px, 100vw"
              />
            </Link>
            <div className="flex flex-col gap-5 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                {excerpt ? (
                  <p className="max-w-3xl text-base leading-7 text-white/72">{excerpt}</p>
                ) : null}
                {date ? (
                  <p className="motif-spec mt-3 text-[0.65rem] text-white/55">
                    {formatDate(date)}
                  </p>
                ) : null}
              </div>
              <Link href={`/news/${slug}`} className="btn btn-primary btn-md shrink-0 gap-2 text-sm">
                Read the story
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section
      className="interior-hero relative z-0 mb-12 min-h-[30rem]"
      aria-label="Featured article"
    >
      {/* Background image (if provided) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: hero ? `url(${hero})` : undefined,
          filter: hero ? "saturate(110%)" : undefined,
        }}
      />

      {/* Soft overlay for readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/90 via-black/65 to-black/15" />

      <div className="relative z-10">
        <Container>
          <div className="grid min-h-[30rem] items-end gap-6 px-1 py-10 sm:px-4 sm:py-14 md:grid-cols-2 md:gap-10 lg:px-8 lg:py-16">
            <div className="text-white">
              <p className="interior-kicker mb-4">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Latest field guide
              </p>
              <h2 className="brand-heading mb-0 text-3xl sm:text-4xl lg:text-5xl">
                <Link
                  href={`/news/${slug}`}
                  className="transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  {title}
                </Link>
              </h2>
              {excerpt ? (
                <p className="mt-3 max-w-2xl text-base/relaxed text-white/90 md:text-lg">
                  {excerpt}
                </p>
              ) : null}
              <div className="motif-spec mt-5 flex items-center gap-3 text-[0.65rem] text-white/55">
                {date ? <span>{formatDate(date)}</span> : null}
              </div>
              <div className="mt-6">
                <Link
                  href={`/news/${slug}`}
                  className="btn btn-primary btn-md gap-2 text-sm"
                >
                  Read the story
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
            {/* Decorative side panel only when image is missing */}
            {!hero && (
              <div className="interior-card-soft hidden h-64 md:block" />
            )}
          </div>
        </Container>
      </div>
    </section>
  );
}

export default async function News() {
  const articles = await listArticles();
  // Infer the Article type from the data source to avoid "any"
  type Article = (typeof articles)[number];

  // Sort by date desc if available; otherwise retain original order
  const sorted = [...articles].sort((a: Article, b: Article) => {
    const ad = new Date(a?.date ?? 0).getTime();
    const bd = new Date(b?.date ?? 0).getTime();
    return bd - ad;
  });

  const [featured] = sorted;
  const blogJsonLd = buildBlogJsonLd({
    name: "Shed210 Guides",
    description,
    articles: sorted,
  });

  return (
    <main id="main" tabIndex={-1} className="interior-page py-10 font-sans sm:py-14 lg:py-18">
      <Container>
        {/* Page Header */}
        <header className="mb-8 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="interior-kicker">Ideas for a better backyard</p>
            <h1 className="brand-heading mb-0 mt-4 text-4xl text-white sm:text-5xl lg:text-6xl">
              Guides
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/62">
              Local buying guides, permit notes, cost breakdowns, and practical ideas from the Shed210 crew.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/buildings"
              className="btn btn-primary btn-md gap-2 text-sm"
            >
              Compare Buildings
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="btn btn-outline btn-md gap-2 text-sm"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Get in touch
            </Link>
          </div>
        </header>
      </Container>

      {/* Featured Hero */}
      {featured ? (
        <FeaturedArticle
          slug={featured.slug}
          title={featured.title}
          excerpt={featured.excerpt}
          date={featured.date}
          hero={featured.hero}
          heroAlt={featured.heroAlt}
          heroLayout={featured.heroLayout}
        />
      ) : null}

      <Container>
        <ArticlesExplorer articles={sorted} />
        <div className="py-8" />
      </Container>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd) }}
      />
    </main>
  );
}
