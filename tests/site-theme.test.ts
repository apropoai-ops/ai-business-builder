import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_THEME,
  SITE_THEMES,
  SITE_THEME_KEYS,
  isSiteThemeKey,
  pickSiteTheme,
  resolveSiteTheme,
  type SiteTheme,
} from "@/lib/site-theme";
import {
  brandForGround,
  contrastRatio,
  mixHex,
  relativeLuminance,
} from "@/lib/storefront-brand";

/**
 * A colour scheme is authored by hand, so every one of them is a chance to ship
 * a site whose own text can't be read on its own ground. These thresholds are
 * the guarantee: they fail here rather than on a paying customer's storefront.
 *
 * The brand colours below are the real shapes the picker produces — a mid blue,
 * a near-black, a saturated yellow and a bright red — because the near-black
 * and the yellow are precisely the two that broke the old hard-coded palette.
 */

const AA_BODY = 4.5;
const AA_LARGE = 3; // WCAG AA for large/bold text and UI components

const BRANDS = ["#2563EB", "#111111", "#FACC15", "#DC2626", "#0F766E", "#7C3AED"];

/** The surfaces a scheme paints text directly onto. */
function surfaces(t: SiteTheme): [string, string][] {
  return [
    ["ground", t.ground],
    ["raised", t.raised],
    ["panel", t.panel],
    ["card", t.card],
  ];
}

describe("registry integrity", () => {
  it("has unique keys and a resolvable default", () => {
    expect(new Set(SITE_THEME_KEYS).size).toBe(SITE_THEME_KEYS.length);
    expect(isSiteThemeKey(DEFAULT_SITE_THEME)).toBe(true);
    expect(resolveSiteTheme(DEFAULT_SITE_THEME).key).toBe(DEFAULT_SITE_THEME);
  });

  it("falls back to midnight for null, junk and retired keys", () => {
    expect(resolveSiteTheme(null).key).toBe("midnight");
    expect(resolveSiteTheme(undefined).key).toBe("midnight");
    expect(resolveSiteTheme("").key).toBe("midnight");
    expect(resolveSiteTheme("   ").key).toBe("midnight");
    expect(resolveSiteTheme("neon-disco").key).toBe("midnight");
  });

  it("trims a padded value rather than dropping it", () => {
    expect(resolveSiteTheme(" forest ").key).toBe("forest");
  });

  it("keeps midnight byte-identical to the palette that shipped before schemes", () => {
    // If any of these move, every site that predates this feature changes
    // appearance without anyone asking for it.
    const m = resolveSiteTheme("midnight");
    expect(m.ground).toBe("#000000");
    expect(m.raised).toBe("#0b0b0d");
    expect(m.panel).toBe("#121214");
    expect(m.card).toBe("#111214");
    expect(m.accent).toBe("#d4af6a");
    expect(m.inkMeasure).toBe("#1d1d1f");
  });
});

describe("every scheme is readable on its own surfaces", () => {
  for (const t of SITE_THEMES) {
    describe(t.key, () => {
      it("declares an ink direction that matches its ground", () => {
        const lum = relativeLuminance(t.ground);
        expect(t.mode === "light" ? lum > 0.45 : lum <= 0.45).toBe(true);
      });

      it("clears AA body text on every surface it paints on", () => {
        for (const [name, surface] of surfaces(t)) {
          expect(
            contrastRatio(t.ink, surface),
            `${t.key}.ink on ${name}`,
          ).toBeGreaterThanOrEqual(AA_BODY);
          expect(
            contrastRatio(t.inkSoft, surface),
            `${t.key}.inkSoft on ${name}`,
          ).toBeGreaterThanOrEqual(AA_BODY);
          expect(
            contrastRatio(t.inkDim, surface),
            `${t.key}.inkDim on ${name}`,
          ).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      it("nominates a surface at least as hard as any it paints on", () => {
        // A colour that clears AA against inkMeasure has to clear it on every
        // real surface too — that is the whole reason brandForGround is only
        // ever handed one. Being STRICTER than the hardest declared surface is
        // fine (midnight measures #1d1d1f, the nested-card tint, which is a
        // step lighter than any token here); being looser is the bug.
        const lums = surfaces(t).map(([, s]) => relativeLuminance(s));
        const measure = relativeLuminance(t.inkMeasure);
        if (t.mode === "dark") expect(measure).toBeGreaterThanOrEqual(Math.max(...lums));
        else expect(measure).toBeLessThanOrEqual(Math.min(...lums));
      });

      it("gives the hero a light headline whatever the page does", () => {
        // The hero components paint their own dark artwork under the tier CSS,
        // so a light scheme must NOT hand them its dark page ink.
        const heroInk = t.mode === "dark" ? t.ink : "#ffffff";
        expect(contrastRatio(heroInk, "#0a0a0a")).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }
});

describe("the brand survives every scheme", () => {
  for (const t of SITE_THEMES) {
    for (const brand of BRANDS) {
      it(`${t.key} + ${brand}: brand-as-ink clears AA on every surface`, () => {
        const adjusted = brandForGround(brand, t.inkMeasure);
        for (const [name, surface] of surfaces(t)) {
          expect(
            contrastRatio(adjusted, surface),
            `${brand}→${adjusted} on ${t.key}.${name}`,
          ).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      it(`${t.key} + ${brand}: the accent clears AA as price/meta text`, () => {
        // Exactly what tier-styles.tsx computes for --accent.
        const adjusted = brandForGround(brand, t.inkMeasure);
        const accent = brandForGround(mixHex(adjusted, t.accent, 0.55), t.inkMeasure);
        for (const [name, surface] of surfaces(t)) {
          expect(
            contrastRatio(accent, surface),
            `accent on ${t.key}.${name}`,
          ).toBeGreaterThanOrEqual(AA_BODY);
        }
      });

      it(`${t.key} + ${brand}: the CTA label reads on every gradient stop`, () => {
        const adjusted = brandForGround(brand, t.inkMeasure);
        const accent = brandForGround(mixHex(adjusted, t.accent, 0.55), t.inkMeasure);
        const stops = [adjusted, accent, t.accent];
        // The ink the stylesheet picks: whichever of white / near-black holds up
        // against the WORST stop of the pill's gradient.
        const worst = stops.reduce((w, s) =>
          contrastRatio(s, "#ffffff") < contrastRatio(w, "#ffffff") ? s : w,
        );
        const ink = contrastRatio(worst, "#ffffff") >= contrastRatio(worst, "#18181b")
          ? "#ffffff"
          : "#18181b";
        for (const stop of stops) {
          // A CTA label is 600-weight — AA large is the honest bar for it, and
          // it's what a 3-stop gradient can actually guarantee end to end.
          expect(contrastRatio(ink, stop), `cta ink on ${stop}`).toBeGreaterThanOrEqual(AA_LARGE);
        }
      });
    }
  }
});

describe("mixHex", () => {
  it("returns the endpoints at 1 and 0", () => {
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#0000ff");
  });

  it("blends channel-wise at the midpoint", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("clamps out-of-range amounts instead of producing junk", () => {
    expect(mixHex("#ff0000", "#0000ff", 5)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", -5)).toBe("#0000ff");
  });

  it("falls back to whichever side parses when the other is junk", () => {
    expect(mixHex("nope", "#0000ff", 0.5)).toBe("#0000ff");
    expect(mixHex("#ff0000", "nope", 0.5)).toBe("#ff0000");
  });
});

describe("pickSiteTheme — the deterministic industry picker", () => {
  it("reads the trade, not the letters", () => {
    expect(pickSiteTheme({ industry: "צימרים ואירוח בגליל" })).toBe("forest");
    expect(pickSiteTheme({ industry: "משרד עורכי דין" })).toBe("navy");
    expect(pickSiteTheme({ industry: "מסעדה שף" })).toBe("wine");
    expect(pickSiteTheme({ industry: "בית קפה ומאפייה" })).toBe("espresso");
    expect(pickSiteTheme({ industry: "מוסך ותיקוני רכב" })).toBe("graphite");
    expect(pickSiteTheme({ industry: "קליניקת שיניים" })).toBe("porcelain");
    expect(pickSiteTheme({ industry: "סטודיו לאיפור וטיפוח" })).toBe("sand");
  });

  it("matches English industry text too", () => {
    expect(pickSiteTheme({ industry: "boutique winery" })).toBe("wine");
    expect(pickSiteTheme({ type: "fintech startup" })).toBe("navy");
  });

  it("falls through to the scheme every site had before, not to something new", () => {
    expect(pickSiteTheme({})).toBe(DEFAULT_SITE_THEME);
    expect(pickSiteTheme({ industry: "עסק" })).toBe(DEFAULT_SITE_THEME);
  });

  it("is deterministic", () => {
    const b = { industry: "ספא", description: "עיסויים וטיפולי גוף" };
    expect(pickSiteTheme(b)).toBe(pickSiteTheme(b));
  });
});
