import { describe, expect, it } from "vitest";

import { maxOutputTokensFor } from "@/lib/ai/limits";

// Known real observed output sizes (tokens), from production data.
const REAL_OUTPUT_SIZES: Record<string, number> = {
  website: 3600,
  business_plan: 3800,
  market_research: 3400,
  content: 4415,
};

const HEAVY_AGENTS = [
  "business_plan",
  "market_research",
  "branding",
  "website",
  "business_insights",
  "hr",
  "logo_design",
  "content",
  "content_calendar",
  "ads",
  "social_media",
];

const LIGHT_AGENTS = [
  "stock_keywords",
  "hero_style",
  "module_pick",
  "product_attributes",
  "product_gen",
  "product_image",
  "daily_brief",
  "logo_options",
  "restock",
  "sales_forecast",
];

describe("maxOutputTokensFor (per-agent output-token cost cap)", () => {
  it("gives heavy long-form agents a higher cap than light/mechanical agents", () => {
    const minHeavy = Math.min(...HEAVY_AGENTS.map(maxOutputTokensFor));
    const maxLight = Math.max(...LIGHT_AGENTS.map(maxOutputTokensFor));
    expect(minHeavy).toBeGreaterThan(maxLight);
  });

  it("returns a positive finite number for every known agent", () => {
    for (const agent of [...HEAVY_AGENTS, ...LIGHT_AGENTS]) {
      const cap = maxOutputTokensFor(agent);
      expect(Number.isFinite(cap)).toBe(true);
      expect(cap).toBeGreaterThan(0);
    }
  });

  it("never caps below known real output sizes (no truncation risk)", () => {
    for (const [agent, realSize] of Object.entries(REAL_OUTPUT_SIZES)) {
      const cap = maxOutputTokensFor(agent);
      expect(cap).toBeGreaterThan(realSize);
    }
  });

  it("gives heavy agents comfortable headroom (1.5x-2x) over real output", () => {
    for (const [agent, realSize] of Object.entries(REAL_OUTPUT_SIZES)) {
      const cap = maxOutputTokensFor(agent);
      expect(cap).toBeGreaterThanOrEqual(realSize * 1.5);
    }
  });

  it("gives the landing agent the largest cap of all — 11 sections in one shot", () => {
    const landing = maxOutputTokensFor("landing");
    const maxHeavy = Math.max(...HEAVY_AGENTS.map(maxOutputTokensFor));
    expect(landing).toBeGreaterThan(maxHeavy);
  });

  it("falls back to a sane default for an unknown agent", () => {
    const unknownCap = maxOutputTokensFor("some_totally_unknown_agent");
    expect(Number.isFinite(unknownCap)).toBe(true);
    expect(unknownCap).toBeGreaterThan(0);
    // Default should sit between the light and heavy caps (or at least not be the smallest).
    const maxLight = Math.max(...LIGHT_AGENTS.map(maxOutputTokensFor));
    expect(unknownCap).toBeGreaterThanOrEqual(maxLight);
  });
});
