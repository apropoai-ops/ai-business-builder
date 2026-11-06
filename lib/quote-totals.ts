import type { QuoteItem } from "@/types/database";

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  taxRate: number;
  /** The pre-VAT (net) portion of the total. */
  netAmount: number;
  /** The VAT portion that is INCLUDED within the total. */
  taxAmount: number;
  /** What the customer pays — equals afterDiscount (prices are VAT-inclusive). */
  total: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Computes the money breakdown for a quote. Pure & deterministic so it can be
 * shared between the dashboard editor, the public view, and unit tests.
 *
 * Israeli convention: the prices entered ARE VAT-inclusive (gross). So the
 * total is simply the (post-discount) sum the owner typed, and the VAT is
 * split OUT of it for display — not added on top.
 *
 * - subtotal = Σ quantity × unit_price (invalid/negative parts treated as 0)
 * - discount = flat ₪ amount, clamped so it never exceeds the subtotal
 * - total = afterDiscount; netAmount = total / (1 + rate); tax = total − net
 */
export function computeQuoteTotals(
  items: QuoteItem[],
  discount = 0,
  taxRate = 18,
): QuoteTotals {
  const subtotal = round2(
    (items ?? []).reduce((sum, it) => {
      const qty = Number(it?.quantity);
      const price = Number(it?.unit_price);
      if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) {
        return sum;
      }
      return sum + qty * price;
    }, 0),
  );

  // Coerce up front: Postgres `numeric` columns can surface as strings.
  const discountNum = Number(discount);
  const taxRateNum = Number(taxRate);

  const safeDiscount = Math.min(
    Math.max(Number.isFinite(discountNum) ? discountNum : 0, 0),
    subtotal,
  );
  const afterDiscount = round2(subtotal - safeDiscount);

  const safeRate = Math.min(Math.max(Number.isFinite(taxRateNum) ? taxRateNum : 0, 0), 100);
  // VAT-inclusive: back the net + VAT out of the post-discount gross.
  const total = afterDiscount;
  const netAmount = round2(total / (1 + safeRate / 100));
  const taxAmount = round2(total - netAmount);

  return {
    subtotal,
    discount: round2(safeDiscount),
    afterDiscount,
    taxRate: safeRate,
    netAmount,
    taxAmount,
    total,
  };
}

/** Formats a number as Israeli Shekel currency for display. */
export function formatILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
