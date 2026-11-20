export const EXTERIOR_UPGRADE_NAMES = [
  'Ground Anchoring',
  'Ramp (Single Door)',
  'Ramp (Double Door)',
  'Steps',
  'Skirting',
  '2-Tone',
  'Roof Overhang',
  'A/C Knock Out',
] as const;

export const INTERIOR_UPGRADES = [
  'Workbench',
  'Loft',
  'Insulation',
  'Electrical Prep',
] as const;

export const VALID_ADD_ON_NAMES = [
  ...EXTERIOR_UPGRADE_NAMES,
  ...INTERIOR_UPGRADES,
] as const;

export type InteriorUpgradeName = (typeof INTERIOR_UPGRADES)[number];
export type ExteriorUpgradeName = (typeof EXTERIOR_UPGRADE_NAMES)[number];

const validAddOnNames = new Set<string>(VALID_ADD_ON_NAMES);
const interiorUpgradeNames = new Set<string>(INTERIOR_UPGRADES);
const exteriorUpgradeNames = new Set<string>(EXTERIOR_UPGRADE_NAMES);

export function isValidAddOnName(name: string) {
  return validAddOnNames.has(name);
}

export function isInteriorUpgradeName(name: string): name is InteriorUpgradeName {
  return interiorUpgradeNames.has(name);
}

export function isExteriorUpgradeName(name: string): name is ExteriorUpgradeName {
  return exteriorUpgradeNames.has(name);
}
