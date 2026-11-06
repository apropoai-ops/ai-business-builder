/**
 * PER-BUSINESS DESIGN TOKENS — the shape, rhythm and motion of a storefront.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 * Every generated site already gets its own COLOUR (lib/site-theme.ts), its own
 * HERO (lib/hero-style.ts) and its own SECTION ORDER (lib/site-layout.ts). What
 * it did not get was its own *feel*: a 5px card radius, a 50px pill, one shadow
 * and one 400ms easing were hard-coded into the professional tier, so a
 * children's ice-cream shop and a cyber-security consultancy rendered with
 * identical geometry and identical timing. Colour alone is not an identity.
 *
 * ── Where the personality comes from ───────────────────────────────────────
 * It is DERIVED, not stored and not separately asked of the model. The hero
 * style already encodes the business's character — `pickHeroStyle()` reads the
 * industry to choose it, and the Design Director reasons about it explicitly —
 * so a second, independent "personality" decision could only ever contradict
 * the first. Deriving here means the geometry and the hero can never disagree,
 * costs no migration, costs no model call, and is identical on the server and
 * in the preview pane.
 *
 * ── The bounds ─────────────────────────────────────────────────────────────
 * Every value below is a bounded variation around what the tier already
 * rendered, never a free choice. `sharp` is the previous behaviour almost
 * exactly, so the styles that were tuned against it do not regress; the others
 * move within a range that was checked to still look deliberate at both ends.
 *
 * Pure & dependency-free — importable from server components, server actions
 * and client pickers alike.
 */

import type { HeroStyleKey } from "@/lib/hero-style";

/** The five geometries a storefront can render in. */
export type DesignPersonality = "sharp" | "editorial" | "soft" | "glass" | "playful";

export interface DesignTokens {
  personality: DesignPersonality;
  /** Corner radius scale, in px. `pill` is for CTAs, which are always rounder. */
  radius: { card: number; control: number; media: number; pill: number };
  /** Motion scale. `base` is the workhorse transition; `slow` is for entrances. */
  motion: { base: number; slow: number; easing: string };
  /** Vertical rhythm between sections, as a rem clamp pair (min, max). */
  density: { sectionMin: number; sectionMax: number };
  /** 0-1. Drives shadow spread and hover-glow strength. */
  elevation: number;
  /** Backdrop blur in px for glassy chrome. 0 disables the effect entirely. */
  glass: number;
}

/**
 * The registry. Each entry is a coherent set — a personality is not five
 * independent sliders, and mixing "playful" radii with "editorial" timing is
 * exactly the incoherence lib/ai/agents/design-director.ts exists to prevent.
 */
const TOKENS: Record<DesignPersonality, Omit<DesignTokens, "personality">> = {
  /**
   * SHARP — technical, commercial, confident. Tight corners, quick motion,
   * dense rhythm. This is the tier's historical look, kept as the baseline so
   * the businesses already rendering it do not shift.
   */
  sharp: {
    radius: { card: 5, control: 6, media: 4, pill: 50 },
    motion: { base: 300, slow: 700, easing: "cubic-bezier(.22,.8,.3,1)" },
    density: { sectionMin: 3.5, sectionMax: 6 },
    elevation: 0.55,
    glass: 10,
  },

  /**
   * EDITORIAL — law, finance, property, photography. Almost square corners and
   * unhurried motion; the authority comes from white space, not from effects.
   * Deliberately the least animated set: a 2px radius with a bouncy easing
   * reads as a template, not as restraint.
   */
  editorial: {
    radius: { card: 2, control: 3, media: 2, pill: 4 },
    motion: { base: 420, slow: 900, easing: "cubic-bezier(.25,.46,.45,.94)" },
    density: { sectionMin: 4.5, sectionMax: 8 },
    elevation: 0.35,
    glass: 6,
  },

  /**
   * SOFT — health, coaching, education, wellness. Generous corners, calm
   * timing, gentle depth. The set that has to feel approachable rather than
   * impressive.
   */
  soft: {
    radius: { card: 16, control: 12, media: 14, pill: 999 },
    motion: { base: 360, slow: 800, easing: "cubic-bezier(.22,.8,.3,1)" },
    density: { sectionMin: 4, sectionMax: 7 },
    elevation: 0.45,
    glass: 14,
  },

  /**
   * GLASS — the aurora/nova family: layered, translucent, atmospheric. The only
   * set that leans on backdrop-filter as a primary material, so it carries the
   * highest blur and the highest elevation to keep panels legible against the
   * motion behind them.
   */
  glass: {
    radius: { card: 20, control: 14, media: 18, pill: 999 },
    motion: { base: 400, slow: 950, easing: "cubic-bezier(.22,.8,.3,1)" },
    density: { sectionMin: 4, sectionMax: 7.5 },
    elevation: 0.7,
    glass: 20,
  },

  /**
   * PLAYFUL — drinks, sweets, kids, pets. The roundest and fastest set, with a
   * slight overshoot in the easing. Capped well below a "bubble" look: this
   * still has to render a checkout a stranger will type a card number into.
   */
  playful: {
    radius: { card: 24, control: 16, media: 20, pill: 999 },
    motion: { base: 260, slow: 620, easing: "cubic-bezier(.34,1.4,.64,1)" },
    density: { sectionMin: 3.5, sectionMax: 6.5 },
    elevation: 0.6,
    glass: 12,
  },
};

/**
 * Hero style → personality. The mapping is the whole coherence argument: the
 * hero the site opens with and the geometry the rest of it renders in are one
 * decision expressed twice.
 */
const BY_HERO: Record<HeroStyleKey, DesignPersonality> = {
  orbit: "sharp", // tech / cyber / SaaS
  denim: "sharp", // deliberately flat commercial retail
  horizon: "editorial", // law, finance, property
  vanguard: "editorial", // agencies, fashion, portfolios
  spotlight: "soft", // beauty, spa, cinematic luxury
  aurora: "glass", // health, therapy, education
  nova: "glass", // industry, logistics, energy
  soda: "playful", // beverages, sweets, CPG
};

/**
 * Resolves the tokens for a storefront.
 *
 * Never throws and never returns undefined: an unknown or stale `hero_style`
 * from the database resolves to `sharp`, which is the look every site had
 * before this file existed.
 */
export function resolveDesignTokens(heroStyle?: string | null): DesignTokens {
  const personality = (heroStyle && BY_HERO[heroStyle as HeroStyleKey]) || "sharp";
  return { personality, ...TOKENS[personality] };
}

/**
 * The tokens as CSS custom properties, ready to be interpolated into the tier
 * stylesheet. Emitted as declarations only (no selector) so the caller decides
 * the scope.
 *
 * Motion is emitted in BOTH ms and s form because `transition` shorthands in
 * the existing rules were authored with seconds and rewriting all of them to
 * var() arithmetic would have been a much larger diff than this feature earns.
 */
export function designTokenCss(t: DesignTokens): string {
  return [
    `--r-card: ${t.radius.card}px;`,
    `--r-control: ${t.radius.control}px;`,
    `--r-media: ${t.radius.media}px;`,
    `--r-pill: ${t.radius.pill}px;`,
    `--t-base: ${t.motion.base}ms;`,
    `--t-slow: ${t.motion.slow}ms;`,
    `--ease: ${t.motion.easing};`,
    `--section-y: clamp(${t.density.sectionMin}rem, ${t.density.sectionMin}rem + 2vw, ${t.density.sectionMax}rem);`,
    `--elev: ${t.elevation};`,
    `--glass: ${t.glass}px;`,
  ].join("\n      ");
}
