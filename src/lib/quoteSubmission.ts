import { normalizeUS } from '@/lib/phone';
import { SMS_QUOTE_CONSENT_TEXT_VERSION } from '@/lib/smsConsent';
import type { QuoteFormParams } from '@/lib/quoteForm';
import type { QuoteBreakdown } from '@/lib/pricing/calculateQuote';
import type { QuoteVisualPlacement } from '@/lib/quoteVisualPlacement';
import { getWebsiteMeasurementContext, normalizeQuoteMeasurement, type QuoteMeasurement } from '@/lib/websiteMeasurement';

export type QuoteSubmissionPayload = {
  structureType: QuoteFormParams['structureType'];
  length: number;
  width: number;
  roofStyle: string;
  wallHeight: string;
  roofMaterial: string;
  frameGauge: string;
  windowPackage?: string;
  windowCount?: number;
  ventilation: boolean;
  color: string;
  addOns: string[];
  foundation: string;
  deliveryAddress?: string;
  deliveryZip: string;
  door: string;
  discountCode?: string;
  website: string;
  name: string;
  email: string;
  phone?: string;
  smsConsentOptIn: boolean;
  smsConsentTextVersion: typeof SMS_QUOTE_CONSENT_TEXT_VERSION;
  smsMarketingConsentOptIn: false;
  session_id: string;
  turnstileToken?: string;
  measurement?: QuoteMeasurement;
  visualPlacement?: QuoteVisualPlacement;
};

export type QuoteApiResponse = {
  id: string;
  discussionToken?: string;
  total: number;
  breakdown: QuoteBreakdown;
  estimate: {
    kind: 'build_subtotal';
    delivery: {
      status: 'pending_verification';
      includedInTotal: false;
    };
  };
};

/** A form field the server rejected, so the page can mark it instead of alerting. */
export type QuoteSubmissionErrorField = 'email';

export type QuoteSubmissionResult =
  | { kind: 'success'; quote: QuoteApiResponse }
  | {
      kind: 'response_error';
      error: string;
      status: number;
      field?: QuoteSubmissionErrorField;
    }
  | { kind: 'network_error'; error: string }
  | { kind: 'aborted' };

export const QUOTE_EMAIL_REJECTED_ERROR = 'Check your email address';

// The alert that shows these renders Call and Text links under them.
export const QUOTE_SUBMISSION_FALLBACK_ERROR =
  "We couldn't send your request. Please check your details, or call or text us.";

export const QUOTE_NETWORK_ERROR =
  "We couldn't reach Shed210. Check your connection and try again, or call or text us.";

export type SubmitQuoteRequestOptions = {
  params: QuoteFormParams;
  deliveryZip: string;
  sessionId: string;
  visualPlacement?: QuoteVisualPlacement;
  /** From the invisible bot check; '' or missing when it didn't run. */
  turnstileToken?: string;
};

type FetchLike = typeof fetch;
type SubmitQuoteRequestConfig = {
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
};

const pendingDeliveryEstimate: QuoteApiResponse['estimate'] = {
  kind: 'build_subtotal',
  delivery: {
    status: 'pending_verification',
    includedInTotal: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonNegativeNumber(value: unknown, fallback?: number): number | null {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function hasPendingDeliveryEstimate(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || value.kind !== 'build_subtotal') return false;
  if (!isRecord(value.delivery)) return false;

  return (
    value.delivery.status === 'pending_verification' &&
    value.delivery.includedInTotal === false
  );
}

function normalizeQuoteApiResponse(value: unknown): QuoteApiResponse | null {
  if (!isRecord(value) || !isRecord(value.breakdown)) return null;

  const id =
    typeof value.id === 'string' || typeof value.id === 'number'
      ? String(value.id)
      : null;
  const total = nonNegativeNumber(value.total);
  const base = nonNegativeNumber(value.breakdown.base);
  const interiorUpgrades = value.breakdown.interiorUpgrades;
  if (
    !id ||
    total === null ||
    base === null ||
    (interiorUpgrades !== undefined &&
      (!Array.isArray(interiorUpgrades) ||
        !interiorUpgrades.every((item) => typeof item === 'string')))
  ) {
    return null;
  }

  const optionalAmounts = {
    wallHeight: nonNegativeNumber(value.breakdown.wallHeight, 0),
    roof: nonNegativeNumber(value.breakdown.roof, 0),
    siding: nonNegativeNumber(value.breakdown.siding, 0),
    door: nonNegativeNumber(value.breakdown.door, 0),
    windows: nonNegativeNumber(value.breakdown.windows, 0),
    addOns: nonNegativeNumber(value.breakdown.addOns, 0),
    delivery: nonNegativeNumber(value.breakdown.delivery, 0),
    discount: nonNegativeNumber(value.breakdown.discount, 0),
  };
  if (Object.values(optionalAmounts).some((amount) => amount === null)) {
    return null;
  }
  if (
    optionalAmounts.delivery !== 0 ||
    !hasPendingDeliveryEstimate(value.estimate)
  ) {
    return null;
  }

  return {
    id,
    ...(typeof value.discussionToken === 'string' &&
    value.discussionToken.trim().length > 0 &&
    value.discussionToken.length <= 2_048
      ? { discussionToken: value.discussionToken }
      : {}),
    total,
    breakdown: {
      base,
      wallHeight: optionalAmounts.wallHeight!,
      roof: optionalAmounts.roof!,
      siding: optionalAmounts.siding!,
      door: optionalAmounts.door!,
      windows: optionalAmounts.windows!,
      addOns: optionalAmounts.addOns!,
      delivery: optionalAmounts.delivery!,
      discount: optionalAmounts.discount!,
      interiorUpgrades: (interiorUpgrades as string[] | undefined) ?? [],
    },
    // Fail safely during rolling deployments: delivery is never treated as
    // included unless a future, separately validated contract explicitly adds
    // that capability.
    estimate: pendingDeliveryEstimate,
  };
}

function resolveConfig(
  fetchOrConfig: FetchLike | SubmitQuoteRequestConfig
): Required<Pick<SubmitQuoteRequestConfig, 'fetchImpl'>> &
  Pick<SubmitQuoteRequestConfig, 'signal'> {
  if (typeof fetchOrConfig === 'function') {
    return { fetchImpl: fetchOrConfig };
  }

  return {
    fetchImpl: fetchOrConfig.fetchImpl ?? fetch,
    signal: fetchOrConfig.signal,
  };
}

function describeResponseError(
  status: number,
  body: unknown
): { error: string; field?: QuoteSubmissionErrorField } {
  const data = isRecord(body) ? body : null;
  const firstIssue =
    Array.isArray(data?.issues) && isRecord(data.issues[0]) ? data.issues[0] : null;
  if (
    status === 400 &&
    Array.isArray(firstIssue?.path) &&
    firstIssue.path[0] === 'email'
  ) {
    return { error: QUOTE_EMAIL_REJECTED_ERROR, field: 'email' };
  }

  // Rate limits and the pricing outage already tell the customer what to do.
  if (
    (status === 429 || status === 503) &&
    typeof data?.error === 'string' &&
    data.error.trim()
  ) {
    return { error: data.error };
  }

  // Raw server strings ("Invalid payload", "Server error", platform HTML pages)
  // give the customer no way forward.
  return { error: QUOTE_SUBMISSION_FALLBACK_ERROR };
}

function getNetworkErrorMessage(error: unknown) {
  if (process.env.NODE_ENV === 'production') return QUOTE_NETWORK_ERROR;

  if (error instanceof Error && error.message.trim()) {
    return `Network error: ${error.message}`;
  }

  return 'Network error';
}

export function buildQuoteSubmissionPayload({
  params,
  deliveryZip,
  sessionId,
  visualPlacement,
  turnstileToken,
}: SubmitQuoteRequestOptions): QuoteSubmissionPayload {
  const payload: QuoteSubmissionPayload = {
    structureType: params.structureType,
    length: Number(params.length),
    width: Number(params.width),
    roofStyle: params.roofStyle,
    wallHeight: params.wallHeight,
    roofMaterial: params.roofMaterial,
    frameGauge: params.frameGauge,
    windowPackage: params.windowPackage || undefined,
    windowCount: params.windowPackage ? Number(params.windowCount) || 1 : undefined,
    ventilation: params.ventilation,
    color: params.color,
    addOns: params.addOns,
    foundation: params.foundation,
    deliveryZip,
    door: params.door,
    discountCode: params.discountCode || undefined,
    website: params.website,
    name: params.name,
    email: params.email,
    phone: params.phone ? normalizeUS(params.phone) : undefined,
    smsConsentOptIn: params.smsConsentOptIn,
    smsConsentTextVersion: SMS_QUOTE_CONSENT_TEXT_VERSION,
    smsMarketingConsentOptIn: false,
    session_id: sessionId,
  };

  if (params.deliveryAddress.trim()) {
    payload.deliveryAddress = params.deliveryAddress.trim();
  }
  if (visualPlacement) payload.visualPlacement = visualPlacement;
  if (turnstileToken) payload.turnstileToken = turnstileToken;
  const measurement = normalizeQuoteMeasurement(getWebsiteMeasurementContext());
  if (measurement) payload.measurement = measurement;
  return payload;
}

export async function submitQuoteRequest(
  options: SubmitQuoteRequestOptions,
  fetchOrConfig: FetchLike | SubmitQuoteRequestConfig = fetch
): Promise<QuoteSubmissionResult> {
  const { fetchImpl, signal } = resolveConfig(fetchOrConfig);

  try {
    const payload = buildQuoteSubmissionPayload(options);
    const res = await fetchImpl('/api/quote', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      signal,
    });

    if (res.ok) {
      let quote: QuoteApiResponse | null = null;
      try {
        quote = normalizeQuoteApiResponse(await res.json());
      } catch {
        // A successful status with unreadable JSON is still an invalid response.
      }
      if (!quote) {
        return {
          kind: 'response_error',
          status: res.status,
          error: QUOTE_SUBMISSION_FALLBACK_ERROR,
        };
      }
      return {
        kind: 'success',
        quote,
      };
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Platform error pages (HTML 5xx) are not JSON.
    }

    return {
      kind: 'response_error',
      status: res.status,
      ...describeResponseError(res.status, body),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { kind: 'aborted' };
    }
    return { kind: 'network_error', error: getNetworkErrorMessage(error) };
  }
}
