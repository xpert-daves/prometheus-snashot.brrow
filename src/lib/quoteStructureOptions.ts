import { initialQuoteFormParams, type QuoteFormParams } from '@/lib/quoteForm';

// Structure types that offer each option. The quote form shows a control only
// for these types, and both the form and /api/quote reset a value the selected
// type does not offer, so a pick left over from an earlier type is never
// priced, saved or sent to the owner. portable_garage is the legacy id for a
// storage shed and keeps the shed options.
const ROOF_STYLE_STRUCTURE_TYPES: readonly string[] = ['storage_shed', 'portable_garage'];
const WINDOW_PACKAGE_STRUCTURE_TYPES: readonly string[] = [
  'storage_shed',
  'portable_garage',
  'greenhouse',
];
const VENTILATION_STRUCTURE_TYPES: readonly string[] = ['greenhouse', 'well_pump'];

export type QuoteStructureOptions = {
  roofStyle: boolean;
  windowPackage: boolean;
  ventilation: boolean;
};

export function getQuoteStructureOptions(structureType: string): QuoteStructureOptions {
  return {
    roofStyle: ROOF_STYLE_STRUCTURE_TYPES.includes(structureType),
    windowPackage: WINDOW_PACKAGE_STRUCTURE_TYPES.includes(structureType),
    ventilation: VENTILATION_STRUCTURE_TYPES.includes(structureType),
  };
}

// Frame gauge and roof material are left alone: they are not priced and the
// owner alerts still list them.
export function normalizeQuoteOptionsForStructure(draft: QuoteFormParams): QuoteFormParams {
  const offered = getQuoteStructureOptions(draft.structureType);
  const roofStyle = offered.roofStyle ? draft.roofStyle : initialQuoteFormParams.roofStyle;
  const windowPackage = offered.windowPackage
    ? draft.windowPackage
    : initialQuoteFormParams.windowPackage;
  const windowCount = offered.windowPackage
    ? draft.windowCount
    : initialQuoteFormParams.windowCount;
  const ventilation = offered.ventilation
    ? draft.ventilation
    : initialQuoteFormParams.ventilation;

  if (
    roofStyle === draft.roofStyle &&
    windowPackage === draft.windowPackage &&
    windowCount === draft.windowCount &&
    ventilation === draft.ventilation
  ) {
    return draft;
  }

  return { ...draft, roofStyle, windowPackage, windowCount, ventilation };
}
