import { describe, it, expect } from "vitest";

import { DEPARTMENTS, visibleDepartments } from "@/lib/dashboard-departments";
import {
  SITE_MODES,
  SITE_MODE_DEFS,
  modeAllowsNav,
  type BusinessNavKey,
} from "@/lib/site-mode";

const allItems = DEPARTMENTS.flatMap((d) => d.items);
const keys = allItems.map((i) => i.key);

describe("dashboard departments", () => {
  it("lists every screen exactly once", () => {
    // Two departments claiming the same screen would render it twice on the
    // overview and put two entries in the sidebar.
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every screen site-mode knows about a home — no orphans", () => {
    // The regression that matters: a screen is added to site-mode's hiddenNav
    // lists but nobody puts it in a department, so it has no entry point in the
    // sidebar OR the overview and is reachable only by typing the URL.
    //
    // "orders" and "returns" are exempt: they are tabs INSIDE the unified /crm
    // screen (app/(dashboard)/businesses/[businessId]/crm/page.tsx renders them
    // conditionally via the same modeAllowsNav check), not destinations of
    // their own — same as in the flat nav list this replaced.
    const NOT_A_SCREEN: BusinessNavKey[] = ["orders", "returns"];
    const knownToModes = new Set<BusinessNavKey>(
      SITE_MODES.flatMap((m) => SITE_MODE_DEFS[m].hiddenNav).filter(
        (k) => !NOT_A_SCREEN.includes(k),
      ),
    );
    const owned = new Set<BusinessNavKey>(keys);
    const orphans = [...knownToModes].filter((k) => !owned.has(k));
    expect(orphans).toEqual([]);
  });

  it("every department has a colour-token id and at least one screen", () => {
    for (const d of DEPARTMENTS) {
      expect(d.id).toMatch(/^[a-z]+$/); // becomes --dept-<id> in globals.css
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.items.length).toBeGreaterThan(0);
    }
  });

  it("every screen carries a label and a one-line blurb for the overview card", () => {
    for (const item of allItems) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.blurb.trim().length).toBeGreaterThan(0);
    }
  });

  describe("mode filtering", () => {
    it("a landing page loses the commerce and content departments' screens", () => {
      const landing = visibleDepartments({ siteMode: "landing" });
      const landingKeys = landing.flatMap((d) => d.items).map((i) => i.key);

      expect(landingKeys).not.toContain("store");
      expect(landingKeys).not.toContain("content");
      expect(landingKeys).not.toContain("bookings");
      // …and every surviving key really is allowed by the mode.
      for (const k of landingKeys) {
        if (k === "store" || k === "rentals") continue; // answered by the opts, not the mode
        expect(modeAllowsNav("landing", k)).toBe(true);
      }
    });

    it("drops a department entirely once all of its screens are hidden", () => {
      const landing = visibleDepartments({ siteMode: "landing" });
      // No empty shells: an empty group would render a heading with nothing in it.
      for (const d of landing) expect(d.items.length).toBeGreaterThan(0);
    });

    it("the brochure site keeps the store screen only when it sells nights", () => {
      const plain = visibleDepartments({ siteMode: "website" })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(plain).not.toContain("store");

      // A צימר on the brochure package: the unit catalog lives in that screen.
      const guesthouse = visibleDepartments({ siteMode: "website", sellsNights: true })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(guesthouse).toContain("store");
    });

    it("לוח לילות follows the entitlement, not the build mode", () => {
      const without = visibleDepartments({ siteMode: "store" })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(without).not.toContain("rentals");

      const with_ = visibleDepartments({ siteMode: "store", hasRentals: true })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(with_).toContain("rentals");

      // Including on a brochure site — that is exactly who buys the package.
      const brochure = visibleDepartments({ siteMode: "website", hasRentals: true })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(brochure).toContain("rentals");
    });

    it("hiddenNavKeys (AI classification) subtracts on top of the entitlement", () => {
      // The actual bug this fixes: a retail store on Pro+ has hasRentals=true
      // (plan entitlement) but the AI classifier (lib/ai/agents/nav-relevance.ts)
      // marked "rentals" irrelevant for this vertical.
      const withoutAi = visibleDepartments({ siteMode: "store", hasRentals: true })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(withoutAi).toContain("rentals");

      const withAi = visibleDepartments({
        siteMode: "store",
        hasRentals: true,
        hiddenNavKeys: ["rentals"],
      })
        .flatMap((d) => d.items)
        .map((i) => i.key);
      expect(withAi).not.toContain("rentals");
    });

    it("a store with everything shows all 27 screens", () => {
      const full = visibleDepartments({
        siteMode: "store",
        sellsNights: true,
        hasRentals: true,
      }).flatMap((d) => d.items);
      expect(full).toHaveLength(keys.length);
    });
  });
});
