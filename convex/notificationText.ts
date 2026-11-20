import { sanitizeAlertText } from "./alertTextSafety";
import { formatWallColorValue } from "./quoteColorNames";
import { SAME_LEAD_LOOKBACK_LIMIT, type QuoteLeadHistory } from "./quoteLeadHistory";

export type QuoteSmsRequest = {
  publicId: string;
  sessionId: string;
  contact: {
    name: string;
    email: string;
    phone: string | null;
  };
  inputs: Record<string, unknown>;
  pricing: {
    total: number;
    breakdown: Record<string, unknown>;
    deliveryPricingStatus?: "pending_verification";
  };
  createdAt: number;
};

/**
 * What a staff alert announces: a saved quote (new lead or the same lead
 * pricing another option), or the customer's "ready to schedule" tap.
 */
export type QuoteAlert = {
  readyToSchedule: boolean;
  history: QuoteLeadHistory;
};

export type NotificationStatus =
  | "sent"
  | "partial_failed"
  | "failed"
  | "no_recipients";

/** The online subtotal never includes slab work; David prices it from the customer's photos or a site visit. */
export const ANCHORED_SLAB_ALERT_NOTE = "not in subtotal; price from photos/site visit";

const DEFAULT_MAX_SMS_BODY_LENGTH = 1400;
const CENTRAL_TIME_ZONE = "America/Chicago";

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? value.map(formatTextValue).join(", ") : "None";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") {
    return "None";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return formatTextValue(String(value));
}

function formatTextValue(value: string): string {
  const safeValue = sanitizeAlertText(value);
  if (safeValue.startsWith("#")) return safeValue.toUpperCase();

  return safeValue
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSubmittedAt(createdAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getStringInput(inputs: Record<string, unknown>, key: string): string | null {
  const value = inputs[key];
  if (value === null || value === undefined || value === "") return null;
  return formatValue(value);
}

function getNumberInput(inputs: Record<string, unknown>, key: string): number | null {
  const value = inputs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildProjectSummary(inputs: Record<string, unknown>): string {
  const length = getNumberInput(inputs, "length");
  const width = getNumberInput(inputs, "width");
  const structureType = getStringInput(inputs, "structureType") ?? "Structure";
  const dimensions =
    length !== null && width !== null ? `${length}x${width}` : "Size not provided";

  return `${dimensions} ${structureType}`;
}

function buildBuildDetails(inputs: Record<string, unknown>): string | null {
  const details = [
    getStringInput(inputs, "roofStyle")
      ? `${getStringInput(inputs, "roofStyle")} roof`
      : null,
    getNumberInput(inputs, "wallHeight") !== null
      ? `${getNumberInput(inputs, "wallHeight")} ft walls`
      : null,
    getStringInput(inputs, "roofMaterial")
      ? `${getStringInput(inputs, "roofMaterial")} roof material`
      : null,
    getStringInput(inputs, "frameGauge")
      ? `${getStringInput(inputs, "frameGauge")} frame`
      : null,
    getStringInput(inputs, "door") ? `${getStringInput(inputs, "door")} door` : null,
  ].filter((value): value is string => Boolean(value));

  return details.length ? details.join("; ") : null;
}

function buildSiteDetails(
  inputs: Record<string, unknown>,
  deliveryPricingStatus?: "pending_verification"
): string | null {
  const details = [
    getStringInput(inputs, "deliveryAddress")
      ? `Address ${getStringInput(inputs, "deliveryAddress")}`
      : null,
    getStringInput(inputs, "deliveryZip")
      ? `ZIP ${getStringInput(inputs, "deliveryZip")}`
      : null,
    deliveryPricingStatus !== "pending_verification" &&
    getNumberInput(inputs, "deliveryRadius") !== null
      ? `${getNumberInput(inputs, "deliveryRadius")} mi from 341 Vista Rd`
      : null,
    getStringInput(inputs, "foundation")
      ? `${getStringInput(inputs, "foundation")} foundation${
          inputs.foundation === "anchored_slab" ? ` (${ANCHORED_SLAB_ALERT_NOTE})` : ""
        }`
      : null,
    deliveryPricingStatus === "pending_verification"
      ? "Delivery pricing pending address/access verification"
      : null,
  ].filter((value): value is string => Boolean(value));

  return details.length ? details.join("; ") : null;
}

function buildAddOnsSummary(inputs: Record<string, unknown>): string {
  return getStringInput(inputs, "addOns") ?? "None";
}

function buildOptionsSummary(inputs: Record<string, unknown>): string | null {
  const options = [
    getNumberInput(inputs, "windowCount") !== null &&
    getStringInput(inputs, "windowPackage")
      ? `${getNumberInput(inputs, "windowCount")} ${getStringInput(
          inputs,
          "windowPackage"
        )} windows`
      : null,
    inputs.ventilation === true ? "Ventilation" : null,
  ].filter((value): value is string => Boolean(value) && value !== "None");

  return options.length ? options.join("; ") : "None";
}

function buildPriceDrivers(
  breakdown: Record<string, unknown>,
  deliveryPricingPending: boolean
): string {
  const drivers = Object.entries(breakdown)
    .filter(([key, value]) => {
      if (deliveryPricingPending && key === "delivery") return false;
      if (typeof value === "number") return value !== 0;
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    })
    .map(([key, value]) => {
      const label = humanizeKey(key);
      if (typeof value === "number") return `${label} ${formatCurrency(value)}`;
      return `${label} ${formatValue(value)}`;
    });

  return drivers.length ? drivers.join("; ") : "No adders";
}

function formatAlertPrice(total: number, deliveryPricingPending: boolean): string {
  return deliveryPricingPending
    ? `${formatCurrency(total)} before delivery`
    : formatCurrency(total);
}

export type QuoteAlertDescription = {
  /** First line of the text, after "Shed210". */
  smsHeadline: string;
  emailSubjectPrefix: string;
  emailHeadline: string;
  /** Context lines shown right under the headline. */
  contextLines: string[];
};

/** Shared by the SMS and email alerts so both name the alert the same way. */
export function describeQuoteAlert(alert: QuoteAlert): QuoteAlertDescription {
  if (alert.readyToSchedule) {
    return {
      smsHeadline: "READY TO SCHEDULE",
      emailSubjectPrefix: "Ready to schedule",
      emailHeadline: "Ready to schedule this build",
      contextLines: [
        "They tapped Ready to schedule and were told you will contact them as soon as possible to finalize details.",
      ],
    };
  }

  const { earlierQuoteCount, previous } = alert.history;
  if (earlierQuoteCount === 0) {
    return {
      smsHeadline: "NEW LEAD",
      emailSubjectPrefix: "New Shed210 quote lead",
      emailHeadline: "New website quote lead",
      contextLines: [],
    };
  }

  const option =
    earlierQuoteCount >= SAME_LEAD_LOOKBACK_LIMIT
      ? `${SAME_LEAD_LOOKBACK_LIMIT + 1}+`
      : String(earlierQuoteCount + 1);
  return {
    smsHeadline: `SAME LEAD, OPTION ${option}`,
    emailSubjectPrefix: `Shed210 same lead, option ${option}`,
    emailHeadline: `Same lead, option ${option}: still comparing`,
    contextLines: previous
      ? [
          `Before: ${buildProjectSummary(previous.inputs)}, ${formatAlertPrice(
            previous.total,
            previous.deliveryPricingPending
          )} (${formatSubmittedAt(previous.createdAt)} CT)`,
        ]
      : [],
  };
}

function buildRecommendedAction(quote: QuoteSmsRequest, alert: QuoteAlert): string {
  if (!quote.contact.phone) {
    return "Email now. Ask for phone, delivery ZIP, site/access details, and desired install timing before quoting next steps.";
  }
  if (alert.readyToSchedule) {
    return "Call/text as soon as possible to finalize details. Confirm the site, delivery access, and install date. Explain the $250 deposit that holds the build day; the balance is due after completion.";
  }
  if (alert.history.earlierQuoteCount > 0) {
    return "Still comparing options. Call/text within 5 min and help them choose. Confirm use, size, add-ons, delivery access, and install timing. Explain the $250 deposit that holds the build day; the balance is due after completion.";
  }

  return "Call/text within 5 min. Confirm use, size, add-ons, delivery access, and install timing. Explain the $250 deposit that holds the build day; the balance is due after completion.";
}

function splitLongLine(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) return [line];

  const parts: string[] = [];
  for (let start = 0; start < line.length; start += maxLength) {
    parts.push(line.slice(start, start + maxLength));
  }
  return parts;
}

function splitBody(lines: string[], maxBodyLength: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const rawLine of lines) {
    for (const line of splitLongLine(rawLine, maxBodyLength)) {
      const next = current ? `${current}\n${line}` : line;
      if (next.length <= maxBodyLength) {
        current = next;
        continue;
      }
      if (current) chunks.push(current);
      current = line;
    }
  }

  if (current) chunks.push(current);

  if (chunks.length <= 1) {
    return chunks;
  }

  return chunks.map((chunk, index) => `Shed210 quote ${index + 1}/${chunks.length}\n${chunk}`);
}

export function buildQuoteSmsBodies(
  quote: QuoteSmsRequest,
  alert: QuoteAlert,
  maxBodyLength = DEFAULT_MAX_SMS_BODY_LENGTH
): string[] {
  const buildDetails = buildBuildDetails(quote.inputs);
  const color = formatWallColorValue(quote.inputs.color);
  const deliveryPricingPending =
    quote.pricing.deliveryPricingStatus === "pending_verification";
  const siteDetails = buildSiteDetails(
    quote.inputs,
    quote.pricing.deliveryPricingStatus
  );
  const description = describeQuoteAlert(alert);

  return splitBody(
    [
      // The headline and one-line summary come first so a lock screen shows them.
      `Shed210 ${description.smsHeadline}`,
      `${sanitizeAlertText(quote.contact.name) || "Website visitor"}: ${buildProjectSummary(
        quote.inputs
      )}, ${formatAlertPrice(quote.pricing.total, deliveryPricingPending)}`,
      ...description.contextLines,
      "",
      "LEAD",
      `Lead: ${sanitizeAlertText(quote.contact.name) || "None"}`,
      `Phone: ${
        quote.contact.phone
          ? sanitizeAlertText(quote.contact.phone) || "None"
          : "None"
      }`,
      `Email: ${sanitizeAlertText(quote.contact.email) || "None"}`,
      `Submitted: ${formatSubmittedAt(quote.createdAt)} CT`,
      "",
      "PROJECT",
      `Project: ${buildProjectSummary(quote.inputs)}`,
      ...(buildDetails ? [`Build: ${buildDetails}`] : []),
      ...(color ? [`Color: ${color}`] : []),
      ...(siteDetails ? [`Site: ${siteDetails}`] : []),
      `Add-ons: ${buildAddOnsSummary(quote.inputs)}`,
      `Options: ${buildOptionsSummary(quote.inputs)}`,
      "",
      "PRICE",
      deliveryPricingPending
        ? `Build subtotal (delivery pending): ${formatCurrency(quote.pricing.total)}`
        : `Total: ${formatCurrency(quote.pricing.total)}`,
      `Drivers: ${buildPriceDrivers(
        quote.pricing.breakdown,
        deliveryPricingPending
      )}`,
      "",
      "RECOMMENDED ACTION",
      buildRecommendedAction(quote, alert),
      "",
      `Quote ID: ${sanitizeAlertText(quote.publicId) || "None"}`,
    ],
    maxBodyLength
  );
}

export function deriveNotificationStatus(
  recipientCount: number,
  successCount: number,
  failureCount: number
): NotificationStatus {
  if (recipientCount === 0) return "no_recipients";
  if (successCount > 0 && failureCount === 0) return "sent";
  if (successCount > 0) return "partial_failed";
  return "failed";
}
