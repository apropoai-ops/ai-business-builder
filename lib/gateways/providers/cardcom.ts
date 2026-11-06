import {
  type GatewayCallbackResult,
  type GatewayCheckoutParams,
  type GatewayCheckoutResult,
  type GatewayCredentials,
  type GatewayDriver,
} from "@/lib/gateways/types";

/**
 * Cardcom — Israeli hosted payment page (Low Profile REST API v11).
 * Docs: https://secure.cardcom.solutions/Api/v11/Docs (Swagger/OpenAPI —
 * confirmed against the published spec) + the Hebrew support-center guide at
 * https://support.cardcom.solutions/hc/he/categories/360002172172
 *
 * Flow:
 * 1. POST /api/v11/LowProfile/Create with TerminalNumber + ApiName (the two
 *    credentials required by the schema — ApiPassword is NOT part of this
 *    endpoint's request body; Cardcom authenticates Low Profile calls with
 *    TerminalNumber+ApiName alone. We still collect apiPassword as a stored
 *    credential since Cardcom's older/other APIs — e.g. GetLpResult is one of
 *    the few that only needs TerminalNumber+ApiName too — reuse it, and to
 *    stay forward-compatible if Cardcom starts requiring it here).
 *    Required fields: TerminalNumber, ApiName, Amount, SuccessRedirectUrl,
 *    FailedRedirectUrl, WebHookUrl. Our orderId round-trips via ReturnValue
 *    ("A string of data to save on the transaction... you will get it back in
 *    the WebHook URL", max 250 chars). Response: { ResponseCode, Description,
 *    LowProfileId, Url, UrlToPayPal, UrlToBit } — ResponseCode 0 = success,
 *    Url is the hosted payment page to redirect the shopper to.
 * 2. Cardcom calls WebHookUrl (POST, JSON body, API level 11) with the same
 *    shape as the LowProfileResult response (ResponseCode, LowProfileId,
 *    TranzactionId, ReturnValue, TranzactionInfo, ...). Cardcom's own
 *    documented best practice is to NOT trust the webhook body directly and
 *    instead re-query POST /api/v11/LowProfile/GetLpResult with
 *    { TerminalNumber, ApiName, LowProfileId } to get the authoritative
 *    server-side result — which is what verifyCallback does below.
 *
 * TODO: verify against a live Cardcom account whether ApiPassword ever needs
 * to be sent (some Cardcom REST endpoints outside LowProfile use it), and
 * confirm the exact webhook delivery method (JSON POST body is the
 * documented API-v11 shape — see the Zendesk "webhook centralization"
 * article — but Cardcom also lets merchants configure a legacy Name-Value
 * POST in the terminal admin panel; we defensively also parse form-encoded
 * and query-string bodies).
 */

const CARDCOM_BASE_URL = "https://secure.cardcom.solutions/api/v11";

type CardcomCreateResponse = {
  ResponseCode: number;
  Description?: string | null;
  LowProfileId?: string | null;
  Url?: string | null;
  UrlToPayPal?: string | null;
  UrlToBit?: string | null;
};

type CardcomTransactionInfo = {
  ResponseCode?: number;
  TranzactionId?: number;
  ApprovalNumber?: string;
  Amount?: number;
};

type CardcomLpResult = {
  ResponseCode: number;
  Description?: string | null;
  TerminalNumber?: number;
  LowProfileId?: string;
  TranzactionId?: number;
  ReturnValue?: string | null;
  Operation?: string | null;
  TranzactionInfo?: CardcomTransactionInfo | null;
};

function terminalNumber(creds: GatewayCredentials): number {
  const n = Number(creds.terminalNumber);
  return Number.isFinite(n) ? n : NaN;
}

async function createCheckout(
  params: GatewayCheckoutParams,
  creds: GatewayCredentials,
): Promise<GatewayCheckoutResult> {
  const terminal = terminalNumber(creds);
  if (!terminal || !creds.apiName) {
    throw new Error("חסרים פרטי התחברות ל-Cardcom (מספר טרמינל / שם משתמש API)");
  }

  const body = {
    TerminalNumber: terminal,
    ApiName: creds.apiName,
    Operation: "ChargeOnly",
    ReturnValue: params.orderId,
    Amount: params.amount,
    ProductName: params.description,
    SuccessRedirectUrl: params.successUrl,
    FailedRedirectUrl: params.cancelUrl,
    WebHookUrl: params.callbackUrl,
    ISOCoinId: 1, // ILS
    Document:
      params.customerName || params.customerEmail
        ? {
            Name: params.customerName || "לקוח/ה",
            Email: params.customerEmail || undefined,
            Products: [
              {
                Description: params.description,
                UnitCost: params.amount,
              },
            ],
          }
        : undefined,
  };

  let res: Response;
  try {
    res = await fetch(`${CARDCOM_BASE_URL}/LowProfile/Create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("לא ניתן היה להתחבר לשרת הסליקה של Cardcom");
  }

  let data: CardcomCreateResponse | undefined;
  try {
    data = (await res.json()) as CardcomCreateResponse;
  } catch {
    // handled by the checks below
  }

  if (!res.ok || !data || data.ResponseCode !== 0 || !data.Url) {
    const message =
      data?.Description || `שגיאה ביצירת עמוד תשלום ב-Cardcom (סטטוס ${res.status})`;
    throw new Error(`יצירת עמוד התשלום ב-Cardcom נכשלה: ${message}`);
  }

  return { redirectUrl: data.Url };
}

/** Fields we read out of Cardcom's webhook notification, regardless of
 * whether it arrives as a JSON POST body (documented API-v11 shape), a
 * form-encoded POST, or GET query params (legacy Name-Value terminals). */
type CardcomCallbackFields = {
  ResponseCode?: string;
  LowProfileId?: string;
  ReturnValue?: string;
  TranzactionId?: string;
};

async function readCallbackFields(
  request: Request,
): Promise<CardcomCallbackFields> {
  const fields: Record<string, string> = {};

  if (request.method === "GET") {
    const url = new URL(request.url);
    url.searchParams.forEach((value, key) => {
      fields[key] = value;
    });
    return fields as CardcomCallbackFields;
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        fields[key] =
          typeof value === "string" ? value : JSON.stringify(value ?? "");
      }
      return fields as CardcomCallbackFields;
    } catch {
      return fields as CardcomCallbackFields;
    }
  }

  try {
    const formData = await request.formData();
    formData.forEach((value, key) => {
      fields[key] = typeof value === "string" ? value : "";
    });
  } catch {
    // ignore — fields stays empty; also fall back to the query string since
    // Cardcom's Low Profile redirect/webhook sometimes appends params there
    // even on a POST callback.
  }
  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => {
    if (!(key in fields)) fields[key] = value;
  });
  return fields as CardcomCallbackFields;
}

/**
 * Server-side confirmation: call GetLpResult with OUR stored credentials +
 * the LowProfileId from the callback, and trust ONLY that response — this is
 * Cardcom's documented recommendation, since the webhook body itself could in
 * theory be spoofed by a third party hitting our public callback URL.
 */
async function fetchLpResult(
  lowProfileId: string,
  creds: GatewayCredentials,
): Promise<CardcomLpResult> {
  const terminal = terminalNumber(creds);
  let res: Response;
  try {
    res = await fetch(`${CARDCOM_BASE_URL}/LowProfile/GetLpResult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        TerminalNumber: terminal,
        ApiName: creds.apiName,
        LowProfileId: lowProfileId,
      }),
    });
  } catch {
    throw new Error("לא ניתן היה לאמת את העסקה מול שרת Cardcom");
  }

  let data: CardcomLpResult | undefined;
  try {
    data = (await res.json()) as CardcomLpResult;
  } catch {
    // handled below
  }

  if (!res.ok || !data) {
    throw new Error("תשובה לא תקינה משרת האימות של Cardcom");
  }
  return data;
}

async function verifyCallback(
  request: Request,
  creds: GatewayCredentials,
): Promise<GatewayCallbackResult> {
  const fields = await readCallbackFields(request);
  const lowProfileId = fields.LowProfileId;
  if (!lowProfileId) {
    throw new Error("התקבלה התראת תשלום מ-Cardcom ללא מזהה עסקה (LowProfileId)");
  }

  // Never trust the webhook body's own ResponseCode/ReturnValue — re-query
  // Cardcom server-to-server for the authoritative result.
  const result = await fetchLpResult(lowProfileId, creds);

  // Only the server-side lookup's ReturnValue is trusted — the webhook body's
  // copy is attacker-supplied, so never fall back to it.
  const orderId = result.ReturnValue;
  if (!orderId) {
    throw new Error("התראת התשלום מ-Cardcom חסרה מזהה הזמנה (ReturnValue)");
  }

  const paid = result.ResponseCode === 0;
  if (!paid) {
    return { orderId, paid: false };
  }

  // Unique transaction ids first — approval numbers repeat across cards, and
  // this value keys the one-transaction-one-order replay guard.
  const providerRef =
    (result.TranzactionId ? String(result.TranzactionId) : undefined) ||
    (result.TranzactionInfo?.TranzactionId
      ? String(result.TranzactionInfo.TranzactionId)
      : undefined) ||
    lowProfileId;

  return { orderId, paid: true, providerRef };
}

export const cardcomDriver: GatewayDriver = {
  key: "cardcom",
  label: "Cardcom",
  description: "סליקת אשראי והפקת חשבוניות דרך חשבון Cardcom שלך.",
  docsUrl: "https://support.cardcom.solutions/hc/he",
  credentialFields: [
    { key: "terminalNumber", label: "מספר טרמינל", type: "text", required: true },
    { key: "apiName", label: "שם משתמש API", type: "text", required: true },
    {
      key: "apiPassword",
      label: "סיסמת API",
      type: "password",
      required: false,
      help: "נדרש רק עבור חלק מממשקי ה-API הישנים של Cardcom; דף התשלום (Low Profile) פועל עם מספר טרמינל ושם משתמש API בלבד.",
    },
  ],
  createCheckout,
  verifyCallback,
};
