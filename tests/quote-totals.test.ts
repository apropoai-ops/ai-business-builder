import { describe, it, expect } from "vitest";

import { computeQuoteTotals } from "@/lib/quote-totals";
import type { QuoteItem } from "@/types/database";

const items: QuoteItem[] = [
  { description: "עיצוב לוגו", quantity: 1, unit_price: 1000 },
  { description: "כרטיסי ביקור", quantity: 2, unit_price: 250 },
];

describe("computeQuoteTotals (VAT-inclusive)", () => {
  it("treats prices as VAT-inclusive and splits 18% VAT out of the total", () => {
    const t = computeQuoteTotals(items);
    expect(t.subtotal).toBe(1500);
    expect(t.discount).toBe(0);
    expect(t.afterDiscount).toBe(1500);
    expect(t.taxRate).toBe(18);
    expect(t.total).toBe(1500); // total = the amount entered
    expect(t.netAmount).toBe(1271.19); // 1500 / 1.18
    expect(t.taxAmount).toBe(228.81); // 1500 − net
    expect(t.netAmount + t.taxAmount).toBeCloseTo(t.total, 2);
  });

  it("applies a flat discount, then splits VAT out of the discounted gross", () => {
    const t = computeQuoteTotals(items, 500, 18);
    expect(t.afterDiscount).toBe(1000);
    expect(t.total).toBe(1000);
    expect(t.netAmount).toBe(847.46);
    expect(t.taxAmount).toBe(152.54);
  });

  it("clamps a discount larger than the subtotal", () => {
    const t = computeQuoteTotals(items, 99999, 18);
    expect(t.discount).toBe(1500);
    expect(t.afterDiscount).toBe(0);
    expect(t.total).toBe(0);
    expect(t.taxAmount).toBe(0);
  });

  it("supports a zero tax rate (net == total)", () => {
    const t = computeQuoteTotals(items, 0, 0);
    expect(t.taxAmount).toBe(0);
    expect(t.netAmount).toBe(1500);
    expect(t.total).toBe(1500);
  });

  it("ignores invalid / negative line items", () => {
    const bad: QuoteItem[] = [
      { description: "ok", quantity: 2, unit_price: 100 },
      { description: "neg", quantity: -3, unit_price: 50 },
      { description: "nan", quantity: Number.NaN, unit_price: 10 },
    ];
    expect(computeQuoteTotals(bad, 0, 0).subtotal).toBe(200);
  });

  it("coerces string discount/tax (Postgres numeric) like numbers", () => {
    // @ts-expect-error — simulating numeric-as-string from the DB client
    const t = computeQuoteTotals(items, "500", "18");
    expect(t.total).toBe(1000);
    expect(t.taxAmount).toBe(152.54);
  });

  it("handles an empty quote", () => {
    const t = computeQuoteTotals([], 0, 18);
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
  });

  it("rounds to two decimals", () => {
    const t = computeQuoteTotals([{ description: "x", quantity: 3, unit_price: 33.33 }], 0, 17);
    expect(t.subtotal).toBe(99.99);
    expect(t.total).toBe(99.99);
    expect(t.netAmount).toBe(85.46);
    expect(t.taxAmount).toBe(14.53);
  });
});
