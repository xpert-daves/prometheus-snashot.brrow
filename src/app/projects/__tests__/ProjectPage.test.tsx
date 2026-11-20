import { render, screen, within } from "@testing-library/react";
import ProjectDetailPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
  revalidate,
} from "../[citySlug]/[slug]/page";
import {
  getCrmProjectBySlug,
  listCrmProjects,
  type PublicProjectDetail,
  type PublicProjectSummary,
} from "../../../lib/crmProjects.server";
import { getResolvedServiceArea } from "../../../lib/crmProjectCities.server";
import { FALLBACK_SERVICE_AREAS } from "../../../lib/serviceAreaRegistry";

jest.mock("../../../lib/crmProjects.server", () => ({
  getCrmProjectBySlug: jest.fn(),
  listCrmProjects: jest.fn(),
}));
jest.mock("../../../lib/crmProjectCities.server", () => ({
  getResolvedServiceArea: jest.fn(),
}));

const mockGetCrmProjectBySlug = jest.mocked(getCrmProjectBySlug);
const mockListCrmProjects = jest.mocked(listCrmProjects);
const mockGetResolvedServiceArea = jest.mocked(getResolvedServiceArea);

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(
    " "
  );
}

function toRscSerializableProps(
  value: unknown,
  seen = new WeakSet<object>()
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toRscSerializableProps(item, seen));
  }
  if (typeof value !== "object" || seen.has(value)) {
    return undefined;
  }

  seen.add(value);
  const record = value as Record<string, unknown>;
  if ("$$typeof" in record && "props" in record) {
    return toRscSerializableProps(record.props, seen);
  }

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, toRscSerializableProps(item, seen)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined)
  );
}

function buildProject(
  overrides: Partial<PublicProjectDetail> = {}
): PublicProjectDetail {
  const coverPhoto = {
    url: "https://youthful-horse-290.convex.cloud/api/storage/master-cover-original",
    thumbnailUrl:
      "https://youthful-horse-290.convex.cloud/api/storage/cover-thumbnail.webp",
    galleryUrl:
      "https://youthful-horse-290.convex.cloud/api/storage/cover-gallery.webp",
    socialPreviewUrl:
      "https://youthful-horse-290.convex.cloud/api/storage/cover-social.jpg",
    alt: "Exact project cover alt",
    filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
  };
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Garden Shed",
    model: "Storage & Utility",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 12),
    coverPhoto,
    dedicatedPageEligible: true,
    price: 0,
    blurb: words(45),
    photos: [
      coverPhoto,
      {
        url: "https://youthful-horse-290.convex.cloud/api/storage/master-interior-original",
        thumbnailUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/interior-thumbnail.webp",
        galleryUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/interior-gallery.webp",
        socialPreviewUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/interior-social.jpg",
        alt: "Exact project interior alt",
        filename: "10x12-garden-shed-san-antonio-tx-2.jpg",
      },
    ],
    coverPhotoIndex: 0,
    ...overrides,
  };
}

function toSummary(project: PublicProjectDetail): PublicProjectSummary {
  return {
    slug: project.slug,
    city: project.city,
    citySlug: project.citySlug,
    ...(project.title !== undefined ? { title: project.title } : {}),
    model: project.model,
    size: project.size,
    dateInstalled: project.dateInstalled,
    coverPhoto: project.coverPhoto,
    dedicatedPageEligible: project.dedicatedPageEligible,
    ...(project.price !== undefined ? { price: project.price } : {}),
  };
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCrmProjectBySlug.mockResolvedValue(buildProject());
    mockListCrmProjects.mockResolvedValue([]);
    mockGetResolvedServiceArea.mockImplementation(async (slug) =>
      FALLBACK_SERVICE_AREAS.find((area) => area.slug === slug)
    );
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.shed210.com";
  });

  it("keeps dynamic slugs open, warms every published project, and revalidates hourly", async () => {
    const eligible = buildProject();
    const thin = buildProject({
      slug: "8x10-utility-shed-schertz",
      city: "Schertz",
      citySlug: "schertz",
      title: "Utility Shed",
      size: "8x10",
      dedicatedPageEligible: false,
      blurb: words(99),
    });
    mockListCrmProjects.mockResolvedValue([
      toSummary(eligible),
      toSummary(thin),
    ]);

    expect(dynamicParams).toBe(true);
    expect(revalidate).toBe(3600);
    await expect(generateStaticParams()).resolves.toEqual([
      {
        citySlug: "san-antonio",
        slug: "10x12-garden-shed-san-antonio",
      },
      {
        citySlug: "schertz",
        slug: "8x10-utility-shed-schertz",
      },
    ]);
  });

  it("renders a dynamic project with priority cover and every responsive photo", async () => {
    const project = buildProject({
      slug: "dynamic-project-cibolo",
      city: "Cibolo",
      citySlug: "cibolo",
      coverPhoto: {
        url: "https://youthful-horse-290.convex.cloud/api/storage/master-dynamic-cover-original",
        thumbnailUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-thumbnail.webp",
        galleryUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-gallery.webp",
        socialPreviewUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-social.jpg",
        alt: "Exact dynamic cover alt",
        filename: "dynamic-project-cibolo-tx-1.jpg",
      },
      photos: [
        {
          url: "https://youthful-horse-290.convex.cloud/api/storage/master-dynamic-side-original",
          thumbnailUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-side-thumbnail.webp",
          galleryUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-side-gallery.webp",
          socialPreviewUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-side-social.jpg",
          alt: "Exact dynamic side alt",
          filename: "dynamic-project-cibolo-tx-2.jpg",
        },
        {
          url: "https://youthful-horse-290.convex.cloud/api/storage/master-dynamic-cover-original",
          thumbnailUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-thumbnail.webp",
          galleryUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-gallery.webp",
          socialPreviewUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-social.jpg",
          alt: "Exact dynamic cover alt",
          filename: "dynamic-project-cibolo-tx-1.jpg",
        },
        {
          url: "https://youthful-horse-290.convex.cloud/api/storage/master-dynamic-interior-original",
          thumbnailUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-interior-thumbnail.webp",
          galleryUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-interior-gallery.webp",
          socialPreviewUrl:
            "https://youthful-horse-290.convex.cloud/api/storage/dynamic-interior-social.jpg",
          alt: "Exact dynamic interior alt",
          filename: "dynamic-project-cibolo-tx-3.jpg",
        },
      ],
      coverPhotoIndex: 1,
    });
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    const element = await ProjectDetailPage({
      params: Promise.resolve({
        citySlug: "cibolo",
        slug: project.slug,
      }),
    });
    const rscSerializableTree = JSON.stringify(toRscSerializableProps(element));
    expect(rscSerializableTree).toContain("dynamic-cover-gallery.webp");
    expect(rscSerializableTree).toContain("dynamic-cover-social.jpg");
    expect(rscSerializableTree).not.toContain("master-");
    expect(rscSerializableTree).not.toContain("storageId");
    expect(rscSerializableTree).not.toContain("sourceUrl");
    const { container } = render(element);

    expect(mockGetCrmProjectBySlug).toHaveBeenCalledWith(project.slug);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "10x12 Garden Shed",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /storage & utility/i })
    ).not.toBeInTheDocument();
    const cover = screen.getByRole("img", {
      name: "Exact dynamic cover alt",
    });
    expect(cover).toHaveAttribute(
      "data-filename",
      "dynamic-project-cibolo-tx-1.jpg"
    );
    expect(cover).toHaveAttribute("loading", "eager");
    expect(cover).toHaveAttribute("fetchpriority", "high");
    expect(cover).toHaveAttribute("sizes");
    expect(
      screen.getByRole("img", { name: "Exact dynamic side alt" })
    ).not.toHaveAttribute("fetchpriority", "high");
    expect(
      screen.getByRole("img", { name: "Exact dynamic interior alt" })
    ).not.toHaveAttribute("fetchpriority", "high");
    expect(
      screen
        .getAllByRole("img")
        .map((image) => image.getAttribute("data-filename"))
    ).toEqual([
      "dynamic-project-cibolo-tx-1.jpg",
      "dynamic-project-cibolo-tx-2.jpg",
      "dynamic-project-cibolo-tx-3.jpg",
    ]);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("Recorded build price")).toBeInTheDocument();
    expect(screen.getByText(/recorded price is for this build completed on July 12, 2026/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cibolo, TX" })).toHaveAttribute(
      "href",
      "/service-area/cibolo"
    );
    expect(
      screen.getByRole("link", { name: /get an instant price/i })
    ).toHaveAttribute("href", "/quote");
    expect(
      screen.getByRole("link", { name: "Compare building types" })
    ).toHaveAttribute("href", "/buildings");

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent ?? "{}"));
    const projectSchema = schemas.find(
      (schema) => schema["@type"] === "CreativeWork"
    );
    expect(projectSchema).toMatchObject({
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id":
          "https://www.shed210.com/projects/cibolo/dynamic-project-cibolo",
      },
      creator: {
        "@type": "HomeAndConstructionBusiness",
        "@id": "https://www.shed210.com/#localbusiness",
        name: "Shed210",
        url: "https://www.shed210.com/",
      },
      isPartOf: {
        "@type": "WebSite",
        "@id": "https://www.shed210.com/#website",
        name: "Shed210",
        url: "https://www.shed210.com/",
      },
    });
    expect(projectSchema.image).toEqual([
      {
        "@type": "ImageObject",
        name: "dynamic-project-cibolo-tx-1.jpg",
        caption: "Exact dynamic cover alt",
        contentUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-cover-social.jpg",
      },
      {
        "@type": "ImageObject",
        name: "dynamic-project-cibolo-tx-2.jpg",
        caption: "Exact dynamic side alt",
        contentUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-side-social.jpg",
      },
      {
        "@type": "ImageObject",
        name: "dynamic-project-cibolo-tx-3.jpg",
        caption: "Exact dynamic interior alt",
        contentUrl:
          "https://youthful-horse-290.convex.cloud/api/storage/dynamic-interior-social.jpg",
      },
    ]);

    const renderedHtml = container.innerHTML;
    expect(renderedHtml).not.toContain("master-");
    expect(renderedHtml).not.toContain("storageId");
    expect(renderedHtml).not.toContain("sourceUrl");
    const browserImageRequests = screen
      .getAllByRole("img")
      .map((image) => decodeURIComponent(image.getAttribute("src") ?? ""));
    expect(browserImageRequests).toEqual(
      expect.arrayContaining([
        expect.stringContaining("dynamic-cover-gallery.webp"),
        expect.stringContaining("dynamic-side-gallery.webp"),
        expect.stringContaining("dynamic-interior-gallery.webp"),
      ])
    );
    expect(browserImageRequests.join(" ")).not.toContain("master-");
  });

  it("generates exact title, bounded description, canonical URL, and cover OG image", async () => {
    const project = buildProject({
      blurb: Array.from(
        { length: 100 },
        () => "A carefully planned backyard storage project with practical details."
      ).join(" "),
    });
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    const result = await generateMetadata({
      params: Promise.resolve({
        citySlug: project.citySlug,
        slug: project.slug,
      }),
    });
    const title = result.title as { absolute: string };
    const openGraphImage = Array.isArray(result.openGraph?.images)
      ? result.openGraph.images[0]
      : result.openGraph?.images;

    expect(title.absolute).toBe(
      "10x12 Garden Shed in San Antonio, TX | Shed210"
    );
    expect(typeof result.description).toBe("string");
    expect(String(result.description).length).toBeGreaterThan(100);
    expect(String(result.description).length).toBeLessThanOrEqual(155);
    expect(String(result.description)).not.toMatch(/\s$/);
    expect(result.alternates?.canonical).toBe(
      "/projects/san-antonio/10x12-garden-shed-san-antonio"
    );
    expect(openGraphImage).toMatchObject({
      url: project.coverPhoto.socialPreviewUrl,
      alt: project.coverPhoto.alt,
    });
    expect(JSON.stringify(result)).not.toContain("master-");
  });

  it("renders a short project story even when the legacy eligibility flag is false", async () => {
    const project = buildProject({
      dedicatedPageEligible: false,
      blurb: "A concise factual project story.",
    });
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    const element = await ProjectDetailPage({
      params: Promise.resolve({
        citySlug: project.citySlug,
        slug: project.slug,
      }),
    });
    render(element);

    expect(
      screen.getByText("A concise factual project story.")
    ).toBeInTheDocument();
  });

  it("links a newly covered project city to its service-area page", async () => {
    const project = buildProject({
      slug: "17x25x9-mobile-office-rio-medina",
      city: "Rio Medina",
      citySlug: "rio-medina",
      title: "Mobile Office",
      model: "Office & Workspace",
      size: "17x25x9",
    });
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    const element = await ProjectDetailPage({
      params: Promise.resolve({
        citySlug: project.citySlug,
        slug: project.slug,
      }),
    });
    render(element);

    expect(
      screen.getByRole("link", { name: "Rio Medina, TX" })
    ).toHaveAttribute("href", "/service-area/rio-medina");
    expect(
      screen.getByRole("link", { name: /sheds in rio medina/i })
    ).toHaveAttribute("href", "/service-area/rio-medina");
  });

  it("links a CRM-only project town through the resolved service registry", async () => {
    const project = buildProject({
      slug: "10x12-garden-shed-elmendorf",
      city: "Elmendorf",
      citySlug: "elmendorf",
    });
    const elmendorfArea = {
      ...FALLBACK_SERVICE_AREAS[0],
      city: "Elmendorf",
      slug: "elmendorf",
      regionName: "Texas",
      regionCode: "TX",
      curated: false,
    };
    mockGetCrmProjectBySlug.mockResolvedValue(project);
    mockGetResolvedServiceArea.mockResolvedValue(elmendorfArea);

    render(
      await ProjectDetailPage({
        params: Promise.resolve({
          citySlug: project.citySlug,
          slug: project.slug,
        }),
      })
    );

    expect(
      screen.getByRole("link", { name: "Elmendorf, TX" })
    ).toHaveAttribute("href", "/service-area/elmendorf");
    expect(
      screen.getByRole("link", { name: /sheds in elmendorf/i })
    ).toHaveAttribute("href", "/service-area/elmendorf");
  });

  it("uses a factual project summary when the optional blurb is absent", async () => {
    const project = buildProject({ blurb: undefined });
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    const element = await ProjectDetailPage({
      params: Promise.resolve({
        citySlug: project.citySlug,
        slug: project.slug,
      }),
    });
    render(element);

    expect(
      screen.getByText(/built in San Antonio, Texas in July 2026/i)
    ).toBeInTheDocument();
  });

  it.each([
    {
      name: "missing photos",
      project: buildProject({
        photos: [],
      }),
    },
    {
      name: "route city mismatch",
      project: buildProject(),
      citySlug: "schertz",
    },
  ])("returns notFound for $name", async ({ project, citySlug }) => {
    mockGetCrmProjectBySlug.mockResolvedValue(project);

    await expect(
      ProjectDetailPage({
        params: Promise.resolve({
          citySlug: citySlug ?? project.citySlug,
          slug: project.slug,
        }),
      })
    ).rejects.toHaveProperty("digest", expect.stringContaining("404"));
  });

  it("returns notFound for absent and malformed dynamic slugs", async () => {
    mockGetCrmProjectBySlug.mockResolvedValueOnce(null);
    await expect(
      ProjectDetailPage({
        params: Promise.resolve({
          citySlug: "san-antonio",
          slug: "missing-project",
        }),
      })
    ).rejects.toHaveProperty("digest", expect.stringContaining("404"));

    jest.clearAllMocks();
    await expect(
      ProjectDetailPage({
        params: Promise.resolve({
          citySlug: "san-antonio",
          slug: "INVALID slug!",
        }),
      })
    ).rejects.toHaveProperty("digest", expect.stringContaining("404"));
    expect(mockGetCrmProjectBySlug).not.toHaveBeenCalled();
  });

  it("omits a hidden price on the project page", async () => {
    const project = buildProject({ price: undefined });
    mockGetCrmProjectBySlug.mockResolvedValue(project);
    const element = await ProjectDetailPage({
      params: Promise.resolve({
        citySlug: project.citySlug,
        slug: project.slug,
      }),
    });
    render(element);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded build price")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "More projects to compare" }))
      .not.toBeInTheDocument();
  });

  it("links real related project titles and their own photos without repeating this build", async () => {
    const current = buildProject();
    const related = buildProject({
      slug: "8x10-utility-shed-boerne",
      city: "Boerne",
      citySlug: "boerne",
      title: "Utility Shed",
      size: "8x10",
      price: 350000,
    });
    mockListCrmProjects.mockResolvedValue([
      toSummary(current), toSummary(related), toSummary(related),
    ]);

    render(await ProjectDetailPage({
      params: Promise.resolve({ citySlug: current.citySlug, slug: current.slug }),
    }));

    const comparison = within(screen.getByRole("region", {
      name: "More projects to compare",
    }));
    expect(comparison.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(comparison.getByRole("link", { name: "8x10 Utility Shed" }))
      .toHaveAttribute("href", "/projects/boerne/8x10-utility-shed-boerne");
    expect(comparison.getByRole("link", { name: "Boerne, TX" }))
      .toHaveAttribute("href", "/service-area/boerne");
    expect(comparison.queryByRole("heading", { name: "10x12 Garden Shed" }))
      .not.toBeInTheDocument();
    expect(comparison.getByRole("img").getAttribute("src"))
      .not.toContain("master-");
    expect(comparison.getByText("Recorded build price")).toBeInTheDocument();
  });

  it("keeps the project available if optional comparison projects cannot load", async () => {
    mockListCrmProjects.mockRejectedValue(new Error("Temporary list failure"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const current = buildProject();
      render(await ProjectDetailPage({
        params: Promise.resolve({ citySlug: current.citySlug, slug: current.slug }),
      }));
      expect(screen.getByRole("heading", { level: 1, name: "10x12 Garden Shed" }))
        .toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "More projects to compare" }))
        .not.toBeInTheDocument();
    } finally {
      warn.mockRestore();
    }
  });
});
