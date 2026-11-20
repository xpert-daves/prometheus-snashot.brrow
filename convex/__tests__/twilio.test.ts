/**
 * @jest-environment node
 */

import {
  normalizeSmsRecipientPhone,
  sendTwilioSms,
  sendTwilioSmsDetailed,
} from "../twilio";

describe("Twilio SMS helper", () => {
  const originalEnv = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
  };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_FROM_NUMBER = "+18555780944";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SM123", status: "queued" }),
    } as Response);
  });

  afterEach(() => {
    if (originalEnv.TWILIO_ACCOUNT_SID === undefined) {
      delete process.env.TWILIO_ACCOUNT_SID;
    } else {
      process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID;
    }
    if (originalEnv.TWILIO_AUTH_TOKEN === undefined) {
      delete process.env.TWILIO_AUTH_TOKEN;
    } else {
      process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
    }
    if (originalEnv.TWILIO_FROM_NUMBER === undefined) {
      delete process.env.TWILIO_FROM_NUMBER;
    } else {
      process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("normalizes US recipient numbers to E.164", () => {
    expect(normalizeSmsRecipientPhone("(210) 555-0123")).toBe("+12105550123");
    expect(normalizeSmsRecipientPhone("1 210 555 0123")).toBe("+12105550123");
    expect(() => normalizeSmsRecipientPhone("555")).toThrow(
      "Invalid SMS recipient phone number"
    );
  });

  it("sends a text message through the Twilio Messages API", async () => {
    const result = await sendTwilioSmsDetailed("+12105550123", "Quote alert");

    expect(result).toEqual({ sid: "SM123", status: "queued" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic QUMxMjM6YXV0aC10b2tlbg==",
        }),
      })
    );
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get("To")).toBe("+12105550123");
    expect(body.get("From")).toBe("+18555780944");
    expect(body.get("Body")).toBe("Quote alert");
  });

  it("returns the Twilio SID from the simple SMS helper", async () => {
    await expect(sendTwilioSms("+12105550123", "Quote alert")).resolves.toBe("SM123");
  });

  it("surfaces Twilio API errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Bad request" }),
    } as Response);

    await expect(sendTwilioSms("+12105550123", "Quote alert")).rejects.toThrow(
      "Bad request"
    );
  });
});
