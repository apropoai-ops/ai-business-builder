import { describe, it, expect } from "vitest";

import { resolveShipping, methodRegions, methodPoints } from "@/lib/shipping";

const base = { type: "delivery" as const, price: 30, free_over: null, details: null };

describe("resolveShipping", () => {
  it("flat price for a simple delivery method", () => {
    expect(resolveShipping(base, {}, 100)).toEqual({ price: 30, detail: null });
  });

  it("free over a per-method threshold", () => {
    expect(resolveShipping({ ...base, free_over: 200 }, {}, 250)).toEqual({ price: 0, detail: null });
    expect(resolveShipping({ ...base, free_over: 200 }, {}, 150)!.price).toBe(30);
  });

  it("by_region picks the region price + label", () => {
    const m = {
      type: "by_region" as const,
      price: 0,
      free_over: null,
      details: { regions: [{ name: "מרכז", price: 20 }, { name: "צפון", price: 40 }] },
    };
    expect(resolveShipping(m, { region: "צפון" }, 100)).toEqual({ price: 40, detail: "צפון" });
    expect(resolveShipping(m, { region: "דרום" }, 100)).toBeNull(); // invalid region
  });

  it("pickup_point requires a valid point", () => {
    const m = {
      type: "pickup_point" as const,
      price: 0,
      free_over: null,
      details: { points: [{ name: "סניף דיזנגוף", address: "דיזנגוף 50" }] },
    };
    expect(resolveShipping(m, { point: "סניף דיזנגוף" }, 100)).toEqual({
      price: 0,
      detail: "סניף דיזנגוף — דיזנגוף 50",
    });
    expect(resolveShipping(m, { point: "לא קיים" }, 100)).toBeNull();
  });

  it("parses regions/points defensively", () => {
    expect(methodRegions({ details: null })).toEqual([]);
    expect(methodPoints({ details: { points: "x" } })).toEqual([]);
  });
});
