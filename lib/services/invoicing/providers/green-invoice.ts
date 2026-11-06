import type { InvoicingDriver, IssueDocumentArgs, IssuedDocument } from "../types";

/**
 * Green Invoice (חשבונית ירוקה) — Israeli invoicing SaaS.
 *
 * Docs: https://www.greeninvoice.co.il/api/docs (Swagger at
 * https://api.greeninvoice.co.il/api-docs) — "Authentication" (account/token)
 * and "Documents" (documents/create) sections.
 *
 * Flow:
 *  1. POST /account/token with {id: apiKey, secret: apiSecret} → short-lived
 *     JWT (`token`). Each document issue re-authenticates (tokens are cheap
 *     and this keeps the driver stateless like the payment-gateway drivers).
 *  2. POST /documents with the JWT as a Bearer token to create the document.
 *     type 320 = חשבונית מס קבלה (tax invoice + receipt) — the standard
 *     document for a paid storefront order.
 *  3. The response echoes `id`, `number`, and a `url` object with hosted PDF
 *     links; we take `url.he` (Hebrew UI) falling back to `url.origin`.
 */

const API_BASE = "https://api.greeninvoice.co.il/api/v1";

// TODO: verify against a live account — 320 is Green Invoice's documented
// "חשבונית מס קבלה" type code; other useful codes are 300 (חשבונית מס) and
// 400 (קבלה) if a future flow needs to split them.
const DOCUMENT_TYPE = 320;

// TODO: verify against a live account — Green Invoice's `paymentType` codes
// per their docs (1=cash, 2=check, 3=credit card, 4=bank transfer,
// 5=payapp/other, 10=other). Falls back to "other" for methods without an
// obvious match (bit/paypal aren't explicitly documented).
const PAYMENT_TYPE_MAP: Record<string, number> = {
  card: 3,
  bank_transfer: 4,
  cod: 1,
  bit: 10,
  paypal: 10,
};

type TokenResponse = {
  token?: string;
  expires?: string;
};

type DocumentResponse = {
  id?: string;
  number?: string | number;
  url?: { origin?: string; he?: string; en?: string } | null;
};

async function getToken(apiKey: string, apiSecret: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/account/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: apiKey, secret: apiSecret }),
    });
  } catch {
    throw new Error("שגיאת תקשורת מול חשבונית ירוקה — לא ניתן היה להתחבר.");
  }
  if (!response.ok) {
    throw new Error("חשבונית ירוקה דחתה את פרטי ההתחברות — יש לבדוק את מפתחות ה-API.");
  }
  let data: TokenResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error("תגובה לא תקינה מחשבונית ירוקה בעת אימות.");
  }
  if (!data.token) {
    throw new Error("חשבונית ירוקה לא החזירה טוקן התחברות.");
  }
  return data.token;
}

export const greenInvoiceDriver: InvoicingDriver = {
  id: "green-invoice",

  async issueDocument(
    args: IssueDocumentArgs,
    credentials: Record<string, string>,
  ): Promise<IssuedDocument> {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    if (!apiKey || !apiSecret) {
      throw new Error("חסרים פרטי חיבור לחשבונית ירוקה — יש לחבר את החשבון מחדש.");
    }

    const token = await getToken(apiKey, apiSecret);

    const paymentType = args.paymentMethod
      ? (PAYMENT_TYPE_MAP[args.paymentMethod] ?? 10)
      : 10;

    const body = {
      type: DOCUMENT_TYPE,
      lang: "he",
      currency: "ILS",
      // 0 = row prices are VAT-INCLUSIVE (matches invoiceFromGross math).
      vatType: 0,
      client: {
        name: args.customer.name,
        emails: args.customer.email ? [args.customer.email] : undefined,
        // TODO: verify against a live account — `phone` may need to be under
        // `client.mobile` instead depending on account locale settings.
        phone: args.customer.phone ?? undefined,
        self: false,
      },
      income: args.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        price: line.unitPrice,
        currency: "ILS",
        vatType: 0,
      })),
      payment: [
        {
          type: paymentType,
          price: args.total,
          currency: "ILS",
        },
      ],
      remarks: `הזמנה מס' ${args.orderId}`,
    };

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("שגיאת תקשורת מול חשבונית ירוקה בעת הפקת המסמך.");
    }

    if (!response.ok) {
      let message = "חשבונית ירוקה סירבה להפיק את המסמך.";
      try {
        const errData = await response.json();
        if (errData?.message) message = `חשבונית ירוקה: ${errData.message}`;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }

    let data: DocumentResponse;
    try {
      data = await response.json();
    } catch {
      throw new Error("תגובה לא תקינה מחשבונית ירוקה בעת הפקת המסמך.");
    }

    if (!data.id || data.number == null) {
      throw new Error("חשבונית ירוקה לא החזירה מספר מסמך תקין.");
    }

    return {
      externalId: String(data.id),
      number: String(data.number),
      url: data.url?.he ?? data.url?.origin ?? null,
      docType: "invoice_receipt",
    };
  },
};
