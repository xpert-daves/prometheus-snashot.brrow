import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import {
  areCrmProjectImagesV3Required,
  CRM_PROJECTS_TENANT_SLUG,
  getCrmProjectsUrl,
} from "@/lib/projectsConfig";
import { normalizePublicProjectCopy } from "@/lib/publicProjectCopy";
import { SERVICE_AREAS, getServiceArea } from "@/lib/serviceAreas";
import {
  getResolvedServiceArea,
  listResolvedServiceAreas,
} from "@/lib/crmProjectCities.server";
import type { ResolvedServiceArea } from "@/lib/serviceAreaRegistry";

const nonBlankText = (label: string, maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, `${label} cannot be blank`);

const projectSlugSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Project slug is invalid");

const citySlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "City slug is invalid");

const httpsUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Project photo URL must use HTTPS"
  );

const publicProjectPhotoV1Schema = z
  .object({
    url: httpsUrlSchema,
    alt: nonBlankText("Project photo alt text", 300).transform(
      normalizePublicProjectCopy
    ),
    filename: nonBlankText("Project photo filename", 200).refine(
      (value) => /^[^/\\]+\.(?:jpe?g)$/i.test(value),
      "Project photo filename must be a JPEG filename without a path"
    ),
  })
  .strict();

const publicProjectPhotoV3Schema = z
  .object({
    thumbnailUrl: httpsUrlSchema,
    galleryUrl: httpsUrlSchema,
    socialPreviewUrl: httpsUrlSchema,
    alt: nonBlankText("Project photo alt text", 300).transform(
      normalizePublicProjectCopy
    ),
    filename: nonBlankText("Project photo filename", 200).refine(
      (value) => /^[^/\\]+\.(?:jpe?g)$/i.test(value),
      "Project photo filename must be a JPEG filename without a path"
    ),
    width: z.number().finite().safe().int().positive().max(1920),
    height: z.number().finite().safe().int().positive().max(1920),
  })
  .strict();

const publicProjectSummaryV1Shape = {
  slug: projectSlugSchema,
  city: nonBlankText("Project city", 120),
  citySlug: citySlugSchema,
  model: nonBlankText("Project model", 120).transform(
    normalizePublicProjectCopy
  ),
  size: nonBlankText("Project size", 80),
  dateInstalled: z.number().finite().safe().int().nonnegative(),
  coverPhoto: publicProjectPhotoV1Schema,
  dedicatedPageEligible: z.boolean(),
  price: z.number().finite().safe().int().nonnegative().optional(),
} as const;

const publicProjectSummaryV2Shape = {
  ...publicProjectSummaryV1Shape,
  title: nonBlankText("Project title", 160).transform(
    normalizePublicProjectCopy
  ),
} as const;

const publicProjectSummaryV3Shape = {
  ...publicProjectSummaryV2Shape,
  coverPhoto: publicProjectPhotoV3Schema,
  photoCount: z.number().finite().safe().int().positive().max(20),
} as const;

const publicProjectSummaryV1Schema = z
  .object(publicProjectSummaryV1Shape)
  .strict();
const publicProjectSummaryV2Schema = z
  .object(publicProjectSummaryV2Shape)
  .strict();
const publicProjectSummaryV3Schema = z
  .object(publicProjectSummaryV3Shape)
  .strict();

const publicProjectPhotoCollectionShape = {
  photos: z.array(publicProjectPhotoV1Schema).min(1).max(20),
  coverPhotoIndex: z.number().finite().safe().int().nonnegative(),
} as const;

const publicProjectPhotoCollectionV3Shape = {
  photos: z.array(publicProjectPhotoV3Schema).min(1).max(20),
  coverPhotoIndex: z.number().finite().safe().int().nonnegative(),
} as const;

type ComparableProjectPhoto = {
  alt: string;
  filename: string;
  url?: string;
  galleryUrl?: string;
};

function validateProjectPhotoCollection(
  project: {
    coverPhoto: ComparableProjectPhoto;
    photos: ComparableProjectPhoto[];
    coverPhotoIndex: number;
  },
  context: z.RefinementCtx
): void {
  if (project.coverPhotoIndex >= project.photos.length) {
    context.addIssue({
      code: "custom",
      path: ["coverPhotoIndex"],
      message: "Project cover photo index is outside the returned photo list",
    });
    return;
  }

  const indexedCover = project.photos[project.coverPhotoIndex];
  const indexedCoverUrl = indexedCover.galleryUrl ?? indexedCover.url;
  const coverUrl = project.coverPhoto.galleryUrl ?? project.coverPhoto.url;
  if (
    indexedCoverUrl !== coverUrl ||
    indexedCover.filename !== project.coverPhoto.filename ||
    indexedCover.alt !== project.coverPhoto.alt
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverPhoto"],
      message: "Project cover photo does not match the returned cover photo index",
    });
  }
}

const publicProjectDetailV1Schema = z
  .object({
    ...publicProjectSummaryV1Shape,
    blurb: nonBlankText("Project blurb", 50_000)
      .transform(normalizePublicProjectCopy)
      .optional(),
    ...publicProjectPhotoCollectionShape,
  })
  .strict()
  .superRefine(validateProjectPhotoCollection);

const publicProjectDetailV2Schema = z
  .object({
    ...publicProjectSummaryV2Shape,
    blurb: nonBlankText("Project blurb", 50_000)
      .transform(normalizePublicProjectCopy)
      .optional(),
    ...publicProjectPhotoCollectionShape,
  })
  .strict()
  .superRefine(validateProjectPhotoCollection);

const publicProjectDetailV3Schema = z
  .object({
    ...publicProjectSummaryV3Shape,
    blurb: nonBlankText("Project blurb", 50_000)
      .transform(normalizePublicProjectCopy)
      .optional(),
    ...publicProjectPhotoCollectionV3Shape,
  })
  .strict()
  .superRefine((project, context) => {
    validateProjectPhotoCollection(project, context);
    if (project.photoCount !== project.photos.length) {
      context.addIssue({
        code: "custom",
        path: ["photoCount"],
        message: "Project photo count does not match the returned photo list",
      });
    }
  });

function validateNewestFirstProjects(
  projects: readonly { dateInstalled: number }[],
  context: z.RefinementCtx
): void {
  for (let index = 1; index < projects.length; index += 1) {
    if (projects[index].dateInstalled > projects[index - 1].dateInstalled) {
      context.addIssue({
        code: "custom",
        path: [index, "dateInstalled"],
        message: "CRM projects must be returned newest first",
      });
    }
  }
}

const publicProjectListV1Schema = z
  .array(publicProjectSummaryV1Schema)
  .superRefine(validateNewestFirstProjects);
const publicProjectListV2Schema = z
  .array(publicProjectSummaryV2Schema)
  .superRefine(validateNewestFirstProjects);
const publicProjectListV3Schema = z
  .array(publicProjectSummaryV3Schema)
  .superRefine(validateNewestFirstProjects);

const publicProjectDetailV1ResultSchema = publicProjectDetailV1Schema.nullable();
const publicProjectDetailV2ResultSchema = publicProjectDetailV2Schema.nullable();
const publicProjectDetailV3ResultSchema = publicProjectDetailV3Schema.nullable();

type PublicProjectPhotoV1 = z.infer<typeof publicProjectPhotoV1Schema>;
type PublicProjectPhotoV3 = z.infer<typeof publicProjectPhotoV3Schema>;
type PublicProjectSummaryV1 = z.infer<typeof publicProjectSummaryV1Schema>;
type PublicProjectSummaryV2 = z.infer<typeof publicProjectSummaryV2Schema>;
type PublicProjectSummaryV3 = z.infer<typeof publicProjectSummaryV3Schema>;
type PublicProjectDetailV2 = z.infer<typeof publicProjectDetailV2Schema>;

export type PublicProjectPhoto = {
  /** Gallery-sized compatibility alias. New consumers should select a named variant. */
  url: string;
  thumbnailUrl?: string;
  galleryUrl?: string;
  socialPreviewUrl?: string;
  alt: string;
  filename: string;
  width?: number;
  height?: number;
};

export type PublicProjectSummary = Omit<
  PublicProjectSummaryV1,
  "coverPhoto"
> & {
  coverPhoto: PublicProjectPhoto;
  title?: PublicProjectSummaryV2["title"];
  photoCount?: number;
};
export type PublicGalleryProject = PublicProjectSummary & {
  photos: PublicProjectPhoto[];
  coverPhotoIndex: number;
};
export type PublicProjectDetail = PublicProjectSummary & {
  title?: PublicProjectDetailV2["title"];
  blurb?: string;
  photos: PublicProjectPhoto[];
  coverPhotoIndex: number;
};

export const CRM_PROJECT_CITY_SLUGS = SERVICE_AREAS.map((area) => area.slug);

type ListProjectsArgs = {
  tenantSlug: string;
  citySlug?: string;
};

type GetProjectArgs = {
  tenantSlug: string;
  slug: string;
};

type VersionedPublicProjectsResponse =
  | { version: "v1"; response: unknown }
  | { version: "v2"; response: unknown }
  | { version: "v3"; response: unknown };

const publicListProjectsV3Reference = makeFunctionReference<
  "query",
  ListProjectsArgs,
  unknown
>("projects:publicListProjectsV3");

const publicGetProjectBySlugV3Reference = makeFunctionReference<
  "query",
  GetProjectArgs,
  unknown
>("projects:publicGetProjectBySlugV3");

const publicListProjectsV2Reference = makeFunctionReference<
  "query",
  ListProjectsArgs,
  unknown
>("projects:publicListProjectsV2");

const publicGetProjectBySlugV2Reference = makeFunctionReference<
  "query",
  GetProjectArgs,
  unknown
>("projects:publicGetProjectBySlugV2");

const legacyPublicListProjectsReference = makeFunctionReference<
  "query",
  ListProjectsArgs,
  unknown
>("projects:publicListProjects");

const legacyPublicGetProjectBySlugReference = makeFunctionReference<
  "query",
  GetProjectArgs,
  unknown
>("projects:publicGetProjectBySlug");

type KnownProjectCity = Pick<ResolvedServiceArea, "city" | "slug">;

async function validateKnownCity(citySlug: string): Promise<KnownProjectCity> {
  const parsedSlug = citySlugSchema.parse(citySlug);
  const area = getServiceArea(parsedSlug) ?? await getResolvedServiceArea(parsedSlug);
  if (!area) {
    throw new Error(`Unsupported CRM project city slug: ${parsedSlug}`);
  }
  return area;
}

function validateProjectCityAgainstAreas(
  project: Pick<PublicProjectSummary, "city" | "citySlug">,
  dynamicAreas?: readonly KnownProjectCity[]
): void {
  const area =
    getServiceArea(project.citySlug) ??
    dynamicAreas?.find((candidate) => candidate.slug === project.citySlug);
  if (!area) {
    throw new Error(`CRM project returned unsupported city slug: ${project.citySlug}`);
  }
  if (project.city !== area.city) {
    throw new Error(
      `CRM project city "${project.city}" does not match website city "${area.city}" for ${area.slug}`
    );
  }
}

function createCrmProjectsClient(): ConvexHttpClient {
  return new ConvexHttpClient(getCrmProjectsUrl());
}

const RETIRED_PROJECT_SLUGS = new Set([
  "16x20x9-side-utility-luling-2",
]);

function omitRetiredProjects<Project extends { slug: string }>(
  projects: readonly Project[]
): Project[] {
  return projects.filter((project) => !RETIRED_PROJECT_SLUGS.has(project.slug));
}

async function validateProjectsForCity<
  Project extends Pick<PublicProjectSummary, "city" | "citySlug">
>(
  projects: readonly Project[],
  normalizedCitySlug?: string,
  knownDynamicAreas?: readonly KnownProjectCity[]
): Promise<void> {
  const requiresRegistry = projects.some(
    (project) =>
      getServiceArea(project.citySlug) === undefined &&
      !knownDynamicAreas?.some((area) => area.slug === project.citySlug)
  );
  const dynamicAreas = requiresRegistry
    ? await listResolvedServiceAreas()
    : knownDynamicAreas;
  for (const project of projects) {
    validateProjectCityAgainstAreas(project, dynamicAreas);
    if (normalizedCitySlug && project.citySlug !== normalizedCitySlug) {
      throw new Error(
        `CRM project query for ${normalizedCitySlug} returned project from ${project.citySlug}`
      );
    }
  }
}

export async function listCrmProjects(
  citySlug?: string
): Promise<PublicProjectSummary[]> {
  const requestedArea =
    citySlug === undefined ? undefined : await validateKnownCity(citySlug);
  const normalizedCitySlug = requestedArea?.slug;
  const response = await queryPublicProjectList({
    tenantSlug: CRM_PROJECTS_TENANT_SLUG,
    ...(normalizedCitySlug ? { citySlug: normalizedCitySlug } : {}),
  });
  const projects = parsePublicProjectList(response);
  await validateProjectsForCity(
    projects,
    normalizedCitySlug,
    requestedArea && getServiceArea(requestedArea.slug) === undefined
      ? [requestedArea]
      : undefined
  );
  return projects;
}

function isRedactedConvexServerError(cause: unknown): cause is Error {
  return (
    cause instanceof Error &&
    /^\[Request ID: [a-z0-9]+\] Server Error$/i.test(cause.message)
  );
}

function isUnavailablePublicProjectsV2Error(cause: unknown): cause is Error {
  return (
    cause instanceof Error &&
    /(?:FunctionNotFound|Could not find public function)[\s\S]*(?:publicListProjectsV2|publicGetProjectBySlugV2)/i.test(
      cause.message
    )
  );
}

function isUnavailablePublicProjectsV3Error(cause: unknown): cause is Error {
  return (
    cause instanceof Error &&
    /(?:FunctionNotFound|Could not find public function)[\s\S]*(?:publicListProjectsV3|publicGetProjectBySlugV3)/i.test(
      cause.message
    )
  );
}

function shouldProbePublicProjectsV2(cause: unknown): cause is Error {
  return (
    isUnavailablePublicProjectsV3Error(cause) ||
    isRedactedConvexServerError(cause)
  );
}

function shouldProbePublicProjectsV1(cause: unknown): cause is Error {
  return (
    isUnavailablePublicProjectsV2Error(cause) ||
    isRedactedConvexServerError(cause)
  );
}

async function queryPublicProjectList(
  args: ListProjectsArgs
): Promise<VersionedPublicProjectsResponse> {
  const client = createCrmProjectsClient();
  try {
    return {
      version: "v3",
      response: await client.query(publicListProjectsV3Reference, args),
    };
  } catch (cause) {
    if (areCrmProjectImagesV3Required()) throw cause;
    if (!shouldProbePublicProjectsV2(cause)) throw cause;
    console.warn(
      "CRM projects V3 list query may not be deployed yet; probing rollout-compatible V2.",
      cause.message
    );
  }

  try {
    return {
      version: "v2",
      response: await client.query(publicListProjectsV2Reference, args),
    };
  } catch (cause) {
    if (!shouldProbePublicProjectsV1(cause)) throw cause;
    const response = await client.query(legacyPublicListProjectsReference, args);
    console.warn(
      "CRM projects V2 list query may not be deployed yet; a direct rollout-compatible V1 probe succeeded.",
      cause.message
    );
    return { version: "v1", response };
  }
}

async function queryPublicProjectDetail(
  args: GetProjectArgs
): Promise<VersionedPublicProjectsResponse> {
  const client = createCrmProjectsClient();
  try {
    return {
      version: "v3",
      response: await client.query(publicGetProjectBySlugV3Reference, args),
    };
  } catch (cause) {
    if (areCrmProjectImagesV3Required()) throw cause;
    if (!shouldProbePublicProjectsV2(cause)) throw cause;
    console.warn(
      "CRM projects V3 detail query may not be deployed yet; probing rollout-compatible V2.",
      cause.message
    );
  }

  try {
    return {
      version: "v2",
      response: await client.query(publicGetProjectBySlugV2Reference, args),
    };
  } catch (cause) {
    if (!shouldProbePublicProjectsV1(cause)) throw cause;
    const response = await client.query(legacyPublicGetProjectBySlugReference, args);
    console.warn(
      "CRM projects V2 detail query may not be deployed yet; a direct rollout-compatible V1 probe succeeded.",
      cause.message
    );
    return { version: "v1", response };
  }
}

function normalizeLegacyPhoto(photo: PublicProjectPhotoV1): PublicProjectPhoto {
  return photo;
}

function normalizeV3Photo(photo: PublicProjectPhotoV3): PublicProjectPhoto {
  return {
    ...photo,
    url: photo.galleryUrl,
  };
}

function normalizeLegacySummary(
  project: PublicProjectSummaryV1 | PublicProjectSummaryV2
): PublicProjectSummary {
  return {
    ...project,
    coverPhoto: normalizeLegacyPhoto(project.coverPhoto),
  };
}

function normalizeV3Summary(
  project: PublicProjectSummaryV3
): PublicProjectSummary {
  return {
    ...project,
    coverPhoto: normalizeV3Photo(project.coverPhoto),
  };
}

function parsePublicProjectList(
  result: VersionedPublicProjectsResponse
): PublicProjectSummary[] {
  const projects = result.version === "v3"
    ? publicProjectListV3Schema.parse(result.response).map(normalizeV3Summary)
    : result.version === "v2"
      ? publicProjectListV2Schema.parse(result.response).map(normalizeLegacySummary)
      : publicProjectListV1Schema.parse(result.response).map(normalizeLegacySummary);
  return omitRetiredProjects(projects);
}

function parsePublicProjectDetail(
  result: VersionedPublicProjectsResponse
): PublicProjectDetail | null {
  if (result.version === "v3") {
    const project = publicProjectDetailV3ResultSchema.parse(result.response);
    return project
      ? {
          ...project,
          coverPhoto: normalizeV3Photo(project.coverPhoto),
          photos: project.photos.map(normalizeV3Photo),
        }
      : null;
  }

  const project = result.version === "v2"
    ? publicProjectDetailV2ResultSchema.parse(result.response)
    : publicProjectDetailV1ResultSchema.parse(result.response);
  return project
    ? {
        ...project,
        coverPhoto: normalizeLegacyPhoto(project.coverPhoto),
        photos: project.photos.map(normalizeLegacyPhoto),
      }
    : null;
}

function summaryToGalleryProject(
  project: PublicProjectSummary
): PublicGalleryProject {
  return {
    ...project,
    photos: [project.coverPhoto],
    coverPhotoIndex: 0,
  };
}

export async function listCrmHomepageProjects(): Promise<
  PublicGalleryProject[]
> {
  const summaries = await listCrmProjects();
  return summaries.map(summaryToGalleryProject);
}

export async function listCrmGalleryProjects(): Promise<
  PublicGalleryProject[]
> {
  const summaries = await listCrmProjects();
  return summaries.map(summaryToGalleryProject);
}

export async function getCrmProjectBySlug(
  slug: string
): Promise<PublicProjectDetail | null> {
  const normalizedSlug = projectSlugSchema.parse(slug);
  const response = await queryPublicProjectDetail({
    tenantSlug: CRM_PROJECTS_TENANT_SLUG,
    slug: normalizedSlug,
  });
  const project = parsePublicProjectDetail(response);
  if (project) {
    await validateProjectsForCity([project]);
    if (project.slug !== normalizedSlug) {
      throw new Error(
        `CRM project query for ${normalizedSlug} returned project slug ${project.slug}`
      );
    }
  }
  return project;
}
