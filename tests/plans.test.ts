import { describe, it, expect } from "vitest";

import { PLANS, PLAN_ORDER, ADDONS, formatLimit, priceBeforeVat, VAT_RATE, type FeatureKey } from "@/lib/plans";
import { FEATURES, planAllows, planAllowsSiteMode, minTierForSiteMode, minPlanForSiteMode, siteModeUpgradeMessage } from "@/lib/entitlements";
import { SITE_MODES } from "@/lib/site-mode";

describe("plan definitions", () => {
  it("covers all four tiers in ascending price order", () => {
    expect(PLAN_ORDER).toEqual(["free", "starter", "pro", "business"]);
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      expect(PLANS[PLAN_ORDER[i]].priceMonthly).toBeGreaterThan(
        PLANS[PLAN_ORDER[i - 1]].priceMonthly,
      );
    }
  });

  it("never shrinks limits when upgrading", () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = PLANS[PLAN_ORDER[i - 1]];
      const higher = PLANS[PLAN_ORDER[i]];
      expect(higher.businesses).toBeGreaterThanOrEqual(lower.businesses);
      expect(higher.aiGenerations).toBeGreaterThanOrEqual(lower.aiGenerations);
      expect(higher.chatMessages).toBeGreaterThanOrEqual(lower.chatMessages);
    }
  });

  it("free cannot publish; every paid plan can", () => {
    expect(PLANS.free.canPublish).toBe(false);
    expect(PLANS.starter.canPublish).toBe(true);
    expect(PLANS.pro.canPublish).toBe(true);
    expect(PLANS.business.canPublish).toBe(true);
  });

  it("packages have the expected business limits and prices", () => {
    // All paid packages are single-business (extra businesses via add-on)
    expect(PLANS.starter.businesses).toBe(1);
    expect(PLANS.pro.businesses).toBe(1);
    expect(PLANS.business.businesses).toBe(1);
    // The three products. These are the GROSS (VAT-inclusive) sticker prices —
    // the number on the card must equal the number charged.
    expect(PLANS.starter.priceMonthly).toBe(199);
    expect(PLANS.pro.priceMonthly).toBe(349);
    expect(PLANS.business.priceMonthly).toBe(699);
  });

  it("priceBeforeVat strips the 18% the sticker price already includes", () => {
    expect(VAT_RATE).toBe(0.18);
    expect(priceBeforeVat(PLANS.starter.priceMonthly)).toBe(169);
    expect(priceBeforeVat(PLANS.pro.priceMonthly)).toBe(296);
    expect(priceBeforeVat(PLANS.business.priceMonthly)).toBe(592);
    expect(priceBeforeVat(0)).toBe(0);
    // Round-trip: adding VAT back lands within a shekel of the sticker.
    for (const tier of PLAN_ORDER) {
      const gross = PLANS[tier].priceMonthly;
      expect(Math.abs(priceBeforeVat(gross) * (1 + VAT_RATE) - gross)).toBeLessThan(1);
    }
  });

  it("אתר תדמית (pro) is the recommended (highlighted) package", () => {
    expect(PLANS.pro.highlight).toBe(true);
    expect(PLANS.starter.highlight).toBeFalsy();
    expect(PLANS.business.highlight).toBeFalsy();
  });

  it("all paid packages are single-business (extra via add-on)", () => {
    expect(PLANS.starter.businesses).toBe(1);
    expect(PLANS.pro.businesses).toBe(1);
    expect(PLANS.business.businesses).toBe(1);
    expect(ADDONS.some((a) => a.key === "extra_business")).toBe(true);
  });

  it("add-ons have positive prices + unique keys", () => {
    expect(ADDONS.length).toBeGreaterThan(0);
    expect(new Set(ADDONS.map((a) => a.key)).size).toBe(ADDONS.length);
    for (const a of ADDONS) expect(a.priceMonthly).toBeGreaterThan(0);
  });

  it("every plan has a positive monthly cost cap that grows with the tier", () => {
    for (const tier of PLAN_ORDER) {
      expect(PLANS[tier].monthlyCostCapUsd).toBeGreaterThan(0);
    }
    // Cost caps never shrink on upgrade (a paid tier can't cap below a cheaper one).
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      expect(PLANS[PLAN_ORDER[i]].monthlyCostCapUsd).toBeGreaterThanOrEqual(
        PLANS[PLAN_ORDER[i - 1]].monthlyCostCapUsd,
      );
    }
    expect(PLANS.starter.monthlyCostCapUsd).toBe(12);
    expect(PLANS.pro.monthlyCostCapUsd).toBe(30);
    expect(PLANS.business.monthlyCostCapUsd).toBe(60);
  });

  it("every plan's cost ceiling stays well under its own price", () => {
    // A tier whose worst-case AI spend can exceed what it earns is a tier that
    // loses money on its heaviest users. Compared against the NET price (VAT
    // is collected for the state, not revenue). ~3.6 ILS per USD, generous.
    for (const tier of PLAN_ORDER) {
      if (tier === "free") continue;
      const plan = PLANS[tier];
      const net = priceBeforeVat(plan.priceMonthly);
      expect(plan.monthlyCostCapUsd * 3.6).toBeLessThan(net * 0.5);
    }
  });
});

describe("packages are sold on the site mode", () => {
  it("each paid tier sells exactly one more product than the one below", () => {
    expect(PLANS.starter.siteModes).toEqual(["landing"]);
    expect(PLANS.pro.siteModes).toEqual(["landing", "website"]);
    expect(PLANS.business.siteModes).toEqual(["landing", "website", "store"]);
  });

  it("free may BUILD every mode (trial) but may publish none", () => {
    expect(PLANS.free.canPublish).toBe(false);
    for (const mode of SITE_MODES) {
      expect(planAllowsSiteMode("free", mode)).toBe(true);
    }
  });

  it("modes never shrink on upgrade — the top package is never less capable", () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      if (PLAN_ORDER[i - 1] === "free") continue; // free is a build-only trial
      for (const mode of PLANS[PLAN_ORDER[i - 1]].siteModes) {
        expect(PLANS[PLAN_ORDER[i]].siteModes).toContain(mode);
      }
    }
  });

  it("every mode is sold by some paid tier, at the expected price", () => {
    for (const mode of SITE_MODES) {
      const tier = minTierForSiteMode(mode);
      expect(tier).not.toBe("free");
      expect(PLANS[tier].siteModes).toContain(mode);
    }
    expect(minTierForSiteMode("landing")).toBe("starter");
    expect(minTierForSiteMode("website")).toBe("pro");
    expect(minTierForSiteMode("store")).toBe("business");
    expect(minPlanForSiteMode("store").priceMonthly).toBe(699);
  });

  it("a landing plan cannot open a store, and a store plan can still do landings", () => {
    expect(planAllowsSiteMode("starter", "store")).toBe(false);
    expect(planAllowsSiteMode("starter", "website")).toBe(false);
    expect(planAllowsSiteMode("pro", "store")).toBe(false);
    expect(planAllowsSiteMode("business", "landing")).toBe(true);
    expect(planAllowsSiteMode("business", "website")).toBe(true);
  });

  it("the upsell line names the package and its price", () => {
    const msg = siteModeUpgradeMessage("store");
    expect(msg).toContain("חנות");
    expect(msg).toContain("699");
  });
});

describe("entitlements follow the packages", () => {
  it("each tier's capabilities are a superset of the tier below", () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      for (const key of PLANS[PLAN_ORDER[i - 1]].entitlements) {
        expect(PLANS[PLAN_ORDER[i]].entitlements).toContain(key);
      }
    }
  });

  it("FEATURES.minTier agrees with the tier that actually grants it", () => {
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      const claimed = FEATURES[key].minTier;
      const actual = PLAN_ORDER.find((t) => PLANS[t].entitlements.includes(key));
      expect(actual).toBe(claimed);
    }
  });

  it("commerce is store-tier only", () => {
    expect(planAllows("pro", "store_basic")).toBe(false);
    expect(planAllows("pro", "store_full")).toBe(false);
    expect(planAllows("business", "store_full")).toBe(true);
  });

  it("the ads generator ships with the landing package — its buyers run ads", () => {
    expect(planAllows("starter", "ads")).toBe(true);
  });

  it("rentals ship with אתר תדמית — a צימר is a service business, not a store", () => {
    expect(planAllows("pro", "rentals")).toBe(true);
    expect(planAllows("starter", "rentals")).toBe(false);
  });

  it("formatLimit renders numbers and infinity in Hebrew", () => {
    expect(formatLimit(50)).toBe("50");
    expect(formatLimit(1500)).toBe("1,500");
    expect(formatLimit(Infinity)).toBe("ללא הגבלה");
  });
});
