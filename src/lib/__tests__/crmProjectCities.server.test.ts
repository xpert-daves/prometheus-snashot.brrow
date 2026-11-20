/**
 * @jest-environment node
 */

jest.mock("convex/browser", () => ({
  ConvexHttpClient: jest.fn(() => ({ query: mockQuery })),
}));

import { getFunctionName } from "convex/server";
import type { PublicProjectCity } from "@/lib/serviceAreaRegistry";

const CRM_URL = "https://youthful-horse-290.convex.cloud";
const mockQuery = jest.fn();

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

async function loadReader() {
  return import("@/lib/crmProjectCities.server");
}

describe("CRM public project cities reader", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.FRONTIER_PIXEL_CRM_CONVEX_URL = CRM_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("strictly reads the V1 city contract for the fixed Shed210 tenant", async () => {
    const city = buildCity();
    mockQuery.mockResolvedValue([city]);
    const { listCrmProjectCities } = await loadReader();

    await expect(listCrmProjectCities()).resolves.toEqual([city]);
    expect(getFunctionName(mockQuery.mock.calls[0][0])).toBe(
      "projects:publicListProjectCitiesV1"
    );
    expect(mockQuery.mock.calls[0][1]).toEqual({ tenantSlug: "shed210" });
  });

  it.each([
    new Error(
      "FunctionNotFound: Could not find public function projects:publicListProjectCitiesV1"
    ),
    new Error("[Request ID: 0dc6fae016b82471] Server Error"),
  ])("uses curated rollout fallback for an unavailable city query", async (failure) => {
    mockQuery.mockRejectedValue(failure);
    const { listCrmProjectCities, listResolvedServiceAreas } = await loadReader();

    await expect(listCrmProjectCities()).resolves.toEqual([]);
    await expect(listResolvedServiceAreas()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "san-antonio", curated: true }),
      ])
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("not deployed yet"),
      failure.message
    );
  });

  it("propagates named provider failures and strict schema failures", async () => {
    const providerFailure = new Error("CRM network unavailable");
    mockQuery.mockRejectedValue(providerFailure);
    let reader = await loadReader();
    await expect(reader.listCrmProjectCities()).rejects.toBe(providerFailure);

    jest.resetModules();
    mockQuery.mockResolvedValue([{ ...buildCity(), unexpected: true }]);
    reader = await loadReader();
    await expect(reader.listCrmProjectCities()).rejects.toThrow();
  });

  it("rejects duplicate or incorrectly ordered city rows", async () => {
    const elmendorf = buildCity();
    mockQuery.mockResolvedValue([elmendorf, elmendorf]);
    let reader = await loadReader();
    await expect(reader.listCrmProjectCities()).rejects.toThrow(/duplicate slug/);

    jest.resetModules();
    mockQuery.mockResolvedValue([
      buildCity({ city: "Zed", citySlug: "zed", sortOrder: 2 }),
      buildCity({ city: "Able", citySlug: "able", sortOrder: 1 }),
    ]);
    reader = await loadReader();
    await expect(reader.listCrmProjectCities()).rejects.toThrow(/must be sorted/);
  });
});
