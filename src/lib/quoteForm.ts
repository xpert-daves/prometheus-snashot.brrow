import type { QuoteParams } from '@/lib/pricing/calculateQuote';
import { STANDARD_WALL_HEIGHT } from '@/lib/pricing/pricingData';
import { isValidAddOnName } from '@/lib/pricing/upgradeOptions';
import { EMAIL_PATTERN } from '@/lib/emailPattern';
import { normalizeUS } from '@/lib/phone';
import { SMS_QUOTE_CONSENT_REQUIRED_MESSAGE } from '@/lib/smsConsent';
import {
  DELIVERY_ADDRESS_MAX_LENGTH,
  QUOTE_DIMENSION_MIN_FT,
  QUOTE_DIMENSION_MAX_FT,
  QUOTE_LEAN_TO_MAX_WIDTH_FT,
  QUOTE_WINDOW_COUNT_MIN,
  QUOTE_WINDOW_COUNT_MAX,
} from '@/lib/quoteLimits';

/**
 * Metal Central Panel-Loc Plus chart colors. `hex` is the swatch Central States
 * publishes for each color in its online visualizer
 * (visualizer.centralstatesco.com). `legacyHex` is the generic web color this
 * palette used before; saved drafts and older leads can still carry it.
 */
export const brandColors = [
  { name: 'Black', hex: '#101010', legacyHex: '#000000' },
  { name: 'Charcoal', hex: '#706A61', legacyHex: '#36454F' },
  { name: 'Pewter', hex: '#B2AFA4', legacyHex: '#8BA8B7' },
  { name: 'Gray', hex: '#D8D4C5', legacyHex: '#808080' },
  { name: 'Alamo', hex: '#F2F0EB', legacyHex: '#E5E1D1' },
  { name: 'Brilliant', hex: '#F7F8F6', legacyHex: '#F5F5F5' },
  { name: 'Forest', hex: '#163E1F', legacyHex: '#228B22' },
  { name: 'Hunter', hex: '#365636', legacyHex: '#0B4008' },
  { name: 'Colony', hex: '#6A7A55', legacyHex: '#3C6E71' },
  { name: 'Crimson', hex: '#DD1010', legacyHex: '#DC143C' },
  { name: 'Rustic', hex: '#842424', legacyHex: '#8B4513' },
  { name: 'Burgundy', hex: '#361921', legacyHex: '#800020' },
  { name: 'Gallery', hex: '#053751', legacyHex: '#1E90FF' },
  { name: 'Ocean', hex: '#3C6577', legacyHex: '#017B92' },
  { name: 'Ivory', hex: '#F0E0B4', legacyHex: '#FFFFF0' },
  { name: 'Light Stone', hex: '#C6B9A0', legacyHex: '#D8CFA8' },
  { name: 'Desert', hex: '#9E966F', legacyHex: '#CCAD60' },
  { name: 'Taupe', hex: '#A09A7F', legacyHex: '#B9A281' },
  { name: 'Burnished Slate', hex: '#3D3D2D', legacyHex: '#4A4C4D' },
  { name: 'Brown', hex: '#493321', legacyHex: '#654321' },
  { name: 'Tan', hex: '#B99167', legacyHex: '#D2B48C' },
  { name: 'Copper Metallic', hex: '#C88823', legacyHex: '#B87333' },
  { name: 'Galvalume', hex: '#C2C1BF', legacyHex: '#DCDCDC' },
] as const;

/** Moves a pre-swatch palette hex to its current value; anything else passes through. */
export function currentBrandColorHex(hex: string): string {
  const upper = hex.toUpperCase();
  return brandColors.find((color) => color.legacyHex === upper)?.hex ?? hex;
}

export const roofLabels: Record<'gabled' | 'barn' | 'lean-to', string> = {
  gabled: 'Gable',
  barn: 'Gambrel',
  'lean-to': 'Lean-to',
};

export type QuoteFormParams = {
  structureType: QuoteParams['structureType'] | '';
  length: string;
  width: string;
  roofStyle: string;
  wallHeight: string;
  roofMaterial: string;
  frameGauge: string;
  windowPackage: string;
  windowCount: string;
  ventilation: boolean;
  color: string;
  addOns: string[];
  foundation: string;
  door: string;
  deliveryAddress: string;
  deliveryRadius: string;
  discountCode: string;
  website: string;
  name: string;
  email: string;
  phone: string;
  smsConsentOptIn: boolean;
};

export const initialQuoteFormParams: QuoteFormParams = {
  structureType: '',
  length: '10',
  width: '8',
  roofStyle: 'gabled',
  wallHeight: String(STANDARD_WALL_HEIGHT),
  roofMaterial: '29ga metal',
  frameGauge: '14-ga',
  windowPackage: '',
  windowCount: '1',
  ventilation: false,
  color: '#ffffff',
  addOns: [],
  foundation: 'blocks_level',
  door: 'single_shed',
  deliveryAddress: '',
  deliveryRadius: '0',
  discountCode: '',
  website: '',
  name: '',
  email: '',
  phone: '',
  smsConsentOptIn: false,
};

export type QuoteFormErrors = Partial<Record<keyof QuoteFormParams, string>>;

export function validateQuoteForm(params: QuoteFormParams): QuoteFormErrors {
  const errors: QuoteFormErrors = {};
  const num = (value: string) => (value === '' ? NaN : Number(value));

  const length = num(params.length);
  if (!Number.isFinite(length)) errors.length = 'Please enter a valid number';
  else if (!Number.isInteger(length)) errors.length = 'Enter a whole number of feet';
  else if (length < QUOTE_DIMENSION_MIN_FT) {
    errors.length = `Min: ${QUOTE_DIMENSION_MIN_FT}ft`;
  } else if (length > QUOTE_DIMENSION_MAX_FT) {
    errors.length = `Max: ${QUOTE_DIMENSION_MAX_FT}ft`;
  }

  const width = num(params.width);
  if (!Number.isFinite(width)) errors.width = 'Please enter a valid number';
  else if (!Number.isInteger(width)) errors.width = 'Enter a whole number of feet';
  else if (width < QUOTE_DIMENSION_MIN_FT) {
    errors.width = `Min: ${QUOTE_DIMENSION_MIN_FT}ft`;
  } else if (width > QUOTE_DIMENSION_MAX_FT) {
    errors.width = `Max: ${QUOTE_DIMENSION_MAX_FT}ft`;
  }

  if (params.roofStyle === 'lean-to' && width > QUOTE_LEAN_TO_MAX_WIDTH_FT) {
    errors.width = `Lean-to roof max span: ${QUOTE_LEAN_TO_MAX_WIDTH_FT}ft`;
  }

  if (params.deliveryAddress.trim().length > DELIVERY_ADDRESS_MAX_LENGTH) {
    errors.deliveryAddress = `Max: ${DELIVERY_ADDRESS_MAX_LENGTH} characters`;
  }

  if (params.windowPackage) {
    const windowCount = num(params.windowCount);
    if (!Number.isInteger(windowCount) || windowCount < QUOTE_WINDOW_COUNT_MIN) {
      errors.windowCount = 'Enter number of windows';
    } else if (windowCount > QUOTE_WINDOW_COUNT_MAX) {
      errors.windowCount = `Max: ${QUOTE_WINDOW_COUNT_MAX} windows`;
    }
  }

  const duplicateAddOns = new Set<string>();
  for (const addOn of params.addOns) {
    if (!isValidAddOnName(addOn)) {
      errors.addOns = 'Select only available upgrades';
      break;
    }

    if (duplicateAddOns.has(addOn)) {
      errors.addOns = 'Remove duplicate upgrades';
      break;
    }
    duplicateAddOns.add(addOn);
  }

  const selectedDoor = params.door || 'single_shed';
  if (
    !errors.addOns &&
    params.addOns.includes('Ramp (Single Door)') &&
    selectedDoor !== 'single_shed'
  ) {
    errors.addOns = 'Single-door ramp requires a single shed door';
  }

  if (
    !errors.addOns &&
    params.addOns.includes('Ramp (Double Door)') &&
    selectedDoor !== 'double_shed'
  ) {
    errors.addOns = 'Double-door ramp requires a double shed door';
  }

  if (!params.name.trim()) errors.name = 'Required';

  // The server trims before applying the same pattern.
  const email = params.email.trim();
  if (!email) {
    errors.email = 'Required';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email';
  } else {
    const domain = email.split('@')[1]?.toLowerCase();
    if (['example.com', 'test.com', 'example.org', 'example.net'].includes(domain ?? '')) {
      errors.email = 'Enter a real email address';
    }
  }

  if (!params.phone.trim()) {
    errors.phone = 'Required';
  } else {
    try {
      normalizeUS(params.phone);
    } catch {
      errors.phone = 'Enter a valid phone number';
    }
  }

  if (!params.smsConsentOptIn) {
    errors.smsConsentOptIn = SMS_QUOTE_CONSENT_REQUIRED_MESSAGE;
  }

  return errors;
}
