import type { PublicProjectSummary } from "@/lib/crmProjects.server";
import { selectRelatedProjects } from "@/lib/relatedProjects";

function project(
  slug: string,
  overrides: Partial<PublicProjectSummary> = {}
): PublicProjectSummary {
  return {
    slug,
    city: "San Antonio",
    citySlug: "san-antonio",
    model: "Storage & Utility",
    size: "10x12",
    dateInstalled: 100,
    dedicatedPageEligible: true,
    coverPhoto: {
      url: "https://example.com/gallery.webp",
      thumbnailUrl: "https://example.com/thumbnail.webp",
      galleryUrl: "https://example.com/gallery.webp",
      socialPreviewUrl: "https://example.com/social.jpg",
      alt: "Completed building",
      filename: "building.jpg",
    },
    ...overrides,
  };
}

describe("related completed projects", () => {
  it("prioritizes known type matches, then city, without self or duplicate links", () => {
    const current = project("current");
    const sameCity = project("same-city", { model: "Carport" });
    const sameType = project("same-type", {
      city: "Boerne",
      citySlug: "boerne",
      model: "Garden Shed",
    });
    const both = project("both", { dedicatedPageEligible: false });
    const candidates = [
      current,
      sameCity,
      sameType,
      both,
      both,
      project("unrelated", { citySlug: "cibolo", model: "Greenhouse" }),
    ];

    expect(selectRelatedProjects(current, candidates).map(({ slug }) => slug))
      .toEqual(["both", "same-type", "same-city"]);
    expect(candidates).toEqual([
      current, sameCity, sameType, both, both,
      expect.objectContaining({ slug: "unrelated" }),
    ]);
  });

  it("treats Green House and Greenhouse models as the same building type", () => {
    const current = project("current", { model: "Green House" });
    expect(selectRelatedProjects(current, [
      project("greenhouse-elsewhere", {
        model: "Greenhouse",
        citySlug: "boerne",
      }),
      project("unrelated-elsewhere", { model: "Carport", citySlug: "boerne" }),
    ]).map(({ slug }) => slug)).toEqual(["greenhouse-elsewhere"]);
  });

  it("does not treat unknown models as a type match or fill with unrelated projects", () => {
    const current = project("current", { model: "Unmapped custom design" });
    expect(selectRelatedProjects(current, [
      project("unknown-elsewhere", {
        model: "Unmapped custom design",
        citySlug: "boerne",
      }),
      project("local", { model: "Carport" }),
    ]).map(({ slug }) => slug)).toEqual(["local"]);
    expect(selectRelatedProjects(current, [])).toEqual([]);
  });

  it("limits suggestions to three and uses newest builds within the same match", () => {
    const candidates = [100, 400, 200, 300].map((dateInstalled) =>
      project(`build-${dateInstalled}`, { dateInstalled })
    );
    expect(selectRelatedProjects(project("current"), candidates)
      .map(({ dateInstalled }) => dateInstalled)).toEqual([400, 300, 200]);
  });
});
