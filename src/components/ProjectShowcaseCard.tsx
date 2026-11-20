import Link from "next/link";
import ProjectThumbnailImage from "./ProjectThumbnailImage";

export type ProjectShowcaseItem = {
  src: string;
  unoptimized?: boolean;
  fallbackSrc?: string;
  alt: string;
  filename?: string;
  city: string;
  eyebrow: string;
  title: string;
  detail?: string;
  price?: string;
  badge?: string;
  href: string;
  linkLabel: string;
};

export type ProjectShowcaseCardScale = "wide" | "featured" | "standard";
export type ProjectShowcaseCardLayout = "overlay" | "grid";

function cardClass(scale: ProjectShowcaseCardScale): string {
  if (scale === "wide") {
    return "min-h-[420px] sm:min-h-[520px]";
  }
  if (scale === "featured") {
    return "min-h-[420px] lg:row-span-2 lg:min-h-[640px]";
  }
  return "min-h-[300px] sm:min-h-[360px]";
}

function defaultImageSizes(
  scale: ProjectShowcaseCardScale,
  itemCount: number
): string {
  if (scale === "wide") {
    return "(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) calc(100vw - 64px), 1200px";
  }
  if (scale === "featured") {
    return "(max-width: 1023px) calc(100vw - 32px), 700px";
  }
  if (itemCount === 2) {
    return "(max-width: 767px) calc(100vw - 32px), (max-width: 1199px) calc((100vw - 48px) / 2), 576px";
  }
  return "(max-width: 1023px) calc(100vw - 32px), (max-width: 1199px) 41vw, 470px";
}

type ProjectShowcaseCardProps = {
  item: ProjectShowcaseItem;
  layout?: ProjectShowcaseCardLayout;
  scale?: ProjectShowcaseCardScale;
  itemCount?: number;
  imageSizes?: string;
  priority?: boolean;
  actionLabel?: string;
};

export default function ProjectShowcaseCard({
  item,
  layout = "overlay",
  scale = "standard",
  itemCount = 3,
  imageSizes,
  priority = false,
  actionLabel = "View project",
}: ProjectShowcaseCardProps) {
  const featured = scale !== "standard";
  const resolvedImageSizes =
    imageSizes ?? defaultImageSizes(scale, itemCount);

  if (layout === "grid") {
    return (
      <Link
        href={item.href}
        aria-label={item.linkLabel}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#11100e] shadow-[0_22px_60px_-36px_rgba(0,0,0,0.9)] outline-none ring-amber-300/70 transition hover:border-amber-300/35 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-black">
          <ProjectThumbnailImage
            src={item.src}
            unoptimized={item.unoptimized}
            fallbackSrc={item.fallbackSrc}
            alt={item.alt}
            {...(item.filename ? { "data-filename": item.filename } : {})}
            fill
            sizes={resolvedImageSizes}
            quality={75}
            priority={priority}
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          {item.badge ? (
            <span className="motif-spec absolute right-4 top-4 rounded-full border border-white/15 bg-black/72 px-3 py-1.5 text-[0.58rem] text-white shadow-lg backdrop-blur-md">
              {item.badge}
            </span>
          ) : null}
        </div>
        <div className="flex min-h-[174px] flex-1 flex-col border-t border-white/10 bg-[#11100e] p-5 sm:p-6">
          <p className="motif-spec text-[0.6rem] text-amber-300/85">
            {item.city}{" "}
            <span aria-hidden="true" className="px-1.5 text-white/30">
              /
            </span>{" "}
            {item.eyebrow}
          </p>
          <h3 className="brand-subheading mt-3 text-xl text-white sm:text-2xl">
            {item.title}
          </h3>
          {item.detail ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/70">
              {item.detail}
            </p>
          ) : null}
          {item.price ? (
            <p className="brand-subheading mt-3 text-lg text-white">
              {item.price}
            </p>
          ) : null}
          <span className="mt-auto inline-flex items-center pt-5 text-xs font-semibold uppercase tracking-[0.12em] text-white/70 transition group-hover:text-white motion-reduce:transition-none">
            {actionLabel}
            <span className="ml-2 text-amber-400" aria-hidden="true">
              &rarr;
            </span>
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-label={item.linkLabel}
      className={`group relative block overflow-hidden rounded-3xl border border-white/10 bg-black outline-none ring-amber-300/70 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${cardClass(scale)}`}
    >
      <ProjectThumbnailImage
        src={item.src}
        unoptimized={item.unoptimized}
        fallbackSrc={item.fallbackSrc}
        alt={item.alt}
        {...(item.filename ? { "data-filename": item.filename } : {})}
        fill
        sizes={resolvedImageSizes}
        quality={featured ? 75 : 60}
        priority={priority}
        className="object-cover transition duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

      {item.badge ? (
        <span className="motif-spec absolute right-4 top-4 rounded-full border border-white/15 bg-black/72 px-3 py-1.5 text-[0.58rem] text-white shadow-lg backdrop-blur-md">
          {item.badge}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <p className="motif-spec text-[0.6rem] text-amber-300/85">
          {item.city}{" "}
          <span aria-hidden="true" className="px-1.5 text-white/30">
            /
          </span>{" "}
          {item.eyebrow}
        </p>
        <h3
          className={`${featured ? "mt-3 text-2xl sm:text-3xl" : "mt-2 text-xl"} brand-subheading max-w-xl text-white`}
        >
          {item.title}
        </h3>
        {item.detail ? (
          <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-white/70">
            {item.detail}
          </p>
        ) : null}
        {item.price ? (
          <p className="brand-subheading mt-3 text-lg text-white">
            {item.price}
          </p>
        ) : null}
        <span className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-white/65 transition group-hover:text-white">
          {actionLabel}{" "}
          <span className="ml-2 text-amber-400" aria-hidden="true">
            &rarr;
          </span>
        </span>
      </div>
    </Link>
  );
}
