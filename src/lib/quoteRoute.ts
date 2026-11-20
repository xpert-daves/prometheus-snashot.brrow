import 'server-only';

import type { NextRequest } from 'next/server';
import { TextDecoder } from 'node:util';
import { z } from 'zod';
import { normalizeUS } from '@/lib/phone';
import {
  SMS_QUOTE_CONSENT_REQUIRED_MESSAGE,
  SMS_QUOTE_CONSENT_TEXT_VERSION,
  SMS_QUOTE_CONSENT_V3_TEXT_VERSION,
} from '@/lib/smsConsent';
import type {
  QuoteBreakdown,
  QuoteParams,
  QuoteResult,
} from '@/lib/pricing/calculateQuote';
import { isValidAddOnName } from '@/lib/pricing/upgradeOptions';
import {
  DELIVERY_ADDRESS_MAX_LENGTH,
  QUOTE_DIMENSION_MIN_FT,
  QUOTE_DIMENSION_MAX_FT,
  QUOTE_LEAN_TO_MAX_WIDTH_FT,
  QUOTE_WINDOW_COUNT_MIN,
  QUOTE_WINDOW_COUNT_MAX,
} from '@/lib/quoteLimits';
import { getQuoteStructureOptions } from '@/lib/quoteStructureOptions';
import type { QuoteVisualPlacement } from '@/lib/quoteVisualPlacement';
import { normalizeQuoteMeasurement } from '@/lib/websiteMeasurement';

const structureTypeValues = [
  'storage_shed',
  'portable_garage',
  'greenhouse',
  'well_pump',
  'open_loafing',
  'carport',
] as const;

const roofStyleValues = ['gabled', 'barn', 'lean-to'] as const;
const roofMaterialValues = ['29ga metal', '26ga metal'] as const;
const foundationValues = ['none', 'blocks_level', 'anchored_slab'] as const;
const doorValues = ['single_shed', 'double_shed', 'garage_roll_up', 'house'] as const;
const sidingValues = ['metal'] as const;
const visualSideValues = ['front', 'back', 'left', 'right'] as const;
const visualPlacementValues = ['default', 'custom'] as const;

const DANGEROUS_TEXT_PATTERN =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/u;
const DANGEROUS_TEXT_MESSAGE =
  'Control characters and bidirectional text controls are not allowed';

function safeText(schema: z.ZodString) {
  return schema.refine((value) => !DANGEROUS_TEXT_PATTERN.test(value), {
    message: DANGEROUS_TEXT_MESSAGE,
  });
}

const VisualDoorSchema = z
  .object({
    id: safeText(z.string().trim().min(1).max(64)),
    side: z.enum(visualSideValues),
    width: z.number().min(0.5).max(12),
    height: z.number().min(1).max(10),
    offset: z.number().min(-100).max(100),
    color: safeText(z.string().trim().min(1).max(32)).optional(),
    placement: z.enum(visualPlacementValues),
  })
  .strict();

const VisualWindowSchema = z
  .object({
    id: safeText(z.string().trim().min(1).max(64)),
    side: z.enum(visualSideValues),
    width: z.number().min(0.5).max(8),
    height: z.number().min(0.5).max(8),
    offset: z.number().min(-100).max(100),
    heightFromFloor: z.number().min(0).max(12),
    placement: z.enum(visualPlacementValues),
  })
  .strict();

const VisualPlacementSchema = z
  .object({
    version: z.literal(1),
    defaultsVersion: safeText(z.string().trim().min(1).max(64)),
    customized: z.boolean(),
    doors: z.array(VisualDoorSchema).max(8),
    windows: z.array(VisualWindowSchema).max(QUOTE_WINDOW_COUNT_MAX),
  })
  .strict() satisfies z.ZodType<QuoteVisualPlacement>;

const QuoteRequestSchema = z
  .object({
    session_id: z.string().uuid().optional(),
    measurement: z.unknown().transform(normalizeQuoteMeasurement).optional(),
    // The bot check's token. Never stored; the route spends it and drops it.
    turnstileToken: z.string().max(2_048).optional(),
    name: safeText(z.string().trim().min(1).max(255)),
    email: safeText(z.string().trim().email().max(255)),
    structureType: z.enum(structureTypeValues),
    length: z.number().int().min(QUOTE_DIMENSION_MIN_FT).max(QUOTE_DIMENSION_MAX_FT),
    width: z.number().int().min(QUOTE_DIMENSION_MIN_FT).max(QUOTE_DIMENSION_MAX_FT),
    phone: safeText(z.string().trim().max(64)).nullable().optional(),
    website: safeText(z.string().trim().max(255)).optional().default(''),
    smsUnifiedConsentOptIn: z.boolean().optional(),
    smsConsentOptIn: z.boolean().optional().default(false),
    // Current copy, plus v3 for pages opened before the v4 release.
    smsConsentTextVersion: z
      .enum([SMS_QUOTE_CONSENT_TEXT_VERSION, SMS_QUOTE_CONSENT_V3_TEXT_VERSION])
      .optional(),
    smsMarketingConsentOptIn: z.boolean().optional().default(false),
    roofStyle: z.enum(roofStyleValues).nullable().optional(),
    wallHeight: z.union([z.literal(6), z.literal(7), z.literal(8)]).nullable().optional(),
    roofMaterial: z.enum(roofMaterialValues).nullable().optional(),
    frameGauge: z
      .union([
        z.literal('12-ga'),
        z.literal('14-ga'),
        z.literal('12'),
        z.literal('14'),
        z.literal(12),
        z.literal(14),
      ])
      .nullable()
      .optional(),
    windowPackage: z.literal('24x36').nullable().optional(),
    windowCount: z
      .number()
      .int()
      .min(QUOTE_WINDOW_COUNT_MIN)
      .max(QUOTE_WINDOW_COUNT_MAX)
      .nullable()
      .optional(),
    ventilation: z.boolean().nullable().optional(),
    color: safeText(z.string().trim().min(1).max(32)).nullable().optional(),
    addOns: z
      .array(safeText(z.string().trim().min(1).max(64)))
      .max(20)
      .default([]),
    foundation: z.enum(foundationValues).nullable().optional(),
    deliveryZip: z
      .union([safeText(z.string().trim().max(16)), z.number().int().min(0)])
      .nullable()
      .optional(),
    deliveryAddress: safeText(
      z.string().trim().max(DELIVERY_ADDRESS_MAX_LENGTH)
    )
      .nullable()
      .optional(),
    door: z.enum(doorValues).nullable().optional(),
    siding: z.enum(sidingValues).nullable().optional(),
    deliveryRadius: z.number().int().min(0).max(250).nullable().optional(),
    discountCode: safeText(z.string().trim().max(32)).nullable().optional(),
    visualPlacement: VisualPlacementSchema.nullable().optional(),
  })
  .strict()
  // A saved draft or cached page can still send a roof style, windows or
  // ventilation picked for an earlier structure type. Reset what this type
  // does not offer instead of rejecting the quote or pricing it. This runs
  // after the field checks, so malformed values are still rejected, and
  // before the lean-to span check below, so it never blocks a wide carport.
  .overwrite((data) => {
    const offered = getQuoteStructureOptions(data.structureType);
    return {
      ...data,
      roofStyle: offered.roofStyle || !data.roofStyle ? data.roofStyle : 'gabled',
      windowPackage: offered.windowPackage ? data.windowPackage : null,
      windowCount: offered.windowPackage ? data.windowCount : null,
      ventilation: offered.ventilation || !data.ventilation ? data.ventilation : false,
    };
  })
  .superRefine((data, ctx) => {
    const quoteConsent = data.smsUnifiedConsentOptIn ?? data.smsConsentOptIn;
    if (!quoteConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['smsConsentOptIn'],
        message: SMS_QUOTE_CONSENT_REQUIRED_MESSAGE,
      });
    }
    // A version identifies the exact quote-only copy shown by the current client.
    // Legacy clients retain their original split or unified audit wording.
    if (data.smsConsentTextVersion &&
        (data.smsUnifiedConsentOptIn !== undefined || data.smsMarketingConsentOptIn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['smsConsentTextVersion'],
        message: 'Quote-only consent cannot include promotional texts',
      });
    }
    if (data.roofStyle === 'lean-to' && data.width > QUOTE_LEAN_TO_MAX_WIDTH_FT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['width'],
        message: `Lean-to roof max span: ${QUOTE_LEAN_TO_MAX_WIDTH_FT}ft`,
      });
    }

    if (data.windowPackage && data.windowCount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['windowCount'],
        message: 'Window count is required when selecting windows',
      });
    }

    const seenAddOns = new Set<string>();
    data.addOns.forEach((name, index) => {
      if (!isValidAddOnName(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addOns', index],
          message: `Unknown add-on: ${name}`,
        });
      }

      if (seenAddOns.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['addOns', index],
          message: `Duplicate add-on: ${name}`,
        });
      }
      seenAddOns.add(name);
    });

    const selectedDoor = data.door ?? 'single_shed';
    if (data.addOns.includes('Ramp (Single Door)') && selectedDoor !== 'single_shed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addOns'],
        message: 'Single-door ramp requires a single shed door',
      });
    }

    if (data.addOns.includes('Ramp (Double Door)') && selectedDoor !== 'double_shed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addOns'],
        message: 'Double-door ramp requires a double shed door',
      });
    }
  });

function tryParseJSON(value: unknown) {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toIntOrUndefined(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;

  const normalized = String(value).trim();
  if (!/^-?\d+$/.test(normalized)) return Number.NaN;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolOrUndefined(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function toCsvArrayOrJson(value: unknown) {
  const parsed = tryParseJSON(value);
  if (Array.isArray(parsed)) return parsed.map(String);
  if (typeof parsed === 'string') {
    return parsed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function trimOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

export type ParsedQuoteRequest = z.infer<typeof QuoteRequestSchema>;

export class QuoteRequestBodyTooLargeError extends Error {
  constructor() {
    super('Quote request body is too large');
    this.name = 'QuoteRequestBodyTooLargeError';
  }
}

export function isJsonRequestContentType(value: string | null): boolean {
  const mediaType = (value || '')
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase();

  return (
    mediaType === 'application/json' ||
    /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType)
  );
}

export async function readJsonRequestBody(
  request: NextRequest,
  maximumBytes: number
): Promise<Record<string, unknown> | null> {
  if (!isJsonRequestContentType(request.headers.get('content-type'))) {
    return null;
  }

  const declaredLength = Number.parseInt(
    request.headers.get('content-length') ?? '',
    10
  );
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new QuoteRequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing JSON request body');

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new QuoteRequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const parsed = JSON.parse(new TextDecoder().decode(bodyBytes)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

export function normalizeQuoteRequestPayload(raw: Record<string, unknown>) {
  return {
    session_id: typeof raw.session_id === 'string' ? raw.session_id : undefined,
    measurement: raw.measurement,
    turnstileToken:
      typeof raw.turnstileToken === 'string' && raw.turnstileToken.trim()
        ? raw.turnstileToken.trim()
        : undefined,
    name: String(raw.name ?? '').trim(),
    email: String(raw.email ?? '').trim().toLowerCase(),
    website: String(raw.website ?? '').trim(),
    structureType: String(raw.structureType ?? '').trim(),
    length: toIntOrUndefined(raw.length),
    width: toIntOrUndefined(raw.width),
    phone: trimOrNull(raw.phone),
    smsUnifiedConsentOptIn: toBoolOrUndefined(raw.smsUnifiedConsentOptIn),
    smsConsentOptIn: toBoolOrUndefined(raw.smsConsentOptIn) ?? false,
    smsConsentTextVersion: raw.smsConsentTextVersion,
    smsMarketingConsentOptIn:
      toBoolOrUndefined(raw.smsMarketingConsentOptIn) ?? false,
    roofStyle: trimOrNull(raw.roofStyle),
    wallHeight: toIntOrUndefined(raw.wallHeight) ?? null,
    roofMaterial: trimOrNull(raw.roofMaterial),
    frameGauge: raw.frameGauge,
    windowPackage: trimOrNull(raw.windowPackage),
    windowCount: toIntOrUndefined(raw.windowCount) ?? null,
    ventilation: toBoolOrUndefined(raw.ventilation) ?? null,
    color: trimOrNull(raw.color),
    addOns: Array.isArray(raw.addOns) ? raw.addOns.map(String) : toCsvArrayOrJson(raw.addOns),
    foundation: trimOrNull(raw.foundation),
    deliveryZip:
      typeof raw.deliveryZip === 'number' ? raw.deliveryZip : trimOrNull(raw.deliveryZip),
    deliveryAddress: trimOrNull(raw.deliveryAddress),
    door: trimOrNull(raw.door),
    siding: trimOrNull(raw.siding),
    deliveryRadius: toIntOrUndefined(raw.deliveryRadius) ?? null,
    discountCode: trimOrNull(raw.discountCode),
    visualPlacement: tryParseJSON(raw.visualPlacement),
  };
}

export function validateQuoteRequest(raw: Record<string, unknown>) {
  return QuoteRequestSchema.safeParse(normalizeQuoteRequestPayload(raw));
}

function mapFrameGauge(value: unknown): QuoteParams['frameGauge'] {
  if (value === '12-ga' || value === '14-ga') return value;
  const numeric = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (numeric === 12) return '12-ga';
  if (numeric === 14) return '14-ga';
  return undefined;
}

export function mapParsedQuoteToParams(parsed: ParsedQuoteRequest): QuoteParams {
  return {
    structureType: parsed.structureType as QuoteParams['structureType'],
    length: parsed.length,
    width: parsed.width,
    roofStyle: (parsed.roofStyle ?? undefined) as QuoteParams['roofStyle'],
    wallHeight: (parsed.wallHeight ?? undefined) as QuoteParams['wallHeight'],
    roofMaterial: (parsed.roofMaterial ?? undefined) as QuoteParams['roofMaterial'],
    frameGauge: mapFrameGauge(parsed.frameGauge),
    windowPackage: (parsed.windowPackage ?? undefined) as QuoteParams['windowPackage'],
    windowCount: parsed.windowCount ?? undefined,
    ventilation:
      typeof parsed.ventilation === 'boolean' ? parsed.ventilation : undefined,
    color: parsed.color ?? undefined,
    addOns: parsed.addOns ?? [],
    foundation: (parsed.foundation ?? undefined) as QuoteParams['foundation'],
    deliveryAddress: parsed.deliveryAddress ?? undefined,
    deliveryZip: parsed.deliveryZip != null ? String(parsed.deliveryZip) : undefined,
    door: (parsed.door ?? undefined) as QuoteParams['door'],
    siding: (parsed.siding ?? undefined) as QuoteParams['siding'],
    // Browser-derived or manually entered mileage is not authoritative. Until a
    // server-side address/distance verifier exists, delivery is final-priced by
    // staff and excluded from the public build subtotal.
    deliveryRadius: 0,
    discountCode: parsed.discountCode ?? undefined,
  };
}

export function normalizeQuotePhone(phone: string | null | undefined) {
  return phone ? normalizeUS(phone) : null;
}

export function buildQuoteResponse({
  id,
  total,
  breakdown,
  discussionToken,
}: {
  id: string;
  total: QuoteResult['total'];
  breakdown: QuoteBreakdown;
  discussionToken?: string;
}) {
  return {
    id,
    total,
    breakdown,
    ...(discussionToken ? { discussionToken } : {}),
    estimate: {
      kind: 'build_subtotal' as const,
      delivery: {
        status: 'pending_verification' as const,
        includedInTotal: false as const,
      },
    },
  };
}
