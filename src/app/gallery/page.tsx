import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Camera, MapPin } from "lucide-react";

import Container from "@/components/Container";
import GalleryFilters from "@/components/GalleryFilters";
import LiveGoogleReviews from "@/components/LiveGoogleReviews";
import ProjectShowcaseCard from "@/components/ProjectShowcaseCard";
import TrackedActionLink from "@/components/TrackedActionLink";
import {
  listCrmGalleryProjects,
  type PublicGalleryProject,
} from "@/lib/crmProjects.server";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import {
  getProjectPhotoCount,
  getProjectThumbnailImageProps,
} from "@/lib/projectImages";
import {
  buildGalleryCityOptions,
  buildGalleryProjectTypeOptions,
  filterGalleryProjects,
  findCanonicalGalleryProjectType,
  selectNearbyGalleryProjects,
} from "@/lib/galleryProjects";
import {
  buildProjectGalleryItemListJsonLd,
  formatProjectInstallMonth,
  formatProjectName,
  formatProjectPrice,
  getProjectCardHref,
} from "@/lib/projectPresentation";
import { getResolvedServiceAreaFromRegistry } from "@/lib/serviceAreaRegistry";
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  serializeJsonLd,
} from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Shed Gallery in San Antonio",
  description:
    "Browse published Shed210 builds by city and project type, then read current Google customer reviews.",
  path: "/gallery",
  imageAlt: "Completed Shed210 projects in San Antonio and nearby Texas communities.",
});

type GallerySearchParams = {
  city?: string | string[];
  type?: string | string[];
  model?: string | string[];
};

function firstSearchParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const GALLERY_CARD_IMAGE_SIZES =
  "(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 48px) / 2), 370px";
function GalleryProjectGrid({
  projects,
  prioritizeFirst = false,
}: {
  projects: readonly PublicGalleryProject[];
  prioritizeFirst?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => {
        const projectName = formatProjectName(project);
        const photoCount = getProjectPhotoCount(project);
        return (
          <article
            id={`project-${project.slug}`}
            key={project.slug}
            className="h-full"
          >
            <ProjectShowcaseCard
              item={{
                ...getProjectThumbnailImageProps(project.coverPhoto),
                alt: project.coverPhoto.alt,
                filename: project.coverPhoto.filename,
                city: `${project.city}, TX`,
                eyebrow: formatProjectInstallMonth(project.dateInstalled),
                title: projectName,
                ...(project.price !== undefined
                  ? { price: formatProjectPrice(project.price) }
                  : {}),
                badge: `${photoCount} ${
                  photoCount === 1 ? "photo" : "photos"
                }`,
                href: getProjectCardHref(project),
                linkLabel: `View project details: ${projectName} in ${project.city}, Texas`,
              }}
              layout="grid"
              imageSizes={GALLERY_CARD_IMAGE_SIZES}
              itemCount={projects.length}
              priority={prioritizeFirst && index === 0}
              actionLabel="View project details"
            />
          </article>
        );
      })}
    </div>
  );
}

function GalleryQuotePrompt() {
  return (
    <aside
      className="interior-card relative my-8 overflow-hidden px-6 py-7 sm:px-8 lg:my-10 lg:flex lg:items-center lg:justify-between lg:gap-10"
      aria-labelledby="gallery-quote-heading"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="interior-kicker">Found a backyard fit?</p>
        <h3
          id="gallery-quote-heading"
          className="brand-subheading mb-0 mt-3 text-2xl text-white sm:text-3xl"
        >
          Price your shed while the details are fresh.
        </h3>
        <p className="mt-3 text-sm leading-6 text-white/62">
          Choose a size, project type, doors, windows, and build ZIP to get an
          instant starting price.
        </p>
      </div>
      <div className="relative mt-6 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
        <Link
          href="/buildings"
          className="btn btn-outline btn-md text-sm"
        >
          Compare building types
        </Link>
        <TrackedActionLink
          href="/quote"
          eventName="quote_cta_clicked"
          eventProperties={{ location: "gallery_mid_grid" }}
          className="btn btn-primary btn-md inline-flex items-center gap-2 text-sm"
        >
          Get an instant price
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </TrackedActionLink>
      </div>
    </aside>
  );
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<GallerySearchParams>;
}) {
  const [projects, serviceAreas, params] = await Promise.all([
    listCrmGalleryProjects(),
    listResolvedServiceAreas(),
    searchParams,
  ]);
  const galleryLocations = serviceAreas.toSorted((left, right) =>
    left.city.localeCompare(right.city, "en-US")
  );
  const requestedCity = firstSearchParam(params.city);
  const selectedLocation = getResolvedServiceAreaFromRegistry(
    serviceAreas,
    requestedCity
  );
  const selectedCity = selectedLocation?.slug ?? "";
  const requestedProjectType =
    firstSearchParam(params.type) || firstSearchParam(params.model);
  const selectedProjectType = findCanonicalGalleryProjectType(
    requestedProjectType
  );
  const filteredProjects = filterGalleryProjects(
    projects,
    selectedCity,
    selectedProjectType
  );
  const cityOptions = buildGalleryCityOptions(
    projects,
    galleryLocations,
    selectedProjectType
  );
  const projectTypeOptions = buildGalleryProjectTypeOptions(
    projects,
    selectedCity
  );
  const nearbySelection =
    selectedLocation && filteredProjects.length === 0
      ? selectNearbyGalleryProjects(
          projects,
          selectedLocation,
          selectedProjectType
        )
      : null;
  const displayedProjects =
    filteredProjects.length > 0
      ? filteredProjects
      : (nearbySelection?.projects ?? []);
  const showingNearby = Boolean(
    selectedLocation &&
      filteredProjects.length === 0 &&
      displayedProjects.length > 0
  );
  const firstGroupEnd =
    displayedProjects.length > 6
      ? Math.min(
          displayedProjects.length,
          Math.ceil(displayedProjects.length / 6) * 3
        )
      : displayedProjects.length;
  const firstProjectGroup = displayedProjects.slice(0, firstGroupEnd);
  const remainingProjectGroup = displayedProjects.slice(firstGroupEnd);
  const itemListJsonLd = buildProjectGalleryItemListJsonLd(
    displayedProjects,
    "Published Shed210 project gallery"
  );
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Gallery", path: "/gallery" },
  ]);

  return (
    <main id="main" tabIndex={-1} className="interior-page font-sans">
      <section className="py-8 sm:py-12 lg:py-16">
        <Container>
          <div className="interior-hero px-6 py-7 sm:px-9 sm:py-10 lg:px-12 lg:py-14">
            <nav aria-label="Breadcrumb" className="relative z-10 mb-8">
              <ol className="flex items-center gap-2 text-xs text-white/60">
                <li>
                  <Link
                    className="underline decoration-white/35 underline-offset-2 hover:text-white"
                    href="/"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-white/80">
                  Gallery
                </li>
              </ol>
            </nav>

            <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
              <div>
                <p className="interior-kicker">Built here · documented here</p>
                <h1 className="brand-heading mb-0 mt-5 max-w-3xl text-4xl text-white sm:text-5xl lg:text-7xl">
                  Completed sheds.
                  <span className="block text-[var(--accent-light)]">
                    Real Texas backyards.
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                  Explore published Shed210 builds by city and project type.
                  Project details stay customer-safe and never include street
                  addresses.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href="#gallery" className="btn btn-outline btn-md gap-2 text-sm">
                    Browse projects
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <TrackedActionLink
                    href="/quote"
                    eventName="quote_cta_clicked"
                    eventProperties={{ location: "gallery_hero" }}
                    className="btn btn-primary btn-md gap-2 text-sm"
                  >
                    Get an instant price
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </TrackedActionLink>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                <div className="interior-card-soft p-4">
                  <Camera className="mb-4 h-5 w-5 text-[var(--accent-light)]" aria-hidden="true" />
                  <span className="brand-subheading block text-lg text-white">
                    {projects.length}
                  </span>
                  <span className="motif-spec mt-1 block text-[0.58rem] text-white/60">
                    published builds
                  </span>
                </div>
                <div className="interior-card-soft p-4">
                  <MapPin className="mb-4 h-5 w-5 text-[var(--accent-light)]" aria-hidden="true" />
                  <span className="brand-subheading block text-lg text-white">
                    San Antonio area
                  </span>
                  <span className="motif-spec mt-1 block text-[0.58rem] text-white/60">
                    built locally
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section
        id="gallery"
        aria-labelledby="gallery-heading"
        className="relative isolate overflow-hidden py-10 sm:py-14 lg:py-16"
      >
        <Container>
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="interior-kicker">Selected projects</p>
                <h2
                  id="gallery-heading"
                  className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl"
                >
                  Project gallery
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-white/55">
                {showingNearby
                  ? `${displayedProjects.length} nearby ${
                      displayedProjects.length === 1 ? "project" : "projects"
                    } shown`
                  : `${filteredProjects.length} of ${projects.length} published ${
                      projects.length === 1 ? "project" : "projects"
                    } shown`}{" "}
                · one curated cover per project.
              </p>
            </div>

            <div className="mt-7">
              <GalleryFilters
                cities={cityOptions}
                projectTypes={projectTypeOptions}
                selectedCity={selectedCity || undefined}
                selectedProjectType={selectedProjectType || undefined}
              />
            </div>

            {showingNearby && selectedLocation ? (
              <div className="interior-card mt-6 px-6 py-7 sm:px-8">
                <p className="interior-kicker">Closest project proof</p>
                <h3 className="brand-subheading mb-0 mt-3 text-xl text-white sm:text-2xl">
                  {`No ${
                    selectedProjectType ? `${selectedProjectType} ` : ""
                  }builds in ${selectedLocation.city} yet — here's what's nearby.`}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
                  {nearbySelection?.serviceAreaWide
                    ? "These are recent builds from across our service area."
                    : "These are recent builds from the closest connected service areas."}{" "}
                  {nearbySelection?.relaxedProjectType
                    ? `No nearby ${selectedProjectType} project is published yet, so we widened the project type while keeping the locations close.`
                    : "Open any project for its complete photo story, including build-day progress."}
                </p>
                <Link
                  href="/gallery"
                  className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent-light)] transition hover:text-white"
                >
                  View every project
                </Link>
              </div>
            ) : null}

            {displayedProjects.length > 0 ? (
              <div className="mt-6">
                <GalleryProjectGrid
                  projects={firstProjectGroup}
                  prioritizeFirst
                />
                <GalleryQuotePrompt />
                {remainingProjectGroup.length > 0 ? (
                  <GalleryProjectGrid projects={remainingProjectGroup} />
                ) : null}
              </div>
            ) : (
              <div className="interior-card mt-6 px-6 py-12 text-center">
                <h3 className="brand-subheading mb-0 text-xl text-white">
                  {selectedLocation
                    ? `No builds in ${selectedLocation.city} yet`
                    : "Project stories are on the way"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Start an instant quote, or clear the filters to browse every
                  published Shed210 build.
                </p>
                <Link
                  href="/gallery"
                  className="btn btn-primary btn-md mt-5 text-sm"
                >
                  View all projects
                </Link>
              </div>
            )}
          </div>
        </Container>
      </section>

      <section
        id="reviews"
        className="relative isolate overflow-hidden py-10 sm:py-14 lg:py-16"
      >
        <Container>
          <div className="interior-card relative p-6 sm:p-8">
            <LiveGoogleReviews />
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
    </main>
  );
}

export { firstSearchParam };
