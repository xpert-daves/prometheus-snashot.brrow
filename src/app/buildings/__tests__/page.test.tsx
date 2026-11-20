import { render, screen } from "@testing-library/react";
import BuildingsPage, { metadata, revalidate, selectProofProjects } from "../page";
import {
  BUILDING_CATALOG,
  type BuildingCatalogEntry,
} from "@/lib/buildingCatalog";
import {
  listCrmGalleryProjects,
  type PublicGalleryProject,
} from "@/lib/crmProjects.server";

jest.mock("../../../lib/crmProjects.server", () => ({
  listCrmGalleryProjects: jest.fn(),
}));

const mockListCrmGalleryProjects = jest.mocked(listCrmGalleryProjects);

function buildProject(
  overrides: Partial<PublicGalleryProject> = {}
): PublicGalleryProject {
  const coverPhoto = overrides.coverPhoto ?? {
    url: "https://youthful-horse-290.convex.cloud/api/storage/storage-cover",
    alt: "Authentic Shed210 storage building in San Antonio",
    filename: "10x12-storage-building-san-antonio-tx-1.jpg",
  };

  return {
    slug: "10x12-storage-building-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Storage Building",
    model: "Storage & Utility",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 12),
    dedicatedPageEligible: true,
    ...overrides,
    coverPhoto,
    photos: overrides.photos ?? [coverPhoto],
    coverPhotoIndex: overrides.coverPhotoIndex ?? 0,
  };
}

const projects = [
  buildProject(),
  buildProject({
    slug: "8x12-greenhouse-boerne",
    city: "Boerne",
    citySlug: "boerne",
    title: "Greenhouse",
    model: "Greenhouse",
    size: "8x12",
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/greenhouse-cover",
      alt: "Authentic Shed210 greenhouse in Boerne",
      filename: "8x12-greenhouse-boerne-tx-1.jpg",
    },
  }),
  buildProject({
    slug: "6x6-water-well-shed-karnes-city",
    city: "Karnes City",
    citySlug: "karnes-city",
    title: "Water Well Shed",
    model: "Water Well Shed",
    size: "6x6",
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/well-cover",
      alt: "Authentic Shed210 water well shed in Karnes City",
      filename: "6x6-water-well-shed-karnes-city-tx-1.jpg",
    },
  }),
] as const;

describe("BuildingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCrmGalleryProjects.mockResolvedValue([...projects]);
  });

  it("publishes a canonical hourly Buildings page", () => {
    expect(revalidate).toBe(3600);
    expect(metadata.alternates?.canonical).toBe("/buildings");
    expect(metadata.title).toBe("Sheds & Custom Buildings in San Antonio");
  });

  it("explains every approved quote building type without creating child routes", async () => {
    const element = await BuildingsPage();
    render(element);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /sheds & custom buildings in san antonio/i,
      })
    ).toBeInTheDocument();

    for (const building of BUILDING_CATALOG as readonly BuildingCatalogEntry[]) {
      expect(
        screen.getByRole("heading", { level: 2, name: building.title })
      ).toBeInTheDocument();
      expect(screen.getByText(building.summary)).toBeInTheDocument();
      expect(
        screen.getByRole("link", {
          name: `Price ${building.quoteLabel}`,
        })
      ).toHaveAttribute("href", `/quote?structureType=${building.value}`);

      if (building.galleryProjectType) {
        const proofLink = screen.getByRole("link", {
          name: `See ${building.title} projects`,
        });
        expect(proofLink.getAttribute("href")).toContain("/gallery?type=");
      }
    }

    expect(screen.queryByRole("link", { name: /open storage sheds/i })).toBeNull();
  });

  it("publishes a Service for each building type that links to its card", async () => {
    const element = await BuildingsPage();
    const { container } = render(element);

    const jsonLd = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.innerHTML));
    const serviceList = jsonLd.find((entry) => entry["@type"] === "ItemList");
    const services = serviceList.itemListElement.map(
      (entry: { item: { "@id": string; name: string } }) => entry.item
    );

    expect(jsonLd.some((entry) => entry["@type"] === "BreadcrumbList")).toBe(true);
    expect(services.map((service: { name: string }) => service.name)).toEqual(
      BUILDING_CATALOG.map((building) => building.title)
    );
    for (const service of services as { "@id": string }[]) {
      const anchor = new URL(service["@id"]).hash.slice(1);
      expect(container.querySelector(`[id="${anchor}"]`)).not.toBeNull();
    }
  });

  it("uses current CRM project photos as proof", async () => {
    const element = await BuildingsPage();
    render(element);

    expect(mockListCrmGalleryProjects).toHaveBeenCalledWith();
    expect(
      screen.getByRole("img", {
        name: "Authentic Shed210 storage building in San Antonio",
      })
    ).toHaveAttribute(
      "data-filename",
      "10x12-storage-building-san-antonio-tx-1.jpg"
    );
    expect(
      screen.getByRole("link", {
        name: /view project details: 8x12 greenhouse in boerne, texas/i,
      })
    ).toHaveAttribute(
      "href",
      "/projects/boerne/8x12-greenhouse-boerne"
    );
  });

  it("leads with the newest published storage project and retains other building types", () => {
    const greenhouse = buildProject({ slug: "greenhouse", model: "Greenhouse", dateInstalled: 500 });
    const olderStorage = buildProject({ slug: "older-storage", model: "Garden Shed", dateInstalled: 100 });
    const storage = buildProject({
      slug: "boerne-storage", model: "Storage Shed", dateInstalled: 300,
      city: "Boerne", citySlug: "boerne",
    });
    const secondGreenhouse = buildProject({ slug: "older-greenhouse", model: "Greenhouse", dateInstalled: 200 });
    const carport = buildProject({ slug: "carport", model: "Carport", dateInstalled: 400 });
    const input = [greenhouse, olderStorage, storage, secondGreenhouse, carport];

    const selected = selectProofProjects(input);

    expect(selected).toEqual([storage, greenhouse, carport]);
    expect(selected[0].city).toBe("Boerne");
    expect(input).toEqual([greenhouse, olderStorage, storage, secondGreenhouse, carport]);
  });

  it("does not infer storage proof from a title when the published model is different", () => {
    const doghouse = buildProject({ slug: "doghouse", model: "Deluxe Doggie House", title: "Storage shed example", dateInstalled: 100 });
    const greenhouse = buildProject({ slug: "greenhouse", model: "Greenhouse", dateInstalled: 200 });

    expect(selectProofProjects([doghouse, greenhouse])).toEqual([greenhouse, doghouse]);
  });
});
