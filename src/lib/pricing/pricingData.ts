import type { ExteriorUpgradeName } from './upgradeOptions';

export { EXTERIOR_UPGRADE_NAMES, INTERIOR_UPGRADES } from './upgradeOptions';

export type FootprintBasePrice = {
  length: number;
  width: number;
  price: number;
  /**
   * Optional completed roof-style price for this exact footprint at the
   * config's standard wall height. New configs use a 6-ft standard wall.
   */
  roofStylePriceOverrides?: {
    barn?: number;
    leanTo?: number;
  };
};

export type ExteriorUpgradePricingMode = 'flat' | 'per_sqft' | 'per_linear_foot';

export type ExteriorUpgradePricing = {
  price: number;
  mode: ExteriorUpgradePricingMode;
};

export type QuotePricingConfig = {
  version: 1;
  standardWallHeight: 6 | 7;
  footprintBasePrices: FootprintBasePrice[];
  customFootprintPricePerSqft: number;
  customFootprintPriceRounding: number;
  /**
   * Legacy 7-ft-baseline adjustment. Used only when the explicit height map is
   * absent so previously published configs keep their original math.
   */
  wallHeightPriceAdjustmentPerSqft: number;
  wallHeightPriceAdjustmentsPerSqft?: {
    six: number;
    seven: number;
    eight: number;
  };
  roof: {
    /** Legacy fallback used only when barnPricePerSqft is absent. */
    barnMultiplier: number;
    barnPricePerSqft?: number;
    leanToFlatCost: number;
  };
  doors: Record<string, number>;
  windows: Record<string, number>;
  exteriorUpgrades: Record<ExteriorUpgradeName, ExteriorUpgradePricing>;
  delivery: {
    includedServiceRadius: number;
    ratePerMile: number;
  };
  discountCodes: Record<string, number>;
};

export const DEFAULT_QUOTE_PRICING_CONFIG: QuotePricingConfig = {
  version: 1,
  standardWallHeight: 6,
  footprintBasePrices: [
    { length: 6, width: 6, price: 1600 },
    { length: 8, width: 6, price: 1900 },
    { length: 8, width: 8, price: 2100 },
    { length: 10, width: 8, price: 2400 },
    { length: 10, width: 10, price: 2700 },
    { length: 12, width: 10, price: 3000 },
    { length: 12, width: 12, price: 3400 },
    { length: 14, width: 12, price: 3800 },
    { length: 14, width: 14, price: 4200 },
    { length: 16, width: 14, price: 4500 },
    { length: 16, width: 16, price: 4900 },
  ],
  customFootprintPricePerSqft: 15,
  customFootprintPriceRounding: 100,
  wallHeightPriceAdjustmentPerSqft: 4,
  wallHeightPriceAdjustmentsPerSqft: {
    six: 0,
    seven: 3,
    eight: 6,
  },
  roof: {
    barnMultiplier: 1.1,
    barnPricePerSqft: 4.5,
    leanToFlatCost: 360,
  },
  doors: {
    single_shed: 0,
    double_shed: 185,
    garage_roll_up: 750,
    house: 375,
  },
  windows: {
    '24x36': 200,
  },
  exteriorUpgrades: {
    'Ground Anchoring': { price: 350, mode: 'flat' },
    'Ramp (Single Door)': { price: 195, mode: 'flat' },
    'Ramp (Double Door)': { price: 249, mode: 'flat' },
    Steps: { price: 85, mode: 'flat' },
    Skirting: { price: 8.5, mode: 'per_linear_foot' },
    '2-Tone': { price: 165, mode: 'flat' },
    'Roof Overhang': { price: 95, mode: 'flat' },
    'A/C Knock Out': { price: 65, mode: 'flat' },
  },
  delivery: {
    includedServiceRadius: 35,
    ratePerMile: 1.5,
  },
  discountCodes: {
    SUMMER10: 0.1,
  },
};

export const STANDARD_WALL_HEIGHT = DEFAULT_QUOTE_PRICING_CONFIG.standardWallHeight;
export const WALL_HEIGHT_PRICE_ADJUSTMENTS_PER_SQFT =
  DEFAULT_QUOTE_PRICING_CONFIG.wallHeightPriceAdjustmentsPerSqft;
/** Legacy 7-ft-baseline fallback for older publications. */
export const WALL_HEIGHT_PRICE_ADJUSTMENT_PER_SQFT =
  DEFAULT_QUOTE_PRICING_CONFIG.wallHeightPriceAdjustmentPerSqft;
export const BARN_PRICE_PER_SQFT =
  DEFAULT_QUOTE_PRICING_CONFIG.roof.barnPricePerSqft;

export const STANDARD_FOOTPRINT_BASE_PRICES =
  DEFAULT_QUOTE_PRICING_CONFIG.footprintBasePrices;

export const CUSTOM_FOOTPRINT_PRICE_PER_SQFT =
  DEFAULT_QUOTE_PRICING_CONFIG.customFootprintPricePerSqft;
export const CUSTOM_FOOTPRINT_PRICE_ROUNDING =
  DEFAULT_QUOTE_PRICING_CONFIG.customFootprintPriceRounding;

export const DELIVERY_INCLUDED_SERVICE_RADIUS =
  DEFAULT_QUOTE_PRICING_CONFIG.delivery.includedServiceRadius;
export const DELIVERY_RATE_PER_MILE = DEFAULT_QUOTE_PRICING_CONFIG.delivery.ratePerMile;

export const DISCOUNT_CODES = DEFAULT_QUOTE_PRICING_CONFIG.discountCodes;
export const WINDOW_PACKAGE_PRICES = DEFAULT_QUOTE_PRICING_CONFIG.windows;
export const DOOR_PRICES = DEFAULT_QUOTE_PRICING_CONFIG.doors;
export const EXTERIOR_UPGRADES = DEFAULT_QUOTE_PRICING_CONFIG.exteriorUpgrades;
