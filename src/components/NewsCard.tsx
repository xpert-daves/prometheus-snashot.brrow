import Image from "next/image";
import Link from "next/link";

export type NewsCardProps = {
  slug: string;
  title: string;
  date: string | Date;
  excerpt: string;
  hero?: string | null;
  alt?: string;
  tags?: string[];
  readingTime?: string; // e.g. "4 min read"
};

function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function NewsCard({
  slug,
  title,
  date,
  excerpt,
  hero,
  alt = title,
  tags,
  readingTime,
}: NewsCardProps) {
  const iso = typeof date === "string" ? date : date.toISOString();
  const isExternalHero = typeof hero === "string" && /^https?:\/\//i.test(hero);
  const externalHeroProps = isExternalHero
    ? {
        loader: ({ src }: { src: string; width: number; quality?: number }) => src,
        unoptimized: true as const,
      }
    : undefined;

  return (
    <article className="interior-card interior-link-card group relative h-full overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/40">
      {/* Make the whole card clickable without nesting interactive elements */}
      <Link
        href={`/news/${slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Read: ${title}`}
      >
        <span className="sr-only">Read: {title}</span>
      </Link>

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
        {hero ? (
          <Image
            src={hero}
            alt={alt || ""}
            fill
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={false}
            {...(externalHeroProps ?? {})}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,122,26,0.18),transparent_45%),linear-gradient(145deg,#1c1d20,#0d0e10)]" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      </div>

      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="motif-spec flex flex-wrap items-center gap-2 text-[0.6rem] text-white/60">
          <time dateTime={iso}>{formatDate(date)}</time>
          {readingTime && (
            <>
              <span className="opacity-35">·</span>
              <span>{readingTime}</span>
            </>
          )}
          {tags && tags.length > 0 && (
            <>
              <span className="opacity-35">·</span>
              <ul className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/65"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <h2 className="brand-subheading mb-0 line-clamp-2 text-xl text-white transition group-hover:text-[var(--accent-light)]">
          {title}
        </h2>

        <p className="line-clamp-3 text-sm leading-6 text-white/58">{excerpt}</p>

        <div className="mt-auto pt-1 text-[var(--accent-light)]">
          <span className="brand-button inline-flex items-center gap-1 text-xs">
            Read more
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
}
