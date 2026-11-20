import { v } from "convex/values";

const touch = v.object({
  landingPath: v.string(),
  referrer: v.union(v.literal("direct"), v.literal("google"), v.literal("bing"), v.literal("social"), v.literal("chatgpt"), v.literal("perplexity"), v.literal("claude"), v.literal("gemini"), v.literal("copilot"), v.literal("other")),
  utmSource: v.optional(v.string()), utmMedium: v.optional(v.string()), utmCampaign: v.optional(v.string()),
});

// Optional browser measurement is distinct from the operational quote session.
// Absent means unknown/opted out; never infer a direct visit from its absence.
export const quoteMeasurementValidator = v.object({
  sessionId: v.string(),
  attribution: v.optional(v.object({ firstTouch: touch, lastTouch: touch })),
});
