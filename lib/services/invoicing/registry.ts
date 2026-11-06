/**
 * Registry of Israeli invoicing providers (Green Invoice / iCount) — mirrors
 * lib/gateways/registry.ts for payment gateways. Drives the "connect" form
 * rendered wherever the owner picks an invoicing integration (via the shared
 * business_integrations credentials contract, lib/services/integrations/credentials.ts).
 */

export type InvoicingProviderField = {
  key: string;
  /** Hebrew label shown in the connect form. */
  label: string;
  /** Rendered as a password input and never echoed back to the client. */
  secret?: boolean;
};

export type InvoicingProviderMeta = {
  id: "green-invoice" | "icount";
  /** Hebrew display name. */
  name: string;
  fields: InvoicingProviderField[];
};

export const INVOICING_PROVIDERS: InvoicingProviderMeta[] = [
  {
    id: "green-invoice",
    name: "חשבונית ירוקה",
    fields: [
      { key: "apiKey", label: "מזהה API (Key)", secret: true },
      { key: "apiSecret", label: "סוד API (Secret)", secret: true },
    ],
  },
  {
    id: "icount",
    name: "iCount",
    fields: [
      { key: "cid", label: "מזהה חברה (CID)", secret: true },
      { key: "user", label: "שם משתמש", secret: true },
      { key: "pass", label: "סיסמה", secret: true },
    ],
  },
];

export function getInvoicingProvider(id: string): InvoicingProviderMeta | undefined {
  return INVOICING_PROVIDERS.find((p) => p.id === id);
}
