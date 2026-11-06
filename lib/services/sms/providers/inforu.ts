import type { SmsDriver, SmsSendResult } from "@/lib/services/sms/types";

/**
 * InforU (אינפורו) — a popular Israeli business-SMS gateway ("019"-style
 * sender IDs, Hebrew support). InforU exposes both a legacy XML API and a
 * newer JSON REST API; we target the REST API since it's what current
 * integration guides point new merchants to.
 *
 * TODO: verify against a live InforU account — the exact base URL, auth
 * header shape, and JSON field names below are reconstructed from InforU's
 * publicly published integration guides (developers.inforu.co.il) rather
 * than a live test call, since this project has no InforU account to test
 * against. In particular: (a) confirm the endpoint path
 * (POST /api/v2/SMS/SendSms vs a numeric-only /SendSms variant), (b) confirm
 * whether auth is HTTP Basic (Username:ApiToken) or a bearer/query-string
 * token, (c) confirm the exact recipient/content field names
 * (Recipients/RecipientPhoneNumber vs PhoneNumbers) and the success-detection
 * field in the response (StatusId 1 = queued in most InforU docs).
 *
 * Israeli sender-ID rules: InforU requires the merchant's alphanumeric sender
 * name to be pre-approved via their support portal before it can be used as
 * `Sender` — an unapproved sender is usually silently replaced with a shared
 * default rather than causing a hard error, so we surface that as a hint in
 * the connect-form copy rather than something we can detect from send().
 */

const INFORU_ENDPOINT = "https://api.inforu.co.il/api/v2/SMS/SendSms";

type InforuResponse = {
  StatusId?: number;
  StatusDescription?: string;
  MessageId?: string;
  // TODO: confirm exact shape — some InforU accounts return an array under
  // "Results"/"Data" instead of a flat object.
};

async function send(
  credentials: Record<string, string>,
  to: string,
  text: string,
): Promise<SmsSendResult> {
  const username = credentials.username?.trim();
  const apiToken = credentials.apiToken?.trim();
  const sender = credentials.sender?.trim();
  if (!username || !apiToken) {
    return { ok: false, error: "חסרים פרטי חיבור ל-InforU (שם משתמש / API Token)" };
  }

  // TODO: confirm auth header shape (Basic username:apiToken is InforU's
  // documented default for the REST API as of their published guide).
  const basicAuth = Buffer.from(`${username}:${apiToken}`).toString("base64");

  const body = {
    Data: {
      Message: text,
      Recipients: [{ Phone: to }],
      Settings: {
        Sender: sender || undefined,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(INFORU_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "לא ניתן היה להתחבר לשרת InforU" };
  }

  let data: InforuResponse | undefined;
  try {
    data = await res.json();
  } catch {
    // handled below
  }

  // TODO: confirm the exact "success" StatusId — 1 is InforU's documented
  // "queued for sending" status; some accounts may use a different code.
  if (!res.ok || (data?.StatusId !== undefined && data.StatusId !== 1)) {
    return {
      ok: false,
      error: data?.StatusDescription || `שגיאת InforU (סטטוס ${res.status})`,
    };
  }
  return { ok: true, providerId: data?.MessageId };
}

export const inforuDriver: SmsDriver = {
  id: "inforu",
  name: "InforU (019)",
  description: "שירות SMS ישראלי — תמיכה בעברית ובשם שולח מותאם (טעון אישור מראש)",
  docsUrl: "https://www.inforu.co.il/",
  credentialFields: [
    { key: "username", label: "שם משתמש", required: true },
    { key: "apiToken", label: "API Token", required: true, secret: true },
    {
      key: "sender",
      label: "שם שולח (אופציונלי)",
      placeholder: "עד 11 תווים באנגלית או 15 מספרים",
      help: "שם שולח מותאם דורש אישור מראש מול InforU — עד לאישור יוצג שולח ברירת מחדל",
    },
  ],
  send,
};
