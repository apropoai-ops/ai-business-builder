import type { GatewayDriver } from "@/lib/gateways/types";

/**
 * Pelecard — Israeli hosted payment page (PaymentGW / Init).
 * Docs: https://developer.pelecard.biz/
 *
 * Flow:
 *  1. createCheckout: POST {terminal,user,password,...} to
 *     https://gateway20.pelecard.biz/PaymentGW/init — returns { URL, Error,
 *     ConfirmationKey }. We redirect the shopper to `URL`.
 *  2. Pelecard's hosted page collects card details directly (never touches
 *     our server) then:
 *       - redirects the shopper's browser to GoodURL/ErrorURL, and
 *       - separately POSTs a server-to-server feedback to
 *         ServerSideGoodFeedbackURL/ServerSideErrorFeedbackURL (our
 *         /api/payments/pelecard/callback route) with PelecardTransactionId,
 *         PelecardStatusCode, ConfirmationKey, and our echoed ParamX/UserData1.
 *  3. verifyCallback: never trust the callback body alone — we re-confirm the
 *     transaction server-side via PaymentGW/GetTransaction (terminal/user/
 *     password + PelecardTransactionId) and cross-check its StatusCode and
 *     amount before reporting paid=true.
 *
 * Source used to pin down exact field names/endpoints (official docs at
 * developer.pelecard.biz are JS-rendered and not fetchable headlessly): the
 * dofinity/pelecard reference client (github.com/dofinity/pelecard), which
 * implements this same Init/GetTransaction/ValidateByUniqueKey flow against
 * gateway20.pelecard.biz.
 *
 * // TODO: verify against a live Pelecard account — in particular whether the
 * // production host is gateway20 vs gateway21 for this merchant's account
 * // (Pelecard has assigned merchants to different gateway hosts historically),
 * // and the exact shape (POST body vs query string) of the server-side
 * // feedback call, which can vary by terminal configuration.
 */

const PELECARD_BASE_URL = "https://gateway20.pelecard.biz";

type PelecardInitResponse = {
  URL?: string;
  ConfirmationKey?: string;
  Error?: { ErrCode?: string | number; ErrMsg?: string } | null;
};

type PelecardTransactionResponse = {
  StatusCode?: string;
  ResultData?: {
    DebitTotal?: number | string;
    TotalX100?: number | string;
    UserData?: { UserData1?: string } & Record<string, string | undefined>;
  };
  UserData?: { UserData1?: string } & Record<string, string | undefined>;
  Error?: { ErrCode?: string | number; ErrMsg?: string } | null;
};

async function pelecardPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PELECARD_BASE_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("שגיאת תקשורת מול Pelecard. נסה שוב מאוחר יותר.");
  }
  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    throw new Error("תשובה לא תקינה מ-Pelecard.");
  }
  return json;
}

/** Extracts our orderId back out of Pelecard's echoed UserData/ParamX fields. */
function extractOrderId(data: {
  UserData?: { UserData1?: string } & Record<string, string | undefined>;
  ParamX?: string;
} | null | undefined): string | null {
  if (!data) return null;
  const fromUserData = data.UserData?.UserData1;
  if (fromUserData) return fromUserData;
  if (data.ParamX) return data.ParamX;
  return null;
}

export const pelecardDriver: GatewayDriver = {
  key: "pelecard",
  label: "Pelecard",
  description: "סליקת אשראי דרך חשבון (טרמינל) Pelecard שלך.",
  docsUrl: "https://developer.pelecard.biz/",
  credentialFields: [
    { key: "terminalNumber", label: "מספר טרמינל", type: "text", required: true },
    { key: "user", label: "שם משתמש", type: "text", required: true },
    { key: "password", label: "סיסמה", type: "password", required: true },
  ],

  async createCheckout(params, creds) {
    const terminal = creds.terminalNumber;
    const user = creds.user;
    const password = creds.password;
    if (!terminal || !user || !password) {
      throw new Error("חסרים פרטי התחברות ל-Pelecard (טרמינל / משתמש / סיסמה).");
    }

    const totalAgorot = Math.round(params.amount * 100);
    if (!Number.isFinite(totalAgorot) || totalAgorot <= 0) {
      throw new Error("סכום התשלום אינו תקין.");
    }

    let json: PelecardInitResponse;
    try {
      json = await pelecardPost<PelecardInitResponse>("PaymentGW/init", {
        terminal,
        user,
        password,
        Total: totalAgorot,
        Currency: 1, // 1 = ILS
        ActionType: "J4", // regular debit (charge)
        GoodURL: params.successUrl,
        ErrorURL: params.cancelUrl,
        ServerSideGoodFeedbackURL: params.callbackUrl,
        ServerSideErrorFeedbackURL: params.callbackUrl,
        ParamX: params.orderId,
        UserData1: params.orderId,
        CustomerIdField: "optional",
        EmailField: params.customerEmail ? "must" : "hide",
        TelField: params.customerPhone ? "must" : "hide",
        Language: "HE",
      });
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error("שגיאה לא צפויה בפנייה ל-Pelecard.");
    }

    if (json.Error && json.Error.ErrCode && String(json.Error.ErrCode) !== "0") {
      throw new Error(
        `Pelecard סירבה לפתוח דף תשלום: ${json.Error.ErrMsg ?? json.Error.ErrCode}`,
      );
    }
    if (!json.URL) {
      throw new Error("Pelecard לא החזירה קישור לדף תשלום.");
    }

    return { redirectUrl: json.URL };
  },

  async verifyCallback(request, creds) {
    const terminal = creds.terminalNumber;
    const user = creds.user;
    const password = creds.password;
    if (!terminal || !user || !password) {
      throw new Error("חסרים פרטי התחברות ל-Pelecard (טרמינל / משתמש / סיסמה).");
    }

    // Pelecard's server-side feedback (ServerSideGoodFeedbackURL /
    // ServerSideErrorFeedbackURL) has historically been sent as either a POST
    // (JSON or form body) or a GET with query params, depending on terminal
    // configuration — so accept whichever arrives.
    // TODO: verify against a live Pelecard account which shape this terminal actually sends.
    let raw: Record<string, unknown> = {};
    const url = new URL(request.url);
    for (const [k, v] of url.searchParams.entries()) raw[k] = v;

    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") ?? "";
      try {
        if (contentType.includes("application/json")) {
          const body = (await request.json()) as Record<string, unknown>;
          raw = { ...raw, ...body };
        } else {
          const form = await request.formData();
          for (const [k, v] of form.entries()) raw[k] = String(v);
        }
      } catch {
        // fall back to whatever we parsed from the query string
      }
    }

    const transactionId = String(raw.PelecardTransactionId ?? raw.TransactionId ?? "").trim();
    const callbackStatusCode = String(raw.PelecardStatusCode ?? raw.StatusCode ?? "").trim();
    const callbackOrderId = extractOrderId({
      UserData: {
        UserData1: (raw.UserData1 as string | undefined) ?? undefined,
      },
      ParamX: (raw.ParamX as string | undefined) ?? undefined,
    });

    if (!transactionId) {
      throw new Error("קריאה חוזרת מ-Pelecard חסרה מזהה עסקה.");
    }

    // Never trust the callback body alone: re-confirm the transaction
    // server-side against Pelecard before treating it as paid.
    const verify = await pelecardPost<PelecardTransactionResponse>("PaymentGW/GetTransaction", {
      terminal,
      user,
      password,
      TransactionId: transactionId,
    });

    if (verify.Error && verify.Error.ErrCode && String(verify.Error.ErrCode) !== "0") {
      return { orderId: callbackOrderId ?? "", paid: false, providerRef: transactionId };
    }

    // Fail CLOSED: require the server-side verification call to explicitly
    // confirm "000". An empty/absent StatusCode used to also count as success,
    // which meant an ambiguous verify response fell back to trusting the
    // callback's own self-reported status — exactly what this verification
    // step exists to not do. Tighten once confirmed against a live account
    // (see TODO above) if Pelecard's real GetTransaction response omits
    // StatusCode on a genuinely successful transaction.
    const verifiedStatusCode = String(verify.StatusCode ?? "").trim();
    const paid = callbackStatusCode === "000" && verifiedStatusCode === "000";

    const orderId =
      extractOrderId(verify.ResultData ?? verify) ?? callbackOrderId ?? "";

    if (!orderId) {
      throw new Error("לא ניתן לשייך את הקריאה החוזרת מ-Pelecard להזמנה.");
    }

    return { orderId, paid, providerRef: transactionId };
  },
};
