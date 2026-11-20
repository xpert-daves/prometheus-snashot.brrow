import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import { resolveGalleryProjectType } from "@/lib/galleryProjects";
import { getProjectCardHref } from "@/lib/projectPresentation";

/** Compare known building types first, then other completed work in the city. */
export function selectRelatedProjects(
  current: Pick<PublicProjectSummary, "slug" | "citySlug" | "model">,
  projects: readonly PublicProjectSummary[]
): PublicProjectSummary[] {
  const currentType = resolveGalleryProjectType(current.model);
  const seen = new Set([getProjectCardHref(current)]);

  return projects
    .filter((project) => {
      const href = getProjectCardHref(project);
      if (
        project.slug === current.slug ||
        seen.has(href) ||
        !project.coverPhoto
      ) {
        return false;
      }
      seen.add(href);
      return true;
    })
    .map((project) => {
      const sameType = Boolean(
        currentType && resolveGalleryProjectType(project.model) === currentType
      );
      const sameCity = project.citySlug === current.citySlug;
      return {
        project,
        rank: sameType ? (sameCity ? 0 : 1) : sameCity ? 2 : 3,
      };
    })
    .filter(({ rank }) => rank < 3)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        right.project.dateInstalled - left.project.dateInstalled ||
        getProjectCardHref(left.project).localeCompare(
          getProjectCardHref(right.project)
        )
    )
    .slice(0, 3)
    .map(({ project }) => project);
}
