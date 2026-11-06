import { type GatewayDriver } from "@/lib/gateways/types";

/**
 * iCredit (Rivhit) — Israeli hosted payment page.
 *
 * Docs: https://docs.rivhit.co.il/ (Hebrew index) + the live API reference at
 * https://rivhit-api.readme.io/ :
 *  - "Get GroupPrivateToken From iCredit" — where the merchant copies the token
 *    from their Payment Page's "Payment Settings" in the iCredit dashboard.
 *  - "Methods" — GetUrl / SaleChargeToken / CreateSale.
 *  - "Payment Page Process" — the hosted-page redirect flow + IPN.
 *  - "IPN - Webhooks" — notification payload + required Verify confirmation.
 *  - Live operation reference:
 *    https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/GetUrl
 *    https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/Verify
 *
 * Flow:
 *  1. createCheckout POSTs to GetUrl with GroupPrivateToken + a single Item
 *     carrying the order total, our own orderId in `Order` (echoed back
 *     verbatim in the IPN), RedirectURL/FailRedirectURL/IPNURL, and optional
 *     customer fields. Response.URL is the hosted payment page to redirect to.
 *  2. iCredit charges the card, then POSTs (IPNMethod=1, the default) the full
 *     sale + order details as an IPN to our callback URL, and separately
 *     redirects the shopper's browser to RedirectURL/FailRedirectURL.
 *  3. verifyCallback reads SaleId + TotalAmount + Order from the IPN body (POST
 *     JSON — falling back to query string for the GET/"mode 2" variant, which
 *     only carries SaleID), then calls Verify server-side with
 *     {GroupPrivateToken, SaleId, TotalAmount} to confirm the charge actually
 *     happened before trusting it. Only a "Verified" status is treated as paid.
 */

const API_BASE = "https://icredit.rivhit.co.il/API/PaymentPageRequest.svc";

type GetUrlResponse = {
  URL?: string | null;
  PublicSaleToken?: string | null;
  PrivateSaleToken?: string | null;
  Status?: number | string | null;
  DebugMessage?: string | null;
};

type VerifyResponse = {
  Status?: string | null;
};

export const icreditDriver: GatewayDriver = {
  key: "icredit",
  label: "iCredit (ריווחית)",
  description: "סליקת אשראי והפקת מסמכים דרך חשבון iCredit/ריווחית שלך.",
  docsUrl: "https://docs.rivhit.co.il/",
  credentialFields: [
    {
      key: "groupPrivateToken",
      label: "Group Private Token",
      type: "password",
      required: true,
      help: "בלוח הבקרה של iCredit: עמודי תשלום ← בחר/י את עמוד התשלום ← עריכה ← הגדרות תשלום ← Group Private Token.",
    },
  ],

  async createCheckout(params, creds) {
    const groupPrivateToken = creds.groupPrivateToken?.trim();
    if (!groupPrivateToken) {
      throw new Error("חסר Group Private Token של iCredit — יש לחבר את החשבון מחדש.");
    }

    const body = {
      GroupPrivateToken: groupPrivateToken,
      Order: params.orderId,
      // Our own order id, echoed back verbatim in the IPN as `Order`.
      Items: [
        {
          UnitPrice: params.amount,
          Quantity: 1,
          Description: params.description,
        },
      ],
      PriceIncludeVAT: true,
      CustomerFirstName: params.customerName ?? undefined,
      EmailAddress: params.customerEmail ?? undefined,
      PhoneNumber: params.customerPhone ?? undefined,
      RedirectURL: params.successUrl,
      FailRedirectURL: params.cancelUrl,
      IPNURL: params.callbackUrl,
      // Mode 1 (default): IPN POST carries the full sale/order payload, not
      // just a bare SaleID — required so verifyCallback can read Order/TotalAmount.
      IPNMethod: 1,
    };

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/GetUrl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("שגיאת תקשורת מול iCredit — נסה/י שוב בעוד רגע.");
    }

    if (!response.ok) {
      throw new Error("iCredit סירב לבקשת התשלום — יש לבדוק את חיבור הסליקה.");
    }

    let data: GetUrlResponse;
    try {
      data = await response.json();
    } catch {
      throw new Error("תגובה לא תקינה מ-iCredit בעת יצירת עמוד תשלום.");
    }

    if (!data.URL) {
      throw new Error(
        data.DebugMessage
          ? `iCredit דחה את יצירת עמוד התשלום: ${data.DebugMessage}`
          : "iCredit לא החזיר קישור לעמוד תשלום.",
      );
    }

    return { redirectUrl: data.URL };
  },

  async verifyCallback(request, creds) {
    const groupPrivateToken = creds.groupPrivateToken?.trim();
    if (!groupPrivateToken) {
      throw new Error("חסר Group Private Token של iCredit — לא ניתן לאמת את ההודעה.");
    }

    // IPNMethod=1 (what createCheckout sets) posts the full payload as JSON;
    // some accounts/configs may still deliver it as a form body or via GET
    // query string (mode 2, SaleID-only) — handle all three defensively.
    let payload: Record<string, unknown> = {};
    const url = new URL(request.url);

    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") ?? "";
      try {
        if (contentType.includes("application/json")) {
          payload = await request.json();
        } else {
          const form = await request.formData();
          form.forEach((value, key) => {
            payload[key] = value;
          });
        }
      } catch {
        throw new Error("לא ניתן היה לפענח את הודעת iCredit.");
      }
    } else {
      url.searchParams.forEach((value, key) => {
        payload[key] = value;
      });
    }

    const saleId = String(payload.SaleId ?? payload.SaleID ?? payload.PrivateSaleToken ?? "").trim();
    const orderId = String(payload.Order ?? payload.CustomerTransactionId ?? "").trim();
    const totalAmountRaw = payload.TotalAmount ?? payload.Amount;
    const totalAmount =
      typeof totalAmountRaw === "number"
        ? totalAmountRaw
        : typeof totalAmountRaw === "string" && totalAmountRaw.trim() !== ""
          ? Number(totalAmountRaw)
          : NaN;

    if (!saleId) {
      throw new Error("הודעת iCredit לא כללה מזהה עסקה (SaleId).");
    }
    if (!orderId) {
      throw new Error("הודעת iCredit לא כללה את מזהה ההזמנה שלנו (Order).");
    }
    if (!Number.isFinite(totalAmount)) {
      throw new Error("הודעת iCredit לא כללה סכום עסקה תקין לאימות.");
    }

    // Never trust the IPN body alone — confirm server-to-server with iCredit
    // that this SaleId truly charged this amount before marking the order paid.
    let verifyResponse: Response;
    try {
      verifyResponse = await fetch(`${API_BASE}/Verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          GroupPrivateToken: groupPrivateToken,
          SaleId: saleId,
          TotalAmount: totalAmount,
        }),
      });
    } catch {
      throw new Error("שגיאת תקשורת מול iCredit באימות התשלום.");
    }

    if (!verifyResponse.ok) {
      throw new Error("iCredit סירב לבקשת אימות התשלום.");
    }

    let verifyData: VerifyResponse;
    try {
      verifyData = await verifyResponse.json();
    } catch {
      throw new Error("תגובה לא תקינה מ-iCredit באימות התשלום.");
    }

    // TODO: verify against a live iCredit account — docs only confirm the
    // response is a string Status field and don't enumerate all possible
    // values; "Verified" is the documented success value.
    const paid = String(verifyData.Status ?? "").trim().toLowerCase() === "verified";

    return { orderId, paid, providerRef: saleId };
  },
};
