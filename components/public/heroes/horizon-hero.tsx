import { Fragment } from "react";

import type { HeroProps } from "./store-hero";
import { LIQUID_GLASS_CSS } from "./liquid-glass";
import { inkOn } from "@/lib/storefront-brand";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Horizon hero — editorial and understated. The business's own photo shows at
 * FULL STRENGTH with no scrim over it (the deliberate signature of this style:
 * no dimming, no gradient veil), and the copy earns its contrast from a soft
 * text shadow instead of from a layer that flattens the picture. Content sits
 * along the bottom edge: headline, sub and buttons at the inline start, a single
 * frosted glass tag at the inline end on wide screens.
 *
 * The entrance is a character-by-character slide: each glyph starts offset and
 * transparent and settles in sequence. Done in pure CSS with a staggered
 * `animation-delay` per character, so this stays a server component — the
 * reference implementation used React state and a timer for the same effect.
 *
 * Characters are grouped into per-word `inline-block` spans with real text
 * nodes between them, so lines still wrap at spaces instead of mid-word, and
 * the `<h1>` carries an `aria-label` with the intact headline so assistive tech
 * reads a sentence rather than a column of letters.
 */
const START_MS = 200;
const CHAR_MS = 30;
/** Ceiling on the whole stagger: at 30ms a 90-character Hebrew headline would
 *  still be assembling itself three seconds in. */
const MAX_STAGGER_MS = 1400;

export function HorizonHero({
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
  const text = headline || brandName || "";
  const words = text.split(" ").filter(Boolean);
  // Two lines, split evenly — the reference hard-codes its own line break, and
  // a single run of Hebrew would otherwise fill the frame edge to edge.
  const mid = Math.max(1, Math.ceil(words.length / 2));
  const lines = [words.slice(0, mid), words.slice(mid)].filter((l) => l.length > 0);

  const totalChars = text.replace(/\s/g, "").length || 1;
  const step = Math.min(CHAR_MS, MAX_STAGGER_MS / totalChars);
  let charIndex = 0;

  const afterHeadline = START_MS + totalChars * step;

  return (
    <section className="hz-section relative flex flex-col overflow-hidden bg-[#050505]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
      />
      <style>{`
        ${LIQUID_GLASS_CSS}
        .hz-section { min-height: 92vh; }
        @supports (height: 100dvh) { .hz-section { min-height: 92dvh; } }
        /* Inter has no Hebrew coverage — Heebo (the app's variable font) picks
           up the Hebrew, Inter the Latin. */
        .hz-type { font-family: 'Inter', var(--font-sans), sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        /* This style shows the video undimmed, so every piece of copy over it
           carries its own contrast. */
        .hz-shadow { text-shadow: 0 2px 18px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5); }
        .hz-char {
          display: inline-block;
          animation: hz-char-in .5s ease-out both;
        }
        @keyframes hz-char-in {
          0% { opacity: 0; transform: translateX(var(--hz-dx, -18px)); }
          100% { opacity: 1; transform: translateX(0); }
        }
        /* Glyphs enter from the side the reader is coming FROM. The storefront
           is RTL, so that is the right; the LTR value is the reference's. */
        [dir="rtl"] .hz-char { --hz-dx: 18px; }
        @keyframes hz-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        .hz-fade { animation: hz-fade 1s ease-out both; }
        /* The professional tier's gold-gradient h1 replaces the per-character
           fill, which kills the entrance outright. */
        [data-tier="professional"] [data-el="hero"] h1.hz-h1 {
          background: none;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
          font-weight: 400;
          line-height: 1.08;
          font-size: clamp(2.25rem, 1.4rem + 4.2vw, 4.5rem);
          animation: none;
        }
        [data-tier="professional"] [data-el="hero"] p.hz-sub { color: #d1d5db !important; animation: none; }
        /* This style shows its backdrop undimmed, so the motion has to be
           gentler than a scrimmed one — a slow push-in on the owner's photo. */
        @keyframes hz-push {
          0% { transform: scale(1.06); }
          100% { transform: scale(1.13); }
        }
        .hz-push { animation: hz-push 26s ease-in-out infinite alternate both; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .hz-char, .hz-fade {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .hz-push { animation: none !important; transform: none !important; }
        }
      `}</style>

      {/* The business's own photo is the backdrop — uploaded by the owner in
          "אתר ומיתוג", or the one generated for them. */}
      {heroImg ? (
        <>
          <HeroImagePreload src={heroImg} />
          <HeroImage
            src={heroImg}
            className="hz-push absolute inset-0 size-full object-cover"
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(200deg, #050505 20%, color-mix(in srgb, ${brand} 38%, #050505))`,
          }}
        />
      )}

      <div className="hz-type relative z-10 flex flex-1 flex-col justify-end px-6 pb-12 sm:px-10 lg:pb-16">
        <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-2 lg:items-end lg:gap-10">
          <div>
            <h1
              aria-label={text}
              // `hz-type` repeats on the h1 itself: each storefront injects its
              // brand typography as a bare `h1, h2, h3` rule, which outranks an
              // inherited value but not a class.
              className="hz-h1 hz-type hz-shadow mb-4 text-balance text-4xl font-normal text-white md:text-5xl lg:text-6xl"
              style={{ letterSpacing: "-0.04em" }}
            >
              {lines.map((line, li) => (
                <span key={li} className="block" aria-hidden="true">
                  {line.map((word, wi) => (
                    <Fragment key={wi}>
                      {wi > 0 ? " " : null}
                      <span className="inline-block whitespace-nowrap">
                        {Array.from(word).map((ch, ci) => (
                          <span
                            key={ci}
                            className="hz-char"
                            style={{ animationDelay: `${START_MS + charIndex++ * step}ms` }}
                          >
                            {ch}
                          </span>
                        ))}
                      </span>
                    </Fragment>
                  ))}
                </span>
              ))}
            </h1>

            {subheadline && (
              <p
                className="hz-sub hz-fade hz-shadow mb-5 max-w-lg text-base text-gray-300 md:text-lg"
                style={{ animationDelay: `${afterHeadline}ms` }}
              >
                {subheadline}
              </p>
            )}

            <div
              className="hz-fade flex flex-wrap items-center gap-4"
              style={{ animationDelay: `${afterHeadline + 200}ms` }}
            >
              {ctaHref && (
                <a
                  href={ctaHref}
                  className="rounded-lg px-8 py-3 font-medium transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  {ctaText}
                </a>
              )}
              {secondaryHref && secondaryText && (
                <a
                  href={secondaryHref}
                  className="liquid-glass liquid-glass-dark rounded-lg px-8 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {secondaryText}
                </a>
              )}
            </div>

            {socialProof && (
              <p
                className="hz-fade hz-shadow mt-5 text-xs text-white/60"
                style={{ animationDelay: `${afterHeadline + 400}ms` }}
              >
                {socialProof}
              </p>
            )}
          </div>

          {slogan && (
            <div
              className="hz-fade mt-8 flex items-end justify-start lg:mt-0 lg:justify-end"
              style={{ animationDelay: `${afterHeadline + 600}ms` }}
            >
              <p className="liquid-glass liquid-glass-dark rounded-xl px-6 py-3 text-lg font-light text-white md:text-xl lg:text-2xl">
                {slogan}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
