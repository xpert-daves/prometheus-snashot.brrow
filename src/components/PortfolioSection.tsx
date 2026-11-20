import Link from "next/link";

import Container from "./Container";
import ProjectShowcaseCard, {
  type ProjectShowcaseCardScale,
  type ProjectShowcaseItem,
} from "./ProjectShowcaseCard";
import SpecTag from "./motif/SpecTag";
import type { PublicGalleryProject } from "@/lib/crmProjects.server";
import {
  getProjectPhotoCount,
  getProjectThumbnailImageProps,
} from "@/lib/projectImages";
import {
  HOMEPAGE_MULTI_PROJECT_LIMIT,
  HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT,
  selectHomepageGalleryPhotos,
} from "@/lib/homepageGallery";
import { portfolioProjects } from "@/lib/portfolio";
import {
  formatProjectInstallMonth,
  formatProjectName,
  getProjectCardHref,
} from "@/lib/projectPresentation";
import { homeSectionTheme } from "@/lib/theme/homeSectionTheme";

type PortfolioDisplayItem = ProjectShowcaseItem & {
  key: string;
};

function multiProjectGridClass(itemCount: number): string {
  const baseClass =
    "mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6";

  if (itemCount === 2 || itemCount === 4) {
    return `${baseClass} lg:grid-cols-2`;
  }
  if (itemCount === 5) {
    return `${baseClass} lg:grid-cols-6`;
  }
  return `${baseClass} lg:grid-cols-3`;
}

function multiProjectItemClass(index: number, itemCount: number): string {
  if (itemCount !== 5) return "";
  if (index < 3) return "lg:col-span-2";
  return index === 3
    ? "lg:col-span-2 lg:col-start-2"
    : "lg:col-span-2 lg:col-start-4";
}

function multiProjectImageSizes(itemCount: number): string {
  const tabletSize =
    "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 52px) / 2)";

  if (itemCount === 2 || itemCount === 4) {
    return `${tabletSize}, (max-width: 1199px) calc((100vw - 56px) / 2), 572px`;
  }
  return `${tabletSize}, (max-width: 1199px) calc((100vw - 80px) / 3), 374px`;
}

function MultiProjectList({ items }: { items: PortfolioDisplayItem[] }) {
  return (
    <ul
      aria-label="Recent Shed210 builds"
      className={multiProjectGridClass(items.length)}
    >
      {items.map((item, index) => (
        <li
          key={item.key}
          className={multiProjectItemClass(index, items.length)}
        >
          <ProjectShowcaseCard
            item={item}
            layout="grid"
            imageSizes={multiProjectImageSizes(items.length)}
            itemCount={items.length}
            actionLabel="View project photos"
          />
        </li>
      ))}
    </ul>
  );
}

function buildLegacyPortfolioItems(): PortfolioDisplayItem[] {
  return portfolioProjects
    .slice(0, HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT)
    .map((project) => ({
      key: `legacy:${project.src}`,
      src: project.src,
      alt: project.alt,
      city: project.city,
      eyebrow: project.projectType,
      title: project.caption || project.alt,
      href: "/gallery",
      linkLabel: `View the project gallery: ${project.alt}`,
    }));
}

function gridClass(itemCount: number): string {
  if (itemCount === 1) return "mt-10 grid gap-4";
  if (itemCount === 2) {
    return "mt-10 grid gap-4 md:grid-cols-2";
  }
  return "mt-10 grid gap-4 lg:grid-cols-[1.45fr_1fr] lg:grid-rows-2";
}

function cardScale(
  index: number,
  itemCount: number
): ProjectShowcaseCardScale {
  if (itemCount === 1) return "wide";
  if (itemCount === 3 && index === 0) return "featured";
  return "standard";
}

type PortfolioSectionProps = {
  projects: readonly PublicGalleryProject[];
};

export default function PortfolioSection({
  projects,
}: PortfolioSectionProps) {
  const theme = homeSectionTheme.portfolioSection;
  const selectedPhotos = selectHomepageGalleryPhotos(projects);
  const publishedProjectCount = new Set(projects.map(({ slug }) => slug)).size;
  const selectedProjectCount = new Set(
    selectedPhotos.map(({ project }) => project.slug)
  ).size;
  const isSingleProjectStory =
    selectedProjectCount === 1 && selectedPhotos.length > 0;
  const isMultiProjectStory =
    selectedProjectCount > 1 && selectedPhotos.length > 0;
  const crmItems: PortfolioDisplayItem[] = selectedPhotos.map(
    ({ project, photo, originalIndex, isCover }) => {
      const projectName = formatProjectName(project);
      const photoCount = getProjectPhotoCount(project);
      return {
        key: `${project.slug}:${originalIndex}`,
        ...getProjectThumbnailImageProps(photo),
        alt: photo.alt,
        filename: photo.filename,
        city: project.city,
        eyebrow: isSingleProjectStory
          ? isCover
            ? `Cover view · ${photoCount} ${photoCount === 1 ? "photo" : "photos"}`
            : `Another angle · photo ${originalIndex + 1} of ${photoCount}`
          : formatProjectInstallMonth(project.dateInstalled),
        title: projectName,
        ...(isSingleProjectStory ? { detail: photo.alt } : {}),
        href: getProjectCardHref(project),
        linkLabel: isSingleProjectStory
          ? `View ${projectName} project in ${project.city}: ${photo.alt}`
          : `View project photos for ${projectName} in ${project.city}`,
      };
    }
  );
  const usesCrmProjects = crmItems.length > 0;
  const items = usesCrmProjects ? crmItems : buildLegacyPortfolioItems();
  const sectionTag = isSingleProjectStory
    ? `One published build · ${selectedPhotos.length} ${selectedPhotos.length === 1 ? "angle" : "angles"}`
    : isMultiProjectStory
      ? publishedProjectCount > selectedProjectCount
        ? `Latest ${HOMEPAGE_MULTI_PROJECT_LIMIT} Builds`
        : `${selectedPhotos.length} Recent Builds`
      : "Real Local Projects";
  const sectionDescription = isSingleProjectStory
    ? "One published build, shown from up to three honest angles. As more projects go live, this space automatically shifts to one photo per recent build."
    : isMultiProjectStory
      ? "Explore our newest builds across the area. Each project opens to every photo and detail."
      : "Every image below is a real Shed210 build—made locally, photographed honestly, and designed for daily use.";

  return (
    <section
      id="our-work"
      data-theme="warm-industrial"
      data-section-tone={theme.tone}
      className="relative isolate overflow-hidden border-y py-14 sm:py-20 lg:py-24"
      style={{ background: theme.sectionBg, borderColor: theme.borderTone }}
      aria-labelledby="portfolio-heading"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: theme.topGlow }} />
      </div>
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end md:gap-10">
          <div className="md:shrink-0">
            <SpecTag>{sectionTag}</SpecTag>
            <h2
              id="portfolio-heading"
              className="brand-heading mt-4 text-4xl md:text-5xl lg:text-6xl"
              style={{ color: theme.headingTone }}
            >
              Built around<br className="hidden sm:block" /> real backyards.
            </h2>
          </div>
          <div className="max-w-md md:pb-2">
            <p
              className="text-sm leading-6 md:text-base"
              style={{ color: theme.chipTone }}
            >
              {sectionDescription}
            </p>
            <Link
              href="/gallery"
              className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-amber-300 transition hover:text-amber-200"
            >
              Explore the full gallery{" "}
              <span className="ml-2" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>

        {isMultiProjectStory ? (
          <MultiProjectList items={items} />
        ) : (
          <div className={gridClass(items.length)}>
            {items.map((item, index) => (
              <ProjectShowcaseCard
                key={item.key}
                item={item}
                scale={cardScale(index, items.length)}
                itemCount={items.length}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <ul
            className="flex flex-wrap gap-x-6 gap-y-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em]"
            style={{ color: theme.chipTone }}
          >
            <li>Built on your property</li>
            <li>Custom sizes & finishes</li>
            <li>Warranty-backed craftsmanship</li>
          </ul>
          <Link
            href="/gallery"
            className="btn btn-primary btn-sm"
            aria-label="See full gallery and reviews"
          >
            See all work
          </Link>
        </div>
      </Container>
    </section>
  );
}
