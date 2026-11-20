import type { PublicGalleryProject } from "@/lib/crmProjects.server";
import {
  buildGalleryCityOptions,
  buildGalleryProjectTypeOptions,
  filterGalleryProjects,
  findCanonicalGalleryProjectType,
  GALLERY_PROJECT_TYPES,
  resolveGalleryProjectType,
  selectNearbyGalleryProjects,
} from "@/lib/galleryProjects";

function buildProject(
  slug: string,
  city: string,
  citySlug: string,
  model: string,
  dateInstalled: number
): PublicGalleryProject {
  const coverPhoto = {
    url: `https://youthful-horse-290.convex.cloud/api/storage/${slug}`,
    alt: `${model} in ${city}`,
    filename: `${slug}-tx-1.jpg`,
  };
  return {
    slug,
    city,
    citySlug,
    model,
    size: "10x12",
    dateInstalled,
    coverPhoto,
    dedicatedPageEligible: true,
    photos: [coverPhoto],
    coverPhotoIndex: 0,
  };
}

const projects = [
  buildProject(
    "garden-shed-san-antonio",
    "San Antonio",
    "san-antonio",
    "Storage Shed",
    300
  ),
  buildProject(
    "utility-shed-schertz",
    "Schertz",
    "schertz",
    "Greenhouse",
    200
  ),
  buildProject(
    "garden-shed-cibolo",
    "Cibolo",
    "cibolo",
    "Custom Doggie House",
    100
  ),
];

describe("gallery project filtering", () => {
  it.each([
    ["Storage Shed", "Storage & Utility"],
    ["Side Utility", "Storage & Utility"],
    ["Side Utility Shed", "Storage & Utility"],
    ["Utility Shed", "Storage & Utility"],
    ["Shed", "Storage & Utility"],
    ["Barn Style Portable Building", "Storage & Utility"],
    ["Heavy-Duty Portable Building", "Storage & Utility"],
    ["Portable Buildings", "Storage & Utility"],
    ["Carport", "Carport"],
    ["Greenhouse", "Greenhouse"],
    ["Green House", "Greenhouse"],
    ["green-house", "Greenhouse"],
    [" GREEN  HOUSE ", "Greenhouse"],
    ["Doggie House", "Animal Shelter"],
    ["Custom Doggie House", "Animal Shelter"],
    ["Deluxe Doggie House", "Animal Shelter"],
    ["Walk-In Doghouse & Watershed", "Animal Shelter"],
    ["Water Well Shed", "Well House"],
      ["Water Well Shelter", "Well House"],
      ["Mobile Office", "Office & Workspace"],
      ["Slanted Roof Utility", "Office & Workspace"],
      ["Slanted-Roof Game Room", "Office & Workspace"],
  ])("maps the legacy %s model to %s", (model, expectedProjectType) => {
    expect(resolveGalleryProjectType(model)).toBe(expectedProjectType);
  });

  it("maps controlled types and legacy model aliases before filtering", () => {
    expect(
      findCanonicalGalleryProjectType("side utility")
    ).toBe("Storage & Utility");
    expect(resolveGalleryProjectType("Water Well Shelter")).toBe(
      "Well House"
    );
    expect(resolveGalleryProjectType("Mobile Office")).toBe(
      "Office & Workspace"
    );
    expect(
      filterGalleryProjects(projects, "cibolo", "ANIMAL SHELTER").map(
        (project) => project.slug
      )
    ).toEqual(["garden-shed-cibolo"]);
  });

  it("includes two-word Green House models in the Greenhouse filter and count", () => {
    const withGreenHouse = [
      ...projects,
      buildProject(
        "10x12x8-green-house-san-antonio",
        "San Antonio",
        "san-antonio",
        "Green House",
        400
      ),
    ];

    expect(
      filterGalleryProjects(withGreenHouse, "", "Greenhouse").map(
        (project) => project.slug
      )
    ).toEqual(["utility-shed-schertz", "10x12x8-green-house-san-antonio"]);
    expect(
      buildGalleryProjectTypeOptions(withGreenHouse, "").find(
        (option) => option.projectType === "Greenhouse"
      )
    ).toEqual({ projectType: "Greenhouse", count: 2 });
  });

  it("computes option counts against the other active filter", () => {
    expect(
      buildGalleryCityOptions(
        projects,
        [
          { city: "San Antonio", slug: "san-antonio" },
          { city: "Schertz", slug: "schertz" },
          { city: "Boerne", slug: "boerne" },
        ],
        "Greenhouse"
      )
    ).toEqual([
      { city: "San Antonio", slug: "san-antonio", count: 0 },
      { city: "Schertz", slug: "schertz", count: 1 },
      { city: "Boerne", slug: "boerne", count: 0 },
    ]);
    expect(
      buildGalleryProjectTypeOptions(projects, "schertz")
    ).toEqual([
      { projectType: "Storage & Utility", count: 0 },
      { projectType: "Carport", count: 0 },
      { projectType: "Greenhouse", count: 1 },
      { projectType: "Animal Shelter", count: 0 },
      { projectType: "Well House", count: 0 },
      { projectType: "Office & Workspace", count: 0 },
    ]);
    expect(GALLERY_PROJECT_TYPES).toHaveLength(6);
  });

  it("prefers the requested project type nearby and widens only when needed", () => {
    const area = { nearbySlugs: ["schertz", "san-antonio"] };

    const exactModel = selectNearbyGalleryProjects(
      projects,
      area,
      "Greenhouse"
    );
    expect(exactModel.projects.map((project) => project.citySlug)).toEqual([
      "schertz",
    ]);
    expect(exactModel.relaxedProjectType).toBe(false);

    const widened = selectNearbyGalleryProjects(
      projects,
      area,
      "Well House"
    );
    expect(widened.projects.map((project) => project.citySlug)).toEqual([
      "schertz",
      "san-antonio",
    ]);
    expect(widened.relaxedProjectType).toBe(true);
    expect(widened.serviceAreaWide).toBe(false);
  });
});
