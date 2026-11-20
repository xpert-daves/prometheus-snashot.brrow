import {
  DEFAULT_QUOTE_PRICING_CONFIG,
  type FootprintBasePrice,
  type QuotePricingConfig,
} from './pricingData';
import { isExteriorUpgradeName, isInteriorUpgradeName } from './upgradeOptions';
import { getQuoteStructureOptions } from '@/lib/quoteStructureOptions';

export type StructureType =
  | 'storage_shed'
  | 'portable_garage'
  | 'greenhouse'
  | 'well_pump'
  | 'open_loafing'
  | 'carport';

export type QuoteParams = {
  structureType: StructureType;
  length: number; // feet
  width: number; // feet
  roofStyle?: 'gabled' | 'barn' | 'lean-to';
  wallHeight?: 6 | 7 | 8;
  roofMaterial?: '29ga metal' | '26ga metal';
  frameGauge?: '14-ga' | '12-ga';
  windowPackage?: string;
  windowCount?: number;
  ventilation?: boolean;
  color?: string;
  addOns?: string[];
  foundation?: 'none' | 'blocks_level' | 'anchored_slab';
  deliveryAddress?: string;
  deliveryZip?: string;
  door?: 'single_shed' | 'double_shed' | 'garage_roll_up' | 'house';
  siding?: 'metal';
  deliveryRadius: number; // miles
  discountCode?: string;
};

export type QuoteBreakdown = {
  base: number;
  wallHeight: number;
  roof: number;
  siding: number;
  door: number;
  windows: number;
  addOns: number;
  delivery: number;
  discount: number;
  interiorUpgrades: string[];
};

export type QuoteResult = {
  total: number;
  breakdown: QuoteBreakdown;
};

function areaForFootprint({ length, width }: Pick<FootprintBasePrice, 'length' | 'width'>) {
  return length * width;
}

function sortedDimensions(length: number, width: number) {
  return {
    shortSide: Math.min(length, width),
    longSide: Math.max(length, width),
  };
}

function roundUpToIncrement(value: number, increment: number) {
  return Math.ceil(value / increment) * increment;
}

function findContainingFootprint(
  length: number,
  width: number,
  pricingConfig: QuotePricingConfig
) {
  const requested = sortedDimensions(length, width);

  return pricingConfig.footprintBasePrices.filter((footprint) => {
    const candidate = sortedDimensions(footprint.length, footprint.width);
    return (
      candidate.shortSide >= requested.shortSide &&
      candidate.longSide >= requested.longSide
    );
  }).sort(
    (a, b) => areaForFootprint(a) - areaForFootprint(b) || a.price - b.price
  )[0];
}

function findExactFootprint(
  length: number,
  width: number,
  pricingConfig: QuotePricingConfig
) {
  const requested = sortedDimensions(length, width);

  return pricingConfig.footprintBasePrices.find((footprint) => {
    const candidate = sortedDimensions(footprint.length, footprint.width);
    return (
      candidate.shortSide === requested.shortSide &&
      candidate.longSide === requested.longSide
    );
  });
}

function calculateStandardWallPricing(
  length: number,
  width: number,
  pricingConfig: QuotePricingConfig
) {
  const containingFootprint = findContainingFootprint(length, width, pricingConfig);
  if (containingFootprint) {
    return {
      basePrice: containingFootprint.price,
      exactFootprint: findExactFootprint(length, width, pricingConfig) ?? null,
    };
  }

  const smallestFootprint = pricingConfig.footprintBasePrices[0];
  const area = length * width;
  const interpolated =
    smallestFootprint.price +
    (area - areaForFootprint(smallestFootprint)) *
      pricingConfig.customFootprintPricePerSqft;

  return {
    basePrice: roundUpToIncrement(
      Math.max(smallestFootprint.price, interpolated),
      pricingConfig.customFootprintPriceRounding
    ),
    exactFootprint: null,
  };
}

function wallHeightKey(wallHeight: 6 | 7 | 8) {
  if (wallHeight === 6) return 'six' as const;
  if (wallHeight === 7) return 'seven' as const;
  return 'eight' as const;
}

export function calculateWallHeightPricing(
  wallHeight: 6 | 7 | 8,
  area: number,
  standardWallBase: number,
  pricingConfig: QuotePricingConfig
) {
  const explicitAdjustments = pricingConfig.wallHeightPriceAdjustmentsPerSqft;
  if (explicitAdjustments) {
    return {
      base: standardWallBase,
      surcharge:
        explicitAdjustments[wallHeightKey(wallHeight)] * area,
    };
  }

  // Compatibility mode for already-published configs whose footprint table is
  // a 7-ft baseline and whose one rate is subtracted for 6 ft or added for 8 ft.
  return {
    base:
      standardWallBase +
      (wallHeight === 6
        ? -pricingConfig.wallHeightPriceAdjustmentPerSqft * area
        : 0),
    surcharge:
      wallHeight === 8
        ? pricingConfig.wallHeightPriceAdjustmentPerSqft * area
        : 0,
  };
}

export function calculateBarnRoofSurcharge(
  area: number,
  base: number,
  pricingConfig: QuotePricingConfig
) {
  return pricingConfig.roof.barnPricePerSqft !== undefined
    ? pricingConfig.roof.barnPricePerSqft * area
    : base * (pricingConfig.roof.barnMultiplier - 1);
}

function findDiscountRate(
  discountCode: string | undefined,
  discountCodes: QuotePricingConfig['discountCodes']
) {
  const code = discountCode?.trim().toUpperCase();
  if (!code) return undefined;

  // CRM publications only hold uppercase codes, but older Shed rows may keep
  // lowercase keys. Own keys only, so names like 'constructor' never match.
  const matchingKey = Object.hasOwn(discountCodes, code)
    ? code
    : Object.keys(discountCodes).find((key) => key.toUpperCase() === code);
  if (matchingKey === undefined) return undefined;

  const rate = discountCodes[matchingKey];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate <= 1
    ? rate
    : undefined;
}

export function calculateQuote(
  params: QuoteParams,
  pricingConfig: QuotePricingConfig = DEFAULT_QUOTE_PRICING_CONFIG
): QuoteResult {
  const area = params.length * params.width;
  const wallHeightEligible = ['storage_shed', 'portable_garage', 'greenhouse'].includes(
    params.structureType
  );
  const wallHeight = wallHeightEligible
    ? params.wallHeight ?? pricingConfig.standardWallHeight
    : pricingConfig.standardWallHeight;
  const standardWallPricing = calculateStandardWallPricing(
    params.length,
    params.width,
    pricingConfig
  );
  const standardWallBase = standardWallPricing.basePrice;
  const wallHeightPricing = calculateWallHeightPricing(
    wallHeight,
    area,
    standardWallBase,
    pricingConfig
  );
  const base = wallHeightPricing.base;
  const wallHeightCost = wallHeightEligible
    ? wallHeightPricing.surcharge
    : 0;

  // A roof style left over from an earlier structure type is priced as gabled.
  const roof = getQuoteStructureOptions(params.structureType).roofStyle
    ? params.roofStyle || 'gabled'
    : 'gabled';
  const door = params.door || 'single_shed';

  const roofPriceOverride =
    roof === 'barn'
      ? standardWallPricing.exactFootprint?.roofStylePriceOverrides?.barn
      : roof === 'lean-to'
        ? standardWallPricing.exactFootprint?.roofStylePriceOverrides?.leanTo
        : undefined;
  const roofCost =
    roofPriceOverride !== undefined
      ? roofPriceOverride - standardWallBase
      : roof === 'barn'
        ? calculateBarnRoofSurcharge(area, base, pricingConfig)
        : roof === 'lean-to'
          ? pricingConfig.roof.leanToFlatCost
          : 0;
  const sidingMultiplier = 1;
  const doorCost = pricingConfig.doors[door] ?? 0;

  const windowCost =
    params.windowPackage === '24x36' && params.windowCount
      ? (pricingConfig.windows['24x36'] ?? 0) * params.windowCount
      : 0;

  const delivery =
    params.deliveryRadius > pricingConfig.delivery.includedServiceRadius
      ? params.deliveryRadius * pricingConfig.delivery.ratePerMile
      : 0;

  const addOns = params.addOns ?? [];
  const interiorUpgrades = addOns.filter(isInteriorUpgradeName);
  const perimeter = 2 * (params.length + params.width);
  const addOnCost = addOns.reduce((acc, name) => {
    if (!isExteriorUpgradeName(name)) return acc;
    const info = pricingConfig.exteriorUpgrades[name];
    const cost =
      info.mode === 'per_sqft'
        ? info.price * area
        : info.mode === 'per_linear_foot'
        ? info.price * perimeter
        : info.price;
    return acc + cost;
  }, 0);

  let subtotal =
    (base + roofCost) * sidingMultiplier +
    wallHeightCost +
    doorCost +
    windowCost +
    addOnCost +
    delivery;

  let discount = 0;
  const discountRate = findDiscountRate(
    params.discountCode,
    pricingConfig.discountCodes
  );
  if (discountRate !== undefined) {
    discount = subtotal * discountRate;
    subtotal -= discount;
  }

  return {
    total: Math.round(subtotal),
    breakdown: {
      base,
      wallHeight: wallHeightCost,
      roof: roofCost,
      siding: (base + roofCost) * (sidingMultiplier - 1),
      door: doorCost,
      windows: windowCost,
      addOns: addOnCost,
      delivery,
      discount,
      interiorUpgrades,
    },
  };
}
