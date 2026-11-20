import { calculateQuote } from '../calculateQuote';
import { DEFAULT_QUOTE_PRICING_CONFIG, type QuotePricingConfig } from '../pricingData';

function pricingConfig(overrides: (config: QuotePricingConfig) => void) {
  const config = JSON.parse(
    JSON.stringify(DEFAULT_QUOTE_PRICING_CONFIG)
  ) as QuotePricingConfig;
  overrides(config);
  return config;
}

describe('calculateQuote', () => {
  it('calculates base quote without extras', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'gabled',
      siding: 'metal',
      door: 'single_shed',
      deliveryRadius: 5,
    });
    expect(result.total).toBe(2700);
  });

  it('exposes the 10x12 calibration contradiction from the literal rates', () => {
    const barn = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 12,
      roofStyle: 'barn',
      wallHeight: 7,
      door: 'single_shed',
      deliveryRadius: 5,
    });
    const gabled = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 12,
      roofStyle: 'gabled',
      wallHeight: 7,
      door: 'single_shed',
      deliveryRadius: 5,
    });

    expect(barn.breakdown).toMatchObject({
      base: 3000,
      wallHeight: 360,
      roof: 540,
    });
    expect(barn.total).toBe(3900);
    expect(barn.total).not.toBe(3800);
    expect(gabled.breakdown).toMatchObject({
      base: 3000,
      wallHeight: 360,
      roof: 0,
    });
    expect(gabled.total).toBe(3360);
  });

  it('recalculates the still-pending 12x14 quote from the literal rates', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 12,
      width: 14,
      roofStyle: 'barn',
      wallHeight: 8,
      roofMaterial: '26ga metal',
      door: 'garage_roll_up',
      foundation: 'anchored_slab',
      addOns: ['Workbench', 'Skirting'],
      deliveryRadius: 5,
    });

    expect(result.breakdown).toMatchObject({
      base: 3800,
      wallHeight: 168 * 6,
      roof: 756,
      door: 750,
      addOns: 442,
    });
    expect(result.total).toBe(6756);
  });

  it('applies discount code', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'gabled',
      siding: 'metal',
      door: 'single_shed',
      deliveryRadius: 5,
      discountCode: 'SUMMER10',
    });
    expect(result.total).toBe(2430);
  });

  it.each(['summer10', 'Summer10', ' SUMMER10 '])(
    'applies discount code %p regardless of case or spacing',
    (discountCode) => {
      const result = calculateQuote({
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        roofStyle: 'gabled',
        door: 'single_shed',
        deliveryRadius: 5,
        discountCode,
      });

      expect(result.breakdown.discount).toBe(270);
      expect(result.total).toBe(2430);
    }
  );

  it.each(['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'])(
    'ignores inherited object name %p as a discount code',
    (discountCode) => {
      const result = calculateQuote({
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        roofStyle: 'gabled',
        door: 'single_shed',
        deliveryRadius: 5,
        discountCode,
      });

      expect(result.breakdown.discount).toBe(0);
      expect(Number.isFinite(result.total)).toBe(true);
      expect(result.total).toBe(2700);
    }
  );

  it('matches a lowercase key from a legacy pricing row', () => {
    const config = pricingConfig((draft) => {
      draft.discountCodes = { spring5: 0.05 };
    });

    for (const discountCode of ['SPRING5', 'spring5', 'Spring5']) {
      const result = calculateQuote(
        {
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          roofStyle: 'gabled',
          deliveryRadius: 5,
          discountCode,
        },
        config
      );

      expect(result.breakdown.discount).toBe(135);
      expect(result.total).toBe(2565);
    }
  });

  it('ignores a matched code whose rate is zero or out of range', () => {
    const config = pricingConfig((draft) => {
      draft.discountCodes = { ZERO: 0, TOOMUCH: 1.5, BROKEN: Number.NaN };
    });

    for (const discountCode of ['ZERO', 'TOOMUCH', 'BROKEN']) {
      const result = calculateQuote(
        {
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          roofStyle: 'gabled',
          deliveryRadius: 5,
          discountCode,
        },
        config
      );

      expect(result.breakdown.discount).toBe(0);
      expect(result.total).toBe(2700);
    }
  });

  it('charges for double door', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'gabled',
      siding: 'metal',
      door: 'double_shed',
      deliveryRadius: 5,
    });
    expect(result.total).toBe(2885);
  });

  it('charges a flat lean-to roof surcharge', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'lean-to',
      siding: 'metal',
      door: 'single_shed',
      deliveryRadius: 5,
    });

    expect(result.breakdown.roof).toBe(360);
    expect(result.total).toBe(3060);
  });

  it('uses the footprint table as the included 6-ft gabled baseline', () => {
    const sixFoot = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    expect(sixFoot.breakdown.base).toBe(2700);
    expect(sixFoot.breakdown.wallHeight).toBe(0);
    expect(sixFoot.total).toBe(2700);
  });

  it('uses the included 6-ft price when wall height is omitted', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 5,
    });

    expect(result.breakdown.base).toBe(2700);
    expect(result.breakdown.wallHeight).toBe(0);
    expect(result.total).toBe(2700);
  });

  it('adds explicit floor-area wall surcharges for 7-ft and 8-ft walls', () => {
    const sevenFoot = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      wallHeight: 7,
      deliveryRadius: 5,
    });

    expect(sevenFoot.breakdown.base).toBe(2700);
    expect(sevenFoot.breakdown.wallHeight).toBe(300);
    expect(sevenFoot.total).toBe(3000);

    const eightFoot = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      wallHeight: 8,
      deliveryRadius: 5,
    });
    expect(eightFoot.breakdown.base).toBe(2700);
    expect(eightFoot.breakdown.wallHeight).toBe(600);
    expect(eightFoot.total).toBe(3300);
  });

  it('charges more for each taller wall in the default price list', () => {
    const rates = DEFAULT_QUOTE_PRICING_CONFIG.wallHeightPriceAdjustmentsPerSqft!;
    const totalFor = (wallHeight: 6 | 7 | 8) =>
      calculateQuote({ structureType: 'storage_shed', length: 10, width: 12, wallHeight, deliveryRadius: 0 })
        .total;

    expect(rates.seven).toBeGreaterThan(rates.six);
    expect(rates.eight).toBeGreaterThan(rates.seven);
    expect(totalFor(7)).toBeGreaterThan(totalFor(6));
    expect(totalFor(8)).toBeGreaterThan(totalFor(7));
  });

  it('adds exterior upgrade costs', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      roofStyle: 'gabled',
      siding: 'metal',
      door: 'single_shed',
      deliveryRadius: 5,
      addOns: ['Ground Anchoring', 'Skirting'],
    });
    // perimeter = 40 ft, skirting priced per linear foot
    expect(result.breakdown.addOns).toBe(350 + 8.5 * 40);
    expect(result.breakdown.interiorUpgrades).toEqual([]);
    expect(result.total).toBe(3390);
  });

  it('charges the selected ramp add-on SKU', () => {
    const singleRamp = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      door: 'single_shed',
      deliveryRadius: 5,
      addOns: ['Ramp (Single Door)'],
    });
    expect(singleRamp.breakdown.addOns).toBe(195);

    const doubleRamp = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      door: 'double_shed',
      deliveryRadius: 5,
      addOns: ['Ramp (Double Door)'],
    });
    expect(doubleRamp.breakdown.door).toBe(185);
    expect(doubleRamp.breakdown.addOns).toBe(249);
  });

  it('lists interior upgrades separately', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 5,
      addOns: ['Workbench', 'Loft'],
    });
    expect(result.breakdown.addOns).toBe(0);
    expect(result.breakdown.interiorUpgrades).toEqual(['Workbench', 'Loft']);
  });

  it('includes built-on-site service inside the current service area', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 35,
    });

    expect(result.breakdown.delivery).toBe(0);
    expect(result.total).toBe(2700);
  });

  it('adds a distance surcharge outside the current service area', () => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 10,
      deliveryRadius: 75,
    });

    expect(result.breakdown.delivery).toBe(112.5);
    expect(result.total).toBe(2813);
  });

  it.each([
    [6, 6, 1600],
    [8, 6, 1900],
    [8, 8, 2100],
    [10, 8, 2400],
    [10, 10, 2700],
    [12, 10, 3000],
    [12, 12, 3400],
    [14, 12, 3800],
    [14, 14, 4200],
    [16, 14, 4500],
    [16, 16, 4900],
  ])('uses the owner price table for %ix%i', (length, width, expected) => {
    const result = calculateQuote({
      structureType: 'storage_shed',
      length,
      width,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    expect(result.breakdown.base).toBe(expected);
    expect(result.total).toBe(expected);
  });

  it('uses table pricing regardless of orientation', () => {
    const landscapeResult = calculateQuote({
      structureType: 'storage_shed',
      length: 10,
      width: 8,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    const portraitResult = calculateQuote({
      structureType: 'storage_shed',
      length: 8,
      width: 10,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    expect(landscapeResult.total).toBe(2400);
    expect(portraitResult.total).toBe(2400);
  });

  it('rounds non-listed sizes up to the smallest containing table footprint', () => {
    const sixBySeven = calculateQuote({
      structureType: 'storage_shed',
      length: 6,
      width: 7,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    const sixByNine = calculateQuote({
      structureType: 'storage_shed',
      length: 6,
      width: 9,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    const elevenByThirteen = calculateQuote({
      structureType: 'storage_shed',
      length: 11,
      width: 13,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    expect(sixBySeven.total).toBe(1900);
    expect(sixByNine.total).toBe(2400);
    expect(elevenByThirteen.total).toBe(3800);
  });

  it('uses table-derived square-foot pricing for sizes beyond the table', () => {
    const twelveByTwenty = calculateQuote({
      structureType: 'storage_shed',
      length: 12,
      width: 20,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    const twentyByTwenty = calculateQuote({
      structureType: 'storage_shed',
      length: 20,
      width: 20,
      wallHeight: 6,
      deliveryRadius: 5,
    });

    expect(twelveByTwenty.total).toBe(4700);
    expect(twentyByTwenty.total).toBe(7100);
  });

  it('uses configured pricing overrides across the priced components', () => {
    const config = pricingConfig((draft) => {
      draft.standardWallHeight = 7;
      delete draft.wallHeightPriceAdjustmentsPerSqft;
      draft.footprintBasePrices[4].price = 3000;
      draft.customFootprintPricePerSqft = 20;
      draft.customFootprintPriceRounding = 50;
      draft.wallHeightPriceAdjustmentPerSqft = 6;
      delete draft.roof.barnPricePerSqft;
      draft.roof.barnMultiplier = 1.2;
      draft.roof.leanToFlatCost = 500;
      draft.doors.double_shed = 250;
      draft.windows['24x36'] = 300;
      draft.exteriorUpgrades['Ramp (Double Door)'] = { price: 275, mode: 'flat' };
      draft.exteriorUpgrades.Skirting = { price: 10, mode: 'per_linear_foot' };
      draft.delivery.includedServiceRadius = 10;
      draft.delivery.ratePerMile = 2;
      draft.discountCodes.TEST15 = 0.15;
    });

    const result = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        wallHeight: 8,
        roofStyle: 'barn',
        door: 'double_shed',
        windowPackage: '24x36',
        windowCount: 2,
        addOns: ['Skirting', 'Ramp (Double Door)'],
        deliveryRadius: 20,
        discountCode: 'TEST15',
      },
      config
    );

    expect(result.breakdown.base).toBe(3000);
    expect(result.breakdown.wallHeight).toBe(600);
    expect(result.breakdown.roof).toBeCloseTo(600);
    expect(result.breakdown.door).toBe(250);
    expect(result.breakdown.windows).toBe(600);
    expect(result.breakdown.addOns).toBe(675);
    expect(result.breakdown.delivery).toBe(40);
    expect(result.breakdown.discount).toBe(864.75);
    expect(result.total).toBe(4900);
  });

  it('uses the explicit barn floor-area rule when no exact override exists', () => {
    const config = pricingConfig((draft) => {
      draft.footprintBasePrices[4].roofStylePriceOverrides = {};
      draft.roof.barnPricePerSqft = 4.5;
      draft.roof.leanToFlatCost = 425;
    });

    const barn = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );
    const leanTo = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        roofStyle: 'lean-to',
        deliveryRadius: 5,
      },
      config
    );

    expect(barn.breakdown.roof).toBe(450);
    expect(barn.total).toBe(3150);
    expect(leanTo.breakdown.roof).toBe(425);
    expect(leanTo.total).toBe(3125);
  });

  it('applies full roof prices only to the exact configured footprint', () => {
    const config = pricingConfig((draft) => {
      draft.footprintBasePrices[5].roofStylePriceOverrides = {
        barn: 3800,
      };
    });

    const exactSixFoot = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 12,
        wallHeight: 6,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );
    const exactSevenFoot = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 12,
        width: 10,
        wallHeight: 7,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );
    const roundedCustomSize = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 9,
        width: 11,
        wallHeight: 6,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );

    expect(exactSixFoot.breakdown).toMatchObject({
      base: 3000,
      wallHeight: 0,
      roof: 800,
    });
    expect(exactSixFoot.total).toBe(3800);
    expect(exactSevenFoot.breakdown).toMatchObject({
      base: 3000,
      wallHeight: 360,
      roof: 800,
    });
    expect(exactSevenFoot.total).toBe(4160);
    expect(roundedCustomSize.breakdown).toMatchObject({
      base: 3000,
      wallHeight: 0,
      roof: 445.5,
    });
    expect(roundedCustomSize.total).toBe(3446);
  });

  it.each(['greenhouse', 'carport', 'well_pump', 'open_loafing'] as const)(
    'prices a %s sent with a leftover barn or lean-to roof as gabled',
    (structureType) => {
      const config = pricingConfig((draft) => {
        draft.footprintBasePrices[5].roofStylePriceOverrides = {
          barn: 3800,
          leanTo: 3500,
        };
      });

      // 10x12 has exact roof overrides; 10x10 falls back to the global rule.
      for (const [length, width] of [
        [10, 12],
        [10, 10],
      ]) {
        const params = { structureType, length, width, deliveryRadius: 5 };
        const gabled = calculateQuote({ ...params, roofStyle: 'gabled' }, config);

        expect(gabled.breakdown.roof).toBe(0);
        expect(calculateQuote({ ...params, roofStyle: 'barn' }, config)).toEqual(gabled);
        expect(calculateQuote({ ...params, roofStyle: 'lean-to' }, config)).toEqual(gabled);
      }
    }
  );

  it('still prices barn and lean-to roofs for the legacy portable garage id', () => {
    const params = {
      structureType: 'portable_garage',
      length: 10,
      width: 10,
      deliveryRadius: 5,
    } as const;

    expect(calculateQuote({ ...params, roofStyle: 'barn' }).breakdown.roof).toBe(450);
    expect(calculateQuote({ ...params, roofStyle: 'lean-to' }).breakdown.roof).toBe(360);
  });

  it('preserves legacy 7-ft baseline and barn-multiplier publications', () => {
    const config = pricingConfig((draft) => {
      draft.standardWallHeight = 7;
      delete draft.wallHeightPriceAdjustmentsPerSqft;
      delete draft.roof.barnPricePerSqft;
      draft.wallHeightPriceAdjustmentPerSqft = 4;
      draft.roof.barnMultiplier = 1.1;
    });

    const sixFoot = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        wallHeight: 6,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );
    const sevenFoot = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        wallHeight: 7,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );
    const eightFoot = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 10,
        width: 10,
        wallHeight: 8,
        roofStyle: 'barn',
        deliveryRadius: 5,
      },
      config
    );

    expect(sixFoot.breakdown).toMatchObject({
      base: 2300,
      wallHeight: 0,
    });
    expect(sixFoot.breakdown.roof).toBeCloseTo(230);
    expect(sixFoot.total).toBe(2530);
    expect(sevenFoot.breakdown).toMatchObject({
      base: 2700,
      wallHeight: 0,
    });
    expect(sevenFoot.breakdown.roof).toBeCloseTo(270);
    expect(sevenFoot.total).toBe(2970);
    expect(eightFoot.breakdown).toMatchObject({
      base: 2700,
      wallHeight: 400,
    });
    expect(eightFoot.breakdown.roof).toBeCloseTo(270);
    expect(eightFoot.total).toBe(3370);
  });

  it('uses configured custom square-foot and lean-to roof pricing', () => {
    const config = pricingConfig((draft) => {
      draft.customFootprintPricePerSqft = 22;
      draft.customFootprintPriceRounding = 25;
      draft.roof.leanToFlatCost = 425;
    });

    const result = calculateQuote(
      {
        structureType: 'storage_shed',
        length: 20,
        width: 20,
        roofStyle: 'lean-to',
        wallHeight: 6,
        deliveryRadius: 5,
      },
      config
    );

    expect(result.breakdown.base).toBe(9625);
    expect(result.breakdown.roof).toBe(425);
    expect(result.total).toBe(10050);
  });
});
