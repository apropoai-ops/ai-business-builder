import { describe, expect, it } from "vitest";

import { modelInfoForAgent } from "@/lib/ai/providers";

describe("AI model tiering (cost optimization)", () => {
  it("routes mechanical agents to the cheap (Haiku) tier", () => {
    for (const agent of ["hero_style", "module_pick", "product_attributes", "product_gen", "stock_keywords"]) {
      expect(modelInfoForAgent(agent).model).toContain("haiku");
    }
  });

  it("keeps heavy long-form agents on the reasoning (Sonnet) tier", () => {
    // content + content_calendar moved here 2026-07-20: Haiku failed to emit
    // their large structured batches ("No object generated") and marketing
    // copy is quality-sensitive.
    for (const agent of ["business_plan", "market_research", "branding", "website", "hr", "content", "content_calendar", "ads"]) {
      const model = modelInfoForAgent(agent).model;
      expect(model).toContain("sonnet");
      expect(model).not.toContain("opus");
    }
  });
});
