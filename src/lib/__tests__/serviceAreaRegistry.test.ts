import {
  buildServiceAreaRegistry,
  toServiceAreaMapLocations,
  type PublicProjectCity,
} from "@/lib/serviceAreaRegistry";
import { SERVICE_AREAS } from "@/lib/serviceAreas";

function buildCity(
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

describe("service area registry", () => {
  it("dates only edited cities and preserves newer CRM updates", () => {
    const areas = buildServiceAreaRegistry([]);
    expect(areas.find((area) => area.slug === "universal-city")?.lastModified)
      .toBe("2026-09-07T00:00:00.000Z");
    expect(areas.find((area) => area.slug === "schertz")?.lastModified)
      .toBe("2026-09-23T00:00:00.000Z");
    expect(areas.find((area) => area.slug === "seguin")?.lastModified)
      .toBe("2026-08-21T00:00:00.000Z");
    const updated = buildServiceAreaRegistry([buildCity({
      city: "Universal City",
      citySlug: "universal-city",
      updatedAt: Date.UTC(2026, 8, 8),
    })]);
    expect(updated.find((area) => area.slug === "universal-city")?.lastModified)
      .toBe("2026-09-08T00:00:00.000Z");
  });

  it("preserves curated copy and ordering while accepting verified CRM coordinates", () => {
    const remoteSanAntonio = buildCity({
      city: "San Antonio",
      citySlug: "san-antonio",
      countyLabel: "Bexar County",
      sortOrder: 10,
      mapLocation: {
        ...buildCity().mapLocation,
        lat: 29.41,
        lon: -98.49,
      },
    });

    const areas = buildServiceAreaRegistry([remoteSanAntonio]);

    expect(areas.map((area) => area.slug)).toEqual(
      SERVICE_AREAS.map((area) => area.slug)
    );
    expect(areas[0]).toMatchObject({
      title: SERVICE_AREAS[0].title,
      description: SERVICE_AREAS[0].description,
      planningNotes: SERVICE_AREAS[0].planningNotes,
      curated: true,
      mapLocation: { lat: 29.41, lon: -98.49 },
    });
  });

  it("appends CRM-only towns with conservative generic copy and nearby cities", () => {
    const areas = buildServiceAreaRegistry([buildCity()]);
    const elmendorf = areas.at(-1);

    expect(elmendorf).toMatchObject({
      city: "Elmendorf",
      slug: "elmendorf",
      county: "Bexar County",
      curated: false,
      regionCode: "TX",
      placeKind: "town",
    });
    expect(elmendorf?.permitNotes).toBeUndefined();
    expect(elmendorf?.nearbySlugs).toHaveLength(5);
    expect(elmendorf?.nearbySlugs).toContain("san-antonio");
    expect(
      [
        elmendorf?.description,
        elmendorf?.intro,
        ...(elmendorf?.planningNotes ?? []),
      ].join(" ")
    ).not.toMatch(/permit (?:is|required)|no permit|one-day/i);
    expect(toServiceAreaMapLocations(areas).at(-1)).toEqual({
      city: "Elmendorf",
      slug: "elmendorf",
      lat: 29.2561,
      lon: -98.3328,
      sourceLabel: "OpenStreetMap contributors",
    });
  });

  it("rejects duplicate slugs and curated city-name mismatches", () => {
    const elmendorf = buildCity();
    expect(() => buildServiceAreaRegistry([elmendorf, elmendorf])).toThrow(
      /duplicate slug elmendorf/
    );
    expect(() =>
      buildServiceAreaRegistry([
        buildCity({ city: "Not San Antonio", citySlug: "san-antonio" }),
      ])
    ).toThrow(/does not match curated city "San Antonio"/);
  });
});
