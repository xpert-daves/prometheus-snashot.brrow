import Link from "next/link";
import { ArrowRight } from "lucide-react";

import ProjectCard from "@/components/ProjectCard";
import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import { buildProjectItemListJsonLd } from "@/lib/projectPresentation";
import { serializeJsonLd } from "@/lib/seo";

const RECENT_INSTALL_LIMIT = 6;

type RecentInstallsProps = {
  city: string;
  citySlug: string;
  projects: readonly PublicProjectSummary[];
};

export default function RecentInstalls({
  city,
  citySlug,
  projects,
}: RecentInstallsProps) {
  const visibleProjects = projects.slice(0, RECENT_INSTALL_LIMIT);
  if (visibleProjects.length === 0) return null;

  const itemListJsonLd = buildProjectItemListJsonLd(
    visibleProjects,
    `Recent Shed210 builds in ${city}, Texas`
  );

  return (
    <section
      className="interior-card mt-5 p-5 sm:p-7"
      aria-labelledby={`${citySlug}-recent-installs-heading`}
    >
      <p className="interior-kicker">Real local builds</p>
      <h2
        id={`${citySlug}-recent-installs-heading`}
        className="brand-subheading mb-0 mt-4 text-xl text-white sm:text-2xl"
      >
        Recent builds in {city}
      </h2>
      <p className="mt-3 max-w-3xl leading-7 text-white/62">
        Browse recently completed Shed210 projects using customer-safe city-level
        details. Customer street addresses are never published.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.slug}
            project={project}
          />
        ))}
      </div>

      {projects.length > RECENT_INSTALL_LIMIT ? (
        <div className="mt-5">
          <Link
            href={`/gallery?city=${encodeURIComponent(citySlug)}`}
            className="brand-button inline-flex items-center gap-2 text-sm text-[var(--accent-light)] transition hover:text-white"
          >
            View all {city} builds
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
    </section>
  );
}

export { RECENT_INSTALL_LIMIT };
