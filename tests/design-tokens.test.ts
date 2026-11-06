import { describe, expect, it } from "vitest";

import { counterTarget, formatCounter } from "@/lib/animated-counter";
import { designTokenCss, resolveDesignTokens } from "@/lib/design-tokens";
import { HERO_STYLE_KEYS } from "@/lib/hero-style";

/**
 * The two rules the storefront's premium layer rests on:
 *
 *  1. every hero style resolves to a design personality (adding a hero without
 *     a mapping would silently hand that business the fallback geometry), and
 *  2. `sharp` is byte-for-byte the geometry the professional tier hard-coded
 *     before tokens existed — that is what keeps the live sites from shifting.
 */
describe("resolveDesignTokens", () => {
  it("maps every hero style to a personality", () => {
    for (const hero of HERO_STYLE_KEYS) {
      const t = resolveDesignTokens(hero);
      expect(t.personality, `hero "${hero}" has no personality`).toBeTruthy();
    }
  });

  it("falls back to `sharp` for a missing, empty or stale hero style", () => {
    for (const input of [null, undefined, "", "portal", "not-a-hero"]) {
      expect(resolveDesignTokens(input).personality).toBe("sharp");
    }
  });

  it("`sharp` reproduces the pre-token professional tier exactly", () => {
    // These four numbers were literals in components/public/tiers/tier-styles.tsx.
    // If one changes, every site already rendering `sharp` moves with it.
    const t = resolveDesignTokens("orbit");
    expect(t.personality).toBe("sharp");
    expect(t.radius.card).toBe(5);
    expect(t.radius.pill).toBe(50);
    expect(t.motion.base).toBe(300);
    expect(t.motion.easing).toBe("cubic-bezier(.22,.8,.3,1)");
  });

  it("keeps every personality inside sane visual bounds", () => {
    const seen = new Set<string>();
    for (const hero of HERO_STYLE_KEYS) {
      const t = resolveDesignTokens(hero);
      seen.add(t.personality);

      // Interaction timing stays purposeful, not decorative. Entrances are
      // allowed to be slower than the interaction transition, never faster.
      expect(t.motion.base).toBeGreaterThanOrEqual(150);
      expect(t.motion.base).toBeLessThanOrEqual(450);
      expect(t.motion.slow).toBeGreaterThan(t.motion.base);

      // A control is never rounder than the card holding it (except the pill,
      // which is the CTA and is allowed to be fully round).
      expect(t.radius.control).toBeLessThanOrEqual(Math.max(t.radius.card, 16));

      // Section rhythm is a real clamp, and generous at the top end.
      expect(t.density.sectionMax).toBeGreaterThan(t.density.sectionMin);
      expect(t.density.sectionMin).toBeGreaterThanOrEqual(3);

      expect(t.elevation).toBeGreaterThan(0);
      expect(t.elevation).toBeLessThanOrEqual(1);
      expect(t.glass).toBeGreaterThanOrEqual(0);
    }

    // The mapping actually differentiates — if every hero collapsed onto one
    // personality the whole feature would be a no-op that still type-checks.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("emits every token as a CSS custom property", () => {
    const css = designTokenCss(resolveDesignTokens("aurora"));
    for (const name of [
      "--r-card",
      "--r-control",
      "--r-media",
      "--r-pill",
      "--t-base",
      "--t-slow",
      "--ease",
      "--section-y",
      "--elev",
      "--glass",
    ]) {
      expect(css, `missing ${name}`).toContain(`${name}:`);
    }
    // Declarations only — the caller owns the selector.
    expect(css).not.toContain("{");
  });
});

describe("counterTarget", () => {
  it("animates plain numbers", () => {
    expect(counterTarget("30")).toEqual({ value: 30, grouped: false });
    expect(counterTarget("  450 ")).toEqual({ value: 450, grouped: false });
    expect(counterTarget("1,200")).toEqual({ value: 1200, grouped: true });
    expect(counterTarget("12.5")).toEqual({ value: 12.5, grouped: false });
  });

  it("leaves an owner's non-numeric copy alone", () => {
    for (const text of ["24/7", "09:00–00:00", "מעל 500", "4.9★", "+30", "", null, undefined]) {
      expect(counterTarget(text), `should skip ${JSON.stringify(text)}`).toBeNull();
    }
  });

  it("skips numbers too small to read as an animation", () => {
    expect(counterTarget("2")).toBeNull();
    expect(counterTarget("9")).toBeNull();
    expect(counterTarget("10")).not.toBeNull();
  });

  it("skips a bare four-digit year but not a grouped thousand", () => {
    expect(counterTarget("1993")).toBeNull();
    expect(counterTarget("2026")).toBeNull();
    expect(counterTarget("2,000")).toEqual({ value: 2000, grouped: true });
    // Outside the year window it is a quantity again.
    expect(counterTarget("1899")).not.toBeNull();
    expect(counterTarget("2101")).not.toBeNull();
  });
});

describe("formatCounter", () => {
  it("writes the in-flight value the way the final one is written", () => {
    expect(formatCounter(1234.6, false)).toBe("1235");
    expect(formatCounter(1234, true)).toBe((1234).toLocaleString("he-IL"));
  });
});
