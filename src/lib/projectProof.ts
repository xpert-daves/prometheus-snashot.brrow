import type { PublicGalleryProject } from "@/lib/crmProjects.server";
import { resolveGalleryProjectType } from "@/lib/galleryProjects";

/** Lead with storage proof while preserving the supplied order and other types. */
export function prioritizeStorageProject(
  projects: readonly PublicGalleryProject[]
): PublicGalleryProject[] {
  const storageIndex = projects.findIndex(
    (project) => resolveGalleryProjectType(project.model) === "Storage & Utility"
  );
  if (storageIndex <= 0) return [...projects];

  return [
    projects[storageIndex],
    ...projects.slice(0, storageIndex),
    ...projects.slice(storageIndex + 1),
  ];
}
