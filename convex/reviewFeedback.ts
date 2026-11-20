import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireQuoteWriteKey } from "./quoteAccess";
import {
  CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS,
  isCrmQuoteSyncEnabled,
  validateCrmQuoteSyncConfiguration,
} from "./crmQuoteSync";

/*
 * Review feedback is forwarded synchronously rather than through an outbox:
 * events are idempotent in the CRM, and the review page tells the customer to
 * retry when the CRM is unreachable instead of queueing their comment here.
 */

const eventValidator = v.union(
  v.literal("opened"),
  v.literal("rated"),
  v.literal("commented"),
  v.literal("google_opened"),
);
const deviceValidator = v.union(
  v.literal("iphone"),
  v.literal("android"),
  v.literal("desktop"),
  v.literal("other"),
);
const resultValidator = v.union(
  v.literal("recorded"),
  v.literal("not_found"),
  v.literal("unavailable"),
);

export type ReviewFeedbackPayload = {
  version: 1;
  tenantSlug: "shed210";
  linkCode: string;
  event: "opened" | "rated" | "commented" | "google_opened";
  rating: number | null;
  comment: string | null;
  device?: "iphone" | "android" | "desktop" | "other";
  occurredAt: number;
};
export type ReviewFeedbackForwardResult = "recorded" | "not_found" | "unavailable";

export async function postReviewFeedback(
  endpointUrl: string,
  intakeKey: string,
  payload: ReviewFeedbackPayload,
): Promise<ReviewFeedbackForwardResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRM_QUOTE_SYNC_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${intakeKey}` },
      body: JSON.stringify(payload),
    });
    if (response.status === 404) return "not_found";
    if (!response.ok) return "unavailable";
    const ack: unknown = await response.json().catch(() => null);
    return ack && typeof ack === "object" && (ack as Record<string, unknown>).ok === true &&
      (ack as Record<string, unknown>).status === "recorded"
      ? "recorded"
      : "unavailable";
  } catch {
    return "unavailable";
  } finally { clearTimeout(timeout); }
}

export const forward = action({
  args: {
    writeKey: v.string(),
    linkCode: v.string(),
    event: eventValidator,
    rating: v.union(v.number(), v.null()),
    comment: v.union(v.string(), v.null()),
    device: v.optional(deviceValidator),
    occurredAt: v.number(),
  },
  returns: resultValidator,
  handler: async (_ctx, { writeKey, ...feedback }) => {
    requireQuoteWriteKey(writeKey);
    if (!isCrmQuoteSyncEnabled()) return "unavailable";
    const config = validateCrmQuoteSyncConfiguration({
      endpointUrl: process.env.FRONTIER_PIXEL_CRM_INTAKE_URL,
      intakeKey: process.env.FRONTIER_PIXEL_CRM_INTAKE_KEY,
    });
    if (!config.ok) return "unavailable";
    const endpoint = new URL(config.endpointUrl);
    endpoint.pathname = "/api/intake/shed-review-feedback";
    return await postReviewFeedback(endpoint.toString(), config.intakeKey, {
      version: 1, tenantSlug: "shed210", ...feedback,
    });
  },
});
