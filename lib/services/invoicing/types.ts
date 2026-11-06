/**
 * Shared types for the Israeli invoicing drivers (Green Invoice / iCount).
 * Mirrors the shape of lib/gateways/types.ts for payment gateways: each
 * provider exposes a small driver object the invoicing service dispatches to.
 */

/** One billable line on the document. Prices are VAT-INCLUSIVE ILS (retail
 * prices in Israel include VAT — see invoiceFromGross in lib/payments.ts). */
export type InvoiceLine = {
  /** Hebrew description shown on the document. */
  description: string;
  quantity: number;
  /** Gross (VAT-inclusive) unit price in ILS. May be negative for discounts. */
  unitPrice: number;
};

export type IssueDocumentArgs = {
  business: {
    name: string;
    /** ח.פ / עוסק מורשה — may be null when the owner hasn't filled it in. */
    taxId: string | null;
    /** VAT percentage, e.g. 17 or 18. */
    vatRate: number;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  lines: InvoiceLine[];
  /** Grand total the customer actually paid (gross ILS, VAT-inclusive). */
  total: number;
  /** Our checkout payment method key (see lib/payments.ts), e.g. "card". */
  paymentMethod: string | null;
  /** Our order id — stamped into the document remarks for traceability. */
  orderId: string;
};

export type IssuedDocument = {
  /** The provider's document id (used for later lookups at the provider). */
  externalId: string;
  /** The human-facing document number (מספר חשבונית). */
  number: string;
  /** Link to view/download the document (PDF), when the provider returns one. */
  url: string | null;
  /** Our normalized document kind, e.g. "invoice_receipt". */
  docType: string;
};

export type InvoicingDriver = {
  id: "green-invoice" | "icount";
  /**
   * Issues a חשבונית מס/קבלה (tax invoice + receipt) for a paid order.
   * Throws with a Hebrew message on failure — the caller records it.
   */
  issueDocument(
    args: IssueDocumentArgs,
    credentials: Record<string, string>,
  ): Promise<IssuedDocument>;
};
