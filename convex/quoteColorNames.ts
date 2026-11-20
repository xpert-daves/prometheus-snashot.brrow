import { sanitizeAlertText } from "./alertTextSafety";

// Mirrors brandColors in src/lib/quoteForm.ts.
export const COLOR_NAME_BY_HEX: Record<string, string> = {
  "#101010": "Black",
  "#706A61": "Charcoal",
  "#B2AFA4": "Pewter",
  "#D8D4C5": "Gray",
  "#F2F0EB": "Alamo",
  "#F7F8F6": "Brilliant",
  "#163E1F": "Forest",
  "#365636": "Hunter",
  "#6A7A55": "Colony",
  "#DD1010": "Crimson",
  "#842424": "Rustic",
  "#361921": "Burgundy",
  "#053751": "Gallery",
  "#3C6577": "Ocean",
  "#F0E0B4": "Ivory",
  "#C6B9A0": "Light Stone",
  "#9E966F": "Desert",
  "#A09A7F": "Taupe",
  "#3D3D2D": "Burnished Slate",
  "#493321": "Brown",
  "#B99167": "Tan",
  "#C88823": "Copper Metallic",
  "#C2C1BF": "Galvalume",
};
// Mirrors brandColors[].legacyHex: the palette before it matched Metal
// Central's swatches. Older leads and saved drafts still send these.
export const LEGACY_COLOR_NAME_BY_HEX: Record<string, string> = {
  "#000000": "Black",
  "#36454F": "Charcoal",
  "#8BA8B7": "Pewter",
  "#808080": "Gray",
  "#E5E1D1": "Alamo",
  "#F5F5F5": "Brilliant",
  "#228B22": "Forest",
  "#0B4008": "Hunter",
  "#3C6E71": "Colony",
  "#DC143C": "Crimson",
  "#8B4513": "Rustic",
  "#800020": "Burgundy",
  "#1E90FF": "Gallery",
  "#017B92": "Ocean",
  "#FFFFF0": "Ivory",
  "#D8CFA8": "Light Stone",
  "#CCAD60": "Desert",
  "#B9A281": "Taupe",
  "#4A4C4D": "Burnished Slate",
  "#654321": "Brown",
  "#D2B48C": "Tan",
  "#B87333": "Copper Metallic",
  "#DCDCDC": "Galvalume",
};
const COLOR_HINT_BY_NAME: Record<string, string> = {
  Black: "black",
  Charcoal: "dark gray",
  Pewter: "medium gray",
  Gray: "light gray",
  Alamo: "warm off-white",
  Brilliant: "bright white",
  Forest: "deep green",
  Hunter: "dark green",
  Colony: "sage green",
  Crimson: "red",
  Rustic: "barn red",
  Burgundy: "dark red",
  Gallery: "dark blue",
  Ocean: "blue green",
  Ivory: "cream",
  "Light Stone": "light beige",
  Desert: "sand",
  Taupe: "tan gray",
  "Burnished Slate": "dark brown gray",
  Brown: "brown",
  Tan: "tan",
  "Copper Metallic": "copper",
  Galvalume: "silver gray",
};

// The quote wizard starts the wall color on this off-palette white and only
// palette tiles change it, so on a website lead it means no color was picked.
// Alerts say so; the stored inputs.color and the CRM payload keep the raw hex.
export const WIZARD_DEFAULT_WALL_COLOR_HEX = "#FFFFFF";
const WALL_COLOR_NOT_SELECTED_LABEL = "Not selected (left on default white)";

function formatColorText(value: string): string {
  if (value.startsWith("#")) return value.toUpperCase();

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatColorValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = sanitizeAlertText(value);
  if (!trimmed) return null;
  const normalizedHex = trimmed.toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalizedHex)) {
    const colorName =
      COLOR_NAME_BY_HEX[normalizedHex] ?? LEGACY_COLOR_NAME_BY_HEX[normalizedHex];
    if (!colorName) return `Custom color ${normalizedHex}`;

    const hint = COLOR_HINT_BY_NAME[colorName];
    return hint ? `${colorName} (${hint})` : colorName;
  }

  return formatColorText(trimmed);
}

export function formatWallColorValue(value: unknown): string | null {
  if (
    typeof value === "string" &&
    sanitizeAlertText(value).toUpperCase() === WIZARD_DEFAULT_WALL_COLOR_HEX
  ) {
    return WALL_COLOR_NOT_SELECTED_LABEL;
  }

  return formatColorValue(value);
}
