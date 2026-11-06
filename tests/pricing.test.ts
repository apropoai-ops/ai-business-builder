import { describe, it, expect } from "vitest";

import { estimateCostUsd, pricingFor } from "@/lib/ai/pricing";

describe("AI cost estimation", () => {
  it("prices Sonnet input+output per the rate card", () => {
    // 1M in @ $3 + 1M out @ $15 = $18
    expect(estimateCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000)).toBeCloseTo(18, 6);
  });

  it("prices Haiku ~5x cheaper than Sonnet for the same tokens", () => {
    const sonnet = estimateCostUsd("claude-sonnet-4-6", 10_000, 10_000);
    const haiku = estimateCostUsd("claude-haiku-4-5", 10_000, 10_000);
    expect(haiku).toBeLessThan(sonnet);
    // Sonnet 3/15, Haiku 1/5 → exactly a third for an equal in/out split.
    expect(haiku).toBeCloseTo(sonnet / 3, 6);
  });

  it("weights output tokens 5x input", () => {
    const p = pricingFor("claude-sonnet-4-6");
    expect(p.out).toBe(p.in * 5);
  });

  it("treats missing token counts as zero", () => {
    expect(estimateCostUsd("claude-haiku-4-5")).toBe(0);
    expect(estimateCostUsd("claude-haiku-4-5", undefined, undefined)).toBe(0);
  });

  it("falls back to Sonnet pricing for an unknown model (never under-counts)", () => {
    expect(estimateCostUsd("some-future-model", 1_000_000, 0)).toBeCloseTo(3, 6);
  });

  it("matches a real MODE website generation (~4.8k in / 3.6k out on Sonnet)", () => {
    // Sanity: a heavy generation should be a fraction of a dollar, not dollars.
    const cost = estimateCostUsd("claude-sonnet-4-6", 4806, 3608);
    expect(cost).toBeGreaterThan(0.05);
    expect(cost).toBeLessThan(0.1);
  });
});
