import { render, screen } from "@testing-library/react";
import GalleryPage, {
  metadata,
  revalidate,
} from "../page";
import {
  listCrmGalleryProjects,
  type PublicGalleryProject,
} from "../../../lib/crmProjects.server";
import { listResolvedServiceAreas } from "../../../lib/crmProjectCities.server";
import {
  FALLBACK_SERVICE_AREAS,
  buildServiceAreaRegistry,
  type PublicProjectCity,
} from "../../../lib/serviceAreaRegistry";

jest.mock("../../../lib/crmProjects.server", () => ({
  listCrmGalleryProjects: jest.fn(),
}));
jest.mock("../../../lib/crmProjectCities.server", () => ({
  listResolvedServiceAreas: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

jest.mock("../../../components/LiveGoogleReviews", () => ({
  __esModule: true,
  default: () => <div>Google review proof</div>,
}));

const mockListCrmGalleryProjects = jest.mocked(listCrmGalleryProjects);
const mockListResolvedServiceAreas = jest.mocked(listResolvedServiceAreas);

function buildProject(
  overrides: Partial<PublicGalleryProject> = {}
): PublicGalleryProject {
  const defaultCoverPhoto = {
    url: "https://youthful-horse-290.convex.cloud/api/storage/cover",
    alt: "Exact CRM gallery alt",
    filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
  };
  const coverPhoto = overrides.coverPhoto ?? defaultCoverPhoto;
  const photos = overrides.photos ?? [
    coverPhoto,
    {
      url: `${coverPhoto.url}-second`,
      alt: `${coverPhoto.alt} second view`,
      filename: coverPhoto.filename.replace(/-1\.jpg$/i, "-2.jpg"),
    },
  ];
  return {
    slug: "10x12-garden-shed-san-antonio",
    city: "San Antonio",
    citySlug: "san-antonio",
    title: "Garden Shed",
    model: "Storage & Utility",
    size: "10x12",
    dateInstalled: Date.UTC(2026, 6, 12),
    dedicatedPageEligible: true,
    price: 0,
    ...overrides,
    coverPhoto,
    photos,
    coverPhotoIndex: overrides.coverPhotoIndex ?? 0,
  };
}

const projects = [
  buildProject(),
  buildProject({
    slug: "8x10-utility-shed-schertz",
    city: "Schertz",
    citySlug: "schertz",
    title: "Utility Shed",
    size: "8x10",
    dateInstalled: Date.UTC(2026, 5, 10),
    dedicatedPageEligible: false,
    price: undefined,
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/thin",
      alt: "Exact thin project alt",
      filename: "8x10-utility-shed-schertz-tx-1.jpg",
    },
  }),
  buildProject({
    slug: "12x16-garden-shed-cibolo",
    city: "Cibolo",
    citySlug: "cibolo",
    size: "12x16",
    dateInstalled: Date.UTC(2026, 4, 2),
    price: 650000,
    coverPhoto: {
      url: "https://youthful-horse-290.convex.cloud/api/storage/cibolo",
      alt: "Exact Cibolo project alt",
      filename: "12x16-garden-shed-cibolo-tx-1.jpg",
    },
  }),
] as const;

const dynamicCity: PublicProjectCity = {
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

describe("GalleryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCrmGalleryProjects.mockResolvedValue([...projects]);
    mockListResolvedServiceAreas.mockResolvedValue(FALLBACK_SERVICE_AREAS);
  });

  it("has hourly canonical gallery metadata", () => {
    expect(revalidate).toBe(3600);
    expect(metadata.alternates?.canonical).toBe("/gallery");
    expect(metadata.title).toBe("Shed Gallery in San Antonio");
  });

  it("server-renders one curated cover card per project with prices, counts, reviews, and image metadata", async () => {
    const element = await GalleryPage({
      searchParams: Promise.resolve({}),
    });
    const { container } = render(element);

    expect(mockListCrmGalleryProjects).toHaveBeenCalledWith();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(container.querySelector("#project-10x12-garden-shed-san-antonio")).toBeTruthy();
    expect(container.querySelector("#project-8x10-utility-shed-schertz")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Exact CRM gallery alt" })
    ).toHaveAttribute(
      "data-filename",
      "10x12-garden-shed-san-antonio-tx-1.jpg"
    );
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.getByText("$6,500")).toBeInTheDocument();
    expect(screen.queryByText("$4,500")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "3 of 3 published projects shown · one curated cover per project."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("2 photos")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Lakehills (0)" })).toHaveValue(
      "lakehills"
    );
    expect(
      screen.queryByRole("button", { name: /apply filters/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /get an instant price/i })
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Compare building types" })
    ).toHaveAttribute("href", "/buildings");
    expect(container.querySelector("#reviews")).toHaveTextContent(
      "Google review proof"
    );

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).map((script) => JSON.parse(script.textContent ?? "{}"));
    const itemList = schemas.find((schema) => schema["@type"] === "ItemList");
    expect(itemList.itemListElement).toHaveLength(3);
    expect(itemList.itemListElement[0].item).toMatchObject({
      "@type": "ImageObject",
      name: projects[0].coverPhoto.filename,
      caption: projects[0].coverPhoto.alt,
      contentUrl: projects[0].coverPhoto.url,
    });
    expect(
      itemList.itemListElement.map(
        (item: { item: { name: string } }) => item.item.name
      )
    ).toEqual(projects.map((project) => project.coverPhoto.filename));
  });

  it("filters server HTML by linkable city and model parameters", async () => {
    const element = await GalleryPage({
      searchParams: Promise.resolve({
        city: "cibolo",
        model: "Garden Shed",
      }),
    });
    render(element);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(
      screen.getByRole("img", { name: "Exact Cibolo project alt" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Exact CRM gallery alt" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue(
      "cibolo"
    );
    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      "Storage & Utility"
    );
  });

  it("shows nearby cards for a known city and model combination with no exact project", async () => {
    const element = await GalleryPage({
      searchParams: Promise.resolve({
        city: "boerne",
        model: "Water Well Shelter",
      }),
    });
    render(element);

    expect(mockListCrmGalleryProjects).toHaveBeenCalledWith();
    expect(
      screen.getByRole("img", { name: "Exact CRM gallery alt" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /no well house builds in boerne yet.*nearby/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /widened the project type while keeping the locations close/i
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view every project/i })).toHaveAttribute(
      "href",
      "/gallery"
    );
  });

  it("ignores unknown filter values instead of producing an empty archive", async () => {
    const element = await GalleryPage({
      searchParams: Promise.resolve({
        city: "austin",
        model: "Unknown Model",
      }),
    });
    render(element);

    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
      ""
    );
  });

  it("offers and selects a town supplied by the CRM registry", async () => {
    mockListResolvedServiceAreas.mockResolvedValue(
      buildServiceAreaRegistry([dynamicCity])
    );
    const elmendorfProject = buildProject({
      slug: "10x12-garden-shed-elmendorf",
      city: "Elmendorf",
      citySlug: "elmendorf",
      coverPhoto: {
        url: "https://youthful-horse-290.convex.cloud/api/storage/elmendorf",
        alt: "Exact Elmendorf project alt",
        filename: "10x12-garden-shed-elmendorf-tx-1.jpg",
      },
    });
    mockListCrmGalleryProjects.mockResolvedValue([
      ...projects,
      elmendorfProject,
    ]);

    render(
      await GalleryPage({
        searchParams: Promise.resolve({ city: "elmendorf" }),
      })
    );

    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue(
      "elmendorf"
    );
    expect(screen.getByRole("option", { name: "Elmendorf (1)" })).toHaveValue(
      "elmendorf"
    );
    expect(
      screen.getByRole("img", { name: "Exact Elmendorf project alt" })
    ).toBeInTheDocument();
  });

  it("uses a dedicated project link for every gallery project", async () => {
    const element = await GalleryPage({
      searchParams: Promise.resolve({ city: "schertz" }),
    });
    render(element);

    expect(
      screen.queryByRole("link", { name: /find in the gallery/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Shown in this gallery")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /view project details: 8x10 utility shed in schertz/i,
      })
    ).toHaveAttribute(
      "href",
      "/projects/schertz/8x10-utility-shed-schertz"
    );

    const unfiltered = await GalleryPage({
      searchParams: Promise.resolve({}),
    });
    render(unfiltered);
    expect(
      screen
        .getAllByRole("link", { name: /view project details:/i })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/projects/san-antonio/10x12-garden-shed-san-antonio"
        )
    ).toBe(true);
  });
});
