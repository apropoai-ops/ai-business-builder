import { describe, expect, it } from "vitest";

import { MODULE_KEYS } from "@/lib/modules";
import { createBusinessSchema } from "@/lib/validation/business";
import {
  SITE_MODES,
  SITE_MODE_DEFS,
  SITE_MODE_LIST,
  inferSiteMode,
  isLandingMode,
  isSiteMode,
  isStoreMode,
  modeAllowsModule,
  modeAllowsNav,
  modeAllowsRoute,
  modeAllowsStoreScreen,
  modeHasCommerce,
  sellsOnline,
  modeHasModules,
  modulesForMode,
  resolveSiteMode,
  siteModeDef,
} from "@/lib/site-mode";

describe("site mode registry", () => {
  it("has exactly the three modes from the spec, each fully defined", () => {
    expect(SITE_MODES).toEqual(["website", "landing", "store"]);
    expect(SITE_MODE_LIST).toHaveLength(3);
    for (const def of SITE_MODE_LIST) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.tagline.length).toBeGreaterThan(0);
      expect(def.audience.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(SITE_MODE_DEFS[def.key]).toBe(def);
    }
  });

  it("only references real module keys", () => {
    for (const def of SITE_MODE_LIST) {
      for (const key of def.modules) expect(MODULE_KEYS).toContain(key);
    }
  });
});

describe("resolveSiteMode", () => {
  it("passes through valid modes", () => {
    expect(resolveSiteMode("website")).toBe("website");
    expect(resolveSiteMode("landing")).toBe("landing");
    expect(resolveSiteMode("store")).toBe("store");
  });

  it("falls back to the least-assuming mode for junk", () => {
    expect(resolveSiteMode(null)).toBe("website");
    expect(resolveSiteMode(undefined)).toBe("website");
    expect(resolveSiteMode("")).toBe("website");
    expect(resolveSiteMode("shop")).toBe("website");
    expect(resolveSiteMode(3)).toBe("website");
  });

  it("isSiteMode guards the same set", () => {
    expect(isSiteMode("store")).toBe(true);
    expect(isSiteMode("Store")).toBe(false);
    expect(isSiteMode(null)).toBe(false);
  });

  it("siteModeDef normalizes junk too", () => {
    expect(siteModeDef("nonsense").key).toBe("website");
  });
});

describe("commerce gating", () => {
  it("only the store mode sells", () => {
    expect(modeHasCommerce("store")).toBe(true);
    expect(modeHasCommerce("website")).toBe(false);
    expect(modeHasCommerce("landing")).toBe(false);
    expect(isStoreMode("store")).toBe(true);
    expect(isLandingMode("landing")).toBe(true);
  });

  it("catalog_only turns a store into a shop window — mode still 'store', selling off", () => {
    // The flag only ever subtracts: it cannot make a non-store sell.
    expect(sellsOnline("store")).toBe(true);
    expect(sellsOnline("store", { catalogOnly: false })).toBe(true);
    expect(sellsOnline("store", { catalogOnly: true })).toBe(false);
    expect(sellsOnline("website", { catalogOnly: false })).toBe(false);
    expect(sellsOnline("landing", { catalogOnly: true })).toBe(false);

    // The mode itself is untouched — the shelf still renders off modeHasCommerce.
    expect(modeHasCommerce("store")).toBe(true);
  });

  it("sellsOnline treats a missing/null flag as 'still selling'", () => {
    // A row read before migration 0090, or a partial select, must not silently
    // switch a paying customer's checkout off.
    expect(sellsOnline("store", {})).toBe(true);
    expect(sellsOnline("store", { catalogOnly: null })).toBe(true);
    expect(sellsOnline("store", { catalogOnly: undefined })).toBe(true);
  });

  it("the store keeps every module; the brochure site drops only the store forms", () => {
    expect(modulesForMode("store")).toEqual(MODULE_KEYS);
    expect(modeAllowsModule("store", "returns")).toBe(true);
    expect(modeAllowsModule("store", "order_tracking")).toBe(true);

    expect(modeAllowsModule("website", "returns")).toBe(false);
    expect(modeAllowsModule("website", "order_tracking")).toBe(false);
    // Everything else survives — a brochure site still gets its lead form.
    expect(modeAllowsModule("website", "contact")).toBe(true);
    expect(modeAllowsModule("website", "testimonials")).toBe(true);
    expect(modulesForMode("website")).toHaveLength(MODULE_KEYS.length - 2);
  });

  it("the landing page has no modules at all — its section order is fixed", () => {
    expect(modulesForMode("landing")).toEqual([]);
    expect(modeHasModules("landing")).toBe(false);
    expect(modeHasModules("website")).toBe(true);
    expect(modeHasModules("store")).toBe(true);
    expect(modeAllowsModule("landing", "contact")).toBe(false);
  });
});

describe("nav gating", () => {
  it("the store sees everything", () => {
    expect(SITE_MODE_DEFS.store.hiddenNav).toEqual([]);
    expect(modeAllowsNav("store", "orders")).toBe(true);
    expect(modeAllowsNav("store", "returns")).toBe(true);
  });

  it("the brochure site hides only the commerce desks", () => {
    expect(modeAllowsNav("website", "store")).toBe(false);
    expect(modeAllowsNav("website", "orders")).toBe(false);
    expect(modeAllowsNav("website", "returns")).toBe(false);
    // Service businesses still quote, book, blog and run a CRM.
    expect(modeAllowsNav("website", "quotes")).toBe(true);
    expect(modeAllowsNav("website", "bookings")).toBe(true);
    expect(modeAllowsNav("website", "content")).toBe(true);
    expect(modeAllowsNav("website", "crm")).toBe(true);
  });

  it("the landing page keeps only the campaign toolkit", () => {
    // "branding" is gone as a nav key — it was merged into "website".
    for (const key of ["overview", "analytics", "crm", "website", "ads", "automations", "ceo-chat", "whatsapp", "reviews", "members", "integrations", "export"] as const) {
      expect(modeAllowsNav("landing", key)).toBe(true);
    }
    for (const key of ["store", "orders", "returns", "sections", "bookings", "content", "calendar", "quotes", "projects", "hr"] as const) {
      expect(modeAllowsNav("landing", key)).toBe(false);
    }
  });

  it("whatsapp stays reachable in every mode — it owns the float button's phone number", () => {
    for (const mode of SITE_MODES) expect(modeAllowsNav(mode, "whatsapp")).toBe(true);
  });

  it("no mode lists the same hidden nav key twice", () => {
    for (const def of SITE_MODE_LIST) {
      expect(new Set(def.hiddenNav).size).toBe(def.hiddenNav.length);
    }
  });
});

describe("the חנות screen (products + תזמון לילות)", () => {
  it("opens wherever the mode sells products, nights or not", () => {
    expect(modeAllowsStoreScreen("store")).toBe(true);
    expect(modeAllowsStoreScreen("store", { sellsNights: false })).toBe(true);
    expect(modeAllowsStoreScreen("store", { sellsNights: true })).toBe(true);
  });

  it("opens for a צימר on the brochure package, whose only product is a night", () => {
    expect(modeAllowsStoreScreen("website", { sellsNights: true })).toBe(true);
    expect(modeAllowsStoreScreen("landing", { sellsNights: true })).toBe(true);
  });

  it("stays shut for a business that sells neither — a lawyer keeps a clean nav", () => {
    expect(modeAllowsStoreScreen("website")).toBe(false);
    expect(modeAllowsStoreScreen("website", { sellsNights: false })).toBe(false);
    expect(modeAllowsStoreScreen("landing", { sellsNights: false })).toBe(false);
  });

  it("never contradicts modeAllowsNav when nothing sells nights", () => {
    for (const mode of SITE_MODES) {
      expect(modeAllowsStoreScreen(mode)).toBe(modeAllowsNav(mode, "store"));
    }
  });
});

describe("public route gating", () => {
  it("product pages exist only where products do", () => {
    expect(modeAllowsRoute("store", "product")).toBe(true);
    expect(modeAllowsRoute("website", "product")).toBe(false);
    expect(modeAllowsRoute("landing", "product")).toBe(false);
  });

  it("the brochure site keeps its blog and customer area", () => {
    expect(modeAllowsRoute("website", "blog")).toBe(true);
    expect(modeAllowsRoute("website", "account")).toBe(true);
  });

  it("only the store serves the shipping-and-returns page", () => {
    expect(modeAllowsRoute("store", "help")).toBe(true);
    expect(modeAllowsRoute("website", "help")).toBe(false);
  });

  it("the landing page serves one page plus the legally expected two", () => {
    expect(modeAllowsRoute("landing", "terms")).toBe(true);
    expect(modeAllowsRoute("landing", "accessibility")).toBe(true);
    expect(modeAllowsRoute("landing", "blog")).toBe(false);
    expect(modeAllowsRoute("landing", "account")).toBe(false);
    expect(modeAllowsRoute("landing", "help")).toBe(false);
  });
});

describe("wizard validation stays in sync with the registry", () => {
  const base = { description: "רעיון עסקי מפורט מספיק כדי לעבור את מינימום העשרים התווים" };

  it("accepts every mode the registry defines", () => {
    for (const mode of SITE_MODES) {
      const parsed = createBusinessSchema.safeParse({ ...base, siteMode: mode });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.siteMode).toBe(mode);
    }
  });

  it("defaults to the brochure site and rejects unknown modes", () => {
    const omitted = createBusinessSchema.safeParse(base);
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.siteMode).toBe("website");

    expect(createBusinessSchema.safeParse({ ...base, siteMode: "shop" }).success).toBe(false);
  });

  it("carries the landing brief fields", () => {
    const parsed = createBusinessSchema.safeParse({
      ...base,
      siteMode: "landing",
      product: "קורס אונליין",
      price: "1490 ש\"ח",
      problem: "בעלי עסקים לא יודעים לנהל פרסום",
      whyYou: "12 שנות ניסיון",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.product).toBe("קורס אונליין");
      expect(parsed.data.problem).toContain("בעלי עסקים");
    }
  });
});

describe("inferSiteMode (matches the 0077 backfill rule)", () => {
  it("anyone who created a product was building a store", () => {
    expect(inferSiteMode({ productCount: 1 })).toBe("store");
    expect(inferSiteMode({ productCount: 42 })).toBe("store");
  });

  it("everyone else gets the brochure site", () => {
    expect(inferSiteMode({ productCount: 0 })).toBe("website");
    expect(inferSiteMode({ productCount: null })).toBe("website");
    expect(inferSiteMode({})).toBe("website");
  });
});
