const UNSAFE_ALERT_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u206f\ufeff]/g;
const COLLAPSIBLE_WHITESPACE = /\s+/g;

export const MAX_ALERT_FIELD_LENGTH = 300;

export function sanitizeAlertText(
  value: unknown,
  maxLength = MAX_ALERT_FIELD_LENGTH
) {
  const normalized = String(value ?? "")
    .replace(UNSAFE_ALERT_CHARACTERS, " ")
    .replace(COLLAPSIBLE_WHITESPACE, " ")
    .trim();
  return normalized.slice(0, maxLength).trim();
}
