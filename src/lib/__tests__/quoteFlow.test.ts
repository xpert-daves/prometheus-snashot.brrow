import { initialQuoteFormParams } from '../quoteForm';
import { DEFAULT_QUOTE_PRICING_CONFIG } from '../pricing/pricingData';
import {
  createInitialQuoteFlowState,
  DOOR_OPTIONS,
  EXTERIOR_UPGRADE_OPTIONS,
  getRampAddOnForDoor,
  getQuoteBlockingField,
  getQuoteErrors,
  getStructureLabel,
  getQuoteViewModel,
  hasRampAddOn,
  quoteFlowReducer,
  removeRampAddOns,
  setRampAddOn,
  STRUCTURE_OPTIONS,
  syncRampAddOnForDoor,
  WINDOW_PACKAGE_OPTIONS,
  type QuoteDraft,
} from '../quoteFlow';
import { getQuoteStructureOptions } from '../quoteStructureOptions';

const mockEstimate = {
  kind: 'build_subtotal' as const,
  delivery: {
    status: 'pending_verification' as const,
    includedInTotal: false as const,
  },
};

describe('quoteFlow', () => {
  it('combines storage sheds and garages into one customer-facing option', () => {
    expect(STRUCTURE_OPTIONS).toContainEqual({
      value: 'storage_shed',
      label: 'Storage Shed / Garage',
    });
    expect(STRUCTURE_OPTIONS.map((option) => option.value)).not.toContain(
      'portable_garage'
    );
    expect(getStructureLabel('portable_garage')).toBe('Storage Shed / Garage');
    expect(getStructureLabel('open_loafing')).toBe(
      'Loafing Shed / 3-Sided Shelter'
    );
  });

  it('keeps quote UI options aligned with pricing config keys', () => {
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.doors).sort()).toEqual(
      DOOR_OPTIONS.map((option) => option.value).sort()
    );
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.windows).sort()).toEqual(
      [...WINDOW_PACKAGE_OPTIONS].sort()
    );
    expect(Object.keys(DEFAULT_QUOTE_PRICING_CONFIG.exteriorUpgrades).sort()).toEqual(
      [...EXTERIOR_UPGRADE_OPTIONS].sort()
    );
  });

  it('derives view-model visibility from the selected structure type', () => {
    const draft = {
      ...initialQuoteFormParams,
      structureType: 'carport' as const,
    };

    const viewModel = getQuoteViewModel(draft, getQuoteErrors(draft));

    expect(viewModel.showFrameGauge).toBe(true);
    expect(viewModel.showDoorOptions).toBe(false);
    expect(viewModel.showUpgrades).toBe(false);
  });

  it('marks the first step as ready when size/style inputs are valid', () => {
    const draft = {
      ...initialQuoteFormParams,
      structureType: 'storage_shed' as const,
      length: '12',
      width: '10',
      name: 'Test User',
      email: 'info@shed210.com',
      phone: '(210) 555-0000',
    };

    const viewModel = getQuoteViewModel(draft, getQuoteErrors(draft));

    expect(viewModel.step1Valid).toBe(true);
    expect(viewModel.area).toBe(120);
  });

  it('resets flow state back to the initial draft', () => {
    let state = createInitialQuoteFlowState();

    state = quoteFlowReducer(state, {
      type: 'replace_draft',
      draft: {
        ...initialQuoteFormParams,
        structureType: 'storage_shed',
        length: '20',
        wallHeight: '8',
      },
    });
    state = quoteFlowReducer(state, { type: 'set_step', step: 2 });
    state = quoteFlowReducer(state, {
      type: 'set_submission',
      submission: {
        status: 'success',
        quote: {
          id: 'quote-123',
          total: 100,
          breakdown: {
            base: 100,
            wallHeight: 0,
            roof: 0,
            siding: 0,
            door: 0,
            windows: 0,
            addOns: 0,
            delivery: 0,
            discount: 0,
            interiorUpgrades: [],
          },
          estimate: mockEstimate,
        },
      },
    });

    state = quoteFlowReducer(state, { type: 'reset' });

    expect(state).toEqual(createInitialQuoteFlowState());
    expect(state.draft.wallHeight).toBe('6');
  });

  it('clears quote result for comparison while keeping draft and delivery context', () => {
    let state = createInitialQuoteFlowState();
    const draft = {
      ...initialQuoteFormParams,
      structureType: 'storage_shed' as const,
      length: '16',
      name: 'Test User',
      email: 'info@shed210.com',
      phone: '(210) 555-0000',
    };

    state = quoteFlowReducer(state, { type: 'replace_draft', draft });
    state = quoteFlowReducer(state, { type: 'set_delivery_zip', deliveryZip: '78205' });
    state = quoteFlowReducer(state, { type: 'set_step', step: 2 });
    state = quoteFlowReducer(state, {
      type: 'set_submission',
      submission: {
        status: 'success',
        quote: {
          id: 'quote-123',
          total: 100,
          breakdown: {
            base: 100,
            wallHeight: 0,
            roof: 0,
            siding: 0,
            door: 0,
            windows: 0,
            addOns: 0,
            delivery: 0,
            discount: 0,
            interiorUpgrades: [],
          },
          estimate: mockEstimate,
        },
      },
    });

    state = quoteFlowReducer(state, { type: 'compare_another_option' });

    expect(state.draft).toEqual(draft);
    expect(state.deliveryZip).toBe('78205');
    expect(state.currentStep).toBe(0);
    expect(state.submission).toEqual({ status: 'idle' });
  });

  describe('options a structure type hides', () => {
    const barnShedWithWindows = {
      ...initialQuoteFormParams,
      structureType: 'storage_shed' as const,
      roofStyle: 'barn',
      windowPackage: '24x36',
      windowCount: '4',
    };

    function switchStructureType(
      draft: QuoteDraft,
      structureType: QuoteDraft['structureType'],
      changes: Partial<QuoteDraft> = {}
    ) {
      let state = quoteFlowReducer(createInitialQuoteFlowState(), {
        type: 'replace_draft',
        draft,
      });
      state = quoteFlowReducer(state, {
        type: 'replace_draft',
        draft: { ...state.draft, structureType, ...changes },
      });
      return state.draft;
    }

    it('keeps the roof style and windows on the types that offer them', () => {
      const state = quoteFlowReducer(createInitialQuoteFlowState(), {
        type: 'replace_draft',
        draft: barnShedWithWindows,
      });

      expect(state.draft).toBe(barnShedWithWindows);
      expect(switchStructureType(barnShedWithWindows, 'portable_garage')).toMatchObject({
        roofStyle: 'barn',
        windowPackage: '24x36',
        windowCount: '4',
      });
    });

    it.each(['carport', 'open_loafing', 'well_pump'] as const)(
      'resets a barn roof and windows when a shed switches to %s',
      (structureType) => {
        const draft = switchStructureType(barnShedWithWindows, structureType);

        expect(draft).toMatchObject({
          structureType,
          roofStyle: 'gabled',
          windowPackage: '',
          windowCount: '1',
        });
        expect(getQuoteViewModel(draft, getQuoteErrors(draft))).toMatchObject({
          showRoofStyle: false,
          showWindowPackage: false,
        });
      }
    );

    it('keeps greenhouse windows but drops the hidden barn roof', () => {
      const draft = switchStructureType(barnShedWithWindows, 'greenhouse');

      expect(draft).toMatchObject({
        structureType: 'greenhouse',
        roofStyle: 'gabled',
        windowPackage: '24x36',
        windowCount: '4',
      });
    });

    it('lets a former lean-to shed become a carport wider than the lean-to span', () => {
      const leanToShed = { ...barnShedWithWindows, roofStyle: 'lean-to' };
      const draft = switchStructureType(leanToShed, 'carport', {
        length: '20',
        width: '20',
      });
      const errors = getQuoteErrors(draft);

      expect(draft.roofStyle).toBe('gabled');
      expect(errors.width).toBeUndefined();
      expect(getQuoteViewModel(draft, errors).step1Valid).toBe(true);
    });

    it('still applies the lean-to span to a storage shed', () => {
      const draft = switchStructureType(
        { ...barnShedWithWindows, roofStyle: 'lean-to' },
        'storage_shed',
        { width: '20' }
      );

      expect(draft.roofStyle).toBe('lean-to');
      expect(getQuoteErrors(draft).width).toBe('Lean-to roof max span: 16ft');
    });

    it('resets ventilation outside greenhouses and well pump houses', () => {
      const ventedGreenhouse = {
        ...barnShedWithWindows,
        structureType: 'greenhouse' as const,
        ventilation: true,
      };

      expect(switchStructureType(ventedGreenhouse, 'well_pump').ventilation).toBe(true);
      expect(switchStructureType(ventedGreenhouse, 'storage_shed').ventilation).toBe(false);
    });

    it.each([
      ['storage_shed', true, true, false],
      ['portable_garage', true, true, false],
      ['greenhouse', false, true, true],
      ['well_pump', false, false, true],
      ['open_loafing', false, false, false],
      ['carport', false, false, false],
    ] as const)(
      'shows the %s controls for the options it offers',
      (structureType, roofStyle, windowPackage, ventilation) => {
        const draft = { ...initialQuoteFormParams, structureType };

        expect(getQuoteStructureOptions(structureType)).toEqual({
          roofStyle,
          windowPackage,
          ventilation,
        });
        expect(getQuoteViewModel(draft, getQuoteErrors(draft))).toMatchObject({
          showRoofStyle: roofStyle,
          showWindowPackage: windowPackage,
          showVentilation: ventilation,
        });
      }
    );
  });

  it('maps ramp add-ons to supported shed door types', () => {
    expect(getRampAddOnForDoor('single_shed')).toBe('Ramp (Single Door)');
    expect(getRampAddOnForDoor('double_shed')).toBe('Ramp (Double Door)');
    expect(getRampAddOnForDoor('garage_roll_up')).toBeNull();
    expect(getRampAddOnForDoor('house')).toBeNull();
  });

  it('sets, removes, and syncs ramp add-ons without duplicating ramp SKUs', () => {
    expect(
      setRampAddOn(['Ground Anchoring', 'Ramp (Double Door)'], 'Ramp (Single Door)', true)
    ).toEqual(['Ground Anchoring', 'Ramp (Single Door)']);
    expect(
      setRampAddOn(['Ground Anchoring', 'Ramp (Single Door)'], 'Ramp (Single Door)', false)
    ).toEqual(['Ground Anchoring']);
    expect(
      syncRampAddOnForDoor(['Ground Anchoring', 'Ramp (Single Door)'], 'double_shed')
    ).toEqual(['Ground Anchoring', 'Ramp (Double Door)']);
    expect(
      syncRampAddOnForDoor(['Ground Anchoring', 'Ramp (Double Door)'], 'garage_roll_up')
    ).toEqual(['Ground Anchoring']);
    expect(hasRampAddOn(['Ground Anchoring', 'Ramp (Single Door)'])).toBe(true);
    expect(removeRampAddOns(['Ramp (Single Door)', 'Steps', 'Ramp (Double Door)'])).toEqual([
      'Steps',
    ]);
  });

  it('names the first field a blocked Get Quote sends the visitor to', () => {
    const ready: QuoteDraft = {
      ...initialQuoteFormParams,
      structureType: 'storage_shed',
      name: 'Test User',
      email: 'info@shed210.com',
      phone: '(210) 555-0000',
      smsConsentOptIn: true,
    };
    const field = (draft: QuoteDraft) => getQuoteBlockingField(draft, getQuoteErrors(draft));

    expect(field(ready)).toBeUndefined();
    expect(field({ ...ready, structureType: '', name: '' })).toBe('selection');
    expect(field({ ...ready, length: '0', name: '' })).toBe('selection');
    expect(field({ ...ready, name: '', smsConsentOptIn: false })).toBe('name');
    expect(field({ ...ready, email: 'not-an-email', phone: '' })).toBe('email');
    expect(field({ ...ready, phone: '123', smsConsentOptIn: false })).toBe('phone');
    expect(field({ ...ready, smsConsentOptIn: false })).toBe('consent');
    expect(field({ ...ready, deliveryAddress: 'x'.repeat(1000) })).toBe('address');
  });
});
