/**
 * Store-payments domain helpers (pure, framework-free).
 *
 * Covers the customer→merchant payment methods offered at checkout and the
 * Israeli tax-invoice math. Real card processing (Stripe) is layered on top
 * later; these helpers stay valid regardless of processor.
 */

/** A checkout payment method the merchant can enable. */
export type PaymentMethodKey = "cod" | "bank_transfer" | "bit" | "card" | "paypal";

export const PAYMENT_METHODS: {
  key: PaymentMethodKey;
  label: string;
  /** Shopper pays now (online) vs later (on delivery / manual transfer). */
  instant: boolean;
}[] = [
  { key: "card", label: "כרטיס אשראי", instant: true },
  { key: "paypal", label: "PayPal", instant: true },
  { key: "bit", label: "Bit", instant: false },
  { key: "bank_transfer", label: "העברה בנקאית", instant: false },
  { key: "cod", label: "מזומן במסירה", instant: false },
];

const METHOD_LABEL = new Map(PAYMENT_METHODS.map((m) => [m.key, m.label]));

export function paymentMethodLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return METHOD_LABEL.get(key as PaymentMethodKey) ?? key;
}

/** Type guard for a stored/posted method key. */
export function isPaymentMethod(v: unknown): v is PaymentMethodKey {
  return typeof v === "string" && METHOD_LABEL.has(v as PaymentMethodKey);
}

/** Parses the businesses.payment_methods jsonb into a clean ordered key list. */
export function parseEnabledMethods(raw: unknown): PaymentMethodKey[] {
  const arr = Array.isArray(raw) ? raw : [];
  const set = new Set(arr.filter(isPaymentMethod));
  // Preserve the canonical display order.
  return PAYMENT_METHODS.map((m) => m.key).filter((k) => set.has(k));
}

/**
 * Israeli tax invoice math. Retail prices in Israel are VAT-INCLUSIVE, so an
 * order's `total` is the gross the customer paid. We back out the net and VAT:
 *   net = gross / (1 + rate/100)   ;   vat = gross − net
 * Rounded to agorot (2 decimals).
 */
export function invoiceFromGross(
  gross: number,
  vatRate: number,
): { net: number; vat: number; gross: number; vatRate: number } {
  const g = Math.max(0, Number(gross) || 0);
  const rate = Math.max(0, Number(vatRate) || 0);
  const net = round2(g / (1 + rate / 100));
  const vat = round2(g - net);
  return { net, vat, gross: round2(g), vatRate: rate };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** ₪ formatter for invoices / payment UI. */
export function formatILS(n: number): string {
  return `₪${(Number(n) || 0).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
