import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { quoteInputsValidator } from "./validators";

/** Earlier quotes from the same phone inside this window make an alert "same lead". */
export const SAME_LEAD_WINDOW_MS = 30 * 24 * 60 * 60_000;
/** Bounds the lookup; alerts show "option 26+" past it. */
export const SAME_LEAD_LOOKBACK_LIMIT = 25;

export type QuoteLeadHistory = {
  earlierQuoteCount: number;
  /** The customer's most recent earlier quote, for the "Before:" line. */
  previous: {
    inputs: Doc<"quoteRequests">["inputs"];
    total: number;
    deliveryPricingPending: boolean;
    createdAt: number;
  } | null;
};

export const NO_LEAD_HISTORY: QuoteLeadHistory = { earlierQuoteCount: 0, previous: null };

export const quoteLeadHistoryValidator = v.object({
  earlierQuoteCount: v.number(),
  previous: v.union(
    v.null(),
    v.object({
      inputs: quoteInputsValidator,
      total: v.number(),
      deliveryPricingPending: v.boolean(),
      createdAt: v.number(),
    })
  ),
});

/**
 * Quotes the same customer saved before this one. The route normalizes phones
 * to E.164 and requires one, so the phone is the lead identity.
 */
export async function getQuoteLeadHistory(
  ctx: QueryCtx,
  quote: Doc<"quoteRequests">
): Promise<QuoteLeadHistory> {
  const phone = quote.contact.phone;
  if (!phone) return NO_LEAD_HISTORY;

  const earlier = await ctx.db
    .query("quoteRequests")
    .withIndex("by_tenant_id_and_contact_phone_and_created_at", (q) =>
      q
        .eq("tenantId", quote.tenantId)
        .eq("contact.phone", phone)
        .gte("createdAt", quote.createdAt - SAME_LEAD_WINDOW_MS)
        .lt("createdAt", quote.createdAt)
    )
    .order("desc")
    .take(SAME_LEAD_LOOKBACK_LIMIT);
  const previous = earlier[0];

  return {
    earlierQuoteCount: earlier.length,
    previous: previous
      ? {
          inputs: previous.inputs,
          total: previous.pricing.total,
          deliveryPricingPending:
            previous.pricing.deliveryPricingStatus === "pending_verification",
          createdAt: previous.createdAt,
        }
      : null,
  };
}
