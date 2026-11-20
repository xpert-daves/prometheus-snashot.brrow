import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  notificationAttemptStatusValidator,
  notificationRecipientDocValidator,
  notificationStatusValidator,
  quoteRequestDocValidator,
} from "./validators";
import {
  buildQuoteSmsBodies,
  deriveNotificationStatus,
  type NotificationStatus,
  type QuoteAlert,
  type QuoteSmsRequest,
} from "./notificationText";
import {
  getQuoteLeadHistory,
  quoteLeadHistoryValidator,
  type QuoteLeadHistory,
} from "./quoteLeadHistory";
import {
  buildQuoteEmailContent,
  getFrontierPixelCrmAdminUrl,
  parseQuoteNotificationEmailRecipients,
  type QuoteEmailNotificationContext,
  type QuoteEmailSendDeps,
} from "./quoteEmailNotifications";
import {
  filterShed210TenantDocs,
  getShed210TenantIdOrNull,
  getShed210TenantIdForExistingWrite,
  setActiveTenantContextByTenantId,
  tenantIdFields,
} from "./platformTenancy";
import { sendTwilioSms } from "./twilio";
import { getZohoConfig, sendZohoEmail } from "./zohoMail";

const MAX_SMS_RECIPIENTS = 20;

/** A quote's own alerts, or the alerts for a "ready to schedule" tap on it. */
export type QuoteAlertTarget = {
  quoteRequestId: Id<"quoteRequests">;
  scheduleRequestId?: Id<"quoteDiscussionRequests">;
};

type NotificationContext = {
  quote: Doc<"quoteRequests">;
  recipients: Doc<"notificationRecipients">[];
  history: QuoteLeadHistory;
};

function alertForTarget(target: QuoteAlertTarget, history: QuoteLeadHistory): QuoteAlert {
  return { readyToSchedule: target.scheduleRequestId !== undefined, history };
}

/** Attempt rows for a schedule alert carry its request, so they never read as quote alerts. */
function scheduleRequestFields(target: QuoteAlertTarget) {
  return target.scheduleRequestId ? { scheduleRequestId: target.scheduleRequestId } : {};
}

export async function getNotificationContextQuery(
  ctx: QueryCtx,
  { quoteRequestId }: { quoteRequestId: Id<"quoteRequests"> }
) {
  const storedQuote = await ctx.db.get(quoteRequestId);
  if (storedQuote?.tenantId) {
    await setActiveTenantContextByTenantId(ctx, storedQuote.tenantId);
  }
  const quote = storedQuote
    ? (await filterShed210TenantDocs(ctx, [storedQuote]))[0] ?? null
    : null;
  if (!quote) return null;

  const tenantId =
    quote.tenantId ?? (await getShed210TenantIdForExistingWrite(ctx));
  const scopedRecipients = tenantId
    ? await ctx.db
        .query("notificationRecipients")
        .withIndex("by_tenant_id_and_active", (query) =>
          query.eq("tenantId", tenantId).eq("active", true)
        )
        .take(MAX_SMS_RECIPIENTS)
    : [];
  const shedTenantId = await getShed210TenantIdOrNull(ctx);
  const recipients =
    scopedRecipients.length > 0 ||
    (tenantId !== undefined && shedTenantId !== null && tenantId !== shedTenantId)
      ? scopedRecipients
      : await filterShed210TenantDocs(
          ctx,
          await ctx.db
            .query("notificationRecipients")
            .withIndex("by_active", (query) => query.eq("active", true))
            .take(MAX_SMS_RECIPIENTS)
        );

  return { quote, recipients, history: await getQuoteLeadHistory(ctx, quote) };
}

export const getNotificationContext = internalQuery({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  returns: v.union(
    v.object({
      quote: quoteRequestDocValidator,
      recipients: v.array(notificationRecipientDocValidator),
      history: quoteLeadHistoryValidator,
    }),
    v.null()
  ),
  handler: getNotificationContextQuery,
});

export const createNotificationAttempt = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    scheduleRequestId: v.optional(v.id("quoteDiscussionRequests")),
    recipientId: v.id("notificationRecipients"),
    recipientLabel: v.string(),
    recipientPhone: v.string(),
    messagePartCount: v.number(),
  },
  returns: v.id("notificationAttempts"),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteRequestId);
    const tenantId =
      quote?.tenantId ?? (await getShed210TenantIdForExistingWrite(ctx));
    return await ctx.db.insert("notificationAttempts", {
      ...tenantIdFields(tenantId),
      ...args,
      status: "pending",
      twilioMessageSids: [],
      createdAt: Date.now(),
    });
  },
});

export const getQuoteEmailNotificationContext = internalQuery({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  returns: v.union(
    v.object({
      quote: quoteRequestDocValidator,
      history: quoteLeadHistoryValidator,
    }),
    v.null()
  ),
  handler: async (ctx, { quoteRequestId }) => {
    const storedQuote = await ctx.db.get(quoteRequestId);
    const quote = storedQuote
      ? (await filterShed210TenantDocs(ctx, [storedQuote]))[0] ?? null
      : null;
    if (!quote) return null;

    return { quote, history: await getQuoteLeadHistory(ctx, quote) };
  },
});

export const createQuoteEmailNotificationAttempt = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    scheduleRequestId: v.optional(v.id("quoteDiscussionRequests")),
    recipientEmail: v.string(),
  },
  returns: v.id("quoteEmailNotificationAttempts"),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteRequestId);
    const tenantId =
      quote?.tenantId ?? (await getShed210TenantIdForExistingWrite(ctx));
    return await ctx.db.insert("quoteEmailNotificationAttempts", {
      ...tenantIdFields(tenantId),
      ...args,
      status: "pending",
      providerMessageId: null,
      providerThreadId: null,
      providerStatus: null,
      createdAt: Date.now(),
    });
  },
});

export const completeQuoteEmailNotificationAttempt = internalMutation({
  args: {
    attemptId: v.id("quoteEmailNotificationAttempts"),
    status: notificationAttemptStatusValidator,
    providerMessageId: v.union(v.string(), v.null()),
    providerThreadId: v.union(v.string(), v.null()),
    providerStatus: v.union(v.string(), v.null()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.attemptId, {
      status: args.status,
      providerMessageId: args.providerMessageId,
      providerThreadId: args.providerThreadId,
      providerStatus: args.providerStatus,
      error: args.error,
      completedAt: Date.now(),
    });
    return null;
  },
});

export const completeNotificationAttempt = internalMutation({
  args: {
    attemptId: v.id("notificationAttempts"),
    status: notificationAttemptStatusValidator,
    twilioMessageSids: v.array(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.attemptId, {
      status: args.status,
      twilioMessageSids: args.twilioMessageSids,
      error: args.error,
      completedAt: Date.now(),
    });
    return null;
  },
});

export const markQuoteNotificationStatus = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    status: notificationStatusValidator,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      notificationStatus: args.status,
      notificationError: args.error,
      notificationCompletedAt: Date.now(),
    });
    return null;
  },
});

export const markQuoteEmailNotificationStatus = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    status: notificationStatusValidator,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      emailNotificationStatus: args.status,
      emailNotificationError: args.error,
      emailNotificationCompletedAt: Date.now(),
    });
    return null;
  },
});

export const markScheduleAlertStatus = internalMutation({
  args: {
    requestId: v.id("quoteDiscussionRequests"),
    channel: v.union(v.literal("sms"), v.literal("email")),
    status: notificationStatusValidator,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(
      args.requestId,
      args.channel === "sms"
        ? { smsAlertStatus: args.status, smsAlertError: args.error }
        : { emailAlertStatus: args.status, emailAlertError: args.error }
    );
    return null;
  },
});

async function markAlertStatus(
  ctx: Pick<ActionCtx, "runMutation">,
  target: QuoteAlertTarget,
  channel: "sms" | "email",
  status: NotificationStatus,
  error?: string
) {
  if (target.scheduleRequestId) {
    await ctx.runMutation(internal.notifications.markScheduleAlertStatus, {
      requestId: target.scheduleRequestId,
      channel,
      status,
      error,
    });
  } else if (channel === "sms") {
    await ctx.runMutation(internal.notifications.markQuoteNotificationStatus, {
      quoteRequestId: target.quoteRequestId,
      status,
      error,
    });
  } else {
    await ctx.runMutation(internal.notifications.markQuoteEmailNotificationStatus, {
      quoteRequestId: target.quoteRequestId,
      status,
      error,
    });
  }
}

const quoteEmailSendDeps: QuoteEmailSendDeps = {
  getRecipientEnv: () => process.env.QUOTE_NOTIFICATION_EMAIL_RECIPIENTS,
  getCrmAdminUrl: getFrontierPixelCrmAdminUrl,
  getZohoConfig,
  sendEmail: sendZohoEmail,
};

export async function sendQuoteEmailAlertsForQuote(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  target: QuoteAlertTarget,
  deps: QuoteEmailSendDeps = quoteEmailSendDeps
) {
  const data: QuoteEmailNotificationContext | null = await ctx.runQuery(
    internal.notifications.getQuoteEmailNotificationContext,
    {
      quoteRequestId: target.quoteRequestId,
    }
  );

  if (!data) return null;

  let recipients: string[];
  try {
    recipients = parseQuoteNotificationEmailRecipients(deps.getRecipientEnv());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid quote email recipients";
    await markAlertStatus(ctx, target, "email", "failed", message);
    return null;
  }

  if (recipients.length === 0) {
    await markAlertStatus(
      ctx,
      target,
      "email",
      "no_recipients",
      "No quote email notification recipients are configured."
    );
    return null;
  }

  let config: ReturnType<QuoteEmailSendDeps["getZohoConfig"]>;
  try {
    config = deps.getZohoConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zoho config failed";
    await markAlertStatus(ctx, target, "email", "failed", message);
    return null;
  }

  let crmAdminUrl: string;
  try {
    crmAdminUrl = deps.getCrmAdminUrl();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "CRM admin URL is not configured";
    await markAlertStatus(ctx, target, "email", "failed", message);
    return null;
  }

  const email = buildQuoteEmailContent({
    quote: data.quote,
    crmAdminUrl,
    alert: alertForTarget(target, data.history),
  });
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const recipientEmail of recipients) {
    const attemptId: Id<"quoteEmailNotificationAttempts"> =
      await ctx.runMutation(
        internal.notifications.createQuoteEmailNotificationAttempt,
        {
          quoteRequestId: target.quoteRequestId,
          ...scheduleRequestFields(target),
          recipientEmail,
        }
      );

    try {
      const result = await deps.sendEmail({
        config,
        toAddress: recipientEmail,
        subject: email.subject,
        content: email.bodyText,
        mailFormat: "plaintext",
      });
      successCount += 1;
      await ctx.runMutation(
        internal.notifications.completeQuoteEmailNotificationAttempt,
        {
          attemptId,
          status: "sent",
          providerMessageId: result.providerMessageId,
          providerThreadId: result.providerThreadId,
          providerStatus: result.status,
        }
      );
    } catch (error) {
      failureCount += 1;
      const message =
        error instanceof Error ? error.message : "Unknown Zoho email error";
      errors.push(`${recipientEmail}: ${message}`);
      await ctx.runMutation(
        internal.notifications.completeQuoteEmailNotificationAttempt,
        {
          attemptId,
          status: "failed",
          providerMessageId: null,
          providerThreadId: null,
          providerStatus: null,
          error: message,
        }
      );
    }
  }

  await markAlertStatus(
    ctx,
    target,
    "email",
    deriveNotificationStatus(recipients.length, successCount, failureCount),
    errors.length ? errors.join("; ") : undefined
  );

  return null;
}

export async function sendQuoteSmsAlertsForQuote(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  target: QuoteAlertTarget
) {
  const data: NotificationContext | null = await ctx.runQuery(
    internal.notifications.getNotificationContext,
    { quoteRequestId: target.quoteRequestId }
  );

  if (!data) return null;

  if (data.recipients.length === 0) {
    await markAlertStatus(
      ctx,
      target,
      "sms",
      "no_recipients",
      "No active SMS recipients are configured."
    );
    return null;
  }

  const bodies = buildQuoteSmsBodies(
    data.quote as QuoteSmsRequest,
    alertForTarget(target, data.history)
  );
  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const recipient of data.recipients) {
    const attemptId: Id<"notificationAttempts"> = await ctx.runMutation(
      internal.notifications.createNotificationAttempt,
      {
        quoteRequestId: target.quoteRequestId,
        ...scheduleRequestFields(target),
        recipientId: recipient._id,
        recipientLabel: recipient.label,
        recipientPhone: recipient.phone,
        messagePartCount: bodies.length,
      }
    );

    const twilioMessageSids: string[] = [];
    try {
      for (const body of bodies) {
        twilioMessageSids.push(await sendTwilioSms(recipient.phone, body));
      }
      successCount += 1;
      await ctx.runMutation(internal.notifications.completeNotificationAttempt, {
        attemptId,
        status: "sent",
        twilioMessageSids,
      });
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : "Unknown SMS error";
      errors.push(`${recipient.label}: ${message}`);
      await ctx.runMutation(internal.notifications.completeNotificationAttempt, {
        attemptId,
        status: "failed",
        twilioMessageSids,
        error: message,
      });
    }
  }

  await markAlertStatus(
    ctx,
    target,
    "sms",
    deriveNotificationStatus(data.recipients.length, successCount, failureCount),
    errors.length ? errors.join("; ") : undefined
  );

  return null;
}

export const sendQuoteSms = internalAction({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  returns: v.null(),
  handler: async (ctx, { quoteRequestId }) => {
    await sendQuoteSmsAlertsForQuote(ctx, { quoteRequestId });
    return null;
  },
});

export const sendQuoteEmailAlerts = internalAction({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  returns: v.null(),
  handler: async (ctx, { quoteRequestId }) => {
    await sendQuoteEmailAlertsForQuote(ctx, { quoteRequestId });
    return null;
  },
});

const scheduleAlertArgs = {
  quoteRequestId: v.id("quoteRequests"),
  scheduleRequestId: v.id("quoteDiscussionRequests"),
};

export const sendScheduleRequestSms = internalAction({
  args: scheduleAlertArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await sendQuoteSmsAlertsForQuote(ctx, args);
    return null;
  },
});

export const sendScheduleRequestEmailAlerts = internalAction({
  args: scheduleAlertArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await sendQuoteEmailAlertsForQuote(ctx, args);
    return null;
  },
});
