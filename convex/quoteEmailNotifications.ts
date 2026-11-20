import type { Doc, Id } from "./_generated/dataModel";
import type { ZohoConfig, ZohoSendResult } from "./zohoMail";
import { sanitizeAlertText } from "./alertTextSafety";
import {
  ANCHORED_SLAB_ALERT_NOTE,
  describeQuoteAlert,
  type QuoteAlert,
} from "./notificationText";
import { formatColorValue, formatWallColorValue } from "./quoteColorNames";
import type { QuoteLeadHistory } from "./quoteLeadHistory";

export type QuoteEmailNotificationContext = {
  quote: Doc<"quoteRequests">;
  history: QuoteLeadHistory;
};

export type QuoteEmailContent = {
  subject: string;
  bodyText: string;
};

const CENTRAL_TIME_ZONE = "America/Chicago";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseQuoteNotificationEmailRecipients(
  rawValue: string | null | undefined
): string[] {
  const values = (rawValue ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const recipients = Array.from(new Set(values));
  const invalid = recipients.filter((value) => !EMAIL_PATTERN.test(value));

  if (invalid.length > 0) {
    throw new Error(
      `Invalid QUOTE_NOTIFICATION_EMAIL_RECIPIENTS value: ${invalid.join(", ")}`
    );
  }

  return recipients;
}

export function getFrontierPixelCrmAdminUrl() {
  const raw = process.env.FRONTIER_PIXEL_CRM_ADMIN_URL?.trim();
  if (!raw) {
    throw new Error("FRONTIER_PIXEL_CRM_ADMIN_URL is not configured.");
  }

  try {
    return new URL(raw).toString().replace(/\/+$/, "");
  } catch {
    throw new Error("FRONTIER_PIXEL_CRM_ADMIN_URL must be a valid URL.");
  }
}

export function buildQuoteEmailContent(args: {
  quote: Doc<"quoteRequests">;
  crmAdminUrl: string;
  alert: QuoteAlert;
}): QuoteEmailContent {
  const deliveryPricingPending =
    args.quote.pricing.deliveryPricingStatus === "pending_verification";
  const projectSummary = buildProjectSummary(args.quote.inputs);
  const description = describeQuoteAlert(args.alert);
  const subject = `${description.emailSubjectPrefix}: ${displayText(
    args.quote.contact.name,
    "Website visitor"
  )} - ${projectSummary}`;
  const crmUrl = buildCrmUrl({
    baseUrl: args.crmAdminUrl,
    quotePublicId: args.quote.publicId,
    quoteRequestId: args.quote._id,
  });
  const buildDetails = compact([
    getStringInput(args.quote.inputs, "roofStyle")
      ? `${getStringInput(args.quote.inputs, "roofStyle")} roof`
      : null,
    getNumberInput(args.quote.inputs, "wallHeight") !== null
      ? `${getNumberInput(args.quote.inputs, "wallHeight")} ft walls`
      : null,
    getStringInput(args.quote.inputs, "roofMaterial")
      ? `${getStringInput(args.quote.inputs, "roofMaterial")} roof material`
      : null,
    getStringInput(args.quote.inputs, "frameGauge")
      ? `${getStringInput(args.quote.inputs, "frameGauge")} frame`
      : null,
    getStringInput(args.quote.inputs, "door")
      ? `${getStringInput(args.quote.inputs, "door")} door`
      : null,
  ]).join("; ");
  const deliveryDetails = compact([
    getStringInput(args.quote.inputs, "deliveryAddress")
      ? `Address: ${getStringInput(args.quote.inputs, "deliveryAddress")}`
      : null,
    getStringInput(args.quote.inputs, "deliveryZip")
      ? `ZIP: ${getStringInput(args.quote.inputs, "deliveryZip")}`
      : null,
    !deliveryPricingPending &&
    getNumberInput(args.quote.inputs, "deliveryRadius") !== null
      ? `${getNumberInput(args.quote.inputs, "deliveryRadius")} mi from 341 Vista Rd`
      : null,
    getStringInput(args.quote.inputs, "foundation")
      ? `Foundation: ${getStringInput(args.quote.inputs, "foundation")}${
          args.quote.inputs.foundation === "anchored_slab"
            ? ` (${ANCHORED_SLAB_ALERT_NOTE})`
            : ""
        }`
      : null,
    deliveryPricingPending
      ? "Delivery pricing: Pending address/access verification; build subtotal excludes delivery"
      : null,
  ]).join("; ");
  const wallColor = formatWallColorValue(args.quote.inputs.color);
  const roofColor = formatColorValue(args.quote.inputs.roofColor);
  const trimColor = formatColorValue(args.quote.inputs.trimColor);
  const colorDetails = compact([
    wallColor ? `Wall: ${wallColor}` : null,
    roofColor ? `Roof: ${roofColor}` : null,
    trimColor ? `Trim: ${trimColor}` : null,
  ]).join("; ");
  const options = compact([
    getStringInput(args.quote.inputs, "windowPackage") &&
    getNumberInput(args.quote.inputs, "windowCount") !== null
      ? `${getNumberInput(args.quote.inputs, "windowCount")} ${getStringInput(
          args.quote.inputs,
          "windowPackage"
        )} windows`
      : null,
    args.quote.inputs.ventilation === true ? "Ventilation" : null,
  ]).join("; ");
  const addOns = getStringInput(args.quote.inputs, "addOns") ?? "None";

  return {
    subject,
    bodyText: [
      description.emailHeadline,
      ...description.contextLines,
      "",
      "Lead",
      `Name: ${displayText(args.quote.contact.name, "None")}`,
      `Phone: ${
        args.quote.contact.phone
          ? sanitizeAlertText(args.quote.contact.phone) || "None"
          : "None"
      }`,
      `Email: ${displayText(args.quote.contact.email, "None")}`,
      `Submitted: ${formatSubmittedAt(args.quote.createdAt)} CT`,
      "",
      "Project",
      `Shed type and size: ${projectSummary}`,
      ...(buildDetails ? [`Build: ${buildDetails}`] : []),
      ...(colorDetails ? [`Colors: ${colorDetails}`] : []),
      `Add-ons: ${addOns}`,
      `Options: ${options || "None"}`,
      "",
      "Delivery",
      deliveryDetails || "No delivery details provided",
      "",
      "Price",
      deliveryPricingPending
        ? `Build subtotal (delivery pending): ${formatCurrency(args.quote.pricing.total)}`
        : `Estimated total: ${formatCurrency(args.quote.pricing.total)}`,
      "",
      "Admin",
      `Open CRM: ${crmUrl}`,
      `Quote ID: ${sanitizeAlertText(args.quote.publicId) || "None"}`,
      `Quote row: ${sanitizeAlertText(args.quote._id) || "None"}`,
    ].join("\n"),
  };
}

export type QuoteEmailSendDeps = {
  getRecipientEnv: () => string | null | undefined;
  getCrmAdminUrl: () => string;
  getZohoConfig: () => ZohoConfig;
  sendEmail: (args: {
    config: ZohoConfig;
    toAddress: string;
    subject: string;
    content: string;
    mailFormat: "plaintext";
  }) => Promise<ZohoSendResult>;
};

function buildCrmUrl(args: {
  baseUrl: string;
  quotePublicId: string;
  quoteRequestId: Id<"quoteRequests">;
}) {
  const url = new URL(args.baseUrl);
  url.searchParams.set("quoteId", args.quotePublicId);
  url.searchParams.set("quoteRowId", args.quoteRequestId);
  return url.toString();
}

function compact(values: Array<string | null>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function displayText(value: string, fallback: string) {
  const trimmed = sanitizeAlertText(value);
  return trimmed || fallback;
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

function buildProjectSummary(inputs: Record<string, unknown>) {
  const length = getNumberInput(inputs, "length");
  const width = getNumberInput(inputs, "width");
  const structureType = getStringInput(inputs, "structureType") ?? "Structure";
  const dimensions =
    length !== null && width !== null ? `${length}x${width}` : "Size not provided";

  return `${dimensions} ${structureType}`;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatTextValue(String(item))).join(", ") : "None";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
