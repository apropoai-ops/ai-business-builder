import { describe, it, expect } from "vitest";

import {
  invoiceFromGross,
  parseEnabledMethods,
  paymentMethodLabel,
  isPaymentMethod,
} from "@/lib/payments";

describe("invoiceFromGross", () => {
  it("backs net + VAT out of a VAT-inclusive gross (18%)", () => {
    const r = invoiceFromGross(118, 18);
    expect(r.net).toBe(100);
    expect(r.vat).toBe(18);
    expect(r.gross).toBe(118);
  });

  it("net + vat always equals gross (rounded)", () => {
    const r = invoiceFromGross(249.9, 18);
    expect(r.net + r.vat).toBeCloseTo(r.gross, 2);
  });

  it("handles 0 and bad input safely", () => {
    expect(invoiceFromGross(0, 18)).toEqual({ net: 0, vat: 0, gross: 0, vatRate: 18 });
    expect(invoiceFromGross(NaN as unknown as number, 18).gross).toBe(0);
  });
});

describe("parseEnabledMethods", () => {
  it("keeps only valid keys in canonical order", () => {
    expect(parseEnabledMethods(["cod", "bogus", "card"])).toEqual(["card", "cod"]);
  });
  it("returns [] for non-arrays", () => {
    expect(parseEnabledMethods(null)).toEqual([]);
    expect(parseEnabledMethods("cod")).toEqual([]);
  });
});

describe("payment method helpers", () => {
  it("labels known methods in Hebrew, passes through unknown", () => {
    expect(paymentMethodLabel("bit")).toBe("Bit");
    expect(paymentMethodLabel(null)).toBe("—");
    expect(paymentMethodLabel("weird")).toBe("weird");
  });
  it("isPaymentMethod guards", () => {
    expect(isPaymentMethod("card")).toBe(true);
    expect(isPaymentMethod("x")).toBe(false);
  });
});
