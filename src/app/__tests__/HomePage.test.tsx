import { render, screen } from "@testing-library/react";

import Home, { revalidate } from "../page";
import {
  listCrmHomepageProjects,
  type PublicGalleryProject,
} from "../../lib/crmProjects.server";
import { listResolvedServiceAreas } from "../../lib/crmProjectCities.server";
import { FALLBACK_SERVICE_AREAS } from "../../lib/serviceAreaRegistry";

jest.mock("../../lib/crmProjects.server", () => ({
  listCrmHomepageProjects: jest.fn(),
}));
jest.mock("../../lib/crmProjectCities.server", () => ({
  listResolvedServiceAreas: jest.fn(),
}));

jest.mock("../../components/hero", () => ({
  __esModule: true,
  default: () => <div>Hero</div>,
}));

jest.mock("../../components/ValuePropsBar", () => ({
  __esModule: true,
  default: () => <div>Value props</div>,
}));

jest.mock("../../components/PortfolioSection", () => ({
  __esModule: true,
  default: ({
    projects,
  }: {
    projects: Array<{ slug: string }>;
  }) => (
    <div data-testid="homepage-portfolio">
      {projects.map((project) => project.slug).join(",")}
    </div>
  ),
}));

jest.mock("../../components/HowItWorks", () => ({
  __esModule: true,
  default: () => <div>How it works</div>,
}));

jest.mock("../../components/ServiceAreaSection", () => ({
  __esModule: true,
  default: ({
    locations,
  }: {
    locations: Array<{ slug: string }>;
  }) => (
    <div data-testid="service-area">
      {locations.map((location) => location.slug).join(",")}
    </div>
  ),
}));

jest.mock("../../components/FAQ", () => ({
  __esModule: true,
  default: () => <div>FAQ</div>,
}));

jest.mock("../../components/CTA", () => ({
  __esModule: true,
  default: () => <div>CTA</div>,
}));

const mockListCrmHomepageProjects = jest.mocked(listCrmHomepageProjects);
const mockListResolvedServiceAreas = jest.mocked(listResolvedServiceAreas);

const project: PublicGalleryProject = {
  slug: "6x8x7-shed-lakehills",
  city: "Lakehills",
  citySlug: "lakehills",
  model: "Shed",
  size: "6x8x7",
  dateInstalled: Date.UTC(2026, 6, 24),
  coverPhoto: {
    url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
    alt: "Exact CRM homepage alt",
    filename: "6x8x7-shed-lakehills-tx-1.jpg",
  },
  dedicatedPageEligible: true,
  photos: [
    {
      url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
      alt: "Exact CRM homepage alt",
      filename: "6x8x7-shed-lakehills-tx-1.jpg",
    },
  ],
  coverPhotoIndex: 0,
};

const secondProject: PublicGalleryProject = {
  slug:
    "12x12-4x12-porch-6x6-walk-in-doghouse-watershed-san-antonio",
  city: "San Antonio",
  citySlug: "san-antonio",
  model: "Walk-In Doghouse & Watershed",
  size: "12x12 + 4x12 porch; 6x6",
  dateInstalled: Date.UTC(2026, 6, 25),
  coverPhoto: {
    url: "https://youthful-horse-290.convex.cloud/api/storage/combo-cover",
    alt: "Walk-in doghouse and watershed project in San Antonio",
    filename:
      "12x12-4x12-porch-6x6-walk-in-doghouse-watershed-san-antonio-tx-1.jpg",
  },
  dedicatedPageEligible: true,
  photos: [
    {
      url: "https://youthful-horse-290.convex.cloud/api/storage/combo-cover",
      alt: "Walk-in doghouse and watershed project in San Antonio",
      filename:
        "12x12-4x12-porch-6x6-walk-in-doghouse-watershed-san-antonio-tx-1.jpg",
    },
  ],
  coverPhotoIndex: 0,
};

describe("HomePage", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListResolvedServiceAreas.mockResolvedValue(FALLBACK_SERVICE_AREAS);
    mockListCrmHomepageProjects.mockResolvedValue([secondProject, project]);
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.shed210.com";
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("keeps an hourly refresh fallback and passes multiple gallery API projects into the homepage portfolio", async () => {
    expect(revalidate).toBe(3600);

    render(await Home());

    expect(mockListCrmHomepageProjects).toHaveBeenCalledTimes(1);
    expect(mockListCrmHomepageProjects).toHaveBeenCalledWith();
    expect(screen.getByTestId("homepage-portfolio")).toHaveTextContent(
      `${secondProject.slug},${project.slug}`
    );
  });

  it("renders the site's one full business node alongside the WebSite node", async () => {
    const { container } = render(await Home());
    const jsonLd = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent ?? "{}"));
    const businessNodes = jsonLd.filter(
      (entry) => entry["@type"] === "HomeAndConstructionBusiness"
    );

    expect(businessNodes).toHaveLength(1);
    expect(businessNodes[0]).toMatchObject({
      "@id": "https://www.shed210.com/#localbusiness",
      mainEntityOfPage: "https://www.shed210.com/",
      telephone: expect.any(String),
    });
    expect(businessNodes[0].areaServed).toHaveLength(FALLBACK_SERVICE_AREAS.length);
    expect(jsonLd.find((entry) => entry["@type"] === "WebSite")?.publisher).toEqual({
      "@id": businessNodes[0]["@id"],
    });
  });

  it("links visitors from the homepage into the building comparison", async () => {
    render(await Home());

    expect(
      screen.getByRole("link", { name: "Compare Buildings" })
    ).toHaveAttribute("href", "/buildings");
  });

  it("propagates API failures so ISR keeps the last successful homepage", async () => {
    const failure = new Error("CRM unavailable");
    mockListCrmHomepageProjects.mockRejectedValueOnce(failure);

    await expect(Home()).rejects.toBe(failure);
  });

  it("passes resolved CRM towns into the homepage map", async () => {
    mockListResolvedServiceAreas.mockResolvedValue([
      ...FALLBACK_SERVICE_AREAS,
      {
        ...FALLBACK_SERVICE_AREAS[0],
        city: "Elmendorf",
        slug: "elmendorf",
        curated: false,
      },
    ]);

    render(await Home());

    expect(screen.getByTestId("service-area")).toHaveTextContent("elmendorf");
  });
});
