import { describe, expect, it } from "vitest";

import { deterministicDirection } from "@/lib/ai/agents/design-director";
import { pickSiteTheme, resolveSiteTheme } from "@/lib/site-theme";
import { HERO_STYLE_KEYS } from "@/lib/hero-style";
import { LAYOUT_KEYS } from "@/lib/site-layout";
import { brandForGround, contrastRatio, pickBrandColor, type Palette } from "@/lib/storefront-brand";

/**
 * The director's whole reason to exist is that the four agents it replaces
 * could each be right while the combination was wrong. So the thing worth
 * testing is not "did it answer" but "does the answer hang together" — and
 * the fallback path is the one that must hold under every condition, because
 * it is what every business gets when the model is unavailable.
 */

const AA_BODY = 4.5;

const BUSINESSES = [
  { name: "צימרים בגליל", industry: "מלונות", type: null, description: "אירוח כפרי מול נוף" },
  { name: "עו״ד כהן", industry: "משפטים", type: null, description: "משרד עורכי דין מסחרי" },
  { name: "מאפיית לחם", industry: "מאפייה", type: null, description: "לחם מחמצת ומאפים" },
  { name: "קליניקת שיניים", industry: "רפואת שיניים", type: null, description: "טיפולי שיניים" },
  { name: "מוסך הצפון", industry: "רכב", type: null, description: "תיקוני רכב ומכונאות" },
  { name: "סטודיו יופי", industry: "קוסמטיקה", type: null, description: "טיפולי פנים ואיפור" },
  { name: "עסק כללי", industry: null, type: null, description: "שירותים" },
];

describe("deterministic direction — the always-available answer", () => {
  for (const b of BUSINESSES) {
    describe(b.name, () => {
      const d = deterministicDirection(b);

      it("returns a complete, valid direction", () => {
        expect(d.palette.length).toBeGreaterThan(0);
        expect(HERO_STYLE_KEYS).toContain(d.heroStyle);
        expect(LAYOUT_KEYS).toContain(d.layout);
        expect(resolveSiteTheme(d.theme).key).toBe(d.theme);
        expect(d.fromModel).toBe(false);
      });

      it("emits only valid hex colours", () => {
        for (const c of d.palette) expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      });

      it("picks Hebrew-capable fonts", () => {
        // A Latin-only face silently falls back on every Hebrew heading, which
        // looks like a broken site rather than a design choice.
        expect(["Heebo", "Assistant", "Rubik", "Varela Round", "Secular One", "Alef"])
          .toContain(d.typography.primary);
      });

      it("THE COHERENCE GUARANTEE: the brand colour reads on its own scheme", () => {
        // This is the failure the director was built to make impossible — a
        // palette chosen by one agent and a ground chosen by another.
        const theme = resolveSiteTheme(d.theme);
        const brand = brandForGround(pickBrandColor(d.palette as Palette), theme.inkMeasure);
        expect(contrastRatio(brand, theme.inkMeasure)).toBeGreaterThanOrEqual(AA_BODY);
      });

      it("keeps ink readable on the scheme it chose", () => {
        const theme = resolveSiteTheme(d.theme);
        expect(contrastRatio(theme.ink, theme.ground)).toBeGreaterThanOrEqual(AA_BODY);
      });
    });
  }

  it("is deterministic — the same business always gets the same direction", () => {
    const a = deterministicDirection(BUSINESSES[0]);
    const b = deterministicDirection(BUSINESSES[0]);
    expect(a.theme).toBe(b.theme);
    expect(a.heroStyle).toBe(b.heroStyle);
    expect(a.palette[0].hex).toBe(b.palette[0].hex);
  });

  it("reads the trade, not just the fallback", () => {
    // If every business landed on the same scheme the director would be
    // decoration rather than a decision.
    const themes = new Set(BUSINESSES.map((b) => deterministicDirection(b).theme));
    expect(themes.size).toBeGreaterThan(2);
  });

  it("degrades to the same scheme a new site is born with", () => {
    // The fallback must not be a THIRD behaviour — it has to match what
    // lib/jobs/handlers/website.ts already assigns at generation time.
    for (const b of BUSINESSES) {
      expect(deterministicDirection(b).theme).toBe(pickSiteTheme(b));
    }
  });
});
