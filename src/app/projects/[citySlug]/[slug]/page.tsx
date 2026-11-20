import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import Container from "@/components/Container";
import ProjectCard from "@/components/ProjectCard";
import TrackedActionLink from "@/components/TrackedActionLink";
import { SITE_NAME } from "@/lib/contact";
import {
  getCrmProjectBySlug,
  listCrmProjects,
  type PublicProjectDetail,
} from "@/lib/crmProjects.server";
import {
  getProjectGalleryUrl,
  getProjectSocialPreviewUrl,
} from "@/lib/projectImages";
import {
  buildProjectDescription,
  formatProjectInstallDate,
  formatProjectName,
  formatProjectPrice,
  orderProjectPhotosCoverFirst,
  projectHasDedicatedPage,
} from "@/lib/projectPresentation";
import { getResolvedServiceArea } from "@/lib/crmProjectCities.server";
import { selectRelatedProjects } from "@/lib/relatedProjects";
import {
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildBusinessReferenceJsonLd,
  serializeJsonLd,
} from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

type ProjectParams = {
  citySlug: string;
  slug: string;
};

const getCachedProjectBySlug = cache(async (slug: string) =>
  getCrmProjectBySlug(slug)
);

const getRelatedProjectCandidates = cache(async () => {
  try {
    return await listCrmProjects();
  } catch {
    // Suggestions should not prevent viewing an otherwise available project.
    console.warn("Related project suggestions are temporarily unavailable.");
    return [];
  }
});

function requireDedicatedProject(
  project: PublicProjectDetail | null,
  citySlug: string
): PublicProjectDetail {
  if (
    !project ||
    project.citySlug !== citySlug ||
    !projectHasDedicatedPage(project)
  ) {
    notFound();
  }
  return project;
}

async function loadDedicatedProject({
  citySlug,
  slug,
}: ProjectParams): Promise<PublicProjectDetail> {
  if (
    slug.length > 240 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    notFound();
  }
  const project = await getCachedProjectBySlug(slug);
  return requireDedicatedProject(project, citySlug);
}

export async function generateStaticParams(): Promise<ProjectParams[]> {
  const projects = await listCrmProjects();
  return projects.map((project) => ({
    citySlug: project.citySlug,
    slug: project.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<ProjectParams>;
}): Promise<Metadata> {
  const routeParams = await params;
  const project = await loadDedicatedProject(routeParams);
  const projectServiceArea = await getResolvedServiceArea(project.citySlug);
  const regionCode = projectServiceArea?.regionCode ?? "TX";
  const title = `${formatProjectName(project)} in ${project.city}, ${regionCode} | Shed210`;
  const description = buildProjectDescription(project);
  const canonicalPath = `/projects/${project.citySlug}/${project.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(canonicalPath),
      images: [
        {
          url: getProjectSocialPreviewUrl(project.coverPhoto),
          alt: project.coverPhoto.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [getProjectSocialPreviewUrl(project.coverPhoto)],
    },
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<ProjectParams>;
}) {
  const routeParams = await params;
  const project = await loadDedicatedProject(routeParams);
  const canonicalPath = `/projects/${project.citySlug}/${project.slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const projectName = formatProjectName(project);
  const [projectServiceArea, relatedCandidates] = await Promise.all([
    getResolvedServiceArea(project.citySlug),
    getRelatedProjectCandidates(),
  ]);
  const relatedProjects = selectRelatedProjects(project, relatedCandidates);
  const regionCode = projectServiceArea?.regionCode ?? "TX";
  const regionName = projectServiceArea?.regionName ?? "Texas";
  const orderedPhotos = orderProjectPhotosCoverFirst(project);
  const remainingPhotos = orderedPhotos
    .slice(1)
    .map(({ photo }) => photo);
  const description = buildProjectDescription(project);
  const projectStory = project.blurb?.trim() || description;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Gallery", path: "/gallery" },
    {
      name: `${projectName} in ${project.city}`,
      path: canonicalPath,
    },
  ]);
  const projectJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${projectName} in ${project.city}, ${regionName}`,
    description,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    creator: buildBusinessReferenceJsonLd(),
    isPartOf: {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    dateCreated: new Date(project.dateInstalled).toISOString().slice(0, 10),
    contentLocation: {
      "@type": "City",
      name: project.city,
      containedInPlace: {
        "@type": "State",
        name: regionName,
      },
    },
    image: orderedPhotos.map(({ photo }) => ({
      "@type": "ImageObject",
      name: photo.filename,
      caption: photo.alt,
      contentUrl: getProjectSocialPreviewUrl(photo),
    })),
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      className="interior-page pb-16 pt-8 font-sans text-white sm:pt-12 lg:pt-16"
    >
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/60">
          <Link
            href="/"
            className="underline decoration-white/35 underline-offset-2 transition hover:text-white"
          >
            Home
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <Link
            href="/gallery"
            className="underline decoration-white/35 underline-offset-2 transition hover:text-white"
          >
            Gallery
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-white/80">
            {projectName}
          </span>
        </nav>

        <article>
          <header className="interior-hero overflow-hidden">
            <div className="relative aspect-[16/10] min-h-[22rem] w-full sm:aspect-[16/9] lg:min-h-[36rem]">
              <Image
                src={getProjectGalleryUrl(project.coverPhoto)}
                alt={project.coverPhoto.alt}
                data-filename={project.coverPhoto.filename}
                fill
                sizes="(max-width: 767px) 100vw, (max-width: 1279px) calc(100vw - 64px), 1200px"
                quality={75}
                priority
                fetchPriority="high"
                loading="eager"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/92 via-black/28 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-9 lg:p-12">
                <p className="interior-kicker">Completed Shed210 build</p>
                <h1 className="brand-heading mb-0 mt-4 max-w-4xl text-4xl text-white sm:text-5xl lg:text-7xl">
                  {projectName}
                </h1>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/75">
                  {projectServiceArea ? (
                    <Link
                      href={`/service-area/${project.citySlug}`}
                      className="inline-flex items-center gap-2 transition hover:text-white"
                    >
                      <MapPin
                        className="h-4 w-4 text-[var(--accent-light)]"
                        aria-hidden="true"
                      />
                      {project.city}, {regionCode}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <MapPin
                        className="h-4 w-4 text-[var(--accent-light)]"
                        aria-hidden="true"
                      />
                      {project.city}, {regionCode}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays
                      className="h-4 w-4 text-[var(--accent-light)]"
                      aria-hidden="true"
                    />
                    <time
                      dateTime={new Date(project.dateInstalled)
                        .toISOString()
                        .slice(0, 10)}
                    >
                      Built {formatProjectInstallDate(project.dateInstalled)}
                    </time>
                  </span>
                </div>
                {project.price !== undefined ? (
                  <div className="mt-5">
                    <p className="text-xs text-white/70">Recorded build price</p>
                    <p className="brand-subheading mt-1 text-2xl text-white">
                      {formatProjectPrice(project.price)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mx-auto mt-6 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="interior-card p-6 sm:p-8">
              <p className="interior-kicker">Project details</p>
              <h2 className="brand-subheading mb-0 mt-4 text-2xl text-white">
                Built for a {project.city} backyard
              </h2>
              <p className="mt-5 whitespace-pre-line text-base leading-8 text-white/72">
                {projectStory}
              </p>
              {project.price !== undefined ? (
                <p className="mt-4 text-sm leading-6 text-white/62">
                  The recorded price is for this build completed on{" "}
                  {formatProjectInstallDate(project.dateInstalled)}. Request a
                  current quote for your size, options, and site; travel and site
                  costs are confirmed separately.
                </p>
              ) : null}
            </section>

            <aside className="interior-card p-6">
              <p className="motif-spec text-[0.62rem] text-[var(--accent-light)]">
                Plan your own build
              </p>
              <h2 className="brand-subheading mb-0 mt-3 text-xl text-white">
                Get a clear shed price
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Choose a size, structure, materials, and build ZIP to see
                current Shed210 pricing.
              </p>
              <TrackedActionLink
                href="/quote"
                eventName="quote_cta_clicked"
                eventProperties={{
                  location: "project_detail",
                  project: project.slug,
                }}
                className="btn btn-primary btn-md mt-5 w-full gap-2 text-sm"
              >
                Get an instant price
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </TrackedActionLink>
              <Link
                href="/buildings"
                className="btn btn-outline btn-md mt-3 w-full text-sm"
              >
                Compare building types
              </Link>
              {projectServiceArea ? (
                <Link
                  href={`/service-area/${project.citySlug}`}
                  className="btn btn-outline btn-md mt-3 w-full text-sm"
                >
                  Sheds in {project.city}
                </Link>
              ) : null}
            </aside>
          </div>

          {remainingPhotos.length > 0 ? (
            <section
              className="mx-auto mt-6 max-w-6xl"
              aria-labelledby="project-photos-heading"
            >
              <div className="mb-5">
                <p className="interior-kicker">Build gallery</p>
                <h2
                  id="project-photos-heading"
                  className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl"
                >
                  More project photos
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {remainingPhotos.map((photo) => (
                  <figure
                    key={photo.filename}
                    className="interior-card-soft overflow-hidden"
                  >
                    <div className="relative aspect-[4/3] bg-black">
                      <Image
                        src={getProjectGalleryUrl(photo)}
                        alt={photo.alt}
                        data-filename={photo.filename}
                        fill
                        sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1279px) calc((100vw - 80px) / 2), 568px"
                        quality={75}
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="p-4 text-sm leading-6 text-white/62">
                      {photo.alt}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        {relatedProjects.length > 0 ? (
          <section
            className="mx-auto mt-12 max-w-6xl"
            aria-labelledby="related-projects-heading"
          >
            <p className="interior-kicker">Compare completed builds</p>
            <h2
              id="related-projects-heading"
              className="brand-heading mb-0 mt-4 text-3xl text-white sm:text-4xl"
            >
              More projects to compare
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/65">
              Compare footprints, finishes, and project photos. These examples
              share a building type or city with this build; each has its own
              recorded scope and date.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProjects.map((relatedProject) => (
                <ProjectCard
                  key={`${relatedProject.citySlug}/${relatedProject.slug}`}
                  project={relatedProject}
                />
              ))}
            </div>
          </section>
        ) : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(projectJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      </Container>
    </main>
  );
}

export { requireDedicatedProject };
