import { PHONE_DISPLAY } from "@/lib/contact";

// Retained so legacy two-field quote submissions keep their original audit copy.
export const SMS_CONSENT_BODY_TEXT =
  "I agree to receive calls or text messages from Shed210 about my quote request, scheduling, and project updates. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help.";

export const SMS_CONSENT_LINK_TEXT =
  "See our Privacy Policy and Terms & SMS Policy.";

// Current quote consent (v4). Consent is optional to purchase, and the copy
// names the phone alternative for people who prefer not to receive texts.
export const SMS_QUOTE_CONSENT_BODY_TEXT =
  "I agree to receive text messages from Shed210 about my quote request, scheduling, and project updates. Consent is not a condition of purchase. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help.";

export const SMS_QUOTE_CONSENT_ALTERNATIVE_TEXT =
  `Prefer not to receive texts? Call ${PHONE_DISPLAY} for a quote.`;

export const SMS_QUOTE_CONSENT_TEXT =
  `${SMS_QUOTE_CONSENT_BODY_TEXT} ${SMS_CONSENT_LINK_TEXT} ${SMS_QUOTE_CONSENT_ALTERNATIVE_TEXT}`;

export const SMS_QUOTE_CONSENT_TEXT_VERSION =
  "shed210_quote_sms_consent_v4_2026_09_28";

// v3 wording shown between 2026-09-27 and the v4 release. Retained so pages
// already open in a browser can still submit, recorded with the copy they saw.
export const SMS_QUOTE_CONSENT_V3_TEXT =
  "I agree to receive text messages from Shed210 about my quote request, scheduling, and project updates. Required to use the online quote tool. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. See our Privacy Policy and Terms & SMS Policy.";

export const SMS_QUOTE_CONSENT_V3_TEXT_VERSION =
  "shed210_quote_sms_consent_v3_2026_09_27";

/** Displayed copy for each accepted quote-consent version. */
export const SMS_QUOTE_CONSENT_TEXT_BY_VERSION = {
  [SMS_QUOTE_CONSENT_TEXT_VERSION]: SMS_QUOTE_CONSENT_TEXT,
  [SMS_QUOTE_CONSENT_V3_TEXT_VERSION]: SMS_QUOTE_CONSENT_V3_TEXT,
} as const;

export const SMS_QUOTE_CONSENT_REQUIRED_MESSAGE =
  `Check the box to get your online estimate, or call ${PHONE_DISPLAY} for a quote.`;

export const SMS_CONSENT_TEXT = `${SMS_CONSENT_BODY_TEXT} ${SMS_CONSENT_LINK_TEXT}`;

export const SMS_CONSENT_TEXT_VERSION = "shed210_quote_contact_consent_v2_2026_05";

export const SMS_MARKETING_CONSENT_TEXT =
  "I agree to receive promotional texts from Shed210. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to purchase goods or services.";

export const SMS_MARKETING_CONSENT_TEXT_VERSION =
  "shed210_marketing_sms_consent_v1_2026_05";

export const SMS_UNIFIED_CONSENT_BODY_TEXT =
  "I agree to receive recurring first-party text messages from Shed210, including messages about my quote request, scheduling, project updates, and Shed210 marketing or promotional offers. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to get a quote or purchase goods or services.";

export const SMS_UNIFIED_CONSENT_TEXT = `${SMS_UNIFIED_CONSENT_BODY_TEXT} ${SMS_CONSENT_LINK_TEXT}`;

export const SMS_UNIFIED_CONSENT_TEXT_VERSION =
  "shed210_unified_sms_consent_v1_2026_07";

export const SMS_TERMS_EFFECTIVE_DATE = "September 28, 2026";

// Website chat consent (v1), modeled on quote consent v4. Shown unticked on the
// chat contact card; the label's text must equal SMS_CHAT_CONSENT_TEXT because
// the CRM records exactly what is sent.
export const SMS_CHAT_CONSENT_BODY_TEXT =
  "I agree to receive text messages from Shed210 about my website chat, quote questions, scheduling, and project updates. Consent is not a condition of purchase. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for help.";

export const SMS_CHAT_CONSENT_ALTERNATIVE_TEXT =
  `Prefer not to receive texts? Call ${PHONE_DISPLAY} instead.`;

export const SMS_CHAT_CONSENT_TEXT =
  `${SMS_CHAT_CONSENT_BODY_TEXT} ${SMS_CONSENT_LINK_TEXT} ${SMS_CHAT_CONSENT_ALTERNATIVE_TEXT}`;

export const SMS_CHAT_CONSENT_TEXT_VERSION =
  "shed210_chat_sms_consent_v1_2026_11_14";
