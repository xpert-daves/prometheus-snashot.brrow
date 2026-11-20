export type QuotePricingProvider =
  | "shed_convex"
  | "frontier_pixel_crm";

export type QuotePricingProvenance = {
  provider?: QuotePricingProvider | null;
  source: "default" | "table";
  settingsId?: string | null;
  pricingPublicationId?: string | null;
  configVersion: number;
  pricingSchemaVersion?: number | null;
  pricingPublicationVersion?: number | null;
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: number | null | undefined) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export function quotePricingProvenanceError(
  provenance: QuotePricingProvenance
): string | null {
  const provider = provenance.provider ?? null;

  if (provider === null) {
    if (
      provenance.pricingSchemaVersion != null ||
      provenance.pricingPublicationVersion != null
    ) {
      return "Legacy pricing provenance cannot include schema or publication versions";
    }
    return null;
  }

  if (
    !isPositiveInteger(provenance.configVersion) ||
    !isPositiveInteger(provenance.pricingSchemaVersion)
  ) {
    return "Current pricing provenance must identify positive whole-number versions";
  }

  if (provider === "frontier_pixel_crm") {
    if (
      provenance.source !== "table" ||
      provenance.settingsId != null ||
      !hasText(provenance.pricingPublicationId) ||
      provenance.pricingSchemaVersion !== 1 ||
      !isPositiveInteger(provenance.pricingPublicationVersion) ||
      provenance.pricingPublicationVersion !== provenance.configVersion
    ) {
      return "CRM pricing provenance must identify one matching version 1 publication";
    }
    return null;
  }

  if (provenance.source === "default") {
    if (
      provenance.settingsId != null ||
      provenance.pricingPublicationId != null ||
      provenance.pricingPublicationVersion != null ||
      provenance.pricingSchemaVersion !== provenance.configVersion
    ) {
      return "Default Shed pricing provenance must identify only its matching schema version";
    }
    return null;
  }

  if (
    !hasText(provenance.settingsId) ||
    provenance.pricingPublicationId != null ||
    provenance.pricingPublicationVersion != null ||
    provenance.pricingSchemaVersion !== provenance.configVersion
  ) {
    return "Shed pricing provenance must identify one matching settings row";
  }

  return null;
}

export function assertQuotePricingProvenance(
  provenance: QuotePricingProvenance | undefined
) {
  if (!provenance) return;
  const error = quotePricingProvenanceError(provenance);
  if (error) throw new Error(error);
}
