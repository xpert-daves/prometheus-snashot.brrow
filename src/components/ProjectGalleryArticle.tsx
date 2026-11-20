import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Images, MapPin } from "lucide-react";

import type { PublicGalleryProject } from "@/lib/crmProjects.server";
import {
  getProjectGalleryUrl,
  getProjectPhotoCount,
} from "@/lib/projectImages";
import { resolveGalleryProjectType } from "@/lib/galleryProjects";
import {
  formatProjectInstallMonth,
  formatProjectName,
  formatProjectPrice,
  orderProjectPhotosCoverFirst,
} from "@/lib/projectPresentation";

type ProjectGalleryArticleProps = {
  project: PublicGalleryProject;
  priority?: boolean;
};

export default function ProjectGalleryArticle({
  project,
  priority = false,
}: ProjectGalleryArticleProps) {
  const projectHref = `/projects/${project.citySlug}/${project.slug}`;
  const projectName = formatProjectName(project);
  const projectType = resolveGalleryProjectType(project.model) || project.model;
  const headingId = `project-${project.slug}-heading`;
  const orderedPhotos = orderProjectPhotosCoverFirst(project);
  const photoCount = getProjectPhotoCount(project);

  return (
    <article
      id={`project-${project.slug}`}
      aria-labelledby={headingId}
      className="interior-card overflow-hidden"
    >
      <header className="p-5 sm:p-6">
        <p className="motif-spec text-[0.62rem] text-[var(--accent-light)]">
          Project type · {projectType}
        </p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h3
              id={headingId}
              className="brand-subheading mb-0 text-xl text-white sm:text-2xl"
            >
              <Link
                href={projectHref}
                className="transition hover:text-[var(--accent-light)]"
              >
                {projectName}
              </Link>
            </h3>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/65">
              <Link
                href={`/service-area/${project.citySlug}`}
                className="inline-flex items-center gap-1.5 transition hover:text-white"
              >
                <MapPin
                  className="h-3.5 w-3.5 text-[var(--accent-light)]"
                  aria-hidden="true"
                />
                {project.city}, TX
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays
                  className="h-3.5 w-3.5 text-[var(--accent-light)]"
                  aria-hidden="true"
                />
                <time
                  dateTime={new Date(project.dateInstalled)
                    .toISOString()
                    .slice(0, 10)}
                >
                  {formatProjectInstallMonth(project.dateInstalled)}
                </time>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Images
                  className="h-3.5 w-3.5 text-[var(--accent-light)]"
                  aria-hidden="true"
                />
                {photoCount}{" "}
                {photoCount === 1 ? "photo" : "photos"}
              </span>
            </div>
          </div>
          {project.price !== undefined ? (
            <p className="brand-subheading text-lg text-white sm:text-right">
              {formatProjectPrice(project.price)}
            </p>
          ) : null}
        </div>
      </header>

      <ul
        className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6 sm:pb-6 lg:grid-cols-3"
        aria-label={`Photos of the ${projectName} project in ${project.city}`}
      >
        {orderedPhotos.map(({ photo, originalIndex }, orderedIndex) => (
          <li
            key={`${photo.filename}-${originalIndex}`}
            className={
              orderedIndex === 0 && orderedPhotos.length > 1
                ? "sm:col-span-2 lg:col-span-2"
                : undefined
            }
          >
            <Link
              href={projectHref}
              aria-label={`View project details: ${photo.alt}`}
              className="group block rounded-xl outline-none ring-amber-400/70 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <div
                className={
                  orderedIndex === 0 && orderedPhotos.length > 1
                    ? "relative aspect-[16/10] overflow-hidden rounded-xl bg-black"
                    : "relative aspect-[4/3] overflow-hidden rounded-xl bg-black"
                }
              >
                <Image
                  src={getProjectGalleryUrl(photo)}
                  alt={photo.alt}
                  data-filename={photo.filename}
                  fill
                  sizes={
                    orderedIndex === 0 && orderedPhotos.length > 1
                      ? "(max-width: 639px) calc(100vw - 72px), (max-width: 1279px) calc(100vw - 120px), 746px"
                      : "(max-width: 639px) calc(100vw - 72px), (max-width: 1023px) calc((100vw - 132px) / 2), 362px"
                  }
                  quality={75}
                  priority={priority && orderedIndex === 0}
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/8 px-5 py-4 sm:px-6">
        <Link
          href={projectHref}
          className="brand-button inline-flex items-center gap-2 text-xs text-[var(--accent-light)] transition hover:text-white"
        >
          View project details
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
