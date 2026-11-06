import { describe, expect, it } from "vitest";

import { ADDONS, PLANS, type AddonDef } from "@/lib/plans";
import { applyAddonsToPlan } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";

// Add-ons with a hard-enforced effect somewhere in the app (quota augmentation
// or a granted FeatureKey). Kept in sync manually with:
//   - lib/quota.ts applyAddonsToPlan (ai_boost, extra_business)
//   - lib/entitlements.ts ADDON_GRANTS_FEATURE (whatsapp_agent, rentals)
// custom_domain / remove_branding are intentionally cosmetic-only (no
// enforcement anywhere yet), so they're excluded from this coverage set.
const ADDONS_WITH_EFFECTS = new Set([
  "ai_boost",
  "extra_business",
  "whatsapp_agent",
  "rentals",
]);
const COSMETIC_ONLY_ADDONS = new Set(["custom_domain", "remove_branding"]);

describe("ADDONS catalog", () => {
  it("has unique keys", () => {
    const keys = ADDONS.map((a: AddonDef) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every add-on is either wired to an effect or explicitly cosmetic-only", () => {
    for (const a of ADDONS) {
      const covered = ADDONS_WITH_EFFECTS.has(a.key) || COSMETIC_ONLY_ADDONS.has(a.key);
      expect(covered, `add-on "${a.key}" is neither effect-wired nor marked cosmetic-only`).toBe(true);
    }
  });

  it("has positive prices", () => {
    for (const a of ADDONS) expect(a.priceMonthly).toBeGreaterThan(0);
  });
});

describe("applyAddonsToPlan (pure quota augmentation)", () => {
  it("returns the same plan shape when no add-ons are active", () => {
    const plan = PLANS.starter;
    const result = applyAddonsToPlan(plan, new Set());
    expect(result).toEqual(plan);
  });

  it("ai_boost doubles aiGenerations and chatMessages", () => {
    const plan = PLANS.starter; // aiGenerations: 100, chatMessages: 500
    const result = applyAddonsToPlan(plan, new Set(["ai_boost"]));
    expect(result.aiGenerations).toBe(plan.aiGenerations * 2);
    expect(result.chatMessages).toBe(plan.chatMessages * 2);
    // Untouched fields stay the same.
    expect(result.businesses).toBe(plan.businesses);
    expect(result.priceMonthly).toBe(plan.priceMonthly);
  });

  it("extra_business adds exactly 1 business slot", () => {
    const plan = PLANS.pro; // businesses: 1
    const result = applyAddonsToPlan(plan, new Set(["extra_business"]));
    expect(result.businesses).toBe(plan.businesses + 1);
  });

  it("stacks ai_boost and extra_business independently", () => {
    const plan = PLANS.business;
    const result = applyAddonsToPlan(plan, new Set(["ai_boost", "extra_business"]));
    expect(result.aiGenerations).toBe(plan.aiGenerations * 2);
    expect(result.chatMessages).toBe(plan.chatMessages * 2);
    expect(result.businesses).toBe(plan.businesses + 1);
  });

  it("leaves Infinity limits (e.g. founder override) untouched", () => {
    const unlimitedPlan = { ...PLANS.business, aiGenerations: Infinity, chatMessages: Infinity, businesses: Infinity };
    const result = applyAddonsToPlan(unlimitedPlan, new Set(["ai_boost", "extra_business"]));
    expect(result.aiGenerations).toBe(Infinity);
    expect(result.chatMessages).toBe(Infinity);
    expect(result.businesses).toBe(Infinity);
  });

  it("ignores add-ons with no quota effect (whatsapp_agent, rentals, cosmetic ones)", () => {
    const plan = PLANS.starter;
    const result = applyAddonsToPlan(plan, new Set(["whatsapp_agent", "rentals", "custom_domain", "remove_branding"]));
    expect(result).toEqual(plan);
  });
});

describe("planAllows with active add-ons (feature grants)", () => {
  it("starter plan alone does not allow whatsapp_agent or rentals", () => {
    expect(planAllows(PLANS.starter, "whatsapp_agent")).toBe(false);
    expect(planAllows(PLANS.starter, "rentals")).toBe(false);
  });

  it("the whatsapp_agent add-on grants the whatsapp_agent feature on a lower tier", () => {
    expect(planAllows(PLANS.starter, "whatsapp_agent", new Set(["whatsapp_agent"]))).toBe(true);
  });

  it("the rentals add-on grants the rentals feature on a lower tier", () => {
    expect(planAllows(PLANS.pro, "rentals", new Set(["rentals"]))).toBe(true);
  });

  it("an unrelated add-on does not grant an unrelated feature", () => {
    expect(planAllows(PLANS.starter, "whatsapp_agent", new Set(["rentals"]))).toBe(false);
    expect(planAllows(PLANS.free, "hr", new Set(["whatsapp_agent", "rentals"]))).toBe(false);
  });

  it("business tier already includes both features regardless of add-ons", () => {
    expect(planAllows(PLANS.business, "whatsapp_agent")).toBe(true);
    expect(planAllows(PLANS.business, "rentals")).toBe(true);
  });

  it("existing two-arg call sites keep working unchanged (no add-on set passed)", () => {
    expect(planAllows("free", "publish_site")).toBe(false);
    expect(planAllows("starter", "publish_site")).toBe(true);
  });
});
