import type { PublicSite } from "@/lib/services/website.service";

export type Palette = { name: string; hex: string; usage: string }[];

/**
 * Brand colour utilities.
 *
 * Every storefront paints itself from ONE owner-chosen hex, and that hex is
 * whatever the AI picked for their industry — it can be navy, or it can be
 * #FACC15. The old code assumed "brand" always meant "dark enough for white
 * text", which is how a yellow brand ended up with white CTA labels at ~1.5:1.
 *
 * Two distinct jobs, two helpers, because they are NOT the same question:
 *   - brand as a SURFACE  → `inkOn(brand)`   : which ink is readable on it
 *   - brand as INK        → `brandInk(brand)`: darken until it's readable on white
 *
 * Pure and dependency-free so the renderers, the PDF builder and the tests can
 * all share one definition of "readable".
 */

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace("#", "");
  const full =
    m.length === 3 ? m.split("").map((c) => c + c).join("") : m.length === 6 ? m : null;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance (0 = black, 1 = white). Invalid input → 0. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1 → 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK_LIGHT = "#ffffff";
export const INK_DARK = "#18181b";

/**
 * Readable text/icon colour to place ON a brand-coloured surface.
 * Picks whichever of white/near-black actually contrasts better, instead of
 * assuming white.
 */
export function inkOn(hex: string): string {
  return contrastRatio(hex, INK_LIGHT) >= contrastRatio(hex, INK_DARK)
    ? INK_LIGHT
    : INK_DARK;
}

/**
 * The brand colour made safe to use AS TEXT on a white/near-white background.
 *
 * Darkens toward black in small steps until it clears WCAG AA for body text.
 * A fixed offset doesn't work: shaving 22% off #FACC15 still only reaches
 * ~2.3:1. Returns the original when it already passes, so a navy brand is
 * untouched.
 */
export function brandInk(hex: string, on: string = INK_LIGHT, target = 4.5): string {
  const rgb = parseHex(hex);
  if (!rgb) return INK_DARK;
  let [r, g, b] = rgb;
  for (let i = 0; i < 24; i++) {
    const candidate = `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    if (contrastRatio(candidate, on) >= target) return candidate;
    r *= 0.88;
    g *= 0.88;
    b *= 0.88;
  }
  return INK_DARK;
}

/**
 * The brand colour made safe to use AS TEXT on a near-black background.
 *
 * The mirror image of `brandInk`, and needed for the same reason in reverse:
 * the cinematic hero styles paint a display word in the brand colour over a
 * near-black ground, and a charcoal or navy brand lands at ~2:1 there — a huge
 * headline nobody can read. Lightens toward white in small steps until it
 * clears the target ratio, and returns the original when it already passes, so
 * a bright brand is untouched.
 */
export function brandOnDark(hex: string, on = "#050110", target = 4.5): string {
  const rgb = parseHex(hex);
  if (!rgb) return INK_LIGHT;
  let [r, g, b] = rgb;
  for (let i = 0; i < 24; i++) {
    const candidate = `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    if (contrastRatio(candidate, on) >= target) return candidate;
    r += (255 - r) * 0.12;
    g += (255 - g) * 0.12;
    b += (255 - b) * 0.12;
  }
  return INK_LIGHT;
}

/**
 * The LIGHTEST surface the "professional" design tier paints a storefront on.
 *
 * Not the page's #000 but the top of its stack — raised bands are #0b0b0d,
 * module cards #121214, product cards #111214, and nested cards land around
 * #1d1d1f. Measuring against the lightest one is what makes the guarantee hold
 * everywhere: a colour that clears AA here clears it on every darker surface
 * too, and it comfortably clears the tier's literal #0a0a0a CTA ink as well.
 */
export const DARK_GROUND = "#1d1d1f";

/**
 * Hairline for an UNSELECTED chip/swatch/thumbnail outline.
 *
 * These used to be a literal `#e4e4e7` paired with a `#3f3f46` label — zinc
 * values from when storefronts were white pages. Inline, so the tier's
 * `.text-zinc-*` remaps (which key on the class) could never reach them, and
 * on the black ground they measured 2.0:1. Derived from `currentColor` instead
 * of a fixed grey so it follows whatever the surface's own ink is, on a dark
 * tier or a white panel, with no per-call-site branching. Unselected labels
 * simply inherit their colour now rather than pinning a light-theme grey.
 */
export const CHIP_HAIRLINE = "color-mix(in srgb, currentColor 35%, transparent)";

/**
 * The brand colour as a dark-tier storefront must PAINT with it.
 *
 * `pickBrandColor` deliberately returns something dark enough to be a surface
 * (luminance ≤ 0.45) — a rule written when storefronts were white pages. Every
 * storefront is now the all-black professional tier, where that same rule
 * guarantees the opposite of what it promises: a #111111 brand is invisible as
 * ink on #000, its `--gold` mix comes out near-black, and the tier's CTA
 * gradient starts at a stop its own #0a0a0a label cannot be read on. Measured
 * on one real demo storefront: 95 elements below WCAG AA, 60 of them this one
 * colour.
 *
 * Lifting once, here, fixes all three at their source — text, icons, and every
 * `var(--brand)` derivation inside the tier stylesheet — instead of patching
 * ~96 call sites that each re-derive the same wrong answer. A brand that
 * already reads on black is returned untouched, so bright-branded sites do not
 * shift at all.
 *
 * Light surfaces (the personal area, help/terms/accessibility) must NOT use
 * this — they need `brandInk`, which lifts in the other direction.
 */
export function brandForDarkGround(hex: string): string {
  return brandOnDark(hex, DARK_GROUND, 4.5);
}

/**
 * The brand colour made safe to use AS TEXT on an ARBITRARY ground.
 *
 * `brandForDarkGround` above is this function with the answer hard-coded to
 * "the ground is black" — true when black was the only ground we shipped. Now
 * that a storefront can be navy, forest or a light porcelain page
 * (`lib/site-theme.ts`), the lift has to know which way to go: on a light
 * ground the dark-ground lift makes every brand-coloured word WORSE, not
 * better. Pass the scheme's `inkMeasure` — the hardest surface for its ink
 * direction — and this picks the direction from that surface's own luminance.
 */
export function brandForGround(hex: string, ground: string): string {
  return relativeLuminance(ground) > 0.45
    ? brandInk(hex, ground, 4.5)
    : brandOnDark(hex, ground, 4.5);
}

/**
 * Linear blend of two hex colours, `amount` being how much of `a` survives —
 * the TS equivalent of `color-mix(in srgb, a <amount>%, b)`.
 *
 * The tier stylesheet used to build its accent with a literal CSS
 * `color-mix()`, which meant nothing could MEASURE the result: the mix of a
 * dark brand and a dark ground is a colour no one can read, and we'd only find
 * out from a contrast audit. Mixing here instead lets the caller run the
 * product through `brandForGround` before it's ever painted.
 */
export function mixHex(a: string, b: string, amount = 0.5): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return ca ? a : b;
  const t = Math.min(1, Math.max(0, amount));
  return `#${ca
    .map((c, i) => Math.round(c * t + cb[i] * (1 - t)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Too light to serve as a brand surface at all.
 *
 * Was `R+G+B > 660`, which let #FACC15 (475) through as a "strong" colour and
 * is why the palette picker kept handing near-unusable yellows to the hero.
 * Luminance is the measure that actually predicts readability.
 */
function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

/** Picks a strong brand color from the palette (skips near-white). */
export function pickBrandColor(palette: Palette | null): string {
  const fallback = "#2563EB";
  if (!palette?.length) return fallback;
  const strong = palette.find(
    (c) => /^#[0-9a-fA-F]{6}$/.test(c.hex) && !isLight(c.hex),
  );
  // Nothing dark enough to be a surface — darken the first valid entry rather
  // than dropping the owner's brand for a generic blue.
  if (!strong) {
    const firstValid = palette.find((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex));
    return firstValid ? brandInk(firstValid.hex, INK_LIGHT, 4.5) : fallback;
  }
  return strong.hex;
}

/** The display name + brand color + logo for a storefront, used by the personal area. */
export function storeBranding(site: PublicSite) {
  const brandName = site.brand?.brand_name ?? site.business.name ?? "החנות";
  const brand = pickBrandColor(site.brand?.color_palette as Palette | null);
  const logoUrl = site.brand?.logo_url ?? null;
  return { brandName, brand, logoUrl };
}
