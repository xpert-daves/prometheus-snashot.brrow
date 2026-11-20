import { haversineDistanceMiles } from "@/lib/location/distance";
import {
  SERVICE_AREAS,
  SERVICE_AREA_LAST_MODIFIED,
  type ServiceArea,
} from "@/lib/serviceAreas";

export type PublicProjectCityMapLocation = {
  lat: number;
  lon: number;
  source: string;
  sourceRef: string;
  sourceLabel: string;
  verifiedAt: number;
};

export type PublicProjectCity = {
  city: string;
  citySlug: string;
  regionName: string;
  regionCode: string;
  countryCode: string;
  countyLabel: string | null;
  placeKind: string;
  mapLocation: PublicProjectCityMapLocation;
  sortOrder: number;
  updatedAt: number;
};

export type ResolvedServiceArea = ServiceArea & {
  curated: boolean;
  regionName: string;
  regionCode: string;
  countryCode: string;
  countyLabel: string | null;
  placeKind: string;
  mapLocation: PublicProjectCityMapLocation;
  sortOrder: number;
  lastModified: string;
};

export type ServiceAreaMapLocation = {
  city: string;
  slug: string;
  lat: number;
  lon: number;
  sourceLabel: string;
};

type CuratedCoordinate = Pick<PublicProjectCityMapLocation, "lat" | "lon">;

// OpenStreetMap/Nominatim administrative label points, last checked 2026-08-21.
export const CURATED_SERVICE_AREA_COORDINATES = {
  "san-antonio": { lat: 29.3909525, lon: -98.435454 },
  "universal-city": { lat: 29.5480071, lon: -98.2911235 },
  schertz: { lat: 29.5641617, lon: -98.2695702 },
  cibolo: { lat: 29.5707831, lon: -98.2330927 },
  "new-braunfels": { lat: 29.7028266, lon: -98.1257348 },
  boerne: { lat: 29.7946641, lon: -98.7319703 },
  poteet: { lat: 29.0391241, lon: -98.5748412 },
  floresville: { lat: 29.1335781, lon: -98.1561192 },
  castroville: { lat: 29.3565001, lon: -98.8788844 },
  lytle: { lat: 29.2330215, lon: -98.797873 },
  pleasanton: { lat: 28.967194, lon: -98.4786269 },
  seguin: { lat: 29.5688411, lon: -97.9647269 },
  bulverde: { lat: 29.7438332, lon: -98.4530729 },
  lakehills: { lat: 29.584395, lon: -98.9489193 },
  natalia: { lat: 29.1888671, lon: -98.8581169 },
  "karnes-city": { lat: 28.8849772, lon: -97.9008356 },
  hallettsville: { lat: 29.4438528, lon: -96.9410929 },
  helotes: { lat: 29.5635688, lon: -98.6884208 },
  "shady-oaks": { lat: 29.973963, lon: -98.9092251 },
  converse: { lat: 29.5180081, lon: -98.3161241 },
  "rio-medina": { lat: 29.4396769, lon: -98.8841945 },
  marion: { lat: 29.5713244, lon: -98.1403096 },
  luling: { lat: 29.680314, lon: -97.6473265 },
  yorktown: { lat: 28.9823065, lon: -97.5024692 },
  nixon: { lat: 29.2696579, lon: -97.7625132 },
} as const satisfies Record<
  (typeof SERVICE_AREAS)[number]["slug"],
  CuratedCoordinate
>;

const CURATED_LAST_MODIFIED = Date.parse(
  `${SERVICE_AREA_LAST_MODIFIED}T00:00:00.000Z`
);

function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function fallbackMapLocation(
  area: (typeof SERVICE_AREAS)[number]
): PublicProjectCityMapLocation {
  return {
    ...CURATED_SERVICE_AREA_COORDINATES[area.slug],
    source: "shed210-service-area-registry",
    sourceRef: `service-area:${area.slug}`,
    sourceLabel: "Shed210 service-area registry",
    verifiedAt: CURATED_LAST_MODIFIED,
  };
}

function buildGenericServiceArea(city: PublicProjectCity): ResolvedServiceArea {
  const county = city.countyLabel ?? `${city.regionName} service area`;
  const regionLabel = `${city.city}, ${city.regionCode}`;

  return {
    city: city.city,
    slug: city.citySlug,
    county,
    title: `Custom Sheds in ${regionLabel}`,
    description:
      `Custom shed planning and on-site builds in ${regionLabel}, with service availability, access, and scheduling confirmed for the build address.`,
    intro:
      `Shed210 serves ${city.city} with custom storage sheds, workshops, and backyard utility buildings. We confirm the exact address, site access, project scope, travel, and scheduling details before a build is placed on the calendar.`,
    planningNotes: [
      "Confirm service availability and any travel details for the exact build address before scheduling.",
      "Share placement photos, gate widths, slopes, drainage, trees, utilities, and the route materials will take to the pad.",
      "Property rules vary by address and jurisdiction. Check applicable local requirements, easements, utilities, and neighborhood restrictions before finalizing placement or design.",
    ],
    accessNote:
      "Send clear photos and measurements from crew parking to the planned pad, including the narrowest gate, turns, slopes, trees, utilities, and nearby structures.",
    schedulingNote:
      "Scheduling is confirmed after the address, project scope, site access, travel, and material details have been reviewed.",
    nearbySlugs: [],
    faqs: [
      {
        question: `Does Shed210 build sheds in ${city.city}?`,
        answer:
          `Shed210 reviews ${city.city} requests by exact build address. Share the address and site details so service availability, travel, access, and scheduling can be confirmed.`,
      },
      {
        question: `What should I send for a ${city.city} shed quote?`,
        answer:
          "Send the build address, preferred size and style, intended use, placement photos, access measurements, and any property or neighborhood requirements you already know about.",
      },
      {
        question: "Who confirms permits or property restrictions?",
        answer:
          "Requirements depend on the exact property and jurisdiction. Confirm current permit, zoning, utility, easement, septic, floodplain, and neighborhood requirements with the applicable authorities before construction.",
      },
    ],
    curated: false,
    regionName: city.regionName,
    regionCode: city.regionCode,
    countryCode: city.countryCode,
    countyLabel: city.countyLabel,
    placeKind: city.placeKind,
    mapLocation: city.mapLocation,
    sortOrder: city.sortOrder,
    lastModified: toIsoTimestamp(city.updatedAt),
  };
}

function nearestAreaSlugs(
  area: ResolvedServiceArea,
  allAreas: readonly ResolvedServiceArea[]
): string[] {
  return allAreas
    .filter((candidate) => candidate.slug !== area.slug)
    .map((candidate) => ({
      slug: candidate.slug,
      distance: haversineDistanceMiles(
        area.mapLocation.lat,
        area.mapLocation.lon,
        candidate.mapLocation.lat,
        candidate.mapLocation.lon
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance || left.slug.localeCompare(right.slug)
    )
    .slice(0, 5)
    .map(({ slug }) => slug);
}

export function buildServiceAreaRegistry(
  crmCities: readonly PublicProjectCity[]
): ResolvedServiceArea[] {
  const seenCrmSlugs = new Set<string>();
  for (const city of crmCities) {
    if (seenCrmSlugs.has(city.citySlug)) {
      throw new Error(`CRM project cities contain duplicate slug ${city.citySlug}`);
    }
    seenCrmSlugs.add(city.citySlug);

    const curatedArea = SERVICE_AREAS.find((area) => area.slug === city.citySlug);
    if (curatedArea && curatedArea.city !== city.city) {
      throw new Error(
        `CRM project city "${city.city}" does not match curated city "${curatedArea.city}" for ${city.citySlug}`
      );
    }
  }

  const crmCitiesBySlug = new Map(
    crmCities.map((city) => [city.citySlug, city] as const)
  );
  const curatedSlugs = new Set<string>(
    SERVICE_AREAS.map((area) => area.slug)
  );

  const curatedAreas: ResolvedServiceArea[] = SERVICE_AREAS.map(
    (area, index) => {
      const crmCity = crmCitiesBySlug.get(area.slug);
      const contentUpdatedAt = 'contentLastModified' in area
        ? Date.parse(`${area.contentLastModified}T00:00:00.000Z`)
        : CURATED_LAST_MODIFIED;
      const updatedAt = crmCity
        ? Math.max(contentUpdatedAt, crmCity.updatedAt)
        : contentUpdatedAt;

      return {
        ...area,
        curated: true,
        regionName: crmCity?.regionName ?? "Texas",
        regionCode: crmCity?.regionCode ?? "TX",
        countryCode: crmCity?.countryCode ?? "US",
        countyLabel: crmCity?.countyLabel ?? area.county,
        placeKind: crmCity?.placeKind ?? "city",
        mapLocation: crmCity?.mapLocation ?? fallbackMapLocation(area),
        sortOrder: index,
        lastModified: toIsoTimestamp(updatedAt),
      };
    }
  );

  const genericAreas = crmCities
    .filter((city) => !curatedSlugs.has(city.citySlug))
    .toSorted(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.citySlug.localeCompare(right.citySlug)
    )
    .map(buildGenericServiceArea);
  const allAreas = [...curatedAreas, ...genericAreas];

  return allAreas.map((area) =>
    area.curated
      ? area
      : { ...area, nearbySlugs: nearestAreaSlugs(area, allAreas) }
  );
}

export function getResolvedServiceAreaFromRegistry(
  areas: readonly ResolvedServiceArea[],
  slug: string
): ResolvedServiceArea | undefined {
  return areas.find((area) => area.slug === slug);
}

export function toServiceAreaMapLocations(
  areas: readonly ResolvedServiceArea[]
): ServiceAreaMapLocation[] {
  return areas.map((area) => ({
    city: area.city,
    slug: area.slug,
    lat: area.mapLocation.lat,
    lon: area.mapLocation.lon,
    sourceLabel: area.mapLocation.sourceLabel,
  }));
}

export const FALLBACK_SERVICE_AREAS = buildServiceAreaRegistry([]);
export const FALLBACK_SERVICE_AREA_MAP_LOCATIONS =
  toServiceAreaMapLocations(FALLBACK_SERVICE_AREAS);
