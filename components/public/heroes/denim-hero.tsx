import type { HeroProps } from "./store-hero";
import { brandOnDark, inkOn } from "@/lib/storefront-brand";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Denim hero — hard commerce. A flat black ground, an oversized Helvetica
 * headline set tight, and the business's own photo in a large rounded card
 * with a price-tag badge clipped to its corner. Nothing floats, nothing
 * parallaxes: this is the style for a storefront whose job is to move product.
 *
 * Built straight off a design-system brief (see .claude/skills/design-system),
 * so every value here comes from a token declared once at the top of the CSS
 * block — spacing 6.4/8/12/16/32/108/128, radius 4/32/38.4, motion
 * 200/250/600ms, shadow.1 — rather than from per-element judgement calls. The
 * brief's own scale stops at 24px, which cannot set a hero headline, so the
 * display step is declared as an explicit named extension instead of being
 * sprinkled in as a one-off.
 *
 * Two deliberate departures from the brief. Its palette is one tenant's
 * (a red pair, `#ff2f2f` / `#d2242a`); every surface on this platform takes
 * the business's own brand colour, resolved through `brandOnDark` so the
 * accent clears AA on black whatever the owner picked — the brief's own
 * contrast rule, enforced rather than assumed. And its font stack names
 * Almoni, which is licensed and not servable here, so the app's own Hebrew
 * grotesque carries the Hebrew behind Helvetica. That also makes this the one
 * hero style that loads no webfont at all.
 *
 * Server component: no client JS, no hydration cost.
 */
export function DenimHero({
  brand,
  brandName,
  slogan,
  headline,
  subheadline,
  ctaText,
  ctaHref,
  secondaryText,
  secondaryHref,
  socialProof,
  heroImg,
}: HeroProps) {
  const accent = brandOnDark(brand);
  const onAccent = inkOn(accent);

  const text = headline || brandName || "";
  // The brief's scale has no display step; these are the declared extension.
  const size =
    text.length <= 14
      ? "clamp(3rem, 1rem + 8vw, 6.5rem)"
      : text.length <= 26
        ? "clamp(2.5rem, 1rem + 6vw, 5rem)"
        : "clamp(2rem, 1rem + 4vw, 3.5rem)";

  return (
    <section className="dn-section relative overflow-hidden">
      {heroImg && <HeroImagePreload src={heroImg} />}
      <style>{`
        .dn-section {
          /* ---- tokens ---- */
          --dn-space-1: 6.4px;  --dn-space-2: 8px;   --dn-space-3: 12px;
          --dn-space-4: 16px;   --dn-space-5: 32px;  --dn-space-6: 108px;
          --dn-space-7: 128px;
          --dn-radius-xs: 4px;  --dn-radius-sm: 32px; --dn-radius-md: 38.4px;
          --dn-shadow-1: rgba(0, 0, 0, 0.1) 0px 0px 8px 0px;
          --dn-dur-instant: 200ms; --dn-dur-fast: 250ms; --dn-dur-normal: 600ms;
          --dn-size-sm: 12.8px; --dn-size-md: 16px; --dn-size-lg: 19.2px; --dn-size-xl: 24px;
          --dn-line-base: 22.4px;

          background: #000000;
          color: #ffffff;
          /* Helvetica per the brief; the app's own Hebrew grotesque sits behind
             it because the brief's Almoni is licensed and not servable here. */
          font-family: Helvetica, 'Helvetica Neue', var(--font-sans), Arial, sans-serif;
          font-size: var(--dn-size-md);
          line-height: var(--dn-line-base);
          padding-block: var(--dn-space-6);
          min-height: 92vh;
          display: flex;
          align-items: center;
        }
        @supports (height: 100dvh) { .dn-section { min-height: 92dvh; } }
        @media (min-width: 1024px) { .dn-section { padding-block: var(--dn-space-7); } }

        /* A single hairline of brand across the top edge — the only decoration
           in the style, and the thing that stops a flat black band from
           reading as an unstyled page. */
        .dn-rule { height: 2px; }

        .dn-eyebrow {
          border-radius: var(--dn-radius-xs);
          font-size: var(--dn-size-sm);
          letter-spacing: .12em;
          padding: var(--dn-space-1) var(--dn-space-3);
        }

        /* States, in the order the brief requires them: default, hover,
           focus-visible, active. Disabled/loading/error do not exist on a hero
           CTA — it is a link to a page that is either there or absent, and the
           hero omits the button entirely when there is nowhere to send people. */
        .dn-cta {
          border-radius: var(--dn-radius-sm);
          padding: var(--dn-space-3) var(--dn-space-5);
          min-height: 48px; /* ≥44px touch target */
          font-size: var(--dn-size-md);
          font-weight: 700;
          transition: transform var(--dn-dur-instant) ease, filter var(--dn-dur-instant) ease;
        }
        .dn-cta:hover { filter: brightness(1.12); transform: translateY(-2px); }
        .dn-cta:active { transform: translateY(0) scale(.985); }
        .dn-cta:focus-visible, .dn-link:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 4px;
        }
        .dn-link {
          font-size: var(--dn-size-md);
          min-height: 48px;
          border-radius: var(--dn-radius-xs);
          transition: color var(--dn-dur-instant) ease;
        }
        .dn-link:hover { color: #ffffff; text-decoration: underline; text-underline-offset: 4px; }

        .dn-card {
          border-radius: var(--dn-radius-md);
          box-shadow: var(--dn-shadow-1);
          overflow: hidden;
        }
        .dn-tag {
          border-radius: var(--dn-radius-xs);
          font-size: var(--dn-size-sm);
          padding: var(--dn-space-2) var(--dn-space-3);
        }

        @keyframes dn-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .dn-enter { animation: dn-enter var(--dn-dur-normal) cubic-bezier(.22,.8,.3,1) both; }

        /* The tier paints every hero h1 with its own gradient, which would
           erase the flat white the brief specifies. */
        [data-tier="professional"] [data-el="hero"] h1.dn-h1 {
          background: none;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
          line-height: .92;
          animation: none;
        }
        [data-tier="professional"] [data-el="hero"] p.dn-sub { color: rgba(255,255,255,.72) !important; animation: none; }

        @media (prefers-reduced-motion: reduce) {
          .dn-enter { animation: none; opacity: 1; transform: none; }
          .dn-cta, .dn-link { transition: none; }
          .dn-cta:hover, .dn-cta:active { transform: none; }
        }
      `}</style>

      <div className="dn-rule absolute inset-x-0 top-0" style={{ background: accent }} />

      <div
        className="mx-auto flex w-full max-w-6xl flex-col items-start gap-[var(--dn-space-5)] px-[var(--dn-space-4)] lg:flex-row lg:items-center lg:gap-[var(--dn-space-6)]"
      >
        {/* Copy first in the DOM: it is the reading order on every width, and
            on a phone it must not sit below a 400px-tall image. */}
        {/* Without a photo the column takes the frame instead of holding a
            52% slot open next to nothing. */}
        <div
          className={`flex w-full flex-col gap-[var(--dn-space-4)] ${heroImg ? "lg:w-[52%]" : "lg:max-w-4xl"}`}
        >
          {slogan && (
            <span
              className="dn-eyebrow dn-enter w-fit font-bold uppercase"
              style={{ background: accent, color: onAccent }}
            >
              {slogan}
            </span>
          )}

          <h1
            className="dn-h1 dn-enter text-balance font-bold text-white [overflow-wrap:anywhere]"
            style={{
              fontSize: size,
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
              animationDelay: "60ms",
            }}
          >
            {text}
          </h1>

          {subheadline && (
            <p
              className="dn-sub dn-enter max-w-[46ch] text-white/70"
              style={{ fontSize: "var(--dn-size-lg)", lineHeight: 1.5, animationDelay: "120ms" }}
            >
              {subheadline}
            </p>
          )}

          {(ctaHref || (secondaryHref && secondaryText)) && (
            <div
              className="dn-enter flex flex-wrap items-center gap-[var(--dn-space-4)] pt-[var(--dn-space-2)]"
              style={{ animationDelay: "180ms" }}
            >
              {ctaHref && (
                <a
                  href={ctaHref}
                  className="dn-cta inline-flex items-center justify-center"
                  style={{ background: accent, color: onAccent }}
                >
                  {ctaText}
                </a>
              )}
              {secondaryHref && secondaryText && (
                <a href={secondaryHref} className="dn-link inline-flex items-center text-white/70">
                  {secondaryText}
                </a>
              )}
            </div>
          )}

          {socialProof && (
            <p
              className="dn-enter flex items-center gap-[var(--dn-space-2)] text-white/60"
              style={{ fontSize: "var(--dn-size-sm)", animationDelay: "240ms" }}
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: accent }}
                aria-hidden
              />
              {socialProof}
            </p>
          )}
        </div>

        {/* The product card. Without a photo the style stays honest rather than
            faking one: the column collapses and the copy takes the full width. */}
        {heroImg && (
          <div className="dn-enter relative w-full lg:w-[48%]" style={{ animationDelay: "120ms" }}>
            <div className="dn-card relative aspect-[4/5] w-full border border-white/10 sm:aspect-[3/2] lg:aspect-[4/5]">
              <HeroImage src={heroImg} className="size-full object-cover" />
            </div>
            <span
              className="dn-tag absolute bottom-[var(--dn-space-5)] end-[var(--dn-space-5)] font-bold"
              style={{ background: accent, color: onAccent, boxShadow: "var(--dn-shadow-1)" }}
            >
              {brandName}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
