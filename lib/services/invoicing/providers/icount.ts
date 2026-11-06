import type { InvoicingDriver, IssueDocumentArgs, IssuedDocument } from "../types";

/**
 * iCount — Israeli invoicing/accounting SaaS.
 *
 * Docs: https://api.icount.co.il/ (interactive API browser) — "doc/create"
 * endpoint under the v3 REST API at https://api.icount.co.il/api/v3.php/.
 * iCount's v3 API accepts the account credentials (cid/user/pass) directly
 * on each request (no separate token exchange), which keeps this driver
 * stateless like the other invoicing/payment drivers.
 *
 * doctype "invrec" = חשבונית מס קבלה (tax invoice + receipt) — the standard
 * document for a paid storefront order.
 *
 * TODO: verify against a live account — iCount also supports a session-token
 * flow (user/auth → sid) that some accounts require instead of raw
 * cid/user/pass per call; switch to that if direct auth is rejected.
 */

const API_BASE = "https://api.icount.co.il/api/v3.php";

type DocCreateResponse = {
  status?: boolean;
  reason?: string;
  docnum?: string | number;
  doc_id?: string | number;
  // TODO: verify against a live account — the hosted-PDF link field name.
  // iCount has historically returned one of these depending on account
  // config; we try each in order.
  doc_url?: string;
  pdf_link?: string;
  doc_link?: string;
};

export const icountDriver: InvoicingDriver = {
  id: "icount",

  async issueDocument(
    args: IssueDocumentArgs,
    credentials: Record<string, string>,
  ): Promise<IssuedDocument> {
    const cid = credentials.cid?.trim();
    const user = credentials.user?.trim();
    const pass = credentials.pass?.trim();
    if (!cid || !user || !pass) {
      throw new Error("חסרים פרטי חיבור ל-iCount — יש לחבר את החשבון מחדש.");
    }

    const body = {
      cid,
      user,
      pass,
      doctype: "invrec",
      client_name: args.customer.name,
      // TODO: verify against a live account — iCount's client email field may
      // be `email` or `client_email` depending on API version.
      email: args.customer.email ?? undefined,
      client_email: args.customer.email ?? undefined,
      phone: args.customer.phone ?? undefined,
      lang: "he",
      currency_code: "ILS",
      // Row prices are VAT-INCLUSIVE (matches invoiceFromGross math) —
      // iCount's default "price includes VAT" row behavior.
      vat_included: true,
      items: args.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitprice: line.unitPrice,
      })),
      remark: `הזמנה מס' ${args.orderId}`,
      send_email: false,
    };

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/doc/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("שגיאת תקשורת מול iCount בעת הפקת המסמך.");
    }

    if (!response.ok) {
      throw new Error("iCount סירב לבקשת הפקת המסמך.");
    }

    let data: DocCreateResponse;
    try {
      data = await response.json();
    } catch {
      throw new Error("תגובה לא תקינה מ-iCount בעת הפקת המסמך.");
    }

    if (data.status === false) {
      throw new Error(
        data.reason ? `iCount דחה את הפקת המסמך: ${data.reason}` : "iCount דחה את הפקת המסמך.",
      );
    }

    const number = data.docnum != null ? String(data.docnum) : null;
    const externalId = data.doc_id != null ? String(data.doc_id) : number;
    if (!externalId || !number) {
      throw new Error("iCount לא החזיר מספר מסמך תקין.");
    }

    return {
      externalId,
      number,
      url: data.doc_url ?? data.pdf_link ?? data.doc_link ?? null,
      docType: "invoice_receipt",
    };
  },
};
