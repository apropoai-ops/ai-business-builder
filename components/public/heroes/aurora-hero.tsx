import { ArrowLeft } from "lucide-react";

import type { HeroProps } from "./store-hero";
import { LIQUID_GLASS_CSS } from "./liquid-glass";
import { inkOn } from "@/lib/storefront-brand";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Aurora hero — calm, premium, "liquid glass over the business's own photo".
 * The owner's hero image fills the frame on a slow drift; every piece of chrome
 * on top of it is a frosted glass panel (see ./liquid-glass) rather than a solid
 * card, so the picture reads through the UI instead of being boxed out by it.
 * Content sits in the bottom inline-start corner, which leaves the upper two
 * thirds of the image clear — the composition the style depends on.
 *
 * The backdrop is deliberately the OWNER'S image and never stock footage: this
 * hero is the first thing a visitor sees, and it has to show that business.
 *
 * Server component, no JS: the entrance and the drift are both CSS.
 *
 * Adapted from the reference design in two deliberate ways: the reference's
 * in-hero navbar is dropped (the storefront already renders its own header
 * directly above this section, so a second nav would be a duplicate), and the
 * reference's white primary button becomes the business's brand colour, which
 * is what carries identity across the rest of the page.
 */
export function AuroraHero({
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
  return (
    <section className="au-section relative flex items-end overflow-hidden bg-[#07070a]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap"
      />
      <style>{`
        ${LIQUID_GLASS_CSS}
        .au-section { min-height: 92vh; }
        @supports (height: 100dvh) { .au-section { min-height: 92dvh; } }
        /* Geist carries no Hebrew glyphs, so Hebrew copy resolves to Heebo (the
           app's variable font) and Latin brand names get Geist. Naming Geist
           first without a real Hebrew fallback is what produces the flat
           system-font look on a Hebrew headline. */
        .au-type { font-family: 'Geist', var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        /* The professional tier paints every hero h1 with a gold gradient at
           weight 200 — which erases this style's quiet, medium-weight white
           headline. Same override pattern the vanguard hero uses. */
        [data-tier="professional"] [data-el="hero"] h1.au-h1 {
          background: none;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.1;
          font-size: clamp(2.25rem, 1.6rem + 3.4vw, 3.75rem);
          animation: none;
        }
        [data-tier="professional"] [data-el="hero"] p.au-sub { color: rgba(255,255,255,.62) !important; animation: none; }
        @keyframes au-rise {
          0% { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .au-rise { animation: au-rise .8s cubic-bezier(.22,.8,.3,1) both; }
        /* The motion this style is built around now comes from the BUSINESS'S
           OWN photo drifting, not from a stock clip. Slow and small on purpose:
           a hero photo is someone's real shopfront, not footage. */
        @keyframes au-drift {
          0% { transform: scale(1.08) translate3d(0, 0, 0); }
          100% { transform: scale(1.14) translate3d(-1.5%, -1.5%, 0); }
        }
        .au-drift { animation: au-drift 22s ease-in-out infinite alternate both; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .au-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
          .au-drift { animation: none !important; transform: none !important; }
        }
      `}</style>

      {/* The backdrop IS the owner's photo — uploaded in "אתר ומיתוג", or the
          one the generator made for them. No stock footage: a business's hero
          should show that business. */}
      {heroImg ? (
        <>
          <HeroImagePreload src={heroImg} />
          <HeroImage
            src={heroImg}
            className="au-drift absolute inset-0 size-full object-cover"
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 100% at 70% 15%, color-mix(in srgb, ${brand} 32%, #07070a), #07070a 72%)`,
          }}
        />
      )}

      {/* Bottom-weighted scrim. The reference sits on a clip that is dark
          exactly where its copy lands; this one carries arbitrary business
          headlines over an arbitrary hero photo, so the contrast has to be
          guaranteed rather than borrowed from the footage. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.82)_0%,rgba(0,0,0,.42)_40%,rgba(0,0,0,0)_78%)]" />

      <div className="au-type relative z-10 w-full px-6 pb-12 sm:px-10 sm:pb-16">
        <div className="mx-auto w-full max-w-5xl">
          <div className="max-w-2xl">
            {slogan && (
              <span
                className="liquid-glass au-rise mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/85 sm:text-sm"
                style={{ animationDelay: "0s" }}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: brand, boxShadow: `0 0 10px ${brand}` }}
                />
                {slogan}
              </span>
            )}

            <h1
              // `au-type` is repeated on the h1 itself, not just inherited from
              // the wrapper: each storefront injects its brand typography as a
              // bare `h1, h2, h3` rule, which outranks an inherited value but
              // not a class. Same reason vanguard puts `vg-display` on its h1.
              className="au-h1 au-type au-rise text-balance text-4xl font-medium leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
              style={{ animationDelay: ".1s" }}
            >
              {headline || brandName}
            </h1>

            {subheadline && (
              <p
                className="au-sub au-rise mt-4 max-w-md text-sm leading-relaxed text-white/60"
                style={{ animationDelay: ".22s" }}
              >
                {subheadline}
              </p>
            )}

            <div
              className="au-rise mt-7 flex flex-wrap items-center gap-3"
              style={{ animationDelay: ".34s" }}
            >
              {ctaHref && (
                <a
                  href={ctaHref}
                  className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-7 sm:text-base"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  {ctaText}
                  {/* Points left because the page is RTL — left IS forward. */}
                  <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
                </a>
              )}
              {/* Only when the page actually has a second place to send people;
                  a glass button over a dead href="#" is worse than one button. */}
              {secondaryHref && secondaryText && (
                <a
                  href={secondaryHref}
                  className="liquid-glass inline-block rounded-full px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-7 sm:text-base"
                >
                  {secondaryText}
                </a>
              )}
            </div>

            {socialProof && (
              <p className="au-rise mt-6 text-xs text-white/55" style={{ animationDelay: ".46s" }}>
                {socialProof}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
