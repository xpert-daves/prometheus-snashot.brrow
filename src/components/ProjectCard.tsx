import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import { getProjectThumbnailImageProps } from "@/lib/projectImages";
import ProjectThumbnailImage from "@/components/ProjectThumbnailImage";
import { resolveGalleryProjectType } from "@/lib/galleryProjects";
import {
  formatProjectInstallMonth,
  formatProjectName,
  formatProjectPrice,
  getProjectCardHref,
} from "@/lib/projectPresentation";

type ProjectCardProps = {
  project: PublicProjectSummary;
  priority?: boolean;
};

export default function ProjectCard({
  project,
  priority = false,
}: ProjectCardProps) {
  const projectHref = getProjectCardHref(project);
  const projectName = formatProjectName(project);
  const projectType = resolveGalleryProjectType(project.model) || project.model;
  const coverImage = (
    <div className="relative aspect-[4/3] overflow-hidden bg-black">
      <ProjectThumbnailImage
        {...getProjectThumbnailImageProps(project.coverPhoto)}
        alt={project.coverPhoto.alt}
        data-filename={project.coverPhoto.filename}
        fill
        sizes="(max-width: 639px) calc(100vw - 72px), (max-width: 1023px) calc((100vw - 112px) / 2), 300px"
        quality={75}
        priority={priority}
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    </div>
  );

  return (
    <article
      id={`project-${project.slug}`}
      className="interior-card-soft group overflow-hidden"
    >
      <Link
        href={projectHref}
        aria-label={`View ${projectName} built in ${project.city}`}
        className="block"
      >
        {coverImage}
      </Link>

      <div className="p-5">
        <p className="motif-spec text-[0.62rem] text-[var(--accent-light)]">
          Project type · {projectType}
        </p>
        <h3 className="brand-subheading mb-0 mt-2 text-lg text-white">
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
            <MapPin className="h-3.5 w-3.5 text-[var(--accent-light)]" aria-hidden="true" />
            {project.city}, TX
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays
              className="h-3.5 w-3.5 text-[var(--accent-light)]"
              aria-hidden="true"
            />
            <time dateTime={new Date(project.dateInstalled).toISOString().slice(0, 10)}>
              {formatProjectInstallMonth(project.dateInstalled)}
            </time>
          </span>
        </div>

        {project.price !== undefined ? (
          <div className="mt-4">
            <p className="text-xs text-white/60">Recorded build price</p>
            <p className="brand-subheading mt-1 text-base text-white">
              {formatProjectPrice(project.price)}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Request a current quote for your size and site.
            </p>
          </div>
        ) : null}

        <Link
          href={projectHref}
          className="brand-button mt-4 inline-flex items-center gap-2 text-xs text-[var(--accent-light)] transition hover:text-white"
        >
          View project details
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
