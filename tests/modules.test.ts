import { describe, expect, it } from "vitest";

import {
  CORE_TOGGLE_KEYS,
  MODULES,
  MODULE_KEYS,
  configFromRecommended,
  isCoreToggle,
  isModuleKey,
  normalizeModuleConfig,
  recommendModules,
  resolveModules,
} from "@/lib/modules";
import { modulesForMode } from "@/lib/site-mode";

describe("module registry", () => {
  it("has 23 unique modules", () => {
    expect(MODULES).toHaveLength(23);
    expect(new Set(MODULE_KEYS).size).toBe(23);
  });

  it("isModuleKey guards known/unknown keys", () => {
    expect(isModuleKey("gallery")).toBe(true);
    expect(isModuleKey("nope")).toBe(false);
    expect(isModuleKey(42)).toBe(false);
  });

  it("core toggles are the built-in form switches", () => {
    expect(CORE_TOGGLE_KEYS).toEqual(["contact", "returns", "order_tracking"]);
    for (const k of CORE_TOGGLE_KEYS) expect(isCoreToggle(k)).toBe(true);
    expect(isCoreToggle("gallery")).toBe(false);
    // Every core toggle must exist in the canonical registry.
    for (const k of CORE_TOGGLE_KEYS) expect(MODULE_KEYS).toContain(k);
  });

  it("recommendModules keeps every core toggle on for any business type", () => {
    for (const k of CORE_TOGGLE_KEYS) {
      expect(recommendModules({ description: "" })).toContain(k);
      expect(recommendModules({ industry: "מסעדה" })).toContain(k);
    }
  });
});

describe("resolveModules", () => {
  it("empty config → all enabled in canonical order", () => {
    const r = resolveModules({});
    expect(r).toHaveLength(23);
    expect(r.every((m) => m.enabled)).toBe(true);
    expect(r.map((m) => m.key)).toEqual(MODULE_KEYS);
  });

  it("null/garbage config behaves like empty", () => {
    expect(resolveModules(null).map((m) => m.key)).toEqual(MODULE_KEYS);
    expect(resolveModules([1, 2]).map((m) => m.key)).toEqual(MODULE_KEYS);
    expect(resolveModules("x").map((m) => m.key)).toEqual(MODULE_KEYS);
  });

  it("respects enabled=false and custom sort", () => {
    const r = resolveModules({
      gallery: { enabled: false, sort: 0 },
      testimonials: { sort: 5 },
    });
    expect(r[0].key).toBe("gallery");
    expect(r[0].enabled).toBe(false);
    // testimonials pushed to sort 5; others keep canonical idx
    const galleryFirst = r.map((m) => m.key);
    expect(galleryFirst[0]).toBe("gallery");
  });

  it("unknown keys in config are ignored", () => {
    const r = resolveModules({ bogus: { enabled: false, sort: 0 } });
    expect(r).toHaveLength(23);
    expect(r.map((m) => m.key)).toEqual(MODULE_KEYS);
  });
});

describe("normalizeModuleConfig", () => {
  it("produces contiguous integer sorts and boolean enabled for all keys", () => {
    const cfg = normalizeModuleConfig({ gallery: { enabled: false, sort: 0 } });
    expect(Object.keys(cfg)).toHaveLength(23);
    const sorts = MODULE_KEYS.map((k) => cfg[k].sort ?? -1).sort((a, b) => a - b);
    expect(sorts).toEqual([...Array(23).keys()]);
    expect(cfg.gallery.enabled).toBe(false);
    expect(cfg.testimonials.enabled).toBe(true);
  });
});

describe("configFromRecommended", () => {
  it("enables recommended modules + disables the rest (full config)", () => {
    const cfg = configFromRecommended({ industry: "מסעדה", description: "בית קפה" });
    expect(Object.keys(cfg)).toHaveLength(23);
    expect(cfg.menu.enabled).toBe(true); // restaurant → menu
    expect(cfg.testimonials.enabled).toBe(true); // baseline
    expect(cfg.donations.enabled).toBe(false); // irrelevant
    // resolves to only the recommended ones being enabled
    const enabled = resolveModules(cfg).filter((m) => m.enabled).map((m) => m.key);
    expect(enabled).toContain("menu");
    expect(enabled).not.toContain("donations");
  });

  it("narrows to the site mode's allowed modules", () => {
    const business = { industry: "מסעדה", description: "בית קפה" };
    // Brochure-site allow-list: no store forms.
    const brochure = configFromRecommended(
      business,
      modulesForMode("website"),
    );
    expect(brochure.menu.enabled).toBe(true);
    expect(brochure.contact.enabled).toBe(true);
    expect(brochure.returns.enabled).toBe(false);
    expect(brochure.order_tracking.enabled).toBe(false);
    // Still a FULL config — the disallowed keys are present but off.
    expect(Object.keys(brochure)).toHaveLength(23);

    // The store keeps them.
    const store = configFromRecommended(business, modulesForMode("store"));
    expect(store.returns.enabled).toBe(true);
    expect(store.order_tracking.enabled).toBe(true);

    // A landing page has no modules at all.
    const landing = configFromRecommended(business, modulesForMode("landing"));
    expect(resolveModules(landing).some((m) => m.enabled)).toBe(false);
  });

  it("omitting the allow-list keeps the old behaviour", () => {
    const business = { industry: "מסעדה", description: "בית קפה" };
    expect(configFromRecommended(business)).toEqual(
      configFromRecommended(business, MODULE_KEYS),
    );
  });
});

describe("recommendModules", () => {
  it("always includes the universal baseline", () => {
    const r = recommendModules({ description: "" });
    expect(r).toContain("testimonials");
    expect(r).toContain("faqs");
    expect(r).toContain("contact"); // the closing lead form stays on for every type
  });

  it("restaurant → menu + gallery", () => {
    const r = recommendModules({ industry: "מסעדה", description: "בית קפה ואוכל" });
    expect(r).toContain("menu");
    expect(r).toContain("gallery");
  });

  it("gym → memberships + pricing", () => {
    const r = recommendModules({ industry: "מכון כושר", description: "סטודיו כושר" });
    expect(r).toContain("memberships");
    expect(r).toContain("pricing");
  });

  it("nonprofit → donations", () => {
    const r = recommendModules({ industry: "עמותה", description: "מלכ\"ר לתרומות" });
    expect(r).toContain("donations");
  });

  it("returns keys in canonical order", () => {
    const r = recommendModules({ industry: "מסעדה אופנה כושר", description: "" });
    const idx = r.map((k) => MODULE_KEYS.indexOf(k));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});
