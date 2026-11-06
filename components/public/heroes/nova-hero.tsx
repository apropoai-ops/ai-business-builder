import { Check } from "lucide-react";

import type { HeroProps } from "./store-hero";
import { LIQUID_GLASS_CSS } from "./liquid-glass";
import { brandOnDark } from "@/lib/storefront-brand";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Nova hero — one enormous statement headline, centred, over a deep near-black
 * violet ground. Behind it sits the BUSINESS'S OWN hero photo, breathing on a
 * slow zoom. A single wide, heavily-blurred dark shape floats behind the text —
 * that is what keeps a giant headline legible over a photo without a flat scrim
 * across the whole frame.
 *
 * The last word of the headline takes a brand gradient; everything before it
 * stays plain white. Along the bottom runs an infinite marquee of the site's
 * own trust facts, each in a small frosted glass tile.
 *
 * Server component, no JS at all. Two adaptations from the reference: its
 * headline font (General Sans) is served from a CDN this app's CSP does not
 * allow, so the closest geometric grotesque on Google Fonts stands in; and its
 * indigo → purple → amber gradient becomes a gradient built from the business's
 * own brand colour, since every other surface on the page is brand-driven.
 */

export function NovaHero({
  brand,
  brandName,
  slogan,
  headline,
  subheadline,
  ctaText,
  ctaHref,
  socialProof,
  heroImg,
  marqueeItems,
}: HeroProps) {
  const text = headline || brandName || "";
  const words = text.split(" ").filter(Boolean);
  // The gradient lands on the last word only — the reference's "Power AI".
  const lead = words.slice(0, -1).join(" ");
  const accent = words.length > 1 ? words[words.length - 1] : words[0] ?? brandName;

  // The reference sets a flat 220px, which is a size chosen for the two short
  // English words it ships with. A Hebrew headline three times that long at the
  // same size is a five-line wall, so the ceiling scales with the copy — short
  // headlines still get the full statement treatment.
  const len = text.length;
  const size =
    len <= 14
      ? "clamp(3rem, 1.2rem + 11vw, 13.75rem)"
      : len <= 26
        ? "clamp(2.5rem, 1rem + 8vw, 9rem)"
        : "clamp(2.25rem, 1rem + 5.5vw, 6rem)";

  // A charcoal or navy brand is unreadable as a display word on this near-black
  // ground; lightened until it clears AA, then mixed toward white and a warm
  // tail for the gradient the style is built around.
  const glow = brandOnDark(brand);

  const items = (marqueeItems ?? []).filter((s) => s && s.trim()).slice(0, 6);

  return (
    <section className="nv-section relative flex flex-col overflow-hidden">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap"
      />
      <style>{`
        ${LIQUID_GLASS_CSS}
        .nv-section { min-height: 92vh; background: hsl(260 87% 3%); }
        @supports (height: 100dvh) { .nv-section { min-height: 92dvh; } }
        /* Outfit stands in for the reference's General Sans (Fontshare is not
           on this app's CSP allowlist); Heebo carries the Hebrew. */
        .nv-display { font-family: 'Outfit', var(--font-sans), sans-serif; }
        /* The professional tier's gold h1 gradient would overwrite the
           brand-coloured one this style is built around. */
        [data-tier="professional"] [data-el="hero"] h1.nv-h1 {
          background: none;
          color: #f4f2ef !important;
          -webkit-text-fill-color: #f4f2ef;
          font-weight: 400;
          line-height: 1.02;
          animation: none;
          /* No font-size here — it is set inline, scaled to the length of the
             actual headline. */
        }
        [data-tier="professional"] [data-el="hero"] h1.nv-h1 .nv-accent {
          color: transparent !important;
          -webkit-text-fill-color: transparent;
        }
        [data-tier="professional"] [data-el="hero"] p.nv-sub { color: #d6d3cd !important; animation: none; }
        @keyframes nv-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .nv-track { animation: nv-marquee 20s linear infinite; }
        @keyframes nv-rise {
          0% { opacity: 0; transform: translateY(22px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .nv-rise { animation: nv-rise .9s cubic-bezier(.22,.8,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .nv-track { animation: none !important; }
          .nv-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
          .nv-breathe { animation: none !important; transform: none !important; }
        }
        /* "Breathing" backdrop — this style's original signature was a clip
           that faded in and out on a loop; the same rhythm now belongs to the
           owner's own photo. */
        @keyframes nv-breathe {
          0% { transform: scale(1.05); }
          100% { transform: scale(1.12); }
        }
        .nv-breathe { animation: nv-breathe 24s ease-in-out infinite alternate both; will-change: transform; }
      `}</style>

      {/* Backdrop: the business's OWN hero photo, dimmed hard so the headline
          keeps working, or the flat violet ground on its own. */}
      {heroImg && (
        <>
          <HeroImagePreload src={heroImg} />
          <HeroImage
            src={heroImg}
            className="nv-breathe absolute inset-0 size-full object-cover opacity-45"
          />
        </>
      )}

      {/* The blur pool behind the text. Width is capped against the viewport —
          a fixed 984px block is wider than a phone and would push the page into
          a horizontal scroll if the section did not clip it. */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[527px] w-[min(984px,140vw)] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-90 blur-[82px]"
        style={{ background: "#030712" }}
      />

      <div className="nv-display relative z-10 flex flex-1 flex-col px-6 sm:px-10">
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          {slogan && (
            <span
              className="liquid-glass nv-rise mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-white/80 sm:text-sm"
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
            // `nv-display` repeats on the h1 itself: each storefront injects its
            // brand typography as a bare `h1, h2, h3` rule, which outranks an
            // inherited value but not a class.
            className="nv-h1 nv-display nv-rise max-w-6xl text-balance font-normal leading-[1.02] text-[#f4f2ef] [overflow-wrap:anywhere]"
            // Inline, so it outranks the tier's own hero-h1 clamp without
            // needing !important.
            style={{ fontSize: size, letterSpacing: "-0.024em", animationDelay: ".08s" }}
          >
            {lead && <span>{lead} </span>}
            <span
              className="nv-accent bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to left, ${glow}, color-mix(in srgb, ${glow} 55%, #ffffff), color-mix(in srgb, ${glow} 40%, #fcd34d))`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {accent}
            </span>
          </h1>

          {subheadline && (
            <p
              className="nv-sub nv-rise mt-[9px] max-w-md text-lg leading-8 text-[#e7e4de] opacity-80"
              style={{ animationDelay: ".2s" }}
            >
              {subheadline}
            </p>
          )}

          {ctaHref && (
            <a
              href={ctaHref}
              className="liquid-glass nv-rise mt-6 inline-block rounded-xl px-[29px] py-5 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              style={{ animationDelay: ".32s", boxShadow: `inset 0 1px 1px rgba(255,255,255,.1), 0 0 40px color-mix(in srgb, ${brand} 35%, transparent)` }}
            >
              {ctaText}
            </a>
          )}

          {socialProof && (
            <p className="nv-rise mt-5 text-xs text-white/50" style={{ animationDelay: ".44s" }}>
              {socialProof}
            </p>
          )}
        </div>

        {items.length > 0 && (
          <div className="mx-auto w-full max-w-5xl pb-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-12">
              <p className="max-w-[9rem] shrink-0 text-center text-sm leading-snug text-white/50 sm:text-start">
                למה בוחרים בנו
              </p>
              <div
                // `w-full` matters on mobile: the parent stacks to a column
                // with `items-center`, which shrink-wraps its children — and
                // this one's child is a `w-max` track nearly 3000px wide, so
                // without it the viewport sizes itself to the track and clips
                // nothing.
                className="relative w-full min-w-0 flex-1 overflow-hidden"
                style={{
                  maskImage: "linear-gradient(to left, transparent, black 8%, black 92%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to left, transparent, black 8%, black 92%, transparent)",
                }}
              >
                <div className="nv-track flex w-max gap-16">
                  {[0, 1].map((copy) => (
                    <div key={copy} className="flex shrink-0 gap-16" aria-hidden={copy === 1}>
                      {items.map((item, i) => (
                        <div key={i} className="flex shrink-0 items-center gap-3">
                          <span className="liquid-glass flex size-6 shrink-0 items-center justify-center rounded-lg">
                            <Check className="size-3.5" style={{ color: glow }} />
                          </span>
                          <span className="whitespace-nowrap text-base font-semibold text-[#f4f2ef]">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
