import sitemap, { revalidate } from "../sitemap";
import { listArticles } from "@/lib/articles";
import {
  SERVICE_AREAS,
  SERVICE_AREA_LAST_MODIFIED,
} from "@/lib/serviceAreas";
import {
  listCrmProjects,
  type PublicProjectSummary,
} from "../../lib/crmProjects.server";
import { listResolvedServiceAreas } from "../../lib/crmProjectCities.server";
import {
  FALLBACK_SERVICE_AREAS,
  buildServiceAreaRegistry,
  type PublicProjectCity,
} from "../../lib/serviceAreaRegistry";

jest.mock("../../lib/crmProjects.server", () => ({
  listCrmProjects: jest.fn(),
}));
jest.mock("../../lib/crmProjectCities.server", () => ({
  listResolvedServiceAreas: jest.fn(),
}));

const mockListCrmProjects = jest.mocked(listCrmProjects);
const mockListResolvedServiceAreas = jest.mocked(listResolvedServiceAreas);

function buildCrmProject(
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary {
  return {
    slug: "10x12-garden-shed-cibolo",
    city: "Cibolo",
    citySlug: "cibolo",
    model: "Garden Shed",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 12),
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
      alt: "10x12 Garden Shed installed in Cibolo, TX",
      filename: "10x12-garden-shed-cibolo-tx-1.jpg",
    },
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

function buildDynamicCity(): PublicProjectCity {
  return {
    city: "Elmendorf",
    citySlug: "elmendorf",
    regionName: "Texas",
    regionCode: "TX",
    countryCode: "US",
    countyLabel: "Bexar County",
    placeKind: "town",
    mapLocation: {
      lat: 29.2561,
      lon: -98.3328,
      source: "openstreetmap-nominatim",
      sourceRef: "relation:1234",
      sourceLabel: "OpenStreetMap contributors",
      verifiedAt: Date.UTC(2026, 7, 31),
    },
    sortOrder: 900,
    updatedAt: Date.UTC(2026, 7, 31),
  };
}

const STATIC_PUBLIC_PATHS = [
  "/",
  "/buildings",
  "/gallery",
  "/quote",
  "/contact",
  "/accessibility",
  "/privacy-policy",
  "/terms-and-conditions",
  "/news",
  "/service-area",
] as const;

describe("sitemap", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListCrmProjects.mockResolvedValue([]);
    mockListResolvedServiceAreas.mockResolvedValue(FALLBACK_SERVICE_AREAS);
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.shed210.com";
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("lists every canonical public route once", async () => {
    const entries = await sitemap();
    const articles = await listArticles();
    const urls = entries.map((entry) => entry.url);

    expect(articles).toHaveLength(2);
    expect(revalidate).toBe(3600);
    expect(urls).toHaveLength(
      STATIC_PUBLIC_PATHS.length + SERVICE_AREAS.length + articles.length
    );
    for (const pathname of STATIC_PUBLIC_PATHS) {
      expect(urls).toContain(
        `https://www.shed210.com${pathname === "/" ? "/" : pathname}`
      );
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => url.startsWith("https://www.shed210.com/"))).toBe(
      true
    );
    expect(urls).not.toContain("https://www.shed210.com/sms-terms");
    expect(urls).not.toContain("https://www.shed210.com/our-work");
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("/api/"))).toBe(false);

    for (const pathname of [
      "/",
      "/buildings",
      "/gallery",
      "/quote",
      "/contact",
      "/privacy-policy",
      "/terms-and-conditions",
      "/news",
    ]) {
      expect(
        entries.find(
          (entry) =>
            entry.url ===
            `https://www.shed210.com${pathname === "/" ? "/" : pathname}`
        )
      ).not.toHaveProperty("lastModified");
    }
    expect(
      entries.find(
        (entry) => entry.url === "https://www.shed210.com/accessibility"
      )?.lastModified
    ).toEqual(new Date("2026-07-27"));
  });

  it("includes every published service-area page under one indexing policy", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const area of SERVICE_AREAS) {
      const url = `https://www.shed210.com/service-area/${area.slug}`;
      expect(urls).toContain(url);
      expect(entries.find((entry) => entry.url === url)?.lastModified).toEqual(
        new Date(`${'contentLastModified' in area ? area.contentLastModified : SERVICE_AREA_LAST_MODIFIED}T00:00:00.000Z`)
      );
    }
  });

  it("uses the real article update date and preserves the publication fallback for untouched articles", async () => {
    const entries = await sitemap();
    const articles = await listArticles();
    const untouched = articles.find((article) => article.slug === "sanantonio_shed_guide");

    expect(entries.find((entry) => entry.url.endsWith("/news/san-antonio-shed-cost-guide"))?.lastModified)
      .toEqual(new Date("2026-11-09"));
    expect(untouched?.modifiedDate).toBeUndefined();
    expect(entries.find((entry) => entry.url.endsWith("/news/sanantonio_shed_guide"))?.lastModified)
      .toEqual(new Date(untouched!.date));
  });

  it("adds every published CRM project without changing city inclusion", async () => {
    const eligibleProject = buildCrmProject();
    const thinProject = buildCrmProject({
      slug: "8x10-utility-shed-universal-city",
      city: "Universal City",
      citySlug: "universal-city",
      model: "Utility Shed",
      size: "8x10",
      dedicatedPageEligible: false,
      dateInstalled: Date.UTC(2026, 6, 10),
      coverPhoto: {
        url: "https://youthful-horse-290.convex.cloud/api/storage/thin",
        alt: "8x10 Utility Shed installed in Universal City, TX",
        filename: "8x10-utility-shed-universal-city-tx-1.jpg",
      },
    });
    mockListCrmProjects.mockResolvedValue([eligibleProject, thinProject]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    const eligibleUrl =
      "https://www.shed210.com/projects/cibolo/10x12-garden-shed-cibolo";

    expect(urls).toContain(eligibleUrl);
    expect(urls).toContain(
      "https://www.shed210.com/projects/universal-city/8x10-utility-shed-universal-city"
    );
    expect(entries.find((entry) => entry.url === eligibleUrl)).not.toHaveProperty(
      "lastModified"
    );
    expect(
      urls.filter((url) => url.includes("/service-area/"))
    ).toHaveLength(SERVICE_AREAS.length);
  });

  it("omits a generic town until it has a published project", async () => {
    const serviceAreas = buildServiceAreaRegistry([buildDynamicCity()]);
    mockListResolvedServiceAreas.mockResolvedValue(serviceAreas);
    const serviceAreaUrl =
      "https://www.shed210.com/service-area/elmendorf";

    await expect(sitemap()).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ url: serviceAreaUrl })])
    );

    mockListCrmProjects.mockResolvedValue([
      buildCrmProject({
        slug: "10x12-garden-shed-elmendorf",
        city: "Elmendorf",
        citySlug: "elmendorf",
      }),
    ]);
    const entries = await sitemap();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: serviceAreaUrl,
          lastModified: new Date(Date.UTC(2026, 7, 31)),
        }),
      ])
    );
  });

  it("propagates CRM failures instead of publishing a partial project sitemap", async () => {
    const failure = new Error("CRM unavailable");
    mockListCrmProjects.mockRejectedValue(failure);
    await expect(sitemap()).rejects.toBe(failure);
  });
});
