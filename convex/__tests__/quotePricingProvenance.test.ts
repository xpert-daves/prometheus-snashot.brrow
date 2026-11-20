import {
  assertQuotePricingProvenance,
  quotePricingProvenanceError,
} from "../quotePricingProvenance";

describe("quote pricing provenance", () => {
  it("accepts one coherent CRM publication tuple", () => {
    expect(
      quotePricingProvenanceError({
        provider: "frontier_pixel_crm",
        source: "table",
        settingsId: null,
        pricingPublicationId: "publication-7",
        configVersion: 7,
        pricingSchemaVersion: 1,
        pricingPublicationVersion: 7,
      })
    ).toBeNull();
  });

  it("accepts one coherent Shed settings-row tuple", () => {
    expect(
      quotePricingProvenanceError({
        provider: "shed_convex",
        source: "table",
        settingsId: "settings-1",
        pricingPublicationId: null,
        configVersion: 1,
        pricingSchemaVersion: 1,
        pricingPublicationVersion: null,
      })
    ).toBeNull();
  });

  it("accepts a clean non-production Shed default tuple", () => {
    expect(
      quotePricingProvenanceError({
        provider: "shed_convex",
        source: "default",
        settingsId: null,
        pricingPublicationId: null,
        configVersion: 1,
        pricingSchemaVersion: 1,
        pricingPublicationVersion: null,
      })
    ).toBeNull();
  });

  it.each([
    {
      provider: "frontier_pixel_crm" as const,
      source: "table" as const,
      settingsId: "shed-settings",
      pricingPublicationId: "publication-7",
      configVersion: 7,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: 7,
    },
    {
      provider: "frontier_pixel_crm" as const,
      source: "table" as const,
      settingsId: null,
      pricingPublicationId: "publication-7",
      configVersion: 7,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: 6,
    },
    {
      provider: "shed_convex" as const,
      source: "table" as const,
      settingsId: null,
      pricingPublicationId: null,
      configVersion: 1,
      pricingSchemaVersion: 1,
      pricingPublicationVersion: null,
    },
  ])("rejects an incoherent current tuple", (provenance) => {
    expect(() => assertQuotePricingProvenance(provenance)).toThrow(
      /pricing provenance/i
    );
  });

  it("keeps legacy metadata valid only when new version fields are absent", () => {
    expect(
      quotePricingProvenanceError({
        source: "table",
        settingsId: "legacy-settings",
        pricingPublicationId: null,
        configVersion: 1,
      })
    ).toBeNull();

    expect(() =>
      assertQuotePricingProvenance({
        source: "table",
        settingsId: "legacy-settings",
        pricingPublicationId: null,
        configVersion: 1,
        pricingSchemaVersion: 1,
      })
    ).toThrow("Legacy pricing provenance");
  });
});
