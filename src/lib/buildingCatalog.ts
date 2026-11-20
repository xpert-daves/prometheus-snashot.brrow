import type { GalleryProjectType } from "@/lib/galleryProjects";
import type { StructureType } from "@/lib/pricing/calculateQuote";

export type PublicBuildingType = Exclude<StructureType, "portable_garage">;

export type BuildingCatalogEntry = {
  value: PublicBuildingType;
  quoteLabel: string;
  title: string;
  summary: string;
  bestFor: readonly string[];
  optionHighlights: readonly string[];
  galleryProjectType?: GalleryProjectType;
};

export const BUILDING_CATALOG = [
  {
    value: "storage_shed",
    quoteLabel: "Storage Shed / Garage",
    title: "Storage Sheds & Garages",
    summary:
      "Enclosed buildings sized around everyday storage, equipment, workshop space, or vehicle access.",
    bestFor: ["Backyard storage", "Workshops", "Equipment and garage use"],
    optionHighlights: ["Walk-in or roll-up doors", "Windows and workbenches", "Custom sizes and layouts"],
    galleryProjectType: "Storage & Utility",
  },
  {
    value: "greenhouse",
    quoteLabel: "Greenhouse",
    title: "Greenhouses",
    summary:
      "Purpose-built growing spaces with layouts that balance light, ventilation, access, and usable interior room.",
    bestFor: ["Home growing", "Plant protection", "Garden workspaces"],
    optionHighlights: ["Ventilation choices", "Doors and shelving", "Site-specific sizing"],
    galleryProjectType: "Greenhouse",
  },
  {
    value: "well_pump",
    quoteLabel: "Water Well Shed",
    title: "Water Well Sheds",
    summary:
      "Protective enclosures planned around pumps, tanks, controls, maintenance access, and the surrounding site.",
    bestFor: ["Well equipment", "Pump protection", "Utility enclosures"],
    optionHighlights: ["Maintenance access", "Ventilation", "Made-to-fit dimensions"],
    galleryProjectType: "Well House",
  },
  {
    value: "open_loafing",
    quoteLabel: "Loafing Shed / 3-Sided Shelter",
    title: "Loafing Sheds & 3-Sided Shelters",
    summary:
      "Open-front shelters that provide practical cover while keeping access, airflow, and daily use straightforward.",
    bestFor: ["Animal cover", "Feed and equipment", "Open utility shelter"],
    optionHighlights: ["Open-front layouts", "Custom footprints", "Site-aware placement"],
    galleryProjectType: "Animal Shelter",
  },
  {
    value: "carport",
    quoteLabel: "Carport",
    title: "Carports",
    summary:
      "Open-sided weather protection sized around vehicles, equipment, access, and the available property footprint.",
    bestFor: ["Vehicle cover", "Equipment protection", "Flexible covered space"],
    optionHighlights: ["Custom length and width", "Roof style", "Placement planning"],
    galleryProjectType: "Carport",
  },
] as const satisfies readonly BuildingCatalogEntry[];

export const BUILDING_OPTIONS = BUILDING_CATALOG.map(
  ({ value, quoteLabel }) => ({ value, label: quoteLabel })
);

const BUILDING_LABELS: Record<StructureType, string> = {
  storage_shed: "Storage Shed / Garage",
  portable_garage: "Storage Shed / Garage",
  greenhouse: "Greenhouse",
  well_pump: "Water Well Shed",
  open_loafing: "Loafing Shed / 3-Sided Shelter",
  carport: "Carport",
};

export function getBuildingQuoteLabel(structureType: StructureType): string {
  return BUILDING_LABELS[structureType];
}
