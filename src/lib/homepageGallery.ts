import type {
  PublicGalleryProject,
  PublicProjectPhoto,
} from "@/lib/crmProjects.server";
import { getProjectThumbnailUrl } from "@/lib/projectImages";
import { orderProjectPhotosCoverFirst } from "@/lib/projectPresentation";
import { prioritizeStorageProject } from "@/lib/projectProof";

export const HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT = 3;
export const HOMEPAGE_MULTI_PROJECT_LIMIT = 6;

export type HomepageGallerySelection = {
  project: PublicGalleryProject;
  photo: PublicProjectPhoto;
  originalIndex: number;
  isCover: boolean;
};

function toHomepageSelection(
  project: PublicGalleryProject,
  photo: PublicProjectPhoto,
  originalIndex: number
): HomepageGallerySelection {
  return {
    project,
    photo,
    originalIndex,
    isCover: originalIndex === project.coverPhotoIndex,
  };
}

export function selectHomepageGalleryPhotos(
  projects: readonly PublicGalleryProject[]
): HomepageGallerySelection[] {
  if (projects.length === 0) return [];

  const newestProjects = projects
    .map((project, inputIndex) => ({ project, inputIndex }))
    .sort(
      (left, right) =>
        right.project.dateInstalled - left.project.dateInstalled ||
        left.inputIndex - right.inputIndex
    )
    .map(({ project }) => project);
  const seenProjectSlugs = new Set<string>();
  const newestDistinctProjects = newestProjects.filter((project) => {
    if (seenProjectSlugs.has(project.slug)) return false;
    seenProjectSlugs.add(project.slug);
    return true;
  });

  if (newestDistinctProjects.length > 1) {
    return prioritizeStorageProject(
      newestDistinctProjects.slice(0, HOMEPAGE_MULTI_PROJECT_LIMIT)
    )
      .map((project) =>
        toHomepageSelection(
          project,
          project.photos[project.coverPhotoIndex],
          project.coverPhotoIndex
        )
      );
  }

  const [project] = newestDistinctProjects;
  const seenPhotoUrls = new Set<string>();
  return orderProjectPhotosCoverFirst(project)
    .filter(({ photo }) => {
      const thumbnailUrl = getProjectThumbnailUrl(photo);
      if (seenPhotoUrls.has(thumbnailUrl)) return false;
      seenPhotoUrls.add(thumbnailUrl);
      return true;
    })
    .slice(0, HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT)
    .map(({ photo, originalIndex }) =>
      toHomepageSelection(project, photo, originalIndex)
    );
}
