import type {
  PublicGalleryProject,
  PublicProjectPhoto,
  PublicProjectSummary,
} from "@/lib/crmProjects.server";
import { getProjectSocialPreviewUrl } from "@/lib/projectImages";
import { normalizePublicProjectCopy } from "@/lib/publicProjectCopy";
import { absoluteUrl, type JsonLdObject } from "@/lib/seo";

const installedMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const installedDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const wholeDollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dollarAndCentFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatProjectInstallMonth(dateInstalled: number): string {
  return installedMonthFormatter.format(new Date(dateInstalled));
}

export function formatProjectInstallDate(dateInstalled: number): string {
  return installedDateFormatter.format(new Date(dateInstalled));
}

export function formatProjectPrice(priceInCents: number): string {
  const dollars = priceInCents / 100;
  return priceInCents % 100 === 0
    ? wholeDollarFormatter.format(dollars)
    : dollarAndCentFormatter.format(dollars);
}

export function formatProjectName(
  project: Pick<PublicProjectSummary, "model" | "size" | "title">
): string {
  const descriptor = normalizePublicProjectCopy(project.title || project.model)
    .replace(/\s+/g, " ")
    .trim();
  return `${project.size} ${descriptor}`.replace(/\s+/g, " ").trim();
}

export function getProjectCardHref(
  project: Pick<PublicProjectSummary, "citySlug" | "slug">
): string {
  return `/projects/${project.citySlug}/${project.slug}`;
}

export function orderProjectPhotosCoverFirst(
  project: Pick<PublicGalleryProject, "photos" | "coverPhotoIndex">
): Array<{ photo: PublicProjectPhoto; originalIndex: number }> {
  return [
    {
      photo: project.photos[project.coverPhotoIndex],
      originalIndex: project.coverPhotoIndex,
    },
    ...project.photos.flatMap((photo, originalIndex) =>
      originalIndex === project.coverPhotoIndex
        ? []
        : [{ photo, originalIndex }]
    ),
  ];
}

export function projectHasDedicatedPage(
  project: { photos?: readonly unknown[] }
): boolean {
  return (project.photos?.length ?? 0) > 0;
}

export function buildProjectDescription(
  project: Pick<
    PublicProjectSummary,
    "city" | "model" | "size" | "title" | "dateInstalled"
  > & { blurb?: string },
  maxLength = 155
): string {
  const normalizedBlurb = project.blurb?.replace(/\s+/g, " ").trim();
  const fallback = `${formatProjectName(project)} built in ${project.city}, Texas in ${formatProjectInstallMonth(project.dateInstalled)}. See project photos and details from Shed210.`;
  const source = normalizedBlurb || fallback;
  if (source.length <= maxLength) return source;

  let sentenceBoundary = 0;
  for (const match of source.matchAll(/[.!?](?=\s|$)/gu)) {
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (matchEnd > maxLength) break;
    sentenceBoundary = matchEnd;
  }
  const minimumUsefulSentenceLength = Math.min(
    100,
    Math.floor(maxLength * 0.65)
  );
  if (sentenceBoundary >= minimumUsefulSentenceLength) {
    return source.slice(0, sentenceBoundary);
  }

  if (normalizedBlurb && sentenceBoundary > 0) {
    const compactFallback = `Shed210 completed this project in ${project.city}, Texas in ${formatProjectInstallMonth(project.dateInstalled)}. See photos and build details.`;
    const completeFallback = [fallback, compactFallback].find(
      (candidate) => candidate.length <= maxLength
    );
    if (completeFallback) return completeFallback;
  }

  const suffix = maxLength > 1 ? "…" : "";
  const candidate = source.slice(0, maxLength - suffix.length + 1);
  const wordBoundary = candidate.lastIndexOf(" ");
  const truncated = source
    .slice(
      0,
      wordBoundary > 0 ? wordBoundary : maxLength - suffix.length
    )
    .trimEnd()
    .replace(/[,:;.!?-]+$/u, "");
  return `${truncated}${suffix}`;
}

export function buildProjectImageJsonLd(
  project: Pick<
    PublicProjectSummary,
    | "slug"
    | "city"
    | "citySlug"
    | "model"
    | "size"
    | "title"
    | "coverPhoto"
  >,
  position: number
): JsonLdObject {
  return {
    "@type": "ListItem",
    position,
    url: absoluteUrl(getProjectCardHref(project)),
    item: {
      "@type": "ImageObject",
      name: project.coverPhoto.filename,
      caption: project.coverPhoto.alt,
      contentUrl: getProjectSocialPreviewUrl(project.coverPhoto),
      representativeOfPage: false,
      about: `${formatProjectName(project)} built in ${project.city}, TX`,
      contentLocation: {
        "@type": "City",
        name: project.city,
      },
    },
  };
}

export function buildProjectItemListJsonLd(
  projects: readonly PublicProjectSummary[],
  name: string
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: projects.map((project, index) =>
      buildProjectImageJsonLd(project, index + 1)
    ),
  };
}

export function buildProjectGalleryItemListJsonLd(
  projects: readonly PublicGalleryProject[],
  name: string
): JsonLdObject {
  return buildProjectItemListJsonLd(projects, name);
}
