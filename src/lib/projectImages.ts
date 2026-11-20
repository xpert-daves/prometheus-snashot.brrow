import type {
  PublicProjectPhoto,
  PublicProjectSummary,
} from "@/lib/crmProjects.server";

export function getProjectThumbnailUrl(photo: PublicProjectPhoto): string {
  return photo.thumbnailUrl ?? photo.url;
}

export function getProjectThumbnailImageProps(photo: PublicProjectPhoto): {
  src: string;
  unoptimized: boolean;
  fallbackSrc?: string;
} {
  // Complete V3 photos have ready-made WebP thumbnails (at most 800px). Use one
  // allowed Next Image width/quality for these instead of generating a separate
  // variant per card layout. The same-origin optimizer retains public caching
  // and indexability; direct Convex storage responses carry a noindex header.
  // Legacy originals and larger gallery images keep responsive downscaling.
  const hasReadyDerivatives = Boolean(
    photo.thumbnailUrl &&
      photo.galleryUrl &&
      photo.socialPreviewUrl &&
      photo.thumbnailUrl !== photo.url &&
      photo.thumbnailUrl !== photo.galleryUrl &&
      typeof photo.width === "number" &&
      Number.isInteger(photo.width) &&
      photo.width > 0 &&
      photo.width <= 1920 &&
      typeof photo.height === "number" &&
      Number.isInteger(photo.height) &&
      photo.height > 0 &&
      photo.height <= 1920
  );
  const src = getProjectThumbnailUrl(photo);
  return {
    src: hasReadyDerivatives
      ? `/_next/image?url=${encodeURIComponent(src)}&w=828&q=60`
      : src,
    // The source above is already an optimizer URL; don't optimize it again.
    unoptimized: hasReadyDerivatives,
    // Only the bounded V3 thumbnail may bypass a failed optimizer request.
    ...(hasReadyDerivatives ? { fallbackSrc: src } : {}),
  };
}

export function getProjectGalleryUrl(photo: PublicProjectPhoto): string {
  return photo.galleryUrl ?? photo.url;
}

export function getProjectSocialPreviewUrl(photo: PublicProjectPhoto): string {
  return photo.socialPreviewUrl ?? getProjectGalleryUrl(photo);
}

export function getProjectPhotoCount(
  project: Pick<PublicProjectSummary, "photoCount"> & {
    photos?: readonly PublicProjectPhoto[];
  }
): number {
  return project.photoCount ?? project.photos?.length ?? 1;
}
