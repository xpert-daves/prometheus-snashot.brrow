jest.mock("convex/browser", () => ({
  ConvexHttpClient: jest.fn(),
}));

import { ConvexHttpClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import {
  CRM_PROJECT_CITY_SLUGS,
  getCrmProjectBySlug,
  listCrmGalleryProjects,
  listCrmHomepageProjects,
  listCrmProjects,
} from "@/lib/crmProjects.server";
import { SERVICE_AREAS } from "@/lib/serviceAreas";
import type { PublicProjectCity } from "@/lib/serviceAreaRegistry";

const CRM_URL = "https://youthful-horse-290.convex.cloud";
const mockQuery = jest.fn();
const mockConvexHttpClient = jest.mocked(ConvexHttpClient);

function buildV3Photo(name = "cover") {
  return {
    thumbnailUrl: `${CRM_URL}/api/storage/${name}-thumbnail.webp`,
    galleryUrl: `${CRM_URL}/api/storage/${name}-gallery.webp`,
    socialPreviewUrl: `${CRM_URL}/api/storage/${name}-social.jpg`,
    alt: `10x12 Garden Shed ${name} view in San Antonio, TX`,
    filename: `10x12-garden-shed-san-antonio-tx-${name}.jpg`,
    width: 1600,
    height: 1200,
  };
}

function buildV3Summary(overrides: Record<string, unknown> = {}) {
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Garden Shed",
    model: "Garden Shed",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 1),
    coverPhoto: buildV3Photo(),
    photoCount: 2,
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

function buildV3Detail(overrides: Record<string, unknown> = {}) {
  const summary = buildV3Summary();
  return {
    ...summary,
    blurb: "A detailed project story.",
    photos: [summary.coverPhoto, buildV3Photo("side")],
    coverPhotoIndex: 0,
    ...overrides,
  };
}

function buildV2Summary(overrides: Record<string, unknown> = {}) {
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Garden Shed",
    model: "Garden Shed",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 1),
    coverPhoto: {
      url: `${CRM_URL}/api/storage/legacy-cover`,
      alt: "10x12 Garden Shed built in San Antonio, TX",
      filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
    },
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

function buildProjectCity(
  overrides: Partial<PublicProjectCity> = {}
): PublicProjectCity {
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
    ...overrides,
  };
}

function buildV1Summary(overrides: Record<string, unknown> = {}) {
  const summary = buildV2Summary(overrides);
  const { title: _title, ...v1Summary } = summary;
  void _title;
  return v1Summary;
}

function buildV2Detail(overrides: Record<string, unknown> = {}) {
  const summary = buildV2Summary();
  return {
    ...summary,
    blurb: "A detailed legacy project story.",
    photos: [summary.coverPhoto],
    coverPhotoIndex: 0,
    ...overrides,
  };
}

function buildV1Detail(overrides: Record<string, unknown> = {}) {
  const detail = buildV2Detail(overrides);
  const { title: _title, ...v1Detail } = detail;
  void _title;
  return v1Detail;
}

function unavailable(version: "V2" | "V3", functionName = "publicListProjects") {
  return new Error(
    `FunctionNotFound: Could not find public function projects:${functionName}${version}`
  );
}

describe("CRM public projects reader", () => {
  const originalCrmUrl = process.env.FRONTIER_PIXEL_CRM_CONVEX_URL;
  const originalSiteConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const originalV3Required = process.env.CRM_PROJECT_IMAGES_V3_REQUIRED;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockConvexHttpClient.mockImplementation(
      () => ({ query: mockQuery }) as unknown as ConvexHttpClient
    );
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = CRM_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://site-quotes.convex.cloud";
    process.env.CRM_PROJECT_IMAGES_V3_REQUIRED = "false";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalCrmUrl === undefined) {
      delete process.env.FRONTIER_PIXEL_CRM_CONVEX_URL;
    } else {
      process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = originalCrmUrl;
    }
    if (originalSiteConvexUrl === undefined) {
      delete process.env.NEXT_PUBLIC_CONVEX_URL;
    } else {
      process.env.NEXT_PUBLIC_CONVEX_URL = originalSiteConvexUrl;
    }
    if (originalV3Required === undefined) {
      delete process.env.CRM_PROJECT_IMAGES_V3_REQUIRED;
    } else {
      process.env.CRM_PROJECT_IMAGES_V3_REQUIRED = originalV3Required;
    }
  });

  it("keeps CRM city parity with the website canonical service areas", () => {
    expect(CRM_PROJECT_CITY_SLUGS).toEqual(
      SERVICE_AREAS.map((area) => area.slug)
    );
  });

  it("strictly reads V3 summaries and normalizes galleryUrl as the compatibility URL", async () => {
    const summary = buildV3Summary();
    mockQuery.mockResolvedValue([summary]);

    const [project] = await listCrmProjects("san-antonio");

    expect(mockConvexHttpClient).toHaveBeenCalledWith(CRM_URL);
    expect(getFunctionName(mockQuery.mock.calls[0][0])).toBe(
      "projects:publicListProjectsV3"
    );
    expect(mockQuery.mock.calls[0][1]).toEqual({
      tenantSlug: "shed210",
      citySlug: "san-antonio",
    });
    expect(project).toEqual({
      ...summary,
      coverPhoto: {
        ...summary.coverPhoto,
        url: summary.coverPhoto.galleryUrl,
      },
    });
    const serializedPublicResponse = JSON.stringify(project);
    expect(serializedPublicResponse).not.toContain("storageId");
    expect(serializedPublicResponse).not.toContain("assetId");
    expect(serializedPublicResponse).not.toContain("sourceUrl");
    expect(serializedPublicResponse).not.toContain("master-");
  });

  it("uses one cover-only V3 list query for gallery and homepage collections", async () => {
    const summary = buildV3Summary({ photoCount: 7 });
    mockQuery.mockResolvedValue([summary]);

    await expect(listCrmGalleryProjects()).resolves.toEqual([
      expect.objectContaining({
        photoCount: 7,
        photos: [expect.objectContaining({ url: summary.coverPhoto.galleryUrl })],
        coverPhotoIndex: 0,
      }),
    ]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][1]).toEqual({ tenantSlug: "shed210" });

    mockQuery.mockClear();
    await expect(listCrmHomepageProjects()).resolves.toEqual([
      expect.objectContaining({ photoCount: 7, coverPhotoIndex: 0 }),
    ]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(getFunctionName(mockQuery.mock.calls[0][0])).toBe(
      "projects:publicListProjectsV3"
    );
  });

  it("strictly reads the complete V3 derivative collection only for detail", async () => {
    const detail = buildV3Detail();
    mockQuery.mockResolvedValue(detail);

    const project = await getCrmProjectBySlug(detail.slug);

    expect(getFunctionName(mockQuery.mock.calls[0][0])).toBe(
      "projects:publicGetProjectBySlugV3"
    );
    expect(mockQuery.mock.calls[0][1]).toEqual({
      tenantSlug: "shed210",
      slug: detail.slug,
    });
    expect(project?.photos).toHaveLength(2);
    expect(project?.photos[1]).toEqual({
      ...detail.photos[1],
      url: detail.photos[1].galleryUrl,
    });
  });

  it("falls back V3 to V2 and normalizes legacy photos without another backend", async () => {
    const summary = buildV2Summary();
    const v3Unavailable = unavailable("V3");
    mockQuery
      .mockRejectedValueOnce(v3Unavailable)
      .mockResolvedValueOnce([summary]);

    await expect(listCrmProjects()).resolves.toEqual([summary]);
    expect(
      mockQuery.mock.calls.map(([reference]) => getFunctionName(reference))
    ).toEqual([
      "projects:publicListProjectsV3",
      "projects:publicListProjectsV2",
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("probing rollout-compatible V2"),
      v3Unavailable.message
    );
  });

  it("falls back V3 to V2 to V1 only for rollout-compatible availability errors", async () => {
    const summary = buildV1Summary();
    mockQuery
      .mockRejectedValueOnce(unavailable("V3"))
      .mockRejectedValueOnce(unavailable("V2"))
      .mockResolvedValueOnce([summary]);

    await expect(listCrmProjects()).resolves.toEqual([summary]);
    expect(
      mockQuery.mock.calls.map(([reference]) => getFunctionName(reference))
    ).toEqual([
      "projects:publicListProjectsV3",
      "projects:publicListProjectsV2",
      "projects:publicListProjects",
    ]);
  });

  it("preserves V2 and V1 detail probes, including nullable results", async () => {
    const v2Detail = buildV2Detail();
    mockQuery
      .mockRejectedValueOnce(
        unavailable("V3", "publicGetProjectBySlug")
      )
      .mockResolvedValueOnce(v2Detail);
    await expect(getCrmProjectBySlug(v2Detail.slug)).resolves.toEqual(v2Detail);
    expect(
      mockQuery.mock.calls.map(([reference]) => getFunctionName(reference))
    ).toEqual([
      "projects:publicGetProjectBySlugV3",
      "projects:publicGetProjectBySlugV2",
    ]);

    mockQuery.mockReset();
    const v1Detail = buildV1Detail();
    mockQuery
      .mockRejectedValueOnce(
        unavailable("V3", "publicGetProjectBySlug")
      )
      .mockRejectedValueOnce(
        unavailable("V2", "publicGetProjectBySlug")
      )
      .mockResolvedValueOnce(v1Detail);
    await expect(getCrmProjectBySlug(v1Detail.slug)).resolves.toEqual(v1Detail);

    mockQuery.mockReset();
    mockQuery.mockResolvedValue(null);
    await expect(getCrmProjectBySlug("missing-project")).resolves.toBeNull();
  });

  it("keeps V2 and V1 response shapes strict during rollout probes", async () => {
    mockQuery
      .mockRejectedValueOnce(unavailable("V3"))
      .mockResolvedValueOnce([buildV1Summary()]);
    await expect(listCrmProjects()).rejects.toThrow();
    expect(mockQuery).toHaveBeenCalledTimes(2);

    mockQuery.mockReset();
    mockQuery
      .mockRejectedValueOnce(unavailable("V3"))
      .mockRejectedValueOnce(unavailable("V2"))
      .mockResolvedValueOnce([buildV2Summary()]);
    await expect(listCrmProjects()).rejects.toThrow();
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it("fails closed without probing legacy APIs when V3 is required", async () => {
    process.env.CRM_PROJECT_IMAGES_V3_REQUIRED = "true";
    const failure = unavailable("V3");
    mockQuery.mockRejectedValue(failure);

    await expect(listCrmProjects()).rejects.toBe(failure);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(getFunctionName(mockQuery.mock.calls[0][0])).toBe(
      "projects:publicListProjectsV3"
    );
  });

  it("rejects V3 source identifiers, generic source URLs, and other extra fields", async () => {
    mockQuery.mockResolvedValue([
      {
        ...buildV3Summary(),
        storageId: "master-storage-id",
        sourceUrl: `${CRM_URL}/api/storage/master-original`,
      },
    ]);

    await expect(listCrmProjects()).rejects.toThrow(/Unrecognized/);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("preserves exact public alt text and filename while normalizing approved copy", async () => {
    const summary = buildV3Summary({
      title: "  Barn Style Portable Building  ",
      model: "Barn Style Portable Building",
      coverPhoto: {
        ...buildV3Photo(),
        alt: "Exact CRM alt — punctuation stays.",
        filename: "Exact-SEO-Filename.JPG",
      },
    });
    mockQuery.mockResolvedValue([summary]);

    const [project] = await listCrmProjects();
    expect(project.title).toBe("Barn Style Shed");
    expect(project.model).toBe("Barn Style Shed");
    expect(project.coverPhoto.alt).toBe("Exact CRM alt — punctuation stays.");
    expect(project.coverPhoto.filename).toBe("Exact-SEO-Filename.JPG");
  });

  it("rejects negative values, extra fields, and non-HTTPS derivative URLs", async () => {
    mockQuery.mockResolvedValueOnce([buildV3Summary({ price: -1 })]);
    await expect(listCrmProjects()).rejects.toThrow();

    mockQuery.mockResolvedValueOnce([
      { ...buildV3Summary(), published: true },
    ]);
    await expect(listCrmProjects()).rejects.toThrow(/Unrecognized/);

    const summary = buildV3Summary();
    mockQuery.mockResolvedValueOnce([
      {
        ...summary,
        coverPhoto: {
          ...summary.coverPhoto,
          thumbnailUrl: "http://example.com/insecure.webp",
        },
      },
    ]);
    await expect(listCrmProjects()).rejects.toThrow(/HTTPS/);
  });

  it("rejects a V3 photo that contains a compatibility or master URL field", async () => {
    const summary = buildV3Summary();
    mockQuery.mockResolvedValue([
      {
        ...summary,
        coverPhoto: {
          ...summary.coverPhoto,
          url: `${CRM_URL}/api/storage/master-original`,
        },
      },
    ]);

    await expect(listCrmProjects()).rejects.toThrow(/Unrecognized/);
  });

  it("rejects oversized dimensions and inconsistent detail photo collections", async () => {
    const summary = buildV3Summary();
    mockQuery.mockResolvedValueOnce([
      {
        ...summary,
        coverPhoto: { ...summary.coverPhoto, width: 1921 },
      },
    ]);
    await expect(listCrmProjects()).rejects.toThrow();

    const detail = buildV3Detail({ photoCount: 3 });
    mockQuery.mockResolvedValueOnce(detail);
    await expect(getCrmProjectBySlug(detail.slug)).rejects.toThrow(
      /photo count does not match/
    );
  });

  it("rejects cover metadata that does not match coverPhotoIndex", async () => {
    const detail = buildV3Detail({ coverPhotoIndex: 1 });
    mockQuery.mockResolvedValue(detail);

    await expect(getCrmProjectBySlug(detail.slug)).rejects.toThrow(
      /cover photo does not match/
    );
  });

  it("omits retired projects and validates newest-first ordering", async () => {
    const newest = buildV3Summary();
    const retired = buildV3Summary({
      slug: "16x20x9-side-utility-luling-2",
      city: "Luling",
      citySlug: "luling",
      dateInstalled: Date.UTC(2026, 5, 1),
    });
    mockQuery.mockResolvedValueOnce([newest, retired]);
    await expect(listCrmProjects()).resolves.toHaveLength(1);

    mockQuery.mockResolvedValueOnce([
      { ...newest, dateInstalled: Date.UTC(2026, 5, 1) },
      { ...newest, slug: "newer-project", dateInstalled: Date.UTC(2026, 6, 1) },
    ]);
    await expect(listCrmProjects()).rejects.toThrow(/newest first/);
  });

  it("accepts and validates a project scoped to a CRM-only town", async () => {
    const project = buildV3Summary({
      slug: "10x12-garden-shed-elmendorf",
      city: "Elmendorf",
      citySlug: "elmendorf",
    });
    mockQuery
      .mockResolvedValueOnce([buildProjectCity()])
      .mockResolvedValueOnce([project]);

    await expect(listCrmProjects("elmendorf")).resolves.toEqual([
      {
        ...project,
        coverPhoto: {
          ...project.coverPhoto,
          url: project.coverPhoto.galleryUrl,
        },
      },
    ]);
    expect(
      mockQuery.mock.calls.map(([reference]) => getFunctionName(reference))
    ).toEqual([
      "projects:publicListProjectCitiesV1",
      "projects:publicListProjectsV3",
    ]);
  });

  it("rejects unsupported input cities before making a project API request", async () => {
    mockQuery.mockResolvedValueOnce([]);

    await expect(listCrmProjects("austin")).rejects.toThrow(
      "Unsupported CRM project city slug: austin"
    );
    expect(
      mockQuery.mock.calls.map(([reference]) => getFunctionName(reference))
    ).toEqual(["projects:publicListProjectCitiesV1"]);
  });

  it("validates requested and returned service areas before publishing data", async () => {
    mockQuery.mockResolvedValue([
      buildV3Summary({ city: "Schertz", citySlug: "schertz" }),
    ]);
    await expect(listCrmProjects("san-antonio")).rejects.toThrow(
      /returned project from schertz/
    );

    mockQuery.mockResolvedValue([
      buildV3Summary({ city: "Universal City", citySlug: "san-antonio" }),
    ]);
    await expect(listCrmProjects()).rejects.toThrow(
      /does not match website city "San Antonio"/
    );
  });

  it("rejects a detail response whose slug differs from the requested slug", async () => {
    mockQuery.mockResolvedValue(
      buildV3Detail({ slug: "different-project-san-antonio" })
    );

    await expect(
      getCrmProjectBySlug("10x12-garden-shed-san-antonio")
    ).rejects.toThrow(
      /returned project slug different-project-san-antonio/
    );
  });

  it("never falls back to the website quote Convex deployment", async () => {
    delete process.env.FRONTIER_PIXEL_CRM_CONVEX_URL;

    await expect(listCrmProjects()).rejects.toThrow(
      "FRONTIER_PIXEL_CRM_CONVEX_URL is not configured"
    );
    expect(mockConvexHttpClient).not.toHaveBeenCalled();
  });

  it("does not mask non-rollout CRM failures", async () => {
    const failure = new Error("CRM unavailable");
    mockQuery.mockRejectedValue(failure);

    await expect(listCrmProjects()).rejects.toBe(failure);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
