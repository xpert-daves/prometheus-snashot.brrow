import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Ruler, ShieldCheck } from "lucide-react";

import Container from "@/components/Container";
import ProjectShowcaseCard from "@/components/ProjectShowcaseCard";
import TrackedActionLink from "@/components/TrackedActionLink";
import {
  BUILDING_CATALOG,
  type BuildingCatalogEntry,
} from "@/lib/buildingCatalog";
import {
  listCrmGalleryProjects,
  type PublicGalleryProject,
} from "@/lib/crmProjects.server";
import {
  getProjectPhotoCount,
  getProjectThumbnailImageProps,
} from "@/lib/projectImages";
import { resolveGalleryProjectType } from "@/lib/galleryProjects";
import { prioritizeStorageProject } from "@/lib/projectProof";
import {
  formatProjectInstallMonth,
  formatProjectName,
  getProjectCardHref,
} from "@/lib/projectPresentation";
import {
  buildBreadcrumbJsonLd,
  buildBuildingServicesJsonLd,
  buildPageMetadata,
  serializeJsonLd,
} from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: "Sheds & Custom Buildings in San Antonio",
  description:
    "Compare Shed210 storage buildings, garages, greenhouses, water well sheds, loafing shelters, and carports before starting an instant quote.",
  path: "/buildings",
  imageAlt: "A custom Shed210 building completed in the San Antonio area.",
});

function galleryHref(projectType: string): string {
  return `/gallery?type=${encodeURIComponent(projectType)}`;
}

function selectProofProjects(
  projects: readonly PublicGalleryProject[]
): PublicGalleryProject[] {
  const supportedTypes = new Set(
    (BUILDING_CATALOG as readonly BuildingCatalogEntry[]).flatMap((building) =>
      building.galleryProjectType ? [building.galleryProjectType] : []
    )
  );
  const representedTypes = new Set<string>();
  const selected: PublicGalleryProject[] = [];

  const orderedProjects = prioritizeStorageProject(
    projects.toSorted((left, right) => right.dateInstalled - left.dateInstalled)
  );
  for (const project of orderedProjects) {
    const projectType = resolveGalleryProjectType(project.model);
    if (
      !projectType ||
      !supportedTypes.has(projectType) ||
      representedTypes.has(projectType)
    ) {
      continue;
    }

    representedTypes.add(projectType);
    selected.push(project);
    if (selected.length === 3) break;
  }

  return selected;
}

export default async function BuildingsPage() {
  const projects = await listCrmGalleryProjects();
  const proofProjects = selectProofProjects(projects);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Buildings", path: "/buildings" },
  ]);
  const buildingServicesJsonLd = buildBuildingServicesJsonLd();

  return (
    <main id="main" tabIndex={-1} className="interior-page font-sans text-white">
      <section className="py-8 sm:py-12 lg:py-16">
        <Container>
          <div className="interior-hero px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-14">
            <nav aria-label="Breadcrumb" className="relative z-10 mb-8 text-xs text-white/60">
              <Link
                href="/"
                className="underline decoration-white/35 underline-offset-2 hover:text-white"
              >
                Home
              </Link>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span aria-current="page" className="text-white/80">
                Buildings
              </span>
            </nav>

            <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end">
              <div>
                <p className="interior-kicker">Built around your property</p>
                <h1 className="brand-heading mb-0 mt-5 max-w-4xl text-4xl text-white sm:text-5xl lg:text-7xl">
                  Sheds &amp; Custom Buildings in San Antonio
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-white/68 sm:text-lg">
                  Start with what the space needs to do. Compare the building types
                  Shed210 prices today, review common choices, and use real local
                  projects to narrow the direction before you request a number.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <TrackedActionLink
                    href="/quote"
                    eventName="quote_cta_clicked"
                    eventProperties={{ location: "buildings_hero" }}
                    className="btn btn-primary btn-md gap-2 text-sm"
                  >
                    Get Instant Price
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </TrackedActionLink>
                  <Link href="/gallery" className="btn btn-outline btn-md text-sm">
                    View Real Projects
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {[
                  {
                    icon: Ruler,
                    title: "Made to fit",
                    text: "Choose the footprint and layout around the job and the available space.",
                  },
                  {
                    icon: Check,
                    title: "Clear choices",
                    text: "Compare doors, windows, roof styles, materials, and practical upgrades.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Warranty backed",
                    text: "Plan with the current Shed210 workmanship and qualifying metal warranties.",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="interior-card-soft p-4">
                    <Icon className="h-5 w-5 text-[var(--accent-light)]" aria-hidden="true" />
                    <p className="brand-subheading mt-3 text-base text-white">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16" aria-labelledby="building-types-heading">
        <Container>
          <div className="mx-auto max-w-6xl">
            <div className="mb-7 max-w-3xl">
              <p className="interior-kicker">Building types</p>
              <h2
                id="building-types-heading"
                className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl"
              >
                Start with the job it needs to do.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/62">
                These are the same building choices used by the instant quote. The
                details below help you compare them before entering dimensions and
                site information.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {(BUILDING_CATALOG as readonly BuildingCatalogEntry[]).map(
                (building, index) => (
                  <article
                    key={building.value}
                    id={building.value}
                    className="interior-card flex h-full flex-col p-6 sm:p-8"
                  >
                    <p className="motif-spec text-[0.62rem] text-[var(--accent-light)]">
                      {String(index + 1).padStart(2, "0")} / {BUILDING_CATALOG.length}
                    </p>
                    <h2 className="brand-subheading mb-0 mt-4 text-2xl text-white sm:text-3xl">
                      {building.title}
                    </h2>
                    <p className="mt-4 text-base leading-7 text-white/68">
                      {building.summary}
                    </p>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <div>
                        <h3 className="motif-spec text-[0.62rem] text-white/55">Best for</h3>
                        <ul className="mt-3 space-y-2 text-sm text-white/72">
                          {building.bestFor.map((item) => (
                            <li key={item} className="flex gap-2">
                              <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-light)]"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="motif-spec text-[0.62rem] text-white/55">
                          Common choices
                        </h3>
                        <ul className="mt-3 space-y-2 text-sm text-white/72">
                          {building.optionHighlights.map((item) => (
                            <li key={item} className="flex gap-2">
                              <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-light)]"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {building.value === "storage_shed" ? (
                      <div className="mt-6 space-y-3 text-sm leading-6 text-white/68">
                        <p>
                          Comparing an 8x10 with a 10x12? Their footprints are 80
                          and 120 square feet. Sketch your equipment, shelving,
                          door opening, and walking space before choosing. Our{" "}
                          <Link
                            href="/news/san-antonio-shed-cost-guide"
                            className="underline decoration-white/40 underline-offset-4 hover:text-white"
                          >
                            shed size and cost guide
                          </Link>{" "}
                          explains the comparison and what to confirm in a quote.
                        </p>
                        <p>
                          Planning a backyard shed? Review our{" "}
                          <Link
                            href="/service-area/san-antonio"
                            className="underline decoration-white/40 underline-offset-4 hover:text-white"
                          >
                            San Antonio shed planning guide
                          </Link>{" "}
                          for local project examples, site access, and the steps
                          to confirm before build day.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-auto flex flex-wrap gap-3 pt-7">
                      <TrackedActionLink
                        href={`/quote?structureType=${building.value}`}
                        eventName="quote_cta_clicked"
                        eventProperties={{
                          location: "buildings_type",
                          buildingType: building.value,
                        }}
                        className="btn btn-primary btn-md text-sm"
                        aria-label={`Price ${building.quoteLabel}`}
                      >
                        Price this building
                      </TrackedActionLink>
                      {building.galleryProjectType ? (
                        <Link
                          href={galleryHref(building.galleryProjectType)}
                          className="btn btn-outline btn-md text-sm"
                          aria-label={`See ${building.title} projects`}
                        >
                          See real projects
                        </Link>
                      ) : null}
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        </Container>
      </section>

      {proofProjects.length > 0 ? (
        <section className="py-10 sm:py-14 lg:py-16" aria-labelledby="building-proof-heading">
          <Container>
            <div className="mx-auto max-w-6xl">
              <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="interior-kicker">Real Shed210 work</p>
                  <h2
                    id="building-proof-heading"
                    className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl"
                  >
                    See the choices in real backyards.
                  </h2>
                </div>
                <Link
                  href="/gallery"
                  className="brand-button text-sm text-[var(--accent-light)] hover:text-white"
                >
                  Browse the full gallery <span aria-hidden="true">→</span>
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {proofProjects.map((project, index) => {
                  const projectName = formatProjectName(project);
                  return (
                    <ProjectShowcaseCard
                      key={project.slug}
                      item={{
                        ...getProjectThumbnailImageProps(project.coverPhoto),
                        alt: project.coverPhoto.alt,
                        filename: project.coverPhoto.filename,
                        city: `${project.city}, TX`,
                        eyebrow: formatProjectInstallMonth(project.dateInstalled),
                        title: projectName,
                        badge: `${getProjectPhotoCount(project)} ${
                          getProjectPhotoCount(project) === 1 ? "photo" : "photos"
                        }`,
                        href: getProjectCardHref(project),
                        linkLabel: `View project details: ${projectName} in ${project.city}, Texas`,
                      }}
                      layout="grid"
                      itemCount={proofProjects.length}
                      priority={index === 0}
                      actionLabel="View project details"
                    />
                  );
                })}
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      <section className="pb-16 pt-8 sm:pb-20 lg:pb-24">
        <Container>
          <div className="interior-card mx-auto max-w-6xl px-6 py-9 sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-12">
            <div className="max-w-3xl">
              <p className="interior-kicker">Ready for a real number?</p>
              <h2 className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl">
                Build the quote around your property.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/65">
                Choose the building type, dimensions, materials, doors, windows,
                and build location. The instant result is an estimated build
                subtotal; travel and site costs are confirmed separately before
                a final quote.
              </p>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Before scheduling a San Antonio build, review the{" "}
                <Link
                  href="/news/sanantonio_shed_guide"
                  className="underline decoration-white/40 underline-offset-4 hover:text-white"
                >
                  shed permits and HOA planning guide
                </Link>
                . Confirm the requirements for your own address and design.
              </p>
            </div>
            <TrackedActionLink
              href="/quote"
              eventName="quote_cta_clicked"
              eventProperties={{ location: "buildings_footer" }}
              className="btn btn-primary btn-lg mt-6 shrink-0 gap-2 lg:mt-0"
            >
              Get Instant Price
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </TrackedActionLink>
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildingServicesJsonLd) }}
      />
    </main>
  );
}

export { galleryHref, selectProofProjects };
