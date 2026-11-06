import type { DesignTier } from "@/lib/design-tier";
import { safeHexColor } from "@/components/public/tiers/color-utils";
import { designTokenCss, resolveDesignTokens, type DesignTokens } from "@/lib/design-tokens";
import { resolveSiteTheme, type SiteTheme } from "@/lib/site-theme";
import { brandForGround, contrastRatio, inkOn, INK_LIGHT, mixHex } from "@/lib/storefront-brand";

/**
 * The single source of CSS for all three design tiers. Renders ONE <style>
 * tag, scoped entirely under `[data-tier="standard|advanced|professional"]`
 * so a tier's rules can never leak onto another tier's page. Targets the
 * stable `data-el` hooks the storefront integrator stamps onto the real DOM:
 * chrome-header, chrome-nav, hero, module-section, section-title,
 * product-grid, product-card, price, btn-primary, chrome-footer.
 *
 * Server component — no client JS, just server-rendered CSS text. Brand
 * color drives raised surfaces / accents via `color-mix()` so every tier
 * still reads as "this business", just in a different visual league.
 *
 * `theme` is the owner's (or the AI's) COLOUR SCHEME — see lib/site-theme.ts.
 * It only reaches the professional tier, which is the one that paints its own
 * ground; the other two are unreachable in production and keep their original
 * palettes. Omitting it resolves to `midnight`, the black page every site had
 * before schemes existed.
 *
 * `heroStyle` is the site's opening visual, and it is passed here for ONE
 * reason: lib/design-tokens.ts derives the page's geometry and timing from it,
 * so the corners, rhythm and motion of the whole storefront agree with the hero
 * instead of being one hard-coded set for every business. Omitting it resolves
 * to the `sharp` personality — the exact numbers this file carried before
 * tokens existed — so a site with no stored hero renders as it always did.
 */
export function TierStyles({
  tier,
  brand,
  theme,
  heroStyle,
}: {
  tier: DesignTier;
  brand: string;
  theme?: string | null;
  heroStyle?: string | null;
}) {
  const safeBrand = safeHexColor(brand);
  const tokens = resolveDesignTokens(heroStyle);
  const css =
    tier === "advanced"
      ? advancedCss()
      : tier === "professional"
        ? professionalCss(resolveSiteTheme(theme), safeBrand, tokens)
        : standardCss();

  return <style>{`${sharedCss(safeBrand, tokens)}\n${css}`}</style>;
}

/**
 * The landing package's stylesheet (site_mode = 'landing').
 *
 * A landing page is NOT a tier. It renders its own white, brand-tinted design
 * outside the colour-scheme system entirely — that is deliberate, and repainting
 * it in the site scheme would undo a conversion page someone tuned. So this
 * emits `sharedCss()` (tokens, focus rings, ripple, magnetic pull, the
 * reduced-motion kill-switch) plus a short landing-only block, and NONE of the
 * three tier stylesheets.
 *
 * The page carries `data-tier="landing"` for scoping. That value matches no
 * tier selector in this file, so a tier rule can never reach a landing page by
 * accident, while every bare `[data-tier]` rule still applies. That is the
 * whole trick, and it is why the attribute is reused rather than a new one
 * invented: the interaction layer in site-polish.tsx already queries
 * `[data-tier] [data-el="btn-primary"]`, and its ripple leaks a node on any
 * button it can find but cannot animate.
 */
export function LandingStyles({
  brand,
  heroStyle,
}: {
  brand: string;
  heroStyle?: string | null;
}) {
  const safeBrand = safeHexColor(brand);
  return <style>{`${sharedCss(safeBrand, resolveDesignTokens(heroStyle))}
${landingCss()}`}</style>;
}

/**
 * Landing-only rules. Deliberately short: the page's colours, radii and rhythm
 * are already tuned for conversion and are left exactly as they are. The one
 * thing genuinely missing was DEPTH — every card on the page was static, with
 * no response to the pointer at all — so that is the only thing added.
 */
function landingCss(): string {
  return `
    [data-tier="landing"] [data-card] {
      transition: transform var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease);
    }
    @media (hover: hover) and (pointer: fine) {
      [data-tier="landing"] [data-card]:hover,
      [data-tier="landing"] [data-card]:focus-within {
        transform: translateY(-3px);
        box-shadow: 0 18px 34px -20px color-mix(in srgb, var(--brand) 55%, transparent);
      }
    }
  `;
}

/** Rules that apply to every tier: brand var, focus-visible, reduced-motion kill-switch. */
function sharedCss(brand: string, tokens: DesignTokens): string {
  return `
    [data-tier] {
      --brand: ${brand};
      ${designTokenCss(tokens)}
    }

    /* Visible, on-brand focus rings for every interactive element, every tier. */
    [data-tier] :is(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
      border-radius: 2px;
    }

    /* "condensed" layouts (lib/site-layout.ts hints) narrow the CONTENT of a
       section, never the section itself — wrapping the section in a max-w box
       clipped its full-bleed background to 56rem. The wrapper is display:contents
       (no box at all) and the width lands on the section's own children. */
    [data-condensed] > [data-el="module-section"] > *,
    [data-condensed] > * > [data-el="module-section"] > * {
      max-width: 56rem;
      margin-inline: auto;
    }

    /* ── The interaction layer's CSS half (components/public/site-polish.tsx) ──
       The component sets custom properties and appends nodes; the styling of
       what it produces lives here so it inherits the reduced-motion
       kill-switch below instead of re-implementing it in JS.

       MAGNETIC PULL uses the independent \`translate\` property, NOT \`transform\`.
       Every tier already animates \`transform\` on :hover (lift + scale); writing
       the pointer offset into the same property would make the two clobber each
       other, and the last one to run would win at random. \`translate\` composes
       with \`transform\` instead of replacing it. */
    [data-tier] [data-el="btn-primary"] {
      translate: var(--pull-x, 0) var(--pull-y, 0);
      transition: translate .18s cubic-bezier(.22,.8,.3,1);
    }

    /* RIPPLE. Appended on pointerdown and removed on animationend, so nothing
       accumulates in the DOM. currentColor keeps it readable on every CTA fill
       we generate without the component needing to know the button's ink. */
    [data-tier] .sp-ripple {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      background: currentColor;
      opacity: .28;
      transform: scale(0);
      animation: sp-ripple-out .55s cubic-bezier(.22,.8,.3,1) forwards;
    }
    @keyframes sp-ripple-out {
      to { transform: scale(1); opacity: 0; }
    }

    /* ACTIVE SECTION INDICATOR. A growing underline rather than a colour
       change, because on a scheme whose nav ink is already near the accent a
       colour-only state is invisible. */
    [data-tier] [data-el="chrome-nav"] a {
      position: relative;
    }
    [data-tier] [data-el="chrome-nav"] a::after {
      content: "";
      position: absolute;
      inset-inline: 0;
      bottom: -6px;
      height: 2px;
      border-radius: 2px;
      background: var(--brand);
      transform: scaleX(0);
      /* \`center\` on purpose: transform-origin takes no logical keywords, and a
         hard-coded \`right\` would grow the wrong way the moment a section of
         this site renders LTR. Growing from the middle reads correctly in both
         directions. */
      transform-origin: center;
      transition: transform .3s cubic-bezier(.22,.8,.3,1);
    }
    [data-tier] [data-el="chrome-nav"] a:hover::after,
    [data-tier] [data-el="chrome-nav"] a[data-active]::after {
      transform: scaleX(1);
    }
    [data-tier] [data-el="chrome-nav"] a[data-active] { font-weight: 600; }

    /* Global reduced-motion kill-switch for every animation/transition defined
       by this file or the sibling tier components (marquee, statement,
       staged entrances). Canvas particle motion handles its own reduced-motion
       branch in JS since it isn't CSS-driven. */
    @media (prefers-reduced-motion: reduce) {
      [data-tier] * {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    }
  `;
}

/**
 * STANDARD — "סטנדרט" (KSP / הכל-במקום-אחד reference): a light polish of
 * today's storefront, not a rebuild. Assistant-friendly, pill CTAs, small
 * rounded cards with a soft KSP-style shadow, brand-tinted raised surfaces.
 */
// The three tier stylesheets read the brand through the `--brand` custom
// property that sharedCss() defines, so none of them needs the hex itself.
function standardCss(): string {
  return `
    [data-tier="standard"] {
      --raised: color-mix(in srgb, var(--brand) 6%, #eef1f4);
      --hair: color-mix(in srgb, var(--brand) 10%, #e4e7eb);
    }

    [data-tier="standard"] [data-el="chrome-header"] {
      background: color-mix(in srgb, var(--brand) 4%, #ffffff);
      border-bottom: 1px solid var(--hair);
    }

    [data-tier="standard"] [data-el="chrome-nav"] a {
      font-weight: 600;
      border-radius: 999px;
      transition: background-color .18s ease, color .18s ease;
    }
    [data-tier="standard"] [data-el="chrome-nav"] a:hover {
      background: color-mix(in srgb, var(--brand) 10%, transparent);
      color: var(--brand);
    }

    [data-tier="standard"] [data-el="hero"] {
      background: linear-gradient(180deg, var(--raised), transparent 70%);
    }

    [data-tier="standard"] [data-el="module-section"]:nth-of-type(even) {
      background: var(--raised);
    }

    [data-tier="standard"] [data-el="section-title"] {
      position: relative;
      padding-inline-start: 16px;
    }
    [data-tier="standard"] [data-el="section-title"]::before {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      top: .15em;
      bottom: .15em;
      width: 4px;
      border-radius: 3px;
      background: var(--brand);
    }

    [data-tier="standard"] [data-el="product-grid"] { gap: 1.25rem; }

    [data-tier="standard"] [data-el="product-card"] {
      border-radius: 4px !important;
      border-color: var(--hair) !important;
      box-shadow: 0 2px 2px -2px #bdbdbd !important;
      transition: box-shadow .2s ease, transform .2s ease;
    }
    [data-tier="standard"] [data-el="product-card"]:hover {
      box-shadow: 0 8px 18px -8px #bdbdbd !important;
      transform: translateY(-2px);
    }

    [data-tier="standard"] [data-el="price"] { font-weight: 800; }

    [data-tier="standard"] [data-el="btn-primary"] {
      border-radius: 30px !important;
      transition: filter .2s ease, transform .2s ease, box-shadow .2s ease;
    }
    [data-tier="standard"] [data-el="btn-primary"]:hover {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }

    [data-tier="standard"] [data-el="chrome-footer"] {
      background: var(--raised);
      border-top: 1px solid var(--hair);
    }
  `;
}

/**
 * ADVANCED — "מתקדם" (Awwwards reference): editorial monochrome. Thin
 * display type, hairline dividers instead of boxed cards, generous
 * whitespace, numbered product cells, hover-reveal add-to-cart, black
 * statement/marquee bands (styled by their own components), underline nav.
 * Brand color is demoted to exactly one accent moment: the thin rule under
 * section titles. Everything else is ink #222 on white + true-black bands.
 */
function advancedCss(): string {
  return `
    [data-tier="advanced"] {
      --ink: #222;
      --hair: #e4e4e4;
      background: #ffffff;
      color: var(--ink);
      line-height: 1.9;
    }

    [data-tier="advanced"] [data-el="chrome-header"] {
      background: #ffffff;
      border-bottom: 1px solid var(--hair);
    }

    [data-tier="advanced"] [data-el="chrome-nav"] a {
      position: relative;
      font-weight: 300;
      letter-spacing: .02em;
      padding-bottom: 2px;
    }
    [data-tier="advanced"] [data-el="chrome-nav"] a::after {
      content: "";
      position: absolute;
      inset-inline-start: 0;
      bottom: -2px;
      width: 100%;
      height: 1px;
      background: currentColor;
      transform: scaleX(0);
      transform-origin: center;
      transition: transform .3s cubic-bezier(.22,.8,.3,1);
    }
    [data-tier="advanced"] [data-el="chrome-nav"] a:hover::after,
    [data-tier="advanced"] [data-el="chrome-nav"] a:focus-visible::after {
      transform: scaleX(1);
    }

    [data-tier="advanced"] [data-el="hero"] {
      background: #ffffff;
      padding-block: clamp(3rem, 8vw, 8rem);
    }
    [data-tier="advanced"] [data-el="hero"] h1 {
      font-weight: 250;
      letter-spacing: -0.02em;
      line-height: 1.02;
      font-size: clamp(2.75rem, 2.1rem + 3.4vw, 6.5rem);
      color: #111111;
    }
    [data-tier="advanced"] [data-el="hero"] p {
      font-weight: 300;
      letter-spacing: .01em;
      color: #5a5a5a;
      line-height: 1.8;
    }

    [data-tier="advanced"] [data-el="module-section"] {
      background: #ffffff !important;
      border-top: 1px solid var(--hair);
      padding-block: clamp(3rem, 6vw, 7rem);
    }

    [data-tier="advanced"] [data-el="section-title"] {
      font-weight: 250;
      letter-spacing: -0.01em;
      font-size: clamp(1.75rem, 1.35rem + 1.8vw, 3.25rem);
      color: #111111;
      margin-bottom: 2.5rem;
    }
    [data-tier="advanced"] [data-el="section-title"]::after {
      content: "";
      display: block;
      width: 48px;
      height: 1px;
      margin-top: 1rem;
      background: var(--brand);
    }

    /* Borderless, hairline-separated numbered cells instead of boxed cards. */
    [data-tier="advanced"] [data-el="product-grid"] {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 0 !important;
      border-top: 1px solid var(--hair);
      counter-reset: adv-product;
    }
    [data-tier="advanced"] [data-el="product-card"] {
      counter-increment: adv-product;
      position: relative;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      border-bottom: 1px solid var(--hair) !important;
      padding: 2rem 0.5rem 2rem 3.5rem !important;
      transition: background-color .3s cubic-bezier(.22,.8,.3,1);
    }
    [data-tier="advanced"] [data-el="product-card"]::before {
      content: counter(adv-product, decimal-leading-zero);
      position: absolute;
      top: 2rem;
      inset-inline-start: 0;
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-size: .75rem;
      letter-spacing: .08em;
      color: #a3a3a3;
    }
    [data-tier="advanced"] [data-el="product-card"]:hover,
    [data-tier="advanced"] [data-el="product-card"]:focus-within {
      background: #fafafa !important;
    }

    /* Hover-reveal add-to-cart affordance; always visible on touch (no hover). */
    [data-tier="advanced"] [data-el="product-card"] [data-el="btn-primary"] {
      opacity: 0;
      transform: translateY(4px);
      transition: opacity .3s cubic-bezier(.22,.8,.3,1), transform .3s cubic-bezier(.22,.8,.3,1);
    }
    [data-tier="advanced"] [data-el="product-card"]:hover [data-el="btn-primary"],
    [data-tier="advanced"] [data-el="product-card"]:focus-within [data-el="btn-primary"] {
      opacity: 1;
      transform: none;
    }
    @media (hover: none) {
      [data-tier="advanced"] [data-el="product-card"] [data-el="btn-primary"] {
        opacity: 1;
        transform: none;
      }
    }

    [data-tier="advanced"] [data-el="price"] {
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-weight: 400;
      font-size: 1rem;
      color: var(--ink);
    }

    [data-tier="advanced"] [data-el="btn-primary"] {
      background: #111111 !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 8px !important;
      padding-inline: 1.75rem !important;
      padding-block: .85rem !important;
      font-weight: 400;
      letter-spacing: .02em;
      box-shadow: none !important;
      transition: opacity .3s cubic-bezier(.22,.8,.3,1), transform .3s cubic-bezier(.22,.8,.3,1);
    }
    [data-tier="advanced"] [data-el="btn-primary"]:hover {
      opacity: .82;
      transform: translateY(-1px);
    }

    [data-tier="advanced"] [data-el="chrome-footer"] {
      background: #ffffff !important;
      border-top: 1px solid var(--hair);
      color: #666666;
    }
    [data-tier="advanced"] [data-el="chrome-footer"] a { font-weight: 300; }

    /* Staged, editorial-paced reveal for [data-reveal] blocks on this tier. */
    .js-reveal [data-tier="advanced"] [data-reveal] {
      transition: opacity .3s cubic-bezier(.22,.8,.3,1), transform .3s cubic-bezier(.22,.8,.3,1);
    }
  `;
}

/**
 * PROFESSIONAL — "מקצועי" (Active Theory reference): immersive cinematic.
 * Gradient-metal headline, staged rises, brand/accent gradient pill CTAs,
 * glass cards with a glowing accent halo on hover.
 *
 * Every surface, ink and hairline comes from the site's COLOUR SCHEME
 * (`lib/site-theme.ts`) instead of the literal blacks this used to hard-code,
 * so the same layout ships as midnight, navy, forest, espresso or a light
 * porcelain page. `midnight` reproduces the previous values exactly.
 *
 * Two things stay dark on EVERY scheme, on purpose:
 *   - the hero, because the hero components paint their own cinematic dark
 *     artwork underneath (spotlight #0a0a0a, denim #000, orbit #070319 …) and
 *     a light headline is the only thing readable on top of it;
 *   - the Tailwind-utility remap, which exists solely to rescue light-first
 *     markup on a dark ground — on a light scheme the markup is already
 *     correct and remapping it would break exactly what it was meant to fix.
 */
function professionalCss(theme: SiteTheme, brand: string, tokens: DesignTokens): string {
  const dark = theme.mode === "dark";
  // Elevation is applied in TS rather than through a CSS var: the shadows below
  // express strength as a color-mix() PERCENTAGE, and a percentage cannot be
  // multiplied by a custom property inside color-mix().
  const elev = tokens.elevation;

  // The tier's accent — what `--gold` used to be, except it is now MEASURED.
  // A CSS color-mix() can't be checked for contrast, which is how a dark brand
  // on a dark ground produced an unreadable price and a CTA gradient starting
  // at a stop its own label couldn't be read on. Mixed in TS, then lifted (or
  // darkened) until it clears AA on this scheme's hardest surface.
  const accentMix = mixHex(brand, theme.accent, 0.55);
  const accent = brandForGround(accentMix, theme.inkMeasure);
  // The same accent, but readable on the hero's dark artwork rather than on
  // the page — the two grounds differ on a light scheme.
  const heroAccent = dark ? accent : brandForGround(accentMix, "#1d1d1f");
  const heroInk = dark ? theme.ink : "#ffffff";
  const heroFade = dark ? theme.heroFade : "#8a8a8a";
  const heroBody = dark ? theme.inkSoft : "#c6c6c6";
  const heroGround = dark ? theme.ground : "#0a0a0a";

  // Ink for the CTA pill. Its fill is a 3-stop gradient, so the label has to
  // survive the WORST stop, not the average — measured against all three.
  const ctaInk = inkOn(
    [brand, accent, theme.accent].reduce((worst, stop) =>
      contrastRatio(stop, INK_LIGHT) < contrastRatio(worst, INK_LIGHT) ? stop : worst,
    ),
  );

  // A glowing halo reads as premium on a dark page and as a smudge on a light
  // one, where depth comes from a plain drop shadow instead.
  const cardHover = dark
    ? `box-shadow:
        0 0 0 1px color-mix(in srgb, var(--accent) ${Math.round(35 * elev * 1.8)}%, transparent) inset,
        0 ${Math.round(22 * elev * 1.8)}px ${Math.round(46 * elev * 1.8)}px -20px color-mix(in srgb, var(--accent) ${Math.round(65 * elev * 1.8)}%, transparent) !important;`
    : `box-shadow: 0 ${Math.round(18 * elev * 1.8)}px ${Math.round(38 * elev * 1.8)}px -22px rgba(0,0,0,${(0.45 * elev * 1.8).toFixed(2)}) !important;`;

  return `
    [data-tier="professional"] {
      --accent: ${accent};
      /* Retained alias: --gold was this tier's accent for its whole life and
         may still be referenced by content or a custom block. */
      --gold: var(--accent);
      background: ${theme.ground};
      color: ${theme.ink};
    }

    [data-tier="professional"] [data-el="chrome-header"] {
      background: ${theme.headerBg} !important;
      backdrop-filter: blur(var(--glass));
      -webkit-backdrop-filter: blur(var(--glass));
      border-bottom: 1px solid ${theme.hair};
    }
    [data-tier="professional"] [data-el="chrome-nav"] a { color: ${theme.inkSoft}; transition: color .25s ease; }
    [data-tier="professional"] [data-el="chrome-nav"] a:hover { color: ${theme.ink}; }
    /* Header utility triggers (cart / wishlist / account) keep Tailwind zinc
       grays that don't match this scheme's chrome — force scheme equivalents. */
    [data-tier="professional"] [data-el="chrome-header"] .text-zinc-500,
    [data-tier="professional"] [data-el="chrome-header"] .text-zinc-600,
    [data-tier="professional"] [data-el="chrome-header"] .text-zinc-700,
    [data-tier="professional"] [data-el="chrome-header"] .text-zinc-800 { color: ${theme.inkSoft} !important; }
    [data-tier="professional"] [data-el="chrome-header"] a:not([data-el]),
    [data-tier="professional"] [data-el="chrome-header"] button { color: ${theme.inkSoft}; }
    [data-tier="professional"] [data-el="chrome-header"] .hover\\:bg-black\\/5:hover {
      background: ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"} !important;
    }

    [data-tier="professional"] [data-el="hero"] {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      background: ${heroGround};
    }
    [data-tier="professional"] [data-el="hero"] h1 {
      font-weight: 200;
      letter-spacing: -0.02em;
      line-height: 1.05;
      font-size: clamp(2.75rem, 2rem + 4vw, 6.5rem);
      background: linear-gradient(120deg, ${heroInk} 0%, ${heroAccent} 45%, ${heroFade} 100%);
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent !important;
      -webkit-text-fill-color: transparent;
      animation: tier-pro-rise var(--t-slow) var(--ease) both;
    }
    [data-tier="professional"] [data-el="hero"] p {
      color: ${heroBody} !important;
      animation: tier-pro-rise var(--t-slow) .15s var(--ease) both;
    }
    @keyframes tier-pro-rise {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: none; }
    }

    [data-tier="professional"] [data-el="module-section"] {
      background: ${theme.ground} !important;
      color: ${theme.inkSoft};
      padding-block: var(--section-y);
    }
    /* Allowlisted Tailwind-utility remap, scoped strictly inside
       [data-el="module-section"] per the locked contract. The panel + border
       rules run on every scheme (they carry the scheme's own surface); the
       ink and shadow remaps are DARK-ONLY — see the note above the function. */
    [data-tier="professional"] [data-el="module-section"] .bg-white,
    [data-tier="professional"] [data-el="module-section"] .bg-zinc-50 {
      background: ${theme.panel} !important;
    }
    [data-tier="professional"] [data-el="module-section"] .border { border-color: ${theme.hair} !important; }
${
  dark
    ? `    [data-tier="professional"] [data-el="module-section"] .text-zinc-900,
    [data-tier="professional"] [data-el="module-section"] .text-zinc-800 { color: ${theme.ink} !important; }
    [data-tier="professional"] [data-el="module-section"] .text-zinc-700,
    [data-tier="professional"] [data-el="module-section"] .text-zinc-600 { color: ${theme.inkSoft} !important; }
    [data-tier="professional"] [data-el="module-section"] .text-zinc-500,
    [data-tier="professional"] [data-el="module-section"] .text-zinc-400 { color: ${theme.inkDim} !important; }
    [data-tier="professional"] [data-el="module-section"] .shadow-sm {
      box-shadow: 0 0 0 1px ${theme.hair}, 0 8px 30px -14px rgba(0,0,0,.9) !important;
    }`
    : `    /* Light scheme: the markup's own zinc inks were authored for a light
       page and already pass there — left untouched on purpose. */`
}

    /* Section rhythm. Without this every section is the same ground and the
       page reads as one endless column — the rule above is !important on the
       element itself, so a section's own bg-white/inline tint can't survive.
       These two bands are opt-in via data-band and must come AFTER it to win. */
    [data-tier="professional"] [data-el="module-section"][data-band="raised"] {
      background: ${theme.raised} !important;
      border-block: 1px solid ${theme.hair};
    }
    [data-tier="professional"] [data-el="module-section"][data-band="cta"] {
      background:
        radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--brand) 18%, transparent), ${theme.ground} 70%)
        !important;
      border-top: 1px solid ${theme.hair};
    }

    /* Mobile menu panel — the header rule above paints every plain <a> in the
       scheme's ink, which would be invisible on the panel's default white. */
    [data-tier="professional"] [data-el="chrome-menu"] > div {
      background: ${theme.raised} !important;
      border-color: ${theme.hairStrong} !important;
      box-shadow: 0 18px 40px -18px rgba(0,0,0,${dark ? ".95" : ".28"}) !important;
    }
    [data-tier="professional"] [data-el="chrome-menu"] a:hover {
      background: ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"} !important;
    }

    [data-tier="professional"] [data-el="section-title"] {
      font-weight: 200;
      letter-spacing: -0.01em;
      color: ${theme.ink};
      /* The hero h1 scales to 6.5rem; a flat text-3xl section heading left the
         page with no typographic hierarchy below the fold. */
      font-size: clamp(1.75rem, 1.3rem + 1.6vw, 3rem);
      line-height: 1.15;
      margin-bottom: 2rem;
    }

    [data-tier="professional"] [data-el="product-card"] {
      background: ${theme.card} !important;
      border: 1px solid ${theme.hair} !important;
      border-radius: var(--r-card) !important;
      box-shadow: none !important;
      position: relative;
      transition: transform var(--t-base) var(--ease), border-color var(--t-base) ease, box-shadow var(--t-base) ease;
    }
    [data-tier="professional"] [data-el="product-card"]:hover,
    [data-tier="professional"] [data-el="product-card"]:focus-within {
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--accent) 55%, transparent) !important;
      ${cardHover}
    }

    [data-tier="professional"] [data-el="price"] {
      font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
      font-weight: 600;
      color: var(--accent);
    }

    [data-tier="professional"] [data-el="btn-primary"] {
      background: linear-gradient(135deg, var(--brand), var(--accent) 55%, ${theme.accent}) !important;
      color: ${ctaInk} !important;
      border: none !important;
      border-radius: var(--r-pill) !important;
      padding-inline: 2rem !important;
      padding-block: .9rem !important;
      font-weight: 600;
      box-shadow: 0 8px 26px -10px color-mix(in srgb, var(--accent) 70%, transparent);
      transition: transform var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease), filter var(--t-base) ease;
    }
    [data-tier="professional"] [data-el="btn-primary"]:hover {
      transform: translateY(-2px) scale(1.02);
      filter: brightness(1.08);
      box-shadow: 0 14px 34px -10px color-mix(in srgb, var(--accent) 80%, transparent);
    }
    /* In the 64px header the section-CTA sizing above (2rem inline, .9rem
       block) rendered a ~48px pill that swallowed the bar and pushed the icons
       around it. Same accent identity, sized for chrome — and it has to be
       !important because the rule it is narrowing is. */
    [data-tier="professional"] [data-el="chrome-header"] [data-el="btn-primary"] {
      padding-inline: 1.15rem !important;
      padding-block: .5rem !important;
      font-size: .8125rem;
      box-shadow: 0 6px 18px -8px color-mix(in srgb, var(--accent) 70%, transparent);
    }
    [data-tier="professional"] [data-el="chrome-header"] [data-el="btn-primary"]:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px -8px color-mix(in srgb, var(--accent) 80%, transparent);
    }

    [data-tier="professional"] [data-el="chrome-footer"] {
      background: ${dark ? theme.ground : theme.raised} !important;
      border-top: 1px solid ${theme.hair};
      color: ${theme.inkDim};
    }
    [data-tier="professional"] [data-el="chrome-footer"] a { color: ${theme.inkSoft}; }
    [data-tier="professional"] [data-el="chrome-footer"] a:hover { color: ${theme.ink}; }
    [data-tier="professional"] [data-el="chrome-footer"] .text-zinc-800,
    [data-tier="professional"] [data-el="chrome-footer"] .text-zinc-900 { color: ${theme.ink} !important; }
    [data-tier="professional"] [data-el="chrome-footer"] .text-zinc-500,
    [data-tier="professional"] [data-el="chrome-footer"] .text-zinc-600 { color: ${theme.inkDim} !important; }
    /* The social buttons are dark-page glass (bg-white/5) — invisible on a
       light footer, so they get an inverted wash there instead. */
    [data-tier="professional"] [data-el="chrome-footer"] .bg-white\\/5 {
      background: ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"} !important;
      border-color: ${theme.hairStrong} !important;
    }

    /* Staged 400/800ms rises for [data-reveal] blocks on this tier. */
    .js-reveal [data-tier="professional"] [data-reveal] {
      transform: translateY(32px);
      transition: opacity var(--t-base) var(--ease), transform var(--t-slow) var(--ease);
    }
    .js-reveal [data-tier="professional"] [data-reveal].is-visible { transform: none; }
  `;
}
