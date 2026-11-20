import {
  isQuotePricingReadKeyAuthorized,
  isQuoteWriteKeyAuthorized,
  requireQuoteWriteKey,
} from "../quoteAccess";

const MANAGED_ENV_NAMES = [
  "CONVEX_QUOTE_WRITE_KEY",
  "CONVEX_QUOTE_WRITE_KEY_PREVIOUS",
  "CONVEX_QUOTE_PRICING_READ_KEY",
  "CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS",
  "CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK",
] as const;

describe("quote service credentials", () => {
  const originalValues = new Map(
    MANAGED_ENV_NAMES.map((name) => [name, process.env[name]])
  );

  beforeEach(() => {
    for (const name of MANAGED_ENV_NAMES) delete process.env[name];
  });

  afterAll(() => {
    for (const name of MANAGED_ENV_NAMES) {
      const value = originalValues.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("fails closed without a current write key", () => {
    process.env.CONVEX_QUOTE_WRITE_KEY_PREVIOUS = "previous-write-key";
    expect(isQuoteWriteKeyAuthorized("previous-write-key")).toBe(false);
    expect(() => requireQuoteWriteKey("previous-write-key")).toThrow(
      "Unauthorized quote write"
    );
  });

  it("accepts the current and optional previous write keys during rotation", () => {
    process.env.CONVEX_QUOTE_WRITE_KEY = "current-write-key";
    process.env.CONVEX_QUOTE_WRITE_KEY_PREVIOUS = "previous-write-key";

    expect(isQuoteWriteKeyAuthorized("current-write-key")).toBe(true);
    expect(isQuoteWriteKeyAuthorized("previous-write-key")).toBe(true);
    expect(isQuoteWriteKeyAuthorized("unknown-key")).toBe(false);
  });

  it("prefers a dedicated pricing key while allowing rollout fallback by default", () => {
    process.env.CONVEX_QUOTE_WRITE_KEY = "write-key";
    process.env.CONVEX_QUOTE_PRICING_READ_KEY = "pricing-read-key";

    expect(
      isQuotePricingReadKeyAuthorized({ readKey: "pricing-read-key" })
    ).toBe(true);
    expect(isQuotePricingReadKeyAuthorized({ readKey: "write-key" })).toBe(
      true
    );
  });

  it("disables write-key pricing reads after the rollout flag is false", () => {
    process.env.CONVEX_QUOTE_WRITE_KEY = "write-key";
    process.env.CONVEX_QUOTE_PRICING_READ_KEY = "pricing-read-key";
    process.env.CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS =
      "previous-pricing-read-key";
    process.env.CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK = "false";

    expect(isQuotePricingReadKeyAuthorized({ readKey: "write-key" })).toBe(
      false
    );
    expect(
      isQuotePricingReadKeyAuthorized({ readKey: "pricing-read-key" })
    ).toBe(true);
    expect(
      isQuotePricingReadKeyAuthorized({
        readKey: "previous-pricing-read-key",
      })
    ).toBe(true);
  });

  it("rejects conflicting legacy and current pricing arguments", () => {
    process.env.CONVEX_QUOTE_WRITE_KEY = "write-key";
    expect(
      isQuotePricingReadKeyAuthorized({
        readKey: "write-key",
        writeKey: "different-key",
      })
    ).toBe(false);
  });
});
