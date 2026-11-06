import { describe, it, expect } from "vitest";

import { evalCoupon } from "@/lib/services/coupon.service";

const base = {
  type: "percent" as const,
  value: 20,
  min_order: null,
  active: true,
  expires_at: null,
  max_uses: null,
  used_count: 0,
  customer_phone: null,
};

describe("evalCoupon personal targeting", () => {
  it("applies a public coupon to anyone", () => {
    expect(evalCoupon(base, 100)).toEqual({ discount: 20 });
  });

  it("blocks a personal coupon for a non-matching phone", () => {
    const personal = { ...base, customer_phone: "0541234567" };
    expect("error" in evalCoupon(personal, 100, { phone: "0509999999" })).toBe(true);
    expect("error" in evalCoupon(personal, 100, {})).toBe(true);
  });

  it("applies a personal coupon for the matching phone (last-9 tolerant)", () => {
    const personal = { ...base, customer_phone: "0541234567" };
    expect(evalCoupon(personal, 100, { phone: "+972541234567" })).toEqual({ discount: 20 });
  });
});
