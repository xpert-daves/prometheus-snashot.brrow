import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import {
  buildProjectDescription,
  buildProjectGalleryItemListJsonLd,
  buildProjectItemListJsonLd,
  formatProjectInstallMonth,
  formatProjectName,
  formatProjectPrice,
  getProjectCardHref,
  orderProjectPhotosCoverFirst,
  projectHasDedicatedPage,
} from "@/lib/projectPresentation";

function buildProject(
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
      alt: "Exact project alt",
      filename: "10x12-garden-shed-san-antonio-tx-1.jpg",
    },
    dedicatedPageEligible: true,
    price: 450000,
    ...overrides,
  };
}

describe("project presentation", () => {
  it("builds a dedicated-page target for every project", () => {
    expect(getProjectCardHref(buildProject())).toBe(
      "/projects/san-antonio/10x12-garden-shed-san-antonio"
    );
    expect(
      getProjectCardHref(
        buildProject({
          dedicatedPageEligible: false,
        })
      )
    ).toBe("/projects/san-antonio/10x12-garden-shed-san-antonio");
  });

  it("formats install dates in UTC and prices from integer cents", () => {
    expect(formatProjectInstallMonth(Date.UTC(2026, 0, 31, 23, 59))).toBe(
      "January 2026"
    );
    expect(formatProjectPrice(450000)).toBe("$4,500");
    expect(formatProjectPrice(450099)).toBe("$4,500.99");
    expect(formatProjectPrice(0)).toBe("$0");
  });

  it("uses the specific CRM title and falls back to the legacy model", () => {
    expect(formatProjectName(buildProject())).toBe("10x12 Garden Shed");
    expect(
      formatProjectName(
        buildProject({
          title: "Side Utility",
          model: "Storage & Utility",
        })
      )
    ).toBe("10x12 Side Utility");
    expect(
      formatProjectName(
        buildProject({
          model: "Walk-In Doghouse & Watershed",
          size: "12x12 + 4x12 porch; 6x6",
        })
      )
    ).toBe(
      "12x12 + 4x12 porch; 6x6 Walk-In Doghouse & Watershed"
    );
    expect(formatProjectName(buildProject({ model: "Utility" }))).toBe(
      "10x12 Utility"
    );
    expect(
      formatProjectName(buildProject({ model: "Portable Buildings" }))
    ).toBe("10x12 Sheds");
  });

  it("requires a resolved photo rather than a minimum blurb length", () => {
    expect(
      projectHasDedicatedPage({
        photos: [{}],
      })
    ).toBe(true);
    expect(
      projectHasDedicatedPage({
        photos: [],
      })
    ).toBe(false);
  });

  it("places the selected cover first without duplicating any gallery photo", () => {
    const project = buildProject();
    const secondPhoto = {
      url: "https://youthful-horse-290.convex.cloud/api/storage/second",
      alt: "Exact second project alt",
      filename: "10x12-garden-shed-san-antonio-tx-2.jpg",
    };

    expect(
      orderProjectPhotosCoverFirst({
        photos: [project.coverPhoto, secondPhoto],
        coverPhotoIndex: 1,
      })
    ).toEqual([
      { photo: secondPhoto, originalIndex: 1 },
      { photo: project.coverPhoto, originalIndex: 0 },
    ]);
  });

  it("builds a normalized description near 155 characters at a word boundary", () => {
    const description = buildProjectDescription({
      ...buildProject(),
      blurb:
        "This project adds organized backyard storage with wide door access, durable materials, thoughtful ventilation, practical shelving space, and a finish selected to complement the home.",
    });

    expect(description.length).toBeLessThanOrEqual(155);
    expect(description).not.toMatch(/\s$/);
    expect(description).not.toMatch(/[,:;.!?-]$/);
    expect(description).toContain("organized backyard storage");
  });

  it("prefers a complete sentence when a longer blurb exceeds the limit", () => {
    const description = buildProjectDescription(
      {
        ...buildProject(),
        blurb:
          "A compact utility shed adds organized backyard storage. Wide double doors simplify equipment access. Additional details continue beyond the metadata limit.",
      },
      80
    );

    expect(description).toBe(
      "A compact utility shed adds organized backyard storage."
    );
    expect(description.length).toBeLessThanOrEqual(80);
  });

  it("keeps useful metadata depth when the only complete sentence is too short", () => {
    const description = buildProjectDescription({
      ...buildProject(),
      blurb:
        "A compact shed was built on-site. Wide double doors, durable metal panels, thoughtful ventilation, practical shelving, and a clean finish create useful backyard storage for the homeowner.",
    });

    expect(description.length).toBeGreaterThanOrEqual(100);
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description).toContain("10x12 Garden Shed built in San Antonio");
    expect(description).toMatch(/\.$/);
  });

  it("keeps unique details and marks truncation when the opening sentence exceeds the limit", () => {
    const description = buildProjectDescription({
      ...buildProject(),
      blurb:
        "This single opening sentence deliberately runs far beyond the metadata limit while describing wide double doors durable metal panels thoughtful ventilation practical shelving a clean exterior finish and useful backyard storage for the homeowner.",
    });

    expect(description.length).toBeLessThanOrEqual(155);
    expect(description).toContain("This single opening sentence");
    expect(description).toMatch(/…$/);
  });

  it("carries the exact filename, alt, and Convex URL into ImageObject data", () => {
    const project = buildProject();
    const jsonLd = buildProjectItemListJsonLd(
      [project],
      "Recent Shed210 builds in San Antonio, Texas"
    );

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Recent Shed210 builds in San Antonio, Texas",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "ImageObject",
            name: project.coverPhoto.filename,
            caption: project.coverPhoto.alt,
            contentUrl: project.coverPhoto.url,
          },
        },
      ],
    });
  });

  it("uses only the curated gallery cover in list-page structured data", () => {
    const project = buildProject();
    const secondPhoto = {
      url: "https://youthful-horse-290.convex.cloud/api/storage/second",
      alt: "Exact second project alt",
      filename: "10x12-garden-shed-san-antonio-tx-2.jpg",
    };
    const jsonLd = buildProjectGalleryItemListJsonLd(
      [
        {
          ...project,
          photos: [project.coverPhoto, secondPhoto],
          coverPhoto: secondPhoto,
          coverPhotoIndex: 1,
        },
      ],
      "Published Shed210 project gallery"
    );

    expect(jsonLd.itemListElement).toMatchObject([
      {
        position: 1,
        item: {
          name: secondPhoto.filename,
          caption: secondPhoto.alt,
          contentUrl: secondPhoto.url,
        },
      },
    ]);
    expect(jsonLd.itemListElement).toHaveLength(1);
  });
});
