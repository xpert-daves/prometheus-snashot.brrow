import type { Doc, Id } from "../_generated/dataModel";
import {
  buildQuoteEmailContent,
  parseQuoteNotificationEmailRecipients,
  type QuoteEmailNotificationContext,
  type QuoteEmailSendDeps,
} from "../quoteEmailNotifications";
import { sendQuoteEmailAlertsForQuote } from "../notifications";
import type { QuoteAlert } from "../notificationText";
import { NO_LEAD_HISTORY } from "../quoteLeadHistory";
import type { ZohoConfig } from "../zohoMail";

const newLead: QuoteAlert = { readyToSchedule: false, history: NO_LEAD_HISTORY };

const tenantId = "tenants-shed210" as Id<"tenants">;
const quoteRequestId = "quoteRequests-1" as Id<"quoteRequests">;

const quote: Doc<"quoteRequests"> = {
  _id: quoteRequestId,
  _creationTime: 1_714_000_000_000,
  tenantId,
  publicId: "quote-public-1",
  sessionId: "session-1",
  contact: {
    name: "Maria Garcia",
    email: "maria@example.com",
    phone: "+12105550123",
  },
  inputs: {
    structureType: "storage_shed",
    length: 12,
    width: 8,
    roofStyle: "gabled",
    wallHeight: 8,
    roofMaterial: "29ga metal",
    frameGauge: "14-ga",
    color: "#053751",
    addOns: ["Workbench", "Loft"],
    ventilation: true,
    deliveryAddress: "123 Test St, San Antonio, TX 78205",
    deliveryZip: "78205",
    deliveryRadius: 5,
  },
  pricing: {
    total: 3500,
    breakdown: {
      base: 3000,
      wallHeight: 200,
      roof: 0,
      siding: 0,
      door: 0,
      windows: 0,
      addOns: 300,
      delivery: 0,
      discount: 0,
      interiorUpgrades: [],
    },
  },
  notificationStatus: "queued",
  notificationQueuedAt: 1_714_000_000_000,
  emailNotificationStatus: "queued",
  emailNotificationQueuedAt: 1_714_000_000_000,
  createdAt: Date.UTC(2026, 3, 24, 15, 30),
};

const zohoConfig: ZohoConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  accountId: "account-id",
  fromAddress: "info@shed210.com",
};

function createActionCtx(
  context: QuoteEmailNotificationContext | null = { quote, history: NO_LEAD_HISTORY }
) {
  const attempts: Array<{
    _id: Id<"quoteEmailNotificationAttempts">;
    quoteRequestId: Id<"quoteRequests">;
    recipientEmail: string;
    status: "pending" | "sent" | "failed";
    providerMessageId: string | null;
    providerThreadId: string | null;
    providerStatus: string | null;
    error?: string;
  }> = [];
  const statusUpdates: Array<{
    quoteRequestId: Id<"quoteRequests">;
    status: "sent" | "partial_failed" | "failed" | "no_recipients";
    error?: string;
  }> = [];
  const ctx = {
    runQuery: jest.fn().mockResolvedValue(context),
    runMutation: jest.fn().mockImplementation(async (_ref, args) => {
      if ("recipientEmail" in args) {
        const attemptId =
          `quoteEmailNotificationAttempts-${attempts.length + 1}` as Id<"quoteEmailNotificationAttempts">;
        attempts.push({
          _id: attemptId,
          quoteRequestId: args.quoteRequestId,
          recipientEmail: args.recipientEmail,
          status: "pending",
          providerMessageId: null,
          providerThreadId: null,
          providerStatus: null,
        });
        return attemptId;
      }

      if ("attemptId" in args) {
        const attempt = attempts.find((item) => item._id === args.attemptId);
        if (!attempt) throw new Error("Attempt not found");
        Object.assign(attempt, {
          status: args.status,
          providerMessageId: args.providerMessageId,
          providerThreadId: args.providerThreadId,
          providerStatus: args.providerStatus,
          error: args.error,
        });
        return null;
      }

      statusUpdates.push(args);
      return null;
    }),
  };

  return { ctx, attempts, statusUpdates };
}

function createDeps(overrides: Partial<QuoteEmailSendDeps> = {}): QuoteEmailSendDeps {
  return {
    getRecipientEnv: () => "galacticinsights@outlook.com,dvjr74@gmail.com",
    getCrmAdminUrl: () => "https://crm.frontierpixel.test/admin",
    getZohoConfig: () => zohoConfig,
    sendEmail: jest.fn().mockResolvedValue({
      providerMessageId: "zoho-message-1",
      providerThreadId: "zoho-thread-1",
      status: "success",
    }),
    ...overrides,
  };
}

describe("quote email notification helpers", () => {
  it("trims, lowercases, dedupes, and validates configured recipients", () => {
    expect(
      parseQuoteNotificationEmailRecipients(
        " GalacticInsights@Outlook.com, dvjr74@gmail.com, galacticinsights@OUTLOOK.com "
      )
    ).toEqual(["galacticinsights@outlook.com", "dvjr74@gmail.com"]);

    expect(() =>
      parseQuoteNotificationEmailRecipients("galacticinsights@outlook.com,not-an-email")
    ).toThrow("Invalid QUOTE_NOTIFICATION_EMAIL_RECIPIENTS value: not-an-email");
  });

  it("formats a quote lead alert subject and body with admin context", () => {
    const email = buildQuoteEmailContent({
      quote,
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: newLead,
    });

    expect(email.subject).toBe(
      "New Shed210 quote lead: Maria Garcia - 12x8 Storage Shed"
    );
    expect(email.bodyText).toContain("Name: Maria Garcia");
    expect(email.bodyText).toContain("Phone: +12105550123");
    expect(email.bodyText).toContain("Email: maria@example.com");
    expect(email.bodyText).toContain("Shed type and size: 12x8 Storage Shed");
    expect(email.bodyText).toContain("Estimated total: $3,500");
    expect(email.bodyText).toContain(
      "Address: 123 Test St, San Antonio, TX 78205"
    );
    expect(email.bodyText).toContain("ZIP: 78205");
    expect(email.bodyText).toContain("Colors: Wall: Gallery (dark blue)");
    expect(email.bodyText).not.toContain("#053751");
    expect(email.bodyText).toContain("Quote ID: quote-public-1");
    expect(email.bodyText).toContain(`Quote row: ${quoteRequestId}`);
    expect(email.bodyText).toContain(
      "Open CRM: https://crm.frontierpixel.test/admin?quoteId=quote-public-1&quoteRowId=quoteRequests-1"
    );
  });

  it("names roof and trim colors and reports the default wall color as not selected", () => {
    const email = buildQuoteEmailContent({
      quote: {
        ...quote,
        inputs: {
          ...quote.inputs,
          color: "#ffffff",
          roofColor: "#361921",
          trimColor: "#123abc",
        },
      },
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: newLead,
    });

    expect(email.bodyText).toContain(
      "Colors: Wall: Not selected (left on default white); Roof: Burgundy (dark red); Trim: Custom color #123ABC"
    );
    expect(email.bodyText).not.toContain("#FFFFFF");
  });

  it("flattens control characters and marks delivery pricing as pending", () => {
    const email = buildQuoteEmailContent({
      quote: {
        ...quote,
        publicId: "quote-public-1\nAdmin: forged",
        contact: {
          ...quote.contact,
          name: "Maria\r\nEstimated total: $1",
        },
        inputs: {
          ...quote.inputs,
          deliveryAddress: "123 Test St\nPrice: forged",
          deliveryRadius: 0,
        },
        pricing: {
          ...quote.pricing,
          deliveryPricingStatus: "pending_verification",
        },
      },
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: newLead,
    });

    expect(email.subject).not.toContain("\n");
    expect(email.subject).toContain("Maria Estimated total: $1");
    expect(email.bodyText).toContain(
      "Delivery pricing: Pending address/access verification; build subtotal excludes delivery"
    );
    expect(email.bodyText).toContain("Build subtotal (delivery pending): $3,500");
    expect(email.bodyText).not.toContain("\nPrice: forged");
    expect(email.bodyText).not.toContain("0 mi from 341 Vista Rd");
    expect(email.bodyText).not.toContain("\nAdmin: forged");
  });

  it("flags an anchored slab as left out of the subtotal", () => {
    const email = buildQuoteEmailContent({
      quote: {
        ...quote,
        inputs: { ...quote.inputs, foundation: "anchored_slab" },
      },
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: newLead,
    });

    expect(email.bodyText).toContain(
      "Foundation: Anchored Slab (not in subtotal; price from photos/site visit)"
    );
  });
});

describe("quote email alert sending", () => {
  it("records sent attempts and sends separate emails to each recipient", async () => {
    const { ctx, attempts, statusUpdates } = createActionCtx();
    const sendEmail = jest.fn().mockImplementation(async ({ toAddress }) => ({
      providerMessageId: `message-${toAddress}`,
      providerThreadId: `thread-${toAddress}`,
      status: "success",
    }));
    const deps = createDeps({ sendEmail });

    await sendQuoteEmailAlertsForQuote(ctx, { quoteRequestId }, deps);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        toAddress: "galacticinsights@outlook.com",
        mailFormat: "plaintext",
      })
    );
    expect(sendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ toAddress: "dvjr74@gmail.com" })
    );
    expect(attempts).toMatchObject([
      {
        recipientEmail: "galacticinsights@outlook.com",
        status: "sent",
        providerMessageId: "message-galacticinsights@outlook.com",
      },
      {
        recipientEmail: "dvjr74@gmail.com",
        status: "sent",
        providerMessageId: "message-dvjr74@gmail.com",
      },
    ]);
    expect(statusUpdates).toEqual([{ quoteRequestId, status: "sent" }]);
  });

  it("records partial failure without blocking successful recipients", async () => {
    const { ctx, attempts, statusUpdates } = createActionCtx();
    const sendEmail = jest
      .fn()
      .mockResolvedValueOnce({
        providerMessageId: "message-1",
        providerThreadId: "thread-1",
        status: "success",
      })
      .mockRejectedValueOnce(new Error("Zoho send failed"));

    await sendQuoteEmailAlertsForQuote(
      ctx,
      { quoteRequestId },
      createDeps({ sendEmail })
    );

    expect(attempts.map((attempt) => attempt.status)).toEqual(["sent", "failed"]);
    expect(attempts[1].error).toBe("Zoho send failed");
    expect(statusUpdates).toEqual([
      {
        quoteRequestId,
        status: "partial_failed",
        error: "dvjr74@gmail.com: Zoho send failed",
      },
    ]);
  });

  it("records full failure when every recipient send fails", async () => {
    const { ctx, attempts, statusUpdates } = createActionCtx();
    const sendEmail = jest.fn().mockRejectedValue(new Error("Zoho unavailable"));

    await sendQuoteEmailAlertsForQuote(
      ctx,
      { quoteRequestId },
      createDeps({ sendEmail })
    );

    expect(attempts.map((attempt) => attempt.status)).toEqual([
      "failed",
      "failed",
    ]);
    expect(statusUpdates[0]).toMatchObject({
      quoteRequestId,
      status: "failed",
    });
    expect(statusUpdates[0].error).toContain(
      "galacticinsights@outlook.com: Zoho unavailable"
    );
    expect(statusUpdates[0].error).toContain(
      "dvjr74@gmail.com: Zoho unavailable"
    );
  });

  it("marks the quote when no email recipients are configured", async () => {
    const { ctx, attempts, statusUpdates } = createActionCtx();
    const sendEmail = jest.fn();

    await sendQuoteEmailAlertsForQuote(
      ctx,
      { quoteRequestId },
      createDeps({
        getRecipientEnv: () => " ",
        sendEmail,
      })
    );

    expect(sendEmail).not.toHaveBeenCalled();
    expect(attempts).toHaveLength(0);
    expect(statusUpdates).toEqual([
      {
        quoteRequestId,
        status: "no_recipients",
        error: "No quote email notification recipients are configured.",
      },
    ]);
  });

  it("marks the quote failed when the CRM admin URL is missing", async () => {
    const { ctx, attempts, statusUpdates } = createActionCtx();
    const sendEmail = jest.fn();

    await sendQuoteEmailAlertsForQuote(
      ctx,
      { quoteRequestId },
      createDeps({
        getCrmAdminUrl: () => {
          throw new Error("FRONTIER_PIXEL_CRM_ADMIN_URL is not configured.");
        },
        sendEmail,
      })
    );

    expect(sendEmail).not.toHaveBeenCalled();
    expect(attempts).toHaveLength(0);
    expect(statusUpdates).toEqual([
      {
        quoteRequestId,
        status: "failed",
        error: "FRONTIER_PIXEL_CRM_ADMIN_URL is not configured.",
      },
    ]);
  });
});

describe("quote email alert kinds", () => {
  const sameLeadHistory = {
    earlierQuoteCount: 1,
    previous: {
      inputs: { structureType: "storage_shed" as const, length: 10, width: 8, addOns: [], deliveryRadius: 0 },
      total: 3100,
      deliveryPricingPending: true,
      createdAt: Date.UTC(2026, 3, 24, 15, 0),
    },
  };

  it("names a repeat quote as the same lead and shows the earlier option", () => {
    const email = buildQuoteEmailContent({
      quote,
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: { readyToSchedule: false, history: sameLeadHistory },
    });

    expect(email.subject).toBe(
      "Shed210 same lead, option 2: Maria Garcia - 12x8 Storage Shed"
    );
    expect(email.bodyText).toMatch(
      /^Same lead, option 2: still comparing\nBefore: 10x8 Storage Shed, \$3,100 before delivery \(Apr 24, 10:00 AM CT\)\n\nLead\n/
    );
  });

  it("names a ready-to-schedule tap in the subject and first lines", () => {
    const email = buildQuoteEmailContent({
      quote,
      crmAdminUrl: "https://crm.frontierpixel.test/admin",
      alert: { readyToSchedule: true, history: sameLeadHistory },
    });

    expect(email.subject).toBe("Ready to schedule: Maria Garcia - 12x8 Storage Shed");
    expect(email.bodyText).toMatch(/^Ready to schedule this build\nThey tapped Ready to schedule/);
    expect(email.bodyText).not.toContain("Before:");
  });

  it("records schedule alerts on the request, not on the quote's own alert status", async () => {
    const scheduleRequestId = "quoteDiscussionRequests-1" as Id<"quoteDiscussionRequests">;
    const { ctx, statusUpdates } = createActionCtx();
    const sendEmail = jest.fn().mockResolvedValue({
      providerMessageId: "message-1",
      providerThreadId: "thread-1",
      status: "success",
    });

    await sendQuoteEmailAlertsForQuote(
      ctx,
      { quoteRequestId, scheduleRequestId },
      createDeps({ sendEmail })
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Ready to schedule: Maria Garcia - 12x8 Storage Shed",
      })
    );
    const attemptCreates = ctx.runMutation.mock.calls
      .map(([, args]) => args)
      .filter((args) => "recipientEmail" in args);
    expect(attemptCreates).toEqual([
      { quoteRequestId, scheduleRequestId, recipientEmail: "galacticinsights@outlook.com" },
      { quoteRequestId, scheduleRequestId, recipientEmail: "dvjr74@gmail.com" },
    ]);
    expect(statusUpdates).toEqual([
      { requestId: scheduleRequestId, channel: "email", status: "sent" },
    ]);
  });
});
