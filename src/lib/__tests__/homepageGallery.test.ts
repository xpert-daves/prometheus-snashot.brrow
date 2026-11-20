import type {
  PublicGalleryProject,
  PublicProjectPhoto,
} from "@/lib/crmProjects.server";
import {
  HOMEPAGE_MULTI_PROJECT_LIMIT,
  HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT,
  selectHomepageGalleryPhotos,
} from "@/lib/homepageGallery";

function buildPhoto(
  projectSlug: string,
  photoNumber: number
): PublicProjectPhoto {
  return {
    url: `https://youthful-horse-290.convex.cloud/api/storage/${projectSlug}-${photoNumber}`,
    alt: `${projectSlug} photo ${photoNumber}`,
    filename: `${projectSlug}-${photoNumber}.jpg`,
  };
}

function buildProject(
  slug: string,
  dateInstalled: number,
  photoCount = 4,
  coverPhotoIndex = 0
): PublicGalleryProject {
  const photos = Array.from({ length: photoCount }, (_, index) =>
    buildPhoto(slug, index + 1)
  );

  return {
    slug,
    city: "San Antonio",
    citySlug: "san-antonio",
    model: "Garden Shed",
    size: "10x12",
    dateInstalled,
    coverPhoto: photos[coverPhotoIndex],
    dedicatedPageEligible: true,
    photos,
    coverPhotoIndex,
  };
}

describe("selectHomepageGalleryPhotos", () => {
  it("returns no tiles when there are no published projects", () => {
    expect(selectHomepageGalleryPhotos([])).toEqual([]);
  });

  it("uses up to three distinct photos from a lone project in cover-first order", () => {
    const project = buildProject("only-project", 100, 4, 2);

    const selections = selectHomepageGalleryPhotos([project]);

    expect(selections).toHaveLength(HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT);
    expect(
      selections.map(({ photo, originalIndex, isCover }) => ({
        filename: photo.filename,
        originalIndex,
        isCover,
      }))
    ).toEqual([
      {
        filename: "only-project-3.jpg",
        originalIndex: 2,
        isCover: true,
      },
      {
        filename: "only-project-1.jpg",
        originalIndex: 0,
        isCover: false,
      },
      {
        filename: "only-project-2.jpg",
        originalIndex: 1,
        isCover: false,
      },
    ]);
    expect(selections.every((selection) => selection.project === project)).toBe(
      true
    );
  });

  it("does not repeat the same photo URL from a lone project", () => {
    const project = buildProject("duplicate-photo", 100, 3, 1);
    project.photos[2] = project.photos[0];

    const selections = selectHomepageGalleryPhotos([project]);

    expect(selections.map(({ originalIndex }) => originalIndex)).toEqual([1, 0]);
    expect(new Set(selections.map(({ photo }) => photo.url)).size).toBe(2);
  });

  it("uses one cover from each of two projects", () => {
    const older = buildProject("older", 100, 4, 1);
    const newer = buildProject("newer", 200, 4, 2);

    const selections = selectHomepageGalleryPhotos([older, newer]);

    expect(
      selections.map(({ project, photo, originalIndex, isCover }) => ({
        slug: project.slug,
        filename: photo.filename,
        originalIndex,
        isCover,
      }))
    ).toEqual([
      {
        slug: "newer",
        filename: "newer-3.jpg",
        originalIndex: 2,
        isCover: true,
      },
      {
        slug: "older",
        filename: "older-2.jpg",
        originalIndex: 1,
        isCover: true,
      },
    ]);
  });

  it("treats repeated records with the same slug as one project", () => {
    const olderRecord = buildProject("repeated-project", 100, 4, 0);
    const newestRecord = buildProject("repeated-project", 200, 4, 2);

    const selections = selectHomepageGalleryPhotos([
      olderRecord,
      newestRecord,
    ]);

    expect(selections).toHaveLength(HOMEPAGE_SINGLE_PROJECT_PHOTO_LIMIT);
    expect(selections.every(({ project }) => project === newestRecord)).toBe(
      true
    );
    expect(selections.map(({ originalIndex }) => originalIndex)).toEqual([
      2, 0, 1,
    ]);
  });

  it("uses one cover from each of four projects in newest-first order", () => {
    const projects = [
      buildProject("oldest", 100, 4, 1),
      buildProject("newest", 400, 4, 2),
      buildProject("third-newest", 200, 4, 3),
      buildProject("second-newest", 300, 4, 1),
    ];

    const selections = selectHomepageGalleryPhotos(projects);

    expect(
      selections.map(({ project, photo, originalIndex, isCover }) => ({
        slug: project.slug,
        filename: photo.filename,
        originalIndex,
        isCover,
      }))
    ).toEqual([
      {
        slug: "newest",
        filename: "newest-3.jpg",
        originalIndex: 2,
        isCover: true,
      },
      {
        slug: "second-newest",
        filename: "second-newest-2.jpg",
        originalIndex: 1,
        isCover: true,
      },
      {
        slug: "third-newest",
        filename: "third-newest-4.jpg",
        originalIndex: 3,
        isCover: true,
      },
      {
        slug: "oldest",
        filename: "oldest-2.jpg",
        originalIndex: 1,
        isCover: true,
      },
    ]);
  });

  it("shows all six distinct projects when six are available", () => {
    const projects = Array.from(
      { length: HOMEPAGE_MULTI_PROJECT_LIMIT },
      (_, index) =>
        buildProject(`project-${index + 1}`, index + 1, 4, index % 4)
    );

    const selections = selectHomepageGalleryPhotos(projects);

    expect(selections).toHaveLength(HOMEPAGE_MULTI_PROJECT_LIMIT);
    expect(selections.map(({ project }) => project.slug)).toEqual([
      "project-6",
      "project-5",
      "project-4",
      "project-3",
      "project-2",
      "project-1",
    ]);
    expect(new Set(selections.map(({ project }) => project.slug)).size).toBe(
      HOMEPAGE_MULTI_PROJECT_LIMIT
    );
    expect(
      selections.every(
        ({ project, photo, originalIndex, isCover }) =>
          photo === project.photos[project.coverPhotoIndex] &&
          originalIndex === project.coverPhotoIndex &&
          isCover
      )
    ).toBe(true);
  });

  it("limits seven or more inputs to the six newest distinct project covers", () => {
    const duplicateNewest = buildProject("project-8", 900, 4, 3);
    const projects = [
      buildProject("project-1", 100, 4, 0),
      buildProject("project-8", 800, 4, 2),
      buildProject("project-3", 300, 4, 2),
      buildProject("project-7", 700, 4, 1),
      buildProject("project-2", 200, 4, 1),
      duplicateNewest,
      buildProject("project-6", 600, 4, 0),
      buildProject("project-5", 500, 4, 3),
      buildProject("project-4", 400, 4, 2),
    ];
    const originalOrder = [...projects];

    const selections = selectHomepageGalleryPhotos(projects);

    expect(selections).toHaveLength(HOMEPAGE_MULTI_PROJECT_LIMIT);
    expect(selections.map(({ project }) => project.slug)).toEqual([
      "project-8",
      "project-7",
      "project-6",
      "project-5",
      "project-4",
      "project-3",
    ]);
    expect(selections[0].project).toBe(duplicateNewest);
    expect(new Set(selections.map(({ project }) => project.slug)).size).toBe(
      HOMEPAGE_MULTI_PROJECT_LIMIT
    );
    expect(
      selections.every(
        ({ project, photo, originalIndex, isCover }) =>
          photo === project.photos[project.coverPhotoIndex] &&
          originalIndex === project.coverPhotoIndex &&
          isCover
      )
    ).toBe(true);
    expect(projects).toEqual(originalOrder);
  });

  it("preserves input order between projects with the same installation date", () => {
    const projects = [
      buildProject("first-tie", 300, 4, 0),
      buildProject("older", 200, 4, 1),
      buildProject("second-tie", 300, 4, 2),
      buildProject("third-tie", 300, 4, 3),
    ];

    const selections = selectHomepageGalleryPhotos(projects);

    expect(selections.map(({ project }) => project.slug)).toEqual([
      "first-tie",
      "second-tie",
      "third-tie",
      "older",
    ]);
  });

  it("leaves the input project order unchanged while choosing newest projects", () => {
    const older = buildProject("older", 100);
    const newer = buildProject("newer", 200);
    const projects = [older, newer];

    selectHomepageGalleryPhotos(projects);

    expect(projects).toEqual([older, newer]);
  });

  it("leads with storage within the recent selection without losing other project types or their details", () => {
    const doghouse = { ...buildProject("doghouse", 400), model: "Deluxe Doggie House" };
    const greenhouse = { ...buildProject("greenhouse", 300), model: "Greenhouse" };
    const storage = { ...buildProject("storage", 200, 4, 2), model: "Storage Shed", city: "Boerne", citySlug: "boerne" };
    const carport = { ...buildProject("carport", 100), model: "Carport" };
    const input = [doghouse, greenhouse, storage, carport];

    const selected = selectHomepageGalleryPhotos(input);

    expect(selected.map(({ project }) => project)).toEqual([storage, doghouse, greenhouse, carport]);
    expect(selected[0]).toMatchObject({ photo: storage.photos[2], originalIndex: 2, isCover: true });
    expect(selected[0].project.city).toBe("Boerne");
    expect(input).toEqual([doghouse, greenhouse, storage, carport]);
  });

  it("keeps the six newest projects when storage is only present in older work", () => {
    const recent = Array.from({ length: 6 }, (_, index) => ({
      ...buildProject(`greenhouse-${index}`, index + 2), model: "Greenhouse",
    }));
    const oldStorage = buildProject("old-storage", 1);

    expect(selectHomepageGalleryPhotos([oldStorage, ...recent]).map(({ project }) => project.slug))
      .toEqual([...recent].reverse().map(({ slug }) => slug));
  });
});
