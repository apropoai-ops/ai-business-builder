import {
  type GatewayCallbackResult,
  type GatewayCheckoutParams,
  type GatewayCheckoutResult,
  type GatewayCredentials,
  type GatewayDriver,
} from "@/lib/gateways/types";

/**
 * Tranzila — Israeli hosted payment page (classic redirect / iframe).
 * Docs: https://docs.tranzila.com/
 *
 * FLOW (classic "iframenew.php" hosted-page redirect — the best-documented
 * Tranzila integration; the newer "TranzilaHostedFields"/handshake-token API
 * requires a separate server-to-server "handshake" call before the redirect
 * and is not fully published in the public docs at the time of writing):
 *
 *   1. We build a GET redirect URL to
 *        https://direct.tranzila.com/{terminalName}/iframenew.php
 *      with the order's amount/currency and our success/fail/notify URLs.
 *      The shopper's browser is sent there directly (no server-side API
 *      call is required for the classic flow, so apiAppKey/apiSecret are
 *      optional — only needed if the merchant's terminal enforces the
 *      newer token/handshake flow, or for the optional server-side
 *      transaction-verification query below).
 *   2. Tranzila hosts the card form, charges the card, then:
 *        - redirects the shopper's browser to success_url_address / fail_url_address
 *        - POSTs (or GETs, depending on terminal config) the same fields plus
 *          the transaction result to notify_url_address (our callback route)
 *   3. We verify the notification: Response == "000" means approved. We also
 *      cross-check the amount (sum) against what we expect isn't possible
 *      here since we don't have the order lookup in this driver — the caller
 *      (callback route) is expected to compare params against the stored
 *      order. We just report back what Tranzila told us.
 *
 * ORDER-ID ROUND-TRIP: Tranzila's classic hosted page doesn't have a generic
 * "custom metadata" field that's guaranteed to be echoed back unmodified by
 * every terminal config, but the free-text "pdesc" (payment description)
 * field IS echoed back verbatim in the notification for all terminals we
 * found documented. We stash our orderId in `pdesc` (prefixed so it's easy
 * to pull back out even if the merchant's Tranzila dashboard appends/edits
 * display text around it) AND also pass it as `myid`/`orderid`-style custom
 * fields some terminals additionally support, for redundancy.
 * // TODO: verify against a live Tranzila account which of pdesc / orderid /
 * // myid / udf1 actually survives round-trip for a real terminal, and adjust.
 *
 * CALLBACK VERIFICATION — READ THIS BEFORE LOOSENING ANYTHING HERE.
 * The classic redirect flow has no HMAC/signature on the notify payload, and
 * the notify URL (with the businessId and the orderId in it) is visible in the
 * shopper's own address bar. Every field below is therefore attacker-supplied:
 * `Response=000` proves nothing on its own.
 *
 * So this driver reports paid=true ONLY when Tranzila itself confirms the
 * charge in a server-to-server lookup keyed by the transaction reference:
 *   - Response === "000" and an orderId recovered from pdesc/orderid/myid,
 *     which merely decide WHICH transaction to go and check; then
 *   - a mandatory lookup with apiAppKey/apiSecret. Missing credentials, a
 *     missing transaction reference, a non-ok response, unparsable JSON or a
 *     network error all mean NOT VERIFIED, and therefore paid=false.
 *
 * That is a deliberate fail-CLOSED: an unverifiable notification leaves the
 * order pending for the owner to confirm by hand, which is recoverable. The
 * previous fail-open lost real money — anyone who knew their own order id
 * could POST `orderid=<id>&Response=000` and have the order marked paid,
 * stock decremented and a tax invoice issued without paying.
 *
 * // TODO: verify against a live Tranzila account: exact transaction-query
 * // endpoint path/response shape for the API-key-based confirmation call.
 */
export const tranzilaDriver: GatewayDriver = {
  key: "tranzila",
  label: "Tranzila",
  description: "סליקת אשראי דרך חשבון (טרמינל) Tranzila שלך.",
  docsUrl: "https://docs.tranzila.com/",
  credentialFields: [
    { key: "terminalName", label: "שם טרמינל (supplier)", type: "text", required: true },
    {
      key: "apiAppKey",
      label: "מפתח API (App Key)",
      type: "password",
      required: true,
      help: "חובה — בלעדיו אי אפשר לאמת מול Tranzila שהתשלום באמת בוצע, והזמנות לא יסומנו כשולמו.",
    },
    {
      key: "apiSecret",
      label: "סוד API (Secret)",
      type: "password",
      required: true,
      help: "חובה — משמש לאימות שרת-לשרת של כל עסקה מול Tranzila.",
    },
  ],

  async createCheckout(
    params: GatewayCheckoutParams,
    creds: GatewayCredentials,
  ): Promise<GatewayCheckoutResult> {
    const terminalName = creds.terminalName?.trim();
    if (!terminalName) {
      throw new Error("חסר שם טרמינל (supplier) של Tranzila בהגדרות הספק");
    }
    if (!params.amount || params.amount <= 0) {
      throw new Error("סכום ההזמנה אינו תקין לסליקה מול Tranzila");
    }

    // Round to 2 decimals — Tranzila expects a plain decimal ILS sum.
    const sum = params.amount.toFixed(2);

    // Smuggle our orderId through the free-text description field, which is
    // echoed back verbatim in the notification for the classic hosted page.
    // Keep it machine-parseable with a stable prefix/delimiter.
    const pdesc = `order:${params.orderId}|${params.description ?? ""}`.slice(0, 300);

    const qs = new URLSearchParams({
      sum,
      currency: "1", // 1 = ILS
      cred_type: "1", // regular (non-installment) credit charge
      tranmode: "AK", // authorize + capture (standard sale)
      success_url_address: params.successUrl,
      fail_url_address: params.cancelUrl,
      notify_url_address: params.callbackUrl,
      pdesc,
      // Redundant custom fields in case the merchant's terminal is configured
      // to surface user-defined fields instead of/alongside pdesc.
      // TODO: verify against a live Tranzila account which of these the
      // terminal actually returns in the notification payload.
      myid: params.orderId,
      orderid: params.orderId,
    });

    if (params.customerEmail) qs.set("email", params.customerEmail);
    if (params.customerPhone) qs.set("phone", params.customerPhone);
    if (params.customerName) qs.set("contact", params.customerName);

    const redirectUrl = `https://direct.tranzila.com/${encodeURIComponent(
      terminalName,
    )}/iframenew.php?${qs.toString()}`;

    return { redirectUrl };
  },

  async verifyCallback(
    request: Request,
    creds: GatewayCredentials,
  ): Promise<GatewayCallbackResult> {
    // Tranzila's notify_url_address may be invoked as GET (querystring) or
    // POST (form body), depending on the terminal's dashboard configuration.
    // Support both.
    let fields: URLSearchParams;
    if (request.method === "GET") {
      fields = new URL(request.url).searchParams;
    } else {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => ({}) as Record<string, unknown>);
        fields = new URLSearchParams();
        for (const [k, v] of Object.entries(body)) {
          if (v !== undefined && v !== null) fields.set(k, String(v));
        }
      } else {
        const raw = await request.text();
        // Body may be form-urlencoded regardless of declared content-type.
        fields = new URLSearchParams(raw);
        if ([...fields.keys()].length === 0) {
          // Fall back to querystring params appended to the notify URL itself.
          fields = new URL(request.url).searchParams;
        }
      }
    }

    const pdesc = fields.get("pdesc") ?? "";
    const orderIdFromPdesc = /^order:([^|]+)/.exec(pdesc)?.[1];
    const orderId =
      orderIdFromPdesc || fields.get("orderid") || fields.get("myid") || "";

    if (!orderId) {
      throw new Error("לא ניתן לזהות את מספר ההזמנה בהודעת התשלום מ-Tranzila");
    }

    const responseCode = fields.get("Response");
    // Claimed, not proven. Nothing below may promote this to `paid` on its own.
    const claimsApproved = responseCode === "000";

    const providerRef =
      fields.get("TranzilaTK") ||
      fields.get("ConfirmationCode") ||
      fields.get("index") ||
      fields.get("authnr") ||
      undefined;

    // MANDATORY server-to-server confirmation. Every early return below is a
    // deliberate fail-closed: `paid` starts false and only Tranzila's own
    // answer can set it true.
    // TODO: verify against a live Tranzila account — exact endpoint path and
    // response shape for the transaction-status/query API using apiAppKey +
    // apiSecret (Tranzila's newer REST "Transactions" API uses an
    // X-tranzila-api-app-key / X-tranzila-api-secret header pair against
    // https://api.tranzila.com/... in current docs, but the exact
    // verification-by-reference endpoint wasn't accessible while implementing
    // this driver).
    let paid = false;

    if (claimsApproved) {
      if (!creds.apiAppKey || !creds.apiSecret) {
        // Connected with a terminal name only. Refusing here is what stops an
        // unsigned notification from being taken at face value.
        throw new Error(
          "לא ניתן לאמת את התשלום מול Tranzila: חסרים מפתח API וסוד API בהגדרות הספק. ההזמנה נשארת בהמתנה לאישור ידני.",
        );
      }
      if (!providerRef) {
        throw new Error(
          "הודעת התשלום מ-Tranzila הגיעה בלי מזהה עסקה (TranzilaTK/index), ולכן לא ניתן לאמת אותה מול Tranzila.",
        );
      }

      const verifyResp = await fetch(
        `https://api.tranzila.com/v1/transactions/${encodeURIComponent(providerRef)}`,
        {
          method: "GET",
          headers: {
            "X-tranzila-api-app-key": creds.apiAppKey,
            "X-tranzila-api-access-token": creds.apiSecret,
            accept: "application/json",
          },
        },
      ).catch(() => null);

      if (!verifyResp || !verifyResp.ok) {
        // A network blip and a forged notification are indistinguishable from
        // here, so both must fail. Tranzila retries its notification.
        throw new Error("אימות העסקה מול Tranzila נכשל — ההזמנה לא סומנה כשולמה.");
      }

      const data = (await verifyResp.json().catch(() => null)) as
        | { transaction_response_code?: string; response_code?: string }
        | null;
      const code = data?.transaction_response_code ?? data?.response_code ?? null;
      if (code === null) {
        throw new Error("תשובת האימות מ-Tranzila לא ניתנת לפענוח — ההזמנה לא סומנה כשולמה.");
      }

      paid = code === "000";
    }

    return { orderId, paid, providerRef };
  },
};
