import type { PublicGalleryProject } from "@/lib/crmProjects.server";
import type { ServiceArea } from "@/lib/serviceAreas";

export type GalleryCityOption = {
  slug: string;
  city: string;
  count: number;
};

export const GALLERY_PROJECT_TYPES = [
  "Storage & Utility",
  "Carport",
  "Greenhouse",
  "Animal Shelter",
  "Well House",
  "Office & Workspace",
] as const;

export type GalleryProjectType = (typeof GALLERY_PROJECT_TYPES)[number];

export type GalleryProjectTypeOption = {
  projectType: GalleryProjectType;
  count: number;
};

export type NearbyGallerySelection = {
  projects: PublicGalleryProject[];
  relaxedProjectType: boolean;
  serviceAreaWide: boolean;
};

/** Ignore case, spaces, and hyphens so "Green House" and "green-house" match "Greenhouse". */
function normalizeProjectTypeLookup(value: string): string {
  return value.replace(/[\s-]+/g, "").toLocaleLowerCase("en-US");
}

const PROJECT_TYPE_ALIAS_ENTRIES: ReadonlyArray<
  readonly [string, GalleryProjectType]
> = [
  ["Storage & Utility", "Storage & Utility"],
  ["Storage Shed", "Storage & Utility"],
  ["Side Utility", "Storage & Utility"],
  ["Side Utility Shed", "Storage & Utility"],
  ["Utility Shed", "Storage & Utility"],
  ["Utility", "Storage & Utility"],
  ["Shed", "Storage & Utility"],
  ["Sheds", "Storage & Utility"],
  ["Garden Shed", "Storage & Utility"],
  ["Barn Style Portable Building", "Storage & Utility"],
  ["Barn Style Shed", "Storage & Utility"],
  ["Lofted Barn", "Storage & Utility"],
  ["Heavy-Duty Portable Building", "Storage & Utility"],
  ["Heavy-Duty Shed", "Storage & Utility"],
  ["Portable Buildings", "Storage & Utility"],
  ["Carport", "Carport"],
  ["Greenhouse", "Greenhouse"],
  ["Animal Shelter", "Animal Shelter"],
  ["Doggie House", "Animal Shelter"],
  ["Custom Doggie House", "Animal Shelter"],
  ["Deluxe Doggie House", "Animal Shelter"],
  ["Walk-In Doghouse & Watershed", "Animal Shelter"],
  ["Well House", "Well House"],
  ["Water Well Shed", "Well House"],
  ["Water Well Shelter", "Well House"],
  ["Office & Workspace", "Office & Workspace"],
  ["Mobile Office", "Office & Workspace"],
  ["Slanted Roof Utility", "Office & Workspace"],
  ["Slanted-Roof Game Room", "Office & Workspace"],
];

const PROJECT_TYPE_ALIASES = new Map<string, GalleryProjectType>(
  PROJECT_TYPE_ALIAS_ENTRIES.map(
    ([alias, projectType]) =>
      [normalizeProjectTypeLookup(alias), projectType] as const
  )
);

export function resolveGalleryProjectType(
  value: string
): GalleryProjectType | "" {
  return PROJECT_TYPE_ALIASES.get(normalizeProjectTypeLookup(value)) ?? "";
}

export function findCanonicalGalleryProjectType(
  requestedProjectType: string
): GalleryProjectType | "" {
  return resolveGalleryProjectType(requestedProjectType);
}

export function filterGalleryProjects(
  projects: readonly PublicGalleryProject[],
  citySlug: string,
  projectType: string
): PublicGalleryProject[] {
  const canonicalProjectType = resolveGalleryProjectType(projectType);
  return projects.filter(
    (project) =>
      (!citySlug || project.citySlug === citySlug) &&
      (!canonicalProjectType ||
        resolveGalleryProjectType(project.model) === canonicalProjectType)
  );
}

export function buildGalleryCityOptions(
  projects: readonly PublicGalleryProject[],
  serviceAreas: readonly Pick<ServiceArea, "city" | "slug">[],
  selectedProjectType: string
): GalleryCityOption[] {
  return serviceAreas.map(({ city, slug }) => ({
    city,
    slug,
    count: filterGalleryProjects(projects, slug, selectedProjectType).length,
  }));
}

export function buildGalleryProjectTypeOptions(
  projects: readonly PublicGalleryProject[],
  selectedCity: string
): GalleryProjectTypeOption[] {
  return GALLERY_PROJECT_TYPES.map((projectType) => ({
    projectType,
    count: filterGalleryProjects(projects, selectedCity, projectType).length,
  }));
}

export function selectNearbyGalleryProjects(
  projects: readonly PublicGalleryProject[],
  area: Pick<ServiceArea, "nearbySlugs">,
  selectedProjectType: string,
  limit = 6
): NearbyGallerySelection {
  const nearbyRank = new Map(
    area.nearbySlugs.map((slug, index) => [slug, index])
  );
  const nearbyProjects = projects
    .filter((project) => nearbyRank.has(project.citySlug))
    .toSorted(
      (left, right) =>
        (nearbyRank.get(left.citySlug) ?? Number.MAX_SAFE_INTEGER) -
          (nearbyRank.get(right.citySlug) ?? Number.MAX_SAFE_INTEGER) ||
        right.dateInstalled - left.dateInstalled
    );
  const nearbyProjectTypeMatches = filterGalleryProjects(
    nearbyProjects,
    "",
    selectedProjectType
  );

  if (nearbyProjectTypeMatches.length > 0) {
    return {
      projects: nearbyProjectTypeMatches.slice(0, limit),
      relaxedProjectType: false,
      serviceAreaWide: false,
    };
  }
  if (nearbyProjects.length > 0) {
    return {
      projects: nearbyProjects.slice(0, limit),
      relaxedProjectType: Boolean(selectedProjectType),
      serviceAreaWide: false,
    };
  }

  const serviceAreaProjectTypeMatches = filterGalleryProjects(
    projects,
    "",
    selectedProjectType
  );
  return {
    projects: (
      serviceAreaProjectTypeMatches.length > 0
        ? serviceAreaProjectTypeMatches
        : projects
    ).slice(0, limit),
    relaxedProjectType: Boolean(
      selectedProjectType && serviceAreaProjectTypeMatches.length === 0
    ),
    serviceAreaWide: true,
  };
}
