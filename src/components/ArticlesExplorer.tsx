"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ArticleMeta } from "@/lib/articles";
import NewsCard from "@/components/NewsCard";

type Props = {
  articles: ArticleMeta[];
};

function normalize(str: string) {
  return str.toLowerCase();
}

export default function ArticlesExplorer({ articles }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"new" | "old">("new");

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      for (const t of a.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [articles]);

  const results = useMemo(() => {
    const q = normalize(query);
    const hasQuery = q.length > 0;
    const hasTags = selected.size > 0;

    const filtered = articles.filter((a) => {
      const text = normalize(`${a.title} ${a.excerpt} ${(a.tags || []).join(" ")}`);
      const passesQuery = !hasQuery || text.includes(q);
      const passesTags = !hasTags || (a.tags || []).some((t) => selected.has(t));
      return passesQuery && passesTags;
    });

    const byDate = (d?: string) => (d ? new Date(d).getTime() : 0);
    filtered.sort((a, b) => (sort === "new" ? byDate(b.date) - byDate(a.date) : byDate(a.date) - byDate(b.date)));

    return filtered;
  }, [articles, query, selected, sort]);

  const clearFilters = () => {
    setQuery("");
    setSelected(new Set());
  };

  return (
    <section aria-label="Browse articles" className="space-y-8">
      {/* Toolbar */}
      <div className="interior-card sticky top-[72px] z-10 overflow-hidden bg-[#121315]/90 backdrop-blur-xl">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, tags..."
                className="mb-0 w-full rounded-full border border-white/10 bg-black/25 px-10 py-2.5 text-sm text-white shadow-inner outline-none ring-amber-400/30 placeholder:text-white/60 focus:border-amber-400/30 focus:ring-2"
                aria-label="Search articles"
              />
            </div>

            {/* Sort + Clear */}
            <div className="flex items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/20 p-1 text-xs text-white/75 shadow-inner">
                <button
                  onClick={() => setSort("new")}
                  className={`brand-button rounded-full px-3 py-1.5 transition ${sort === "new" ? "bg-white text-black" : "opacity-70 hover:opacity-100"}`}
                  aria-pressed={sort === "new"}
                >
                  Newest
                </button>
                <button
                  onClick={() => setSort("old")}
                  className={`brand-button rounded-full px-3 py-1.5 transition ${sort === "old" ? "bg-white text-black" : "opacity-70 hover:opacity-100"}`}
                  aria-pressed={sort === "old"}
                >
                  Oldest
                </button>
              </div>

              <button
                onClick={clearFilters}
                className="brand-button inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 shadow-sm transition hover:border-white/20 hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className={`motif-spec rounded-full px-3 py-1.5 text-[0.62rem] transition ${selected.size === 0 ? "bg-white text-zinc-900" : "border border-white/10 bg-white/[0.035] text-white/60 hover:border-white/25"}`}
                aria-pressed={selected.size === 0}
              >
                All
              </button>

              {allTags.map(({ tag, count }) => {
                const isOn = selected.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const next = new Set(selected);
                      if (next.has(tag)) next.delete(tag); else next.add(tag);
                      setSelected(next);
                    }}
                    className={`motif-spec rounded-full px-3 py-1.5 text-[0.62rem] transition ${isOn ? "bg-amber-500 text-black shadow-sm" : "border border-white/10 bg-white/[0.035] text-white/60 hover:border-white/25"}`}
                    aria-pressed={isOn}
                  >
                    {tag}
                    <span className={`ml-1.5 text-[11px] ${isOn ? "text-black/70" : "text-white/60"}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {results.length} {results.length === 1 ? "article" : "articles"} found.
      </p>

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((article) => (
            <div key={article.slug} className="group relative">
              <NewsCard
                slug={article.slug}
                title={article.title}
                date={article.date}
                excerpt={article.excerpt}
                hero={article.hero}
                alt={article.heroAlt || article.title}
                readingTime={article.readingTime}
                tags={article.tags}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="interior-card my-16 border-dashed p-10 text-center text-white/60">
          <p className="text-sm">No matching articles. Try a different search or tag.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={clearFilters}
              className="brand-button rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/85 shadow-sm transition hover:bg-white/10"
            >
              Reset filters
            </button>
            <Link
              href="/news"
              className="brand-button rounded-full bg-white px-4 py-2 text-xs text-zinc-900 transition hover:opacity-90"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
