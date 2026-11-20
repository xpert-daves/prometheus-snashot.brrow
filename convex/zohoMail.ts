const ZOHO_ACCOUNTS_BASE_URL = "https://accounts.zoho.com";
const ZOHO_MAIL_API_BASE_URL = "https://mail.zoho.com/api";

type ZohoTokenResponse = {
  access_token?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type ZohoSendResponse = {
  data?: unknown;
  status?: unknown;
  message?: unknown;
};

export type ZohoConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
  fromAddress: string;
};

export type ZohoSendResult = {
  providerMessageId: string | null;
  providerThreadId: string | null;
  status: string | null;
};

export function getZohoConfig(): ZohoConfig {
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
  const accountId = process.env.ZOHO_MAIL_ACCOUNT_ID?.trim();
  const fromAddress = process.env.ZOHO_FROM_ADDRESS?.trim().toLowerCase();

  if (!clientId || !clientSecret || !refreshToken || !accountId || !fromAddress) {
    throw new Error(
      "Zoho Mail is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_MAIL_ACCOUNT_ID, and ZOHO_FROM_ADDRESS in Convex."
    );
  }

  return { clientId, clientSecret, refreshToken, accountId, fromAddress };
}

export async function sendZohoEmail(args: {
  config: ZohoConfig;
  toAddress: string;
  subject: string;
  content: string;
  mailFormat?: "html" | "plaintext";
}): Promise<ZohoSendResult> {
  const accessToken = await refreshZohoAccessToken(args.config);
  const response = await fetch(
    `${ZOHO_MAIL_API_BASE_URL}/accounts/${encodeURIComponent(
      args.config.accountId
    )}/messages`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromAddress: args.config.fromAddress,
        toAddress: args.toAddress,
        subject: args.subject,
        content: args.content,
        mailFormat: args.mailFormat ?? "plaintext",
        askReceipt: "no",
        encoding: "UTF-8",
      }),
    }
  );
  const payload = (await response.json().catch(() => null)) as ZohoSendResponse | null;

  if (!response.ok) {
    throw new Error(extractZohoError(payload) ?? `Zoho send failed with status ${response.status}`);
  }

  return {
    providerMessageId: extractZohoMessageId(payload),
    providerThreadId: extractZohoThreadId(payload),
    status: typeof payload?.status === "string" ? payload.status : null,
  };
}

async function refreshZohoAccessToken(config: ZohoConfig) {
  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  const response = await fetch(`${ZOHO_ACCOUNTS_BASE_URL}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const payload = (await response.json().catch(() => null)) as ZohoTokenResponse | null;

  if (!response.ok || typeof payload?.access_token !== "string") {
    const message =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.error === "string"
          ? payload.error
          : `Zoho token refresh failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.access_token;
}

function extractZohoError(payload: ZohoSendResponse | null) {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  const data = payload?.data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return null;
}

function extractZohoMessageId(payload: ZohoSendResponse | null) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return null;
  const id = (data as { messageId?: unknown; messageIdString?: unknown }).messageId;
  const idString = (data as { messageIdString?: unknown }).messageIdString;
  if (typeof idString === "string") return idString;
  return typeof id === "string" ? id : null;
}

function extractZohoThreadId(payload: ZohoSendResponse | null) {
  const data = payload?.data;
  if (!data || typeof data !== "object") return null;
  const threadId = (data as { threadId?: unknown }).threadId;
  return typeof threadId === "string" ? threadId : null;
}
