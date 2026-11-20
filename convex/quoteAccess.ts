const WRITE_KEY_ENV = "CONVEX_QUOTE_WRITE_KEY";
const PREVIOUS_WRITE_KEY_ENV = "CONVEX_QUOTE_WRITE_KEY_PREVIOUS";
const PRICING_READ_KEY_ENV = "CONVEX_QUOTE_PRICING_READ_KEY";
const PREVIOUS_PRICING_READ_KEY_ENV =
  "CONVEX_QUOTE_PRICING_READ_KEY_PREVIOUS";
const PRICING_WRITE_KEY_FALLBACK_ENV =
  "CONVEX_PRICING_ALLOW_WRITE_KEY_FALLBACK";

function configuredSecret(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function rotationKeys(currentName: string, previousName: string) {
  const current = configuredSecret(currentName);
  if (!current) return [];

  const previous = configuredSecret(previousName);
  return previous && previous !== current ? [current, previous] : [current];
}

export function getCurrentQuoteWriteKey() {
  return configuredSecret(WRITE_KEY_ENV);
}

export function isQuoteWriteKeyAuthorized(suppliedKey: string) {
  return rotationKeys(WRITE_KEY_ENV, PREVIOUS_WRITE_KEY_ENV).includes(
    suppliedKey
  );
}

export function requireQuoteWriteKey(suppliedKey: string) {
  if (!isQuoteWriteKeyAuthorized(suppliedKey)) {
    throw new Error("Unauthorized quote write");
  }
}

export function isLegacyPricingWriteKeyFallbackAllowed() {
  const configured = process.env[PRICING_WRITE_KEY_FALLBACK_ENV]?.trim();
  if (!configured) return true;
  return configured.toLowerCase() === "true";
}

export function isQuotePricingReadKeyAuthorized(args: {
  readKey?: string;
  writeKey?: string;
}) {
  if (
    args.readKey !== undefined &&
    args.writeKey !== undefined &&
    args.readKey !== args.writeKey
  ) {
    return false;
  }

  const suppliedKey = args.readKey ?? args.writeKey;
  if (!suppliedKey) return false;

  const acceptedKeys = rotationKeys(
    PRICING_READ_KEY_ENV,
    PREVIOUS_PRICING_READ_KEY_ENV
  );
  if (isLegacyPricingWriteKeyFallbackAllowed()) {
    acceptedKeys.push(
      ...rotationKeys(WRITE_KEY_ENV, PREVIOUS_WRITE_KEY_ENV)
    );
  }

  return acceptedKeys.includes(suppliedKey);
}
