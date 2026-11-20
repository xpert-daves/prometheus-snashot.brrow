import { render, screen } from "@testing-library/react";
import ServiceAreaPage, { metadata as serviceAreaMetadata } from "../page";
import ServiceAreaCityPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
  revalidate,
} from "../[city]/page";
import { SERVICE_AREAS } from "@/lib/serviceAreas";
import { listResolvedServiceAreas } from "@/lib/crmProjectCities.server";
import {
  FALLBACK_SERVICE_AREAS,
  buildServiceAreaRegistry,
  type PublicProjectCity,
} from "@/lib/serviceAreaRegistry";
import {
  listCrmProjects,
  type PublicProjectSummary,
} from "../../../lib/crmProjects.server";

jest.mock("../../../lib/crmProjects.server", () => ({
  listCrmProjects: jest.fn(),
}));
jest.mock("../../../lib/crmProjectCities.server", () => ({
  listResolvedServiceAreas: jest.fn(),
}));

const mockListCrmProjects = jest.mocked(listCrmProjects);
const mockListResolvedServiceAreas = jest.mocked(listResolvedServiceAreas);

function buildCrmProject(
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary {
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    model: "Garden Shed",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 1),
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
      alt: "Exact CRM alt for a San Antonio install",
      filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
    },
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

function buildDynamicCity(
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

describe("Service area pages", () => {
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

  it("lists every public service area with descriptive copy", async () => {
    render(await ServiceAreaPage());

    expect(serviceAreaMetadata.title).toBe("Shed Service Areas Near San Antonio");
    expect(
      screen.getByRole("heading", {
        name: /built local\. built on-site across the region\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("no distance fee")).toBeInTheDocument();
    expect(screen.queryByText(/delivery radius/i)).not.toBeInTheDocument();
    for (const area of SERVICE_AREAS) {
      expect(
        screen.getByRole("link", { name: new RegExp(`${area.city}, TX`, "i") })
      ).toHaveAttribute("href", `/service-area/${area.slug}`);
      expect(screen.getByText(area.description)).toBeInTheDocument();
    }
  });

  it("generates indexable metadata without duplicate brand suffixes", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "schertz" }),
    });

    expect(metadata.title).toBe("Custom Sheds in Schertz, TX");
    expect(String(metadata.title)).not.toContain("| Shed210");
    expect(metadata.description).toContain("Schertz");
    expect(metadata.alternates?.canonical).toBe("/service-area/schertz");
  });

  it("generates San Antonio conversion metadata", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "san-antonio" }),
    });

    expect(metadata.title).toBe("Sheds in San Antonio: Local Projects & Planning");
    expect(metadata.description).toContain("Plan a shed in San Antonio");
    expect(metadata.alternates?.canonical).toBe("/service-area/san-antonio");
  });

  it("builds static params for every service area", async () => {
    expect(revalidate).toBe(3600);
    expect(dynamicParams).toBe(true);
    await expect(generateStaticParams()).resolves.toEqual(
      SERVICE_AREAS.map((area) => ({ city: area.slug }))
    );
  });

  it("builds and safely serializes a generic town page while noindexing it until project proof exists", async () => {
    const dynamicCity = buildDynamicCity({
      city: "Elmendorf </script><script>alert(1)</script>",
      citySlug: "elmendorf",
    });
    const resolvedAreas = buildServiceAreaRegistry([dynamicCity]);
    mockListResolvedServiceAreas.mockResolvedValue(resolvedAreas);

    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "elmendorf" }),
    });
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "elmendorf" }),
    });
    const { container } = render(element);

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/service-area/elmendorf");
    expect(screen.getByText(/Serving Bexar County/i)).toBeInTheDocument();
    expect(screen.queryByText(/permit and HOA guidance/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "San Antonio" })).toHaveAttribute(
      "href",
      "/service-area/san-antonio"
    );
    const jsonLd = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => script.textContent ?? "");
    expect(jsonLd.join(" ")).not.toContain("</script>");
    expect(jsonLd.join(" ")).toContain("\\u003c/script\\u003e");
  });

  it("renders city-specific planning, FAQ, and nearby links", async () => {
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "new-braunfels" }),
    });

    render(element);

    expect(
      screen.getByRole("heading", { level: 1, name: /custom sheds in new braunfels/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Comal and Guadalupe Counties/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /local shed planning notes/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /new braunfels shed questions/i })
    ).toBeInTheDocument();
    const textLinks = screen.getAllByRole("link", {
      name: /text \(855\) 578-0944/i,
    });
    expect(textLinks).toHaveLength(2);
    expect(
      textLinks.every((link) => link.getAttribute("href") === "sms:+18555780944")
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Schertz" })).toHaveAttribute(
      "href",
      "/service-area/schertz"
    );
    expect(
      screen.getByRole("link", { name: "Compare building types" })
    ).toHaveAttribute("href", "/buildings");
    expect(mockListCrmProjects).toHaveBeenCalledWith("new-braunfels");
  });

  it("renders conservative Lakehills county and floodplain guidance", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "lakehills" }),
    });
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "lakehills" }),
    });

    render(element);

    expect(metadata.title).toBe("Custom Sheds in Lakehills, TX");
    expect(metadata.alternates?.canonical).toBe("/service-area/lakehills");
    expect(screen.getByText(/Serving Bandera County/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Bandera County development permit application/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Official source" })
    ).toHaveAttribute(
      "href",
      "https://www.banderacounty.gov/page/open/1169/0/Development%20Permit%20Application---Revised%201-8-25.pdf"
    );
    expect(screen.getByRole("link", { name: "Castroville" })).toHaveAttribute(
      "href",
      "/service-area/castroville"
    );
    expect(mockListCrmProjects).toHaveBeenCalledWith("lakehills");
  });

  it("renders official local guidance for the expanded service areas", async () => {
    const hallettsville = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "hallettsville" }),
    });
    const { unmount } = render(hallettsville);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /custom sheds in hallettsville/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Serving Lavaca County/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /accessory-building submittal checklist/i,
      })
    ).toBeInTheDocument();
    expect(mockListCrmProjects).toHaveBeenCalledWith("hallettsville");

    unmount();

    const shadyOaks = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "shady-oaks" }),
    });
    render(shadyOaks);

    expect(
      screen.getByText(/Serving Kendall County \(Comfort area\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/used in more than one Texas jurisdiction/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Shady Oaks service and jurisdiction check/i,
      })
    ).toBeInTheDocument();
    expect(mockListCrmProjects).toHaveBeenCalledWith("shady-oaks");
  });

  it("renders Luling service, permit, and floodplain guidance", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "luling" }),
    });
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "luling" }),
    });

    render(element);

    expect(metadata.title).toBe("Custom Sheds in Luling, TX");
    expect(metadata.alternates?.canonical).toBe("/service-area/luling");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /custom sheds in luling/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Serving Caldwell and Guadalupe Counties/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /City of Luling permits and inspections/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Luling residential accessory-structure checklist/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Seguin" })
    ).toHaveAttribute("href", "/service-area/seguin");
    expect(mockListCrmProjects).toHaveBeenCalledWith("luling");
  });

  it("renders Yorktown permit, jurisdiction, and floodplain guidance", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "yorktown" }),
    });
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "yorktown" }),
    });

    render(element);

    expect(metadata.title).toBe("Custom Sheds in Yorktown, TX");
    expect(metadata.alternates?.canonical).toBe("/service-area/yorktown");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /custom sheds in yorktown/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Serving DeWitt County/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /City of Yorktown building code and permits/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Yorktown floodplain development review/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /DeWitt County permit resources/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Karnes City" })).toHaveAttribute(
      "href",
      "/service-area/karnes-city"
    );
    expect(mockListCrmProjects).toHaveBeenCalledWith("yorktown");
  });

  it("renders Nixon permit and two-county jurisdiction guidance", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ city: "nixon" }),
    });
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "nixon" }),
    });

    render(element);

    expect(metadata.title).toBe("Custom Sheds in Nixon, TX");
    expect(metadata.alternates?.canonical).toBe("/service-area/nixon");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /custom sheds in nixon/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Serving Gonzales and Wilson Counties/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /City of Nixon construction permits/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Gonzales County permit resources/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Wilson County permitting and development/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seguin" })).toHaveAttribute(
      "href",
      "/service-area/seguin"
    );
    expect(mockListCrmProjects).toHaveBeenCalledWith("nixon");
  });

  it("renders San Antonio local proof and address-safe JSON-LD", async () => {
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "san-antonio" }),
    });

    const { container } = render(element);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /san antonio neighborhoods and nearby areas served/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Alamo Ranch/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /completed san antonio shed projects/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /san antonio service area and build access/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/against our 35-mile service area/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /permit and HOA guidance/i })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /San Antonio Shed Cost Guide/i })).toHaveAttribute(
      "href",
      "/news/san-antonio-shed-cost-guide"
    );
    expect(
      screen.getByRole("link", { name: /San Antonio Shed Permits and HOA Guide/i })
    ).toHaveAttribute("href", "/news/sanantonio_shed_guide");

    const projectLinks = screen.getAllByRole("link", {
      name: /in the completed shed project gallery/i,
    });
    expect(projectLinks).toHaveLength(3);
    expect(projectLinks.every((link) => link.getAttribute("href") === "/gallery")).toBe(true);

    const projectImages = screen.getAllByRole("img");
    expect(projectImages).toHaveLength(3);
    expect(projectImages.map((image) => decodeURIComponent(image.getAttribute("src") ?? ""))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/portfolio/IMG_6287.jpeg"),
        expect.stringContaining("/portfolio/IMG_6288.jpeg"),
        expect.stringContaining("/portfolio/IMG_6290.jpeg"),
      ])
    );
    expect(projectImages.map((image) => image.getAttribute("alt"))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/gable roof built on-site in a San Antonio backyard/i),
        expect.stringMatching(/double doors and trim detailing in Bexar County/i),
        expect.stringMatching(/side-entry door and ventilation in a Texas backyard/i),
      ])
    );

    const jsonLd = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.innerHTML));
    const serviceJsonLd = jsonLd.find((entry) => entry["@type"] === "Service");
    const breadcrumbJsonLd = jsonLd.find((entry) => entry["@type"] === "BreadcrumbList");

    // The business node lives on the homepage; the city page points at it.
    expect(jsonLd.some((entry) => entry["@type"] === "HomeAndConstructionBusiness")).toBe(false);
    expect(serviceJsonLd).toMatchObject({
      "@id": "https://www.shed210.com/service-area/san-antonio#service",
      name: "Custom sheds in San Antonio, Texas",
      url: "https://www.shed210.com/service-area/san-antonio",
      areaServed: { "@type": "City", name: "San Antonio" },
      provider: {
        "@type": "HomeAndConstructionBusiness",
        "@id": "https://www.shed210.com/#localbusiness",
      },
    });
    expect(serviceJsonLd.provider).not.toHaveProperty("telephone");
    expect(JSON.stringify(jsonLd)).not.toContain("streetAddress");
    expect(breadcrumbJsonLd).toBeDefined();
    expect(jsonLd.some((entry) => entry["@type"] === "FAQPage")).toBe(false);
  });

  it("keeps existing non-San-Antonio project proof text-only", async () => {
    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "schertz" }),
    });

    render(element);

    expect(
      screen.getByRole("heading", { level: 2, name: /local project proof/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /completed schertz shed projects/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /San Antonio Shed Cost Guide/i })
    ).not.toBeInTheDocument();
  });

  it("replaces the existing proof slot with CRM builds when results exist", async () => {
    mockListCrmProjects.mockResolvedValue([
      buildCrmProject(),
      buildCrmProject({
        slug: "8x10-utility-shed-san-antonio",
        model: "Utility Shed",
        size: "8x10",
        dedicatedPageEligible: false,
        price: undefined,
        dateInstalled: Date.UTC(2026, 5, 1),
        coverPhoto: {
          url: "https://youthful-horse-290.convex.cloud/api/storage/second",
          alt: "Exact CRM alt for a thin project",
          filename: "8x10-utility-shed-san-antonio-tx-1.jpg",
        },
      }),
    ]);

    const element = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "san-antonio" }),
    });
    render(element);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Recent builds in San Antonio",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: /completed san antonio shed projects/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Exact CRM alt for a San Antonio install",
      })
    ).toHaveAttribute(
      "data-filename",
      "10x12-garden-shed-san-antonio-tx-1.jpg"
    );
    expect(screen.getByText("$4,500")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: /view project details/i })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/projects/san-antonio/8x10-utility-shed-san-antonio"
        )
    ).toBe(true);
  });

  it("preserves zero-project fallbacks only for San Antonio and Schertz", async () => {
    const universalCityElement = await ServiceAreaCityPage({
      params: Promise.resolve({ city: "universal-city" }),
    });
    render(universalCityElement);

    expect(
      screen.queryByRole("heading", { name: /recent builds/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /local project proof/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /completed universal city/i })
    ).not.toBeInTheDocument();
  });

  it("lets CRM and configuration failures reject the render for ISR safety", async () => {
    const failure = new Error("CRM unavailable");
    mockListCrmProjects.mockRejectedValue(failure);

    await expect(
      ServiceAreaCityPage({
        params: Promise.resolve({ city: "san-antonio" }),
      })
    ).rejects.toBe(failure);
  });
});
