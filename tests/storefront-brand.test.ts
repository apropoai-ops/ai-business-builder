import { describe, expect, it } from "vitest";

import {
  DARK_GROUND,
  INK_DARK,
  INK_LIGHT,
  brandForDarkGround,
  brandInk,
  brandOnDark,
  contrastRatio,
  inkOn,
  pickBrandColor,
  relativeLuminance,
} from "@/lib/storefront-brand";

/**
 * Every storefront paints itself from one owner-chosen hex, and the AI picks it
 * per industry — so these helpers are the only thing standing between a yellow
 * brand and a white-on-yellow CTA nobody can read. The thresholds are pinned
 * here because a regression is invisible until a customer's site looks broken.
 */

const AA_BODY = 4.5;

describe("relativeLuminance / contrastRatio", () => {
  it("anchors at black and white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("is order-independent and handles 3-digit hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(contrastRatio("#000", "#fff"), 5);
  });

  it("treats junk as black rather than throwing", () => {
    expect(relativeLuminance("not-a-color")).toBe(0);
    expect(relativeLuminance("")).toBe(0);
  });
});

describe("inkOn — text placed ON a brand surface", () => {
  it("uses white on a dark brand and near-black on a light one", () => {
    expect(inkOn("#2563EB")).toBe(INK_LIGHT); // brand blue
    expect(inkOn("#111111")).toBe(INK_LIGHT);
    expect(inkOn("#FACC15")).toBe(INK_DARK); // the yellow that started this
    expect(inkOn("#FDE68A")).toBe(INK_DARK);
  });

  it("always returns the better of the two — never worse than 3:1", () => {
    for (const hex of ["#2563EB", "#FACC15", "#2D5A3D", "#E11D48", "#94A3B8", "#111111"]) {
      expect(contrastRatio(hex, inkOn(hex))).toBeGreaterThan(3);
    }
  });
});

describe("brandInk — the brand used AS text on white", () => {
  it("leaves an already-readable brand untouched (hex is re-serialised lowercase)", () => {
    expect(brandInk("#2563EB").toLowerCase()).toBe("#2563eb");
  });

  it("darkens a light brand until it clears AA on white", () => {
    const ink = brandInk("#FACC15");
    expect(ink.toLowerCase()).not.toBe("#facc15");
    expect(contrastRatio(ink, "#ffffff")).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("clears AA for every brand colour we might be handed", () => {
    for (const hex of ["#FACC15", "#22D3EE", "#A3E635", "#F472B6", "#2563EB", "#2D5A3D"]) {
      expect(contrastRatio(brandInk(hex), "#ffffff")).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("falls back to near-black on junk input", () => {
    expect(brandInk("nope")).toBe(INK_DARK);
  });
});

describe("brandOnDark — the brand used AS text on a near-black hero", () => {
  const NEAR_BLACK = "#050110";

  it("leaves an already-readable bright brand untouched", () => {
    expect(brandOnDark("#FACC15").toLowerCase()).toBe("#facc15");
  });

  it("lightens a dark brand until it clears AA on the hero ground", () => {
    // The grey that exposed this: on #050110 it sat at ~2:1 as a display word.
    const glow = brandOnDark("#5F5D5D");
    expect(glow.toLowerCase()).not.toBe("#5f5d5d");
    expect(contrastRatio(glow, NEAR_BLACK)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("clears AA for every brand colour we might be handed", () => {
    for (const hex of ["#5F5D5D", "#111111", "#2563EB", "#2D5A3D", "#7C2D12", "#FACC15"]) {
      expect(contrastRatio(brandOnDark(hex), NEAR_BLACK)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("falls back to white on junk input", () => {
    expect(brandOnDark("nope")).toBe(INK_LIGHT);
  });
});

describe("brandForDarkGround — what a dark-tier storefront paints with", () => {
  // The tier's surfaces, darkest to lightest. DARK_GROUND is the lightest of
  // them, so clearing AA there clears it on all of the others.
  const SURFACES = ["#000000", "#0a0a0a", "#0b0b0d", "#111214", "#121214", DARK_GROUND];

  it("clears AA on EVERY surface the tier paints, for every brand", () => {
    for (const hex of ["#111111", "#1A1A1A", "#5F5D5D", "#2563EB", "#0F172A", "#2D5A3D", "#7C2D12"]) {
      const lit = brandForDarkGround(hex);
      for (const surface of SURFACES) {
        expect(contrastRatio(lit, surface)).toBeGreaterThanOrEqual(AA_BODY);
      }
    }
  });

  it("survives the tier's #0a0a0a CTA ink sitting on top of it", () => {
    // [data-el="btn-primary"] hard-codes color:#0a0a0a over a gradient that
    // starts at the brand. A near-black brand made that label invisible.
    for (const hex of ["#111111", "#2563EB", "#0F172A"]) {
      expect(contrastRatio(brandForDarkGround(hex), "#0a0a0a")).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("leaves a brand that already reads on the ground untouched", () => {
    expect(brandForDarkGround("#FACC15").toLowerCase()).toBe("#facc15");
  });

  it("stays usable as a SURFACE too — inkOn still finds a readable label", () => {
    // The lift makes the brand mid-tone, which is exactly where a hard-coded
    // text-white breaks; inkOn has to pick the other side.
    for (const hex of ["#111111", "#1A1A1A", "#2563EB", "#FACC15"]) {
      const lit = brandForDarkGround(hex);
      expect(contrastRatio(lit, inkOn(lit))).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});

describe("pickBrandColor", () => {
  const p = (...hexes: string[]) =>
    hexes.map((hex) => ({ name: "c", hex, usage: "u" }));

  it("prefers the first colour dark enough to be a surface", () => {
    expect(pickBrandColor(p("#FFFFFF", "#FACC15", "#2563EB"))).toBe("#2563EB");
  });

  it("falls back to the default only when there is no palette", () => {
    expect(pickBrandColor(null)).toBe("#2563EB");
    expect(pickBrandColor([])).toBe("#2563EB");
  });

  it("darkens rather than discarding an all-light palette", () => {
    // Previously every one of these passed `R+G+B > 660`… or failed it and got
    // replaced by a generic blue, losing the owner's brand entirely.
    const picked = pickBrandColor(p("#FDE68A", "#FEF3C7"));
    expect(picked).not.toBe("#2563EB");
    expect(contrastRatio(picked, "#ffffff")).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("ignores malformed entries", () => {
    expect(pickBrandColor(p("nope", "#2D5A3D"))).toBe("#2D5A3D");
  });
});
