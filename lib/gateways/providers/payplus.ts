import { timingSafeEqual } from "node:crypto";

import {
  type GatewayCallbackResult,
  type GatewayCheckoutParams,
  type GatewayCheckoutResult,
  type GatewayCredentials,
  type GatewayDriver,
} from "@/lib/gateways/types";

/**
 * PayPlus — Israeli hosted payment page (generate payment link).
 * Docs: https://restapidev.payplus.co.il/ (production: https://restapi.payplus.co.il/)
 * Reference: https://docs.payplus.co.il/reference/post_paymentpages-generatelink
 *            https://docs.payplus.co.il/reference/validate-requests-received-from-payplus
 *
 * Flow:
 *  1. createCheckout POSTs to PaymentPages/generateLink with the merchant's
 *     api-key/secret-key headers + payment_page_uid, and gets back a hosted
 *     payment page URL (data.payment_page_link) that the shopper is redirected to.
 *  2. PayPlus later POSTs a JSON callback to our callbackUrl. The callback body
 *     carries a `transaction` object; the order id round-trips via
 *     transaction.more_info (we send it as `more_info` on generateLink) and the
 *     payment result is transaction.status_code ("000" = approved).
 *  3. The callback request is authenticated via a `Hash` header: HMAC-SHA256 of
 *     the RAW request body, keyed with secret_key, base64-encoded. We recompute
 *     it from the raw body and compare — never trust the parsed JSON alone.
 *
 * NOTE: PayPlus's generateLink only has refURL_success / refURL_failure (no
 * distinct "cancel" URL) — our GatewayCheckoutParams.cancelUrl is sent as
 * refURL_failure, the closest documented equivalent.
 * // TODO: verify against a live PayPlus account whether a shopper-abandoned
 * // page (as opposed to a declined charge) also redirects to refURL_failure,
 * // or whether PayPlus has a separate cancel hook we should also wire up.
 */

const PAYPLUS_API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://restapi.payplus.co.il/api/v1.0"
    : "https://restapidev.payplus.co.il/api/v1.0";

type PayPlusGenerateLinkResponse = {
  results?: { status?: string; code?: number; description?: string };
  data?: {
    page_request_uid?: string;
    payment_page_link?: string;
    qr_code_image?: string;
  };
};

function getCred(creds: GatewayCredentials, key: string): string {
  const value = creds[key];
  if (!value) {
    throw new Error(`חסר פרט חיבור נדרש עבור PayPlus: ${key}`);
  }
  return value;
}

export const payplusDriver: GatewayDriver = {
  key: "payplus",
  label: "PayPlus",
  description: "סליקת אשראי, Bit ו-Apple/Google Pay דרך חשבון PayPlus שלך.",
  docsUrl: "https://restapidev.payplus.co.il/",
  credentialFields: [
    { key: "apiKey", label: "מפתח API", type: "password", required: true },
    { key: "secretKey", label: "מפתח סודי (Secret Key)", type: "password", required: true },
    { key: "paymentPageUid", label: "מזהה עמוד תשלום (Page UID)", type: "text", required: true },
  ],

  async createCheckout(
    params: GatewayCheckoutParams,
    creds: GatewayCredentials,
  ): Promise<GatewayCheckoutResult> {
    const apiKey = getCred(creds, "apiKey");
    const secretKey = getCred(creds, "secretKey");
    const paymentPageUid = getCred(creds, "paymentPageUid");

    const body: Record<string, unknown> = {
      payment_page_uid: paymentPageUid,
      amount: params.amount,
      currency_code: "ILS",
      more_info: params.orderId,
      more_info_1: params.orderId,
      custom_invoice_name: params.description,
      refURL_success: params.successUrl,
      // PayPlus has no distinct "cancel" redirect — refURL_failure is the
      // documented equivalent for a non-successful checkout.
      // TODO: verify against a live PayPlus account.
      refURL_failure: params.cancelUrl,
      refURL_callback: params.callbackUrl,
      sendEmailApproval: true,
      sendEmailFailure: false,
    };

    if (params.customerName || params.customerEmail || params.customerPhone) {
      body.customer = {
        customer_name: params.customerName || undefined,
        email: params.customerEmail || undefined,
        phone: params.customerPhone || undefined,
      };
    }

    let response: Response;
    try {
      response = await fetch(`${PAYPLUS_API_BASE}/PaymentPages/generateLink`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          "secret-key": secretKey,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("שגיאת תקשורת מול PayPlus. נסה שוב מאוחר יותר.");
    }

    let data: PayPlusGenerateLinkResponse | undefined;
    try {
      data = (await response.json()) as PayPlusGenerateLinkResponse;
    } catch {
      throw new Error("תגובה לא תקינה מ-PayPlus בעת יצירת עמוד תשלום.");
    }

    const redirectUrl = data?.data?.payment_page_link;
    const ok = response.ok && data?.results?.status === "success" && !!redirectUrl;

    if (!ok) {
      const reason = data?.results?.description || `שגיאה (${response.status})`;
      throw new Error(`יצירת עמוד תשלום ב-PayPlus נכשלה: ${reason}`);
    }

    return { redirectUrl: redirectUrl as string };
  },

  async verifyCallback(
    request: Request,
    creds: GatewayCredentials,
  ): Promise<GatewayCallbackResult> {
    const secretKey = getCred(creds, "secretKey");

    // Must hash the RAW body bytes (not a re-serialized/parsed version) —
    // PayPlus signs the exact bytes it sent.
    const rawBody = await request.text();

    const receivedHash =
      request.headers.get("hash") || request.headers.get("Hash") || "";

    if (!receivedHash) {
      throw new Error("קריאה חוזרת מ-PayPlus חסרה חתימה (Hash header).");
    }

    const expectedHashBuffer = await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      new TextEncoder().encode(rawBody),
    );
    const expectedHash = Buffer.from(expectedHashBuffer).toString("base64");

    // Genuinely constant-time: crypto.timingSafeEqual, not a `===` string
    // compare (which can leak the number of matching leading bytes through
    // response-time variance, letting an attacker brute-force the hash
    // byte-by-byte). Length is checked first since timingSafeEqual throws on
    // mismatched buffer lengths rather than returning false.
    const expectedBuf = Buffer.from(expectedHash);
    const receivedBuf = Buffer.from(receivedHash);
    const validSignature =
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf);

    if (!validSignature) {
      throw new Error("חתימת הקריאה החוזרת מ-PayPlus אינה תקינה — הבקשה נדחתה.");
    }

    let parsed: {
      transaction?: {
        more_info?: string;
        status_code?: string;
        uid?: string;
        payment_page_request_uid?: string;
      };
      data?: { status_code?: string; transaction_uid?: string };
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error("גוף הקריאה החוזרת מ-PayPlus אינו JSON תקין.");
    }

    // TODO: verify against a live PayPlus account — some PayPlus callback
    // variants nest the status under `data` instead of `transaction`; both
    // are handled defensively here since the docs example was incomplete.
    const transaction = parsed.transaction;
    const orderId = transaction?.more_info;
    const statusCode = transaction?.status_code ?? parsed.data?.status_code;
    const providerRef = transaction?.uid ?? parsed.data?.transaction_uid;

    if (!orderId) {
      throw new Error("הקריאה החוזרת מ-PayPlus לא כללה מזהה הזמנה (more_info).");
    }

    const paid = statusCode === "000";

    return { orderId, paid, providerRef };
  },
};
