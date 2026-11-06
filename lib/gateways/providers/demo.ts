import crypto from "node:crypto";

import {
  type GatewayCallbackResult,
  type GatewayCheckoutParams,
  type GatewayCheckoutResult,
  type GatewayCredentials,
  type GatewayDriver,
} from "@/lib/gateways/types";

/**
 * Demo / test gateway — a self-hosted fake hosted-payment-page (app/pay/demo/
 * [orderId]) so a business owner can connect a "provider" and shoppers can
 * experience the FULL checkout flow with zero real money and no external
 * account. Mirrors the real-provider contract exactly (createCheckout returns
 * a redirect URL; the shopper pays or cancels there; a server notification
 * hits our own callback route) — the only difference is every step happens
 * inside this app instead of talking to a bank.
 *
 * Anti-forgery: createCheckout signs `${orderId}|${amount}` with HMAC-SHA256
 * keyed by `${creds.store_label}:${PAYMENTS_ENC_KEY}` and passes it through
 * the fake payment page as `sig`. verifyCallback recomputes the same HMAC from
 * the callback's own orderId/amount and rejects a mismatch — so a random POST
 * to the callback URL can't mark an order paid without knowing the merchant's
 * store_label + the server's encryption key.
 */

function amountToStr(amount: number): string {
  return amount.toFixed(2);
}

function signKey(creds: GatewayCredentials): string {
  // PAYMENTS_ENC_KEY is already required for credential storage (lib/gateways/
  // crypto.ts); reusing it as key material means the signature is unforgeable
  // without server-side secrets, even though this whole provider is "fake".
  const encKey = process.env.PAYMENTS_ENC_KEY ?? "";
  return `${creds.store_label ?? ""}:${encKey}`;
}

function sign(orderId: string, amountStr: string, creds: GatewayCredentials): string {
  return crypto
    .createHmac("sha256", signKey(creds))
    .update(`${orderId}|${amountStr}`)
    .digest("hex");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function createCheckout(
  params: GatewayCheckoutParams,
  creds: GatewayCredentials,
): Promise<GatewayCheckoutResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const amountStr = amountToStr(params.amount);
  const sig = sign(params.orderId, amountStr, creds);

  const url = new URL(`${appUrl}/pay/demo/${params.orderId}`);
  url.searchParams.set("amount", amountStr);
  url.searchParams.set("desc", params.description);
  url.searchParams.set("name", params.customerName?.trim() || "לקוח/ה");
  url.searchParams.set("label", creds.store_label || "החנות שלי");
  url.searchParams.set("cb", params.callbackUrl);
  url.searchParams.set("su", params.successUrl);
  url.searchParams.set("cu", params.cancelUrl);
  url.searchParams.set("sig", sig);

  return { redirectUrl: url.toString() };
}

/** Reads orderId/amount/sig/result from either query params (GET, or the
 * client-side fetch the fake payment page performs) or a form/JSON POST body,
 * whichever the caller used. */
async function readCallbackFields(request: Request): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};
  const url = new URL(request.url);
  url.searchParams.forEach((value, key) => {
    fields[key] = value;
  });

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const json = (await request.json()) as Record<string, unknown>;
        for (const [key, value] of Object.entries(json)) {
          fields[key] = typeof value === "string" ? value : String(value);
        }
      } else {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          fields[key] = typeof value === "string" ? value : "";
        });
      }
    } catch {
      // ignore — fall back to whatever was already parsed from the query string
    }
  }
  return fields;
}

async function verifyCallback(
  request: Request,
  creds: GatewayCredentials,
): Promise<GatewayCallbackResult> {
  const fields = await readCallbackFields(request);

  const orderId = fields.orderId;
  if (!orderId) {
    throw new Error("התקבלה התראת תשלום דמו ללא מזהה הזמנה");
  }

  const amountStr = fields.amount ?? "";
  const expectedSig = sign(orderId, amountStr, creds);
  if (!timingSafeEqualStrings(fields.sig ?? "", expectedSig)) {
    throw new Error("אימות חתימת תשלום הדמו נכשל");
  }

  if (fields.result !== "success") {
    return { orderId, paid: false };
  }

  return { orderId, paid: true, providerRef: `demo-${orderId.slice(0, 8)}` };
}

export const demoDriver: GatewayDriver = {
  key: "demo",
  label: "סליקת דמו (להתנסות)",
  description:
    "ספק סליקה מדומה — מדגים את חוויית התשלום המלאה בלי כסף אמיתי. מעולה לבדיקות לפני חיבור ספק אמיתי.",
  docsUrl: "https://apropo.business",
  credentialFields: [
    {
      key: "store_label",
      label: "שם החנות שיוצג בדף התשלום",
      type: "text",
      required: true,
      placeholder: "החנות שלי",
    },
  ],
  createCheckout,
  verifyCallback,
};
