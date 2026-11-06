import {
  type GatewayCallbackResult,
  type GatewayCheckoutParams,
  type GatewayCheckoutResult,
  type GatewayCredentials,
  type GatewayDriver,
} from "@/lib/gateways/types";

/**
 * Grow (formerly Meshulam) — Israeli hosted payment page.
 * Docs: https://grow-il.readme.io/ (Light API — createPaymentProcess /
 * approveTransaction / server-to-server callback).
 *
 * API summary (from the public docs; Grow gates full reference access behind
 * a support-provisioned account, so some field-level details below are the
 * best-documented shape — see the inline TODOs for what to confirm against a
 * live sandbox account):
 *
 * - Base URL: https://sandbox.meshulam.co.il/api/light/server/1.0 (sandbox)
 *   or https://api.meshulam.co.il/api/light/server/1.0 (production). We use
 *   production since merchants connect real live credentials.
 * - createPaymentProcess: POST multipart/form-data with userId, pageCode,
 *   apiKey, sum, description, pageField[fullName], pageField[phone],
 *   pageField[email], cField1..9 (free custom fields — we stash our orderId
 *   in cField1), successUrl, cancelUrl, notifyUrl. Response is the standard
 *   Grow envelope `{ status, err, data }`; on success `data.url` is the
 *   hosted payment page to redirect the shopper to (valid ~10 minutes).
 * - After the shopper pays, Grow POSTs a server-to-server notification to
 *   notifyUrl with the transaction fields (status/statusCode, transactionId,
 *   transactionToken, processId, processToken, sum, asmachta, customFields
 *   echoing our cField1, etc). No signature/HMAC field is documented for
 *   this callback, so authenticity is established by round-tripping the
 *   callback's own transaction identifiers back to Grow's approveTransaction
 *   endpoint using OUR merchant credentials (pageCode) — Grow only accepts
 *   that call for a real, matching transaction on our account, which is the
 *   documented server-side confirmation step.
 */

const GROW_BASE_URL = "https://api.meshulam.co.il/api/light/server/1.0";

type GrowEnvelope<T> = {
  status: number; // 1 = success in Grow's Light API convention
  err?: { id?: string | number; message?: string } | string | null;
  data?: T;
};

type CreatePaymentProcessData = {
  url?: string;
  processId?: string | number;
  processToken?: string;
};

// Grow's docs require requests as multipart/form-data (not JSON or plain
// x-www-form-urlencoded), so we build a real FormData body — fetch sets the
// multipart boundary content-type automatically for FormData bodies.
function growCredsToForm(creds: GatewayCredentials) {
  const form = new FormData();
  form.set("userId", creds.userId ?? "");
  form.set("pageCode", creds.pageCode ?? "");
  if (creds.apiKey) form.set("apiKey", creds.apiKey);
  return form;
}

/** Grow amounts are plain ILS (decimal shekels), not agorot — per the docs'
 * `sum` example ("10.99"). No conversion needed. */
function formatSum(amountIls: number): string {
  return amountIls.toFixed(2);
}

/** Grow wants an Israeli local mobile format (0500000000), not +972. Best
 * effort normalize; falls back to a placeholder since fullName+phone are
 * documented as required pageFields.
 * TODO: verify against a live Grow account whether phone is truly mandatory
 * for a Generic/Credit-Card page code, and the exact accepted format. */
function normalizeIlPhone(phone?: string | null): string {
  if (!phone) return "0500000000";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  if (!digits.startsWith("0")) digits = "0" + digits;
  return digits || "0500000000";
}

async function createCheckout(
  params: GatewayCheckoutParams,
  creds: GatewayCredentials,
): Promise<GatewayCheckoutResult> {
  const form = growCredsToForm(creds);
  form.set("sum", formatSum(params.amount));
  form.set("description", params.description);
  form.set("pageField[fullName]", params.customerName?.trim() || "לקוח/ה");
  form.set("pageField[phone]", normalizeIlPhone(params.customerPhone));
  if (params.customerEmail) form.set("pageField[email]", params.customerEmail);
  // Our order id round-trips via Grow's free-text custom field, echoed back
  // verbatim in the server-to-server callback's customFields.
  form.set("cField1", params.orderId);
  form.set("successUrl", params.successUrl);
  form.set("cancelUrl", params.cancelUrl);
  form.set("notifyUrl", params.callbackUrl);

  let res: Response;
  try {
    res = await fetch(`${GROW_BASE_URL}/createPaymentProcess`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new Error("לא ניתן היה להתחבר לשרת הסליקה של Grow");
  }

  let body: GrowEnvelope<CreatePaymentProcessData> | undefined;
  try {
    body = (await res.json()) as GrowEnvelope<CreatePaymentProcessData>;
  } catch {
    // fall through, handled by the !res.ok / missing-url checks below
  }

  const url = body?.data?.url;
  if (!res.ok || !body || Number(body.status) !== 1 || !url) {
    const message =
      (typeof body?.err === "string" ? body.err : body?.err?.message) ||
      `שגיאה ביצירת עמוד תשלום ב-Grow (סטטוס ${res.status})`;
    throw new Error(`יצירת עמוד התשלום ב-Grow נכשלה: ${message}`);
  }

  return { redirectUrl: url };
}

/** Fields Grow includes in the server-to-server notifyUrl callback that we
 * actually read. Sent as POST form data; some integrations receive it as GET
 * query params instead, so both are supported.
 * TODO: verify the exact field casing/nesting (e.g. whether customFields
 * arrives as customFields[cField1] vs a JSON-encoded array) against a live
 * callback from the sandbox account. */
type GrowCallbackFields = {
  status?: string;
  statusCode?: string;
  transactionId?: string;
  transactionToken?: string;
  transactionTypeId?: string;
  paymentType?: string;
  sum?: string;
  firstPaymentSum?: string;
  periodicalPaymentSum?: string;
  paymentsNum?: string;
  allPaymentsNum?: string;
  paymentDate?: string;
  asmachta?: string;
  description?: string;
  fullName?: string;
  payerPhone?: string;
  payerEmail?: string;
  cardSuffix?: string;
  cardType?: string;
  cardTypeCode?: string;
  cardBrand?: string;
  cardBrandCode?: string;
  cardExp?: string;
  processId?: string;
  processToken?: string;
  cField1?: string;
  pageCode?: string;
};

async function readCallbackFields(
  request: Request,
): Promise<GrowCallbackFields> {
  const fields: Record<string, string> = {};

  if (request.method === "GET") {
    const url = new URL(request.url);
    url.searchParams.forEach((value, key) => {
      fields[key] = value;
    });
    return fields as GrowCallbackFields;
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        fields[key] = typeof value === "string" ? value : JSON.stringify(value);
      }
      return fields as GrowCallbackFields;
    } catch {
      return fields as GrowCallbackFields;
    }
  }

  // Default: form-encoded (multipart or x-www-form-urlencoded), Grow's
  // documented shape for the server-to-server callback.
  try {
    const formData = await request.formData();
    formData.forEach((value, key) => {
      fields[key] = typeof value === "string" ? value : "";
    });
  } catch {
    // ignore — fields stays empty, will fail verification below
  }
  return fields as GrowCallbackFields;
}

/** Extract our order id from whatever shape the custom field arrives in. */
function extractOrderId(fields: GrowCallbackFields): string | undefined {
  if (fields.cField1) return fields.cField1;
  const raw = fields as unknown as Record<string, unknown>;
  const nested = raw["customFields"];
  if (nested && typeof nested === "object") {
    const asRecord = nested as Record<string, unknown>;
    const cField1 = asRecord["cField1"];
    if (typeof cField1 === "string") return cField1;
  }
  return undefined;
}

/**
 * Server-side confirmation: echo the transaction's own identifiers (as
 * received in the callback) back to Grow's approveTransaction endpoint,
 * authenticated with our pageCode. Grow only accepts this for a real,
 * matching transaction, so a successful response is our proof that the
 * callback wasn't forged/replayed client-side data.
 */
async function approveTransaction(
  fields: GrowCallbackFields,
  creds: GatewayCredentials,
): Promise<boolean> {
  const form = growCredsToForm(creds);
  const passthrough: (keyof GrowCallbackFields)[] = [
    "transactionId",
    "transactionToken",
    "transactionTypeId",
    "paymentType",
    "sum",
    "firstPaymentSum",
    "periodicalPaymentSum",
    "paymentsNum",
    "allPaymentsNum",
    "paymentDate",
    "asmachta",
    "description",
    "fullName",
    "payerPhone",
    "payerEmail",
    "cardSuffix",
    "cardType",
    "cardTypeCode",
    "cardBrand",
    "cardBrandCode",
    "cardExp",
    "processId",
    "processToken",
  ];
  for (const key of passthrough) {
    const value = fields[key];
    if (value !== undefined) form.set(key, value);
  }

  try {
    const res = await fetch(`${GROW_BASE_URL}/approveTransaction`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => undefined)) as
      | GrowEnvelope<unknown>
      | undefined;
    // approveTransaction is documented as an acknowledgement (it doesn't
    // itself flip the transaction's status), but Grow rejects it (non-1
    // status/err) when the transaction identifiers don't match a real
    // transaction under our credentials — that rejection is what we rely on
    // to catch forged/replayed callbacks.
    // TODO: verify against a live Grow account exactly which err code is
    // returned for a mismatched/forged transaction vs a legitimate one.
    // Fail CLOSED: an empty/unparsable acknowledgement is not a confirmation.
    return !!body && Number(body.status) === 1;
  } catch {
    return false;
  }
}

async function verifyCallback(
  request: Request,
  creds: GatewayCredentials,
): Promise<GatewayCallbackResult> {
  const fields = await readCallbackFields(request);

  const orderId = extractOrderId(fields);
  if (!orderId) {
    throw new Error("התקבלה התראת תשלום מ-Grow ללא מזהה הזמנה");
  }

  // "2" / "שולם" is Grow's documented paid indicator; accept either the
  // numeric statusCode or the human-readable status string.
  const looksPaid =
    fields.statusCode === "2" ||
    fields.status === "2" ||
    fields.status === "שולם" ||
    fields.status === "success" ||
    fields.status === "OK";

  if (!looksPaid) {
    return { orderId, paid: false };
  }

  if (!fields.transactionId || !fields.processId) {
    throw new Error("התראת התשלום מ-Grow חסרה נתוני עסקה לאימות");
  }

  const confirmed = await approveTransaction(fields, creds);
  if (!confirmed) {
    throw new Error("אימות עסקת Grow מול השרת נכשל");
  }

  return {
    orderId,
    paid: true,
    // transactionId is the identifier Grow just confirmed; asmachta is not
    // checked by approveTransaction, so it can't key the replay guard.
    providerRef: fields.transactionId,
  };
}

export const growDriver: GatewayDriver = {
  key: "grow",
  label: "Grow (משולם)",
  description: "סליקת אשראי, Bit ו-Google/Apple Pay דרך חשבון Grow שלך.",
  docsUrl: "https://grow-il.readme.io/",
  credentialFields: [
    { key: "userId", label: "מזהה משתמש (User ID)", type: "text", required: true },
    { key: "pageCode", label: "קוד עמוד (Page Code)", type: "text", required: true },
    {
      key: "apiKey",
      label: "מפתח API",
      type: "password",
      required: false,
      help: "נדרש רק אם החשבון שלך ב-Grow מוגדר עם כמה עסקים (multi-business).",
    },
  ],
  createCheckout,
  verifyCallback,
};
