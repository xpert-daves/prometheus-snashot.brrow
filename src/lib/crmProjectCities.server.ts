import "server-only";

import { cache } from "react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import {
  CRM_PROJECTS_TENANT_SLUG,
  getCrmProjectsUrl,
} from "@/lib/projectsConfig";
import {
  buildServiceAreaRegistry,
  getResolvedServiceAreaFromRegistry,
  type PublicProjectCity,
} from "@/lib/serviceAreaRegistry";

const nonBlankText = (label: string, maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0, `${label} cannot be blank`);

const citySlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "City slug is invalid");

const publicProjectCitySchema = z
  .object({
    city: nonBlankText("Project city", 120),
    citySlug: citySlugSchema,
    regionName: nonBlankText("Project city region", 120),
    regionCode: nonBlankText("Project city region code", 12).regex(
      /^[A-Z0-9-]+$/,
      "Project city region code is invalid"
    ),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/, "Project city country code is invalid"),
    countyLabel: nonBlankText("Project city county label", 160).nullable(),
    placeKind: nonBlankText("Project city place kind", 80),
    mapLocation: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lon: z.number().finite().min(-180).max(180),
        source: nonBlankText("Project city map source", 120),
        sourceRef: nonBlankText("Project city map source reference", 300),
        sourceLabel: nonBlankText("Project city map source label", 200),
        verifiedAt: z.number().finite().safe().int().nonnegative(),
      })
      .strict(),
    sortOrder: z.number().finite().safe().int().nonnegative(),
    updatedAt: z.number().finite().safe().int().nonnegative(),
  })
  .strict();

const publicProjectCityListSchema = z
  .array(publicProjectCitySchema)
  .max(200)
  .superRefine((cities, context) => {
    const slugs = new Set<string>();
    for (const [index, city] of cities.entries()) {
      if (slugs.has(city.citySlug)) {
        context.addIssue({
          code: "custom",
          path: [index, "citySlug"],
          message: `CRM project cities contain duplicate slug ${city.citySlug}`,
        });
      }
      slugs.add(city.citySlug);

      const previous = cities[index - 1];
      if (
        previous &&
        (city.sortOrder < previous.sortOrder ||
          (city.sortOrder === previous.sortOrder &&
            city.citySlug < previous.citySlug))
      ) {
        context.addIssue({
          code: "custom",
          path: [index, "sortOrder"],
          message: "CRM project cities must be sorted by sortOrder and citySlug",
        });
      }
    }
  });

type ListProjectCitiesArgs = { tenantSlug: string };

const publicListProjectCitiesV1Reference = makeFunctionReference<
  "query",
  ListProjectCitiesArgs,
  unknown
>("projects:publicListProjectCitiesV1");

export function isMissingPublicProjectCitiesFunctionError(
  cause: unknown
): cause is Error {
  return (
    cause instanceof Error &&
    (/(?:FunctionNotFound|Could not find public function)[\s\S]*publicListProjectCitiesV1/i.test(
      cause.message
    ) || /^\[Request ID: [a-z0-9]+\] Server Error$/i.test(cause.message))
  );
}

async function queryCrmProjectCities(): Promise<PublicProjectCity[]> {
  const client = new ConvexHttpClient(getCrmProjectsUrl());
  try {
    const response = await client.query(publicListProjectCitiesV1Reference, {
      tenantSlug: CRM_PROJECTS_TENANT_SLUG,
    });
    return publicProjectCityListSchema.parse(response);
  } catch (cause) {
    if (!isMissingPublicProjectCitiesFunctionError(cause)) throw cause;
    console.warn(
      "CRM project cities query is not deployed yet; using the curated Shed210 service-area registry during rollout.",
      cause.message
    );
    return [];
  }
}

const listCrmProjectCitiesCached = cache(queryCrmProjectCities);

export async function listCrmProjectCities(): Promise<PublicProjectCity[]> {
  return listCrmProjectCitiesCached();
}

const listResolvedServiceAreasCached = cache(async () =>
  buildServiceAreaRegistry(await listCrmProjectCities())
);

export async function listResolvedServiceAreas() {
  return listResolvedServiceAreasCached();
}

export async function getResolvedServiceArea(slug: string) {
  return getResolvedServiceAreaFromRegistry(
    await listResolvedServiceAreas(),
    slug
  );
}
