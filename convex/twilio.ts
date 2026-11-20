const TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";

type TwilioMessageResponse = {
  sid?: unknown;
  status?: unknown;
  message?: unknown;
  error_message?: unknown;
};

export type TwilioSendResult = {
  sid: string;
  status: string | null;
};

export function normalizeSmsRecipientPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const nationalDigits =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (nationalDigits.length !== 10) {
    throw new Error("Invalid SMS recipient phone number");
  }

  return `+1${nationalDigits}`;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Convex."
    );
  }

  return { accountSid, authToken, fromNumber };
}

export async function sendTwilioSms(to: string, body: string): Promise<string> {
  return (await sendTwilioSmsDetailed(to, body)).sid;
}

export async function sendTwilioSmsDetailed(
  to: string,
  body: string
): Promise<TwilioSendResult> {
  const { accountSid, authToken, fromNumber } = getTwilioConfig();
  const params = new URLSearchParams({
    To: normalizeSmsRecipientPhone(to),
    From: fromNumber,
    Body: body,
  });

  const response = await fetch(
    `${TWILIO_API_BASE_URL}/Accounts/${encodeURIComponent(
      accountSid
    )}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${toBase64(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  const payload = (await response.json().catch(() => null)) as TwilioMessageResponse | null;

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error_message === "string"
          ? payload.error_message
          : `Twilio request failed with status ${response.status}`;
    throw new Error(message);
  }

  return {
    sid: typeof payload?.sid === "string" ? payload.sid : "",
    status: typeof payload?.status === "string" ? payload.status : null,
  };
}

function toBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let index = 0;

  while (index < value.length) {
    const first = value.charCodeAt(index++);
    const second = index < value.length ? value.charCodeAt(index++) : Number.NaN;
    const third = index < value.length ? value.charCodeAt(index++) : Number.NaN;

    output += alphabet[first >> 2];
    output += alphabet[
      ((first & 3) << 4) | (Number.isNaN(second) ? 0 : second >> 4)
    ];
    output += Number.isNaN(second)
      ? "="
      : alphabet[
          ((second & 15) << 2) | (Number.isNaN(third) ? 0 : third >> 6)
        ];
    output += Number.isNaN(third) ? "=" : alphabet[third & 63];
  }

  return output;
}
