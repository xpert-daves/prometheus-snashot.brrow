import {
  BUILDING_OPTIONS,
  getBuildingQuoteLabel,
} from '@/lib/buildingCatalog';
import {
  initialQuoteFormParams,
  type QuoteFormErrors,
  type QuoteFormParams,
  validateQuoteForm,
} from '@/lib/quoteForm';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';
import type { WebsiteFailureField } from '@/lib/websiteMeasurement';
import { QUOTE_DIMENSION_MAX_FT } from '@/lib/quoteLimits';
import {
  getQuoteStructureOptions,
  normalizeQuoteOptionsForStructure,
} from '@/lib/quoteStructureOptions';

export type QuoteDraft = QuoteFormParams;
export type QuoteFlowStep = 0 | 1 | 2;

export const SIZE_PRESETS = [
  { key: '8x10', label: '8 × 10', length: '10', width: '8' },
  { key: '10x12', label: '10 × 12', length: '12', width: '10' },
  { key: '12x14', label: '12 × 14', length: '14', width: '12' },
] as const;

export type QuotePresetKey = 'custom' | (typeof SIZE_PRESETS)[number]['key'];

export type QuoteSubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  // field: a form field the server rejected (QuoteSubmissionErrorField).
  | { status: 'error'; error: string; field?: 'email' }
  | { status: 'success'; quote: QuoteApiResponse };

export type QuoteFlowState = {
  draft: QuoteDraft;
  currentStep: QuoteFlowStep;
  deliveryZip: string;
  showDiscountCode: boolean;
  sizePreset: QuotePresetKey;
  submission: QuoteSubmissionState;
};

export const QUOTE_STEP_LABELS = [
  'Size & Style',
  'Materials',
  'Build Location & Contact',
] as const;

export const STRUCTURE_OPTIONS = BUILDING_OPTIONS;

export function getStructureLabel(structureType: QuoteFormParams['structureType']) {
  return structureType ? getBuildingQuoteLabel(structureType) : '—';
}

export const ROOF_STYLE_OPTIONS = ['gabled', 'barn', 'lean-to'] as const;
export const ROOF_MATERIAL_OPTIONS = ['29ga metal', '26ga metal'] as const;
export const DOOR_OPTIONS = [
  { value: 'single_shed', label: 'Single Shed' },
  { value: 'double_shed', label: 'Double Shed' },
  { value: 'garage_roll_up', label: 'Garage Roll Up' },
  { value: 'house', label: 'House Door' },
] as const;
export const FRAME_GAUGE_OPTIONS = ['14-ga', '12-ga'] as const;
export const WINDOW_PACKAGE_OPTIONS = ['24x36'] as const;
export const WALL_HEIGHT_OPTIONS = ['6', '7', '8'] as const;
export const EXTERIOR_UPGRADE_OPTIONS = [
  'Ground Anchoring',
  'Ramp (Single Door)',
  'Ramp (Double Door)',
  'Steps',
  'Skirting',
  '2-Tone',
  'Roof Overhang',
  'A/C Knock Out',
] as const;
export const INTERIOR_UPGRADE_OPTIONS = [
  'Workbench',
  'Loft',
  'Insulation',
  'Electrical Prep',
] as const;
export const RAMP_ADD_ONS = ['Ramp (Single Door)', 'Ramp (Double Door)'] as const;

export type RampAddOnName = (typeof RAMP_ADD_ONS)[number];

const rampAddOns = new Set<string>(RAMP_ADD_ONS);

export function isRampAddOn(option: string): option is RampAddOnName {
  return rampAddOns.has(option);
}

export function getRampAddOnForDoor(
  door: QuoteFormParams['door']
): RampAddOnName | null {
  if (door === 'single_shed') return 'Ramp (Single Door)';
  if (door === 'double_shed') return 'Ramp (Double Door)';
  return null;
}

export function hasRampAddOn(addOns: readonly string[]) {
  return addOns.some(isRampAddOn);
}

export function removeRampAddOns(addOns: readonly string[]) {
  return addOns.filter((addOn) => !isRampAddOn(addOn));
}

export function setRampAddOn(
  addOns: readonly string[],
  option: RampAddOnName,
  checked: boolean
) {
  const withoutRamp = removeRampAddOns(addOns);
  return checked ? [...withoutRamp, option] : withoutRamp;
}

export function syncRampAddOnForDoor(
  addOns: readonly string[],
  door: QuoteFormParams['door']
) {
  if (!hasRampAddOn(addOns)) return removeRampAddOns(addOns);

  const option = getRampAddOnForDoor(door);
  if (!option) return removeRampAddOns(addOns);
  return [...removeRampAddOns(addOns), option];
}

export type QuoteViewModel = {
  area: number | null;
  maxLength: number;
  maxWidth: number;
  step1Valid: boolean;
  isValid: boolean;
  showWallHeight: boolean;
  showRoofStyle: boolean;
  showRoofMaterial: boolean;
  showPanelMaterial: boolean;
  showFrameGauge: boolean;
  showDoorOptions: boolean;
  showWindowPackage: boolean;
  showVentilation: boolean;
  showColor: boolean;
  showUpgrades: boolean;
};

type QuoteFlowAction =
  | { type: 'replace_draft'; draft: QuoteDraft }
  | { type: 'set_step'; step: QuoteFlowStep }
  | { type: 'set_delivery_zip'; deliveryZip: string }
  | { type: 'set_show_discount_code'; showDiscountCode: boolean }
  | { type: 'set_size_preset'; sizePreset: QuotePresetKey }
  | { type: 'set_submission'; submission: QuoteSubmissionState }
  | { type: 'compare_another_option' }
  | { type: 'reset' };

export function deriveSizePreset(draft: QuoteDraft): QuotePresetKey {
  const match = SIZE_PRESETS.find(
    (preset) => preset.length === draft.length && preset.width === draft.width
  );
  return match?.key ?? 'custom';
}

export function createInitialQuoteFlowState(): QuoteFlowState {
  return {
    draft: initialQuoteFormParams,
    currentStep: 0,
    deliveryZip: '',
    showDiscountCode: false,
    sizePreset: deriveSizePreset(initialQuoteFormParams),
    submission: { status: 'idle' },
  };
}

export function quoteFlowReducer(
  state: QuoteFlowState,
  action: QuoteFlowAction
): QuoteFlowState {
  switch (action.type) {
    case 'replace_draft':
      // Every draft write (type switch, restored draft, prefill) lands here, so
      // a roof style, window or ventilation pick the new type hides is reset
      // before it is validated, previewed, saved or submitted.
      return {
        ...state,
        draft: normalizeQuoteOptionsForStructure(action.draft),
      };
    case 'set_step':
      return {
        ...state,
        currentStep: action.step,
      };
    case 'set_delivery_zip':
      return {
        ...state,
        deliveryZip: action.deliveryZip,
      };
    case 'set_show_discount_code':
      return {
        ...state,
        showDiscountCode: action.showDiscountCode,
      };
    case 'set_size_preset':
      return {
        ...state,
        sizePreset: action.sizePreset,
      };
    case 'set_submission':
      return {
        ...state,
        submission: action.submission,
      };
    case 'compare_another_option':
      return {
        ...state,
        currentStep: 0,
        submission: { status: 'idle' },
      };
    case 'reset':
      return createInitialQuoteFlowState();
    default:
      return state;
  }
}

export function getQuoteErrors(draft: QuoteDraft): QuoteFormErrors {
  return validateQuoteForm(draft);
}

/**
 * The first field a blocked Get Quote sends the visitor back to, in the order
 * the page guides them: building and options, then name, email, phone,
 * consent, and the build address. Measurement gets only this category.
 */
export function getQuoteBlockingField(
  draft: QuoteDraft,
  errors: QuoteFormErrors
): WebsiteFailureField | undefined {
  if (!draft.structureType || errors.length || errors.width || errors.windowCount || errors.addOns) {
    return 'selection';
  }
  if (errors.name) return 'name';
  if (errors.email) return 'email';
  if (errors.phone) return 'phone';
  if (errors.smsConsentOptIn) return 'consent';
  if (errors.deliveryAddress) return 'address';
  return undefined;
}

export function getQuoteViewModel(
  draft: QuoteDraft,
  errors: QuoteFormErrors
): QuoteViewModel {
  const lengthNum = Number(draft.length);
  const widthNum = Number(draft.width);
  const area =
    !Number.isNaN(lengthNum) && !Number.isNaN(widthNum) ? lengthNum * widthNum : null;
  const maxArea = Number.POSITIVE_INFINITY;
  const safeWidthNum = Number.isFinite(widthNum) && widthNum > 0 ? widthNum : 1;
  const safeLengthNum = Number.isFinite(lengthNum) && lengthNum > 0 ? lengthNum : 1;
  const maxLength = Math.min(QUOTE_DIMENSION_MAX_FT, Math.floor(maxArea / safeWidthNum));
  const maxWidth = Math.min(QUOTE_DIMENSION_MAX_FT, Math.floor(maxArea / safeLengthNum));

  const offered = getQuoteStructureOptions(draft.structureType);
  const showWallHeight = ['storage_shed', 'portable_garage', 'greenhouse'].includes(
    draft.structureType
  );
  const showRoofStyle = offered.roofStyle;
  const showRoofMaterial = draft.structureType !== 'greenhouse';
  const showPanelMaterial = draft.structureType === 'greenhouse';
  const showFrameGauge = ['carport', 'open_loafing'].includes(draft.structureType);
  const showDoorOptions = !['carport', 'open_loafing'].includes(draft.structureType);
  const showWindowPackage = offered.windowPackage;
  const showVentilation = offered.ventilation;
  const showColor = true;
  const showUpgrades = !['carport', 'well_pump', 'open_loafing'].includes(
    draft.structureType
  );

  const step1Valid = draft.structureType !== '' && !errors.length && !errors.width;
  const isValid = draft.structureType !== '' && Object.keys(errors).length === 0;
  return {
    area,
    maxLength,
    maxWidth,
    step1Valid,
    isValid,
    showWallHeight,
    showRoofStyle,
    showRoofMaterial,
    showPanelMaterial,
    showFrameGauge,
    showDoorOptions,
    showWindowPackage,
    showVentilation,
    showColor,
    showUpgrades,
  };
}
