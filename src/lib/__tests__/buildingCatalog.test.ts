import {
  BUILDING_CATALOG,
  BUILDING_OPTIONS,
  type BuildingCatalogEntry,
  getBuildingQuoteLabel,
} from "@/lib/buildingCatalog";

describe("building catalog", () => {
  it("uses the approved quote-building list as the public catalog", () => {
    expect(BUILDING_OPTIONS).toEqual([
      { value: "storage_shed", label: "Storage Shed / Garage" },
      { value: "greenhouse", label: "Greenhouse" },
      { value: "well_pump", label: "Water Well Shed" },
      { value: "open_loafing", label: "Loafing Shed / 3-Sided Shelter" },
      { value: "carport", label: "Carport" },
    ]);
    expect(BUILDING_CATALOG.map((building) => building.value)).toEqual(
      BUILDING_OPTIONS.map((option) => option.value)
    );
  });

  it("keeps legacy portable garages under the storage shed and garage label", () => {
    expect(getBuildingQuoteLabel("portable_garage")).toBe(
      "Storage Shed / Garage"
    );
    expect(getBuildingQuoteLabel("greenhouse")).toBe("Greenhouse");
  });

  it("maps only supported building families to real gallery filters", () => {
    expect(
      (BUILDING_CATALOG as readonly BuildingCatalogEntry[]).map(
        ({ value, galleryProjectType }) => [value, galleryProjectType]
      )
    ).toEqual([
      ["storage_shed", "Storage & Utility"],
      ["greenhouse", "Greenhouse"],
      ["well_pump", "Well House"],
      ["open_loafing", "Animal Shelter"],
      ["carport", "Carport"],
    ]);
  });
});
