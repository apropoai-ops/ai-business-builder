import { Crown, ArrowUpRight, Award } from "lucide-react";
import type { HeroProps } from "./store-hero";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Vanguard hero — cinematic, editorial-agency storefront style. Pure CSS,
 * server component (no hooks/JS): a full-bleed backdrop (photo with a slow
 * Ken-Burns drift, or a generative brand gradient when there's no photo)
 * behind a CENTERED content stack built around one dominant, oversized
 * display headline. The signature twist: headline lines alternate between
 * solid white and a hollow outline (text-stroke) treatment, with a brand-color
 * glow and a centered brand rule beneath — fashion-editorial poster energy.
 */
export function VanguardHero(p: HeroProps) {
  const { brand, brandName, slogan, headline, subheadline, ctaText, ctaHref, socialProof, heroImg, seed } = p;

  // Centered poster composition reads best at 2-3 big lines. Split evenly and
  // never drop words — the old fixed slices left a lopsided last line, and an
  // empty headline produced an empty h1.
  const words = (headline || brandName || "ברוכים הבאים").split(" ").filter(Boolean);
  const lineCount = Math.min(3, words.length) || 1;
  const perLine = Math.ceil(words.length / lineCount);
  // A separator like "GOLDEN MEMORY - ..." would otherwise dangle at a line
  // edge once the poster split breaks the sentence there.
  const lines = Array.from({ length: lineCount }, (_, i) =>
    words
      .slice(i * perLine, (i + 1) * perLine)
      .join(" ")
      .replace(/^[\s\-–—|·:]+|[\s\-–—|·:]+$/g, ""),
  ).filter(Boolean);

  // Deterministic-but-varied orb placement so different sites using this
  // gradient backdrop (no heroImg) don't look identical.
  let seedHash = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) seedHash = (seedHash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const orbVariant = seedHash % 2;

  return (
    <section className="vg-section relative flex items-center overflow-hidden bg-[#0a0a0a] px-6 py-20 sm:px-10">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap" />
      <style>{`
        .vg-section { min-height: 92vh; }
        @supports (height: 100dvh) { .vg-section { min-height: 92dvh; } }
        /* Anton is Latin-only — a Hebrew headline fell through to a generic
           system font. Heebo (the app's variable font) carries real display
           weight in Hebrew, so it's the fallback rather than plain sans-serif. */
        .vg-display { font-family: 'Anton', var(--font-sans), sans-serif; }
        /* The professional tier styles EVERY hero h1: gradient fill, weight 200
           and a clamp up to 6.5rem — which erased this hero's entire signature.
           Higher specificity + !important is what wins it back. */
        [data-tier="professional"] [data-el="hero"] h1.vg-h1 {
          background: none;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
          font-size: clamp(2.25rem, 11vw, 8.5rem);
          font-weight: 800;
          line-height: .9;
          letter-spacing: -.02em;
          animation: none;
        }
        [data-tier="professional"] [data-el="hero"] h1.vg-h1 .vg-outline {
          color: transparent !important;
          -webkit-text-fill-color: transparent;
        }
        /* Signature block — the tier paints every hero <p> the same grey. */
        [data-tier="professional"] [data-el="hero"] .vg-sig-name { color: #ffffff !important; }
        @keyframes vg-fade-up {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .vg-fade { animation: vg-fade-up .8s ease-out both; }
        @keyframes vg-kenburns {
          0% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        .vg-kenburns { animation: vg-kenburns 2s ease-out both; }
        .vg-outline {
          color: transparent;
          -webkit-text-stroke: 3px rgba(255,255,255,.92);
        }
        @media (max-width: 640px) {
          .vg-outline { -webkit-text-stroke-width: 1.2px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vg-fade { animation: none !important; opacity: 1 !important; transform: none !important; }
          .vg-kenburns { animation: none !important; transform: none !important; }
        }
      `}</style>

      {/* Background */}
      {heroImg ? (
        <>
          {/* LCP image — the cinematic zoom starts the moment the section
              paints, so the file needs to be in flight before anything else. */}
          <HeroImagePreload src={heroImg} />
          <HeroImage
            src={heroImg}
            className="vg-kenburns absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.72) 60%, color-mix(in srgb, ${brand} 55%, black) 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            // A darkness FLOOR, not full transparency at the centre — the whole
            // text stack sits in the middle of the frame, over bare photo.
            style={{ background: `radial-gradient(90% 90% at 50% 45%, rgba(0,0,0,.3) 35%, rgba(0,0,0,.72) 100%)` }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, #0a0a0a, color-mix(in srgb, ${brand} 30%, #0a0a0a))` }}
          />
          <div
            className="pointer-events-none absolute size-[420px] rounded-full blur-3xl"
            style={
              orbVariant === 0
                ? { background: brand, opacity: 0.25, right: "-8rem", top: "-7rem" }
                : { background: brand, opacity: 0.22, left: "-6rem", top: "-4rem" }
            }
          />
          <div
            className="pointer-events-none absolute size-72 rounded-full blur-3xl"
            style={
              orbVariant === 0
                ? { background: brand, opacity: 0.15, left: "-5rem", bottom: "-4rem" }
                : { background: brand, opacity: 0.14, right: "-4rem", bottom: "-3rem" }
            }
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${brand} 45%, transparent) 1px, transparent 1px)`,
              backgroundSize: "26px 26px",
              maskImage: "radial-gradient(120% 85% at 60% 20%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(120% 85% at 60% 20%, black, transparent 75%)",
            }}
          />
        </>
      )}

      {/* Content — centered poster composition, the headline is the hero */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <div className="flex w-full flex-col items-center text-center">
          {/* No invented fallback copy — an empty slogan hides the badge rather
              than telling every business it's a "קולקטיב יצירתי".
              uppercase + wide tracking is dropped: Hebrew has no case, and the
              letter-spacing shifted the centred block off-axis. */}
          {slogan && (
            <div
              className="vg-fade mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs tracking-[0.12em] text-white/85 [margin-inline-end:-0.12em] sm:text-sm"
              style={{ animationDelay: "0s", borderColor: `color-mix(in srgb, ${brand} 45%, transparent)` }}
            >
              <Crown className="size-4" style={{ color: brand }} />
              <span>{slogan}</span>
            </div>
          )}

          <h1
            className="vg-h1 vg-display max-w-full text-balance uppercase leading-[0.9] tracking-tight text-white text-[clamp(2.25rem,11vw,8.5rem)] [overflow-wrap:anywhere]"
            style={{ textShadow: `0 0 80px color-mix(in srgb, ${brand} 55%, transparent)` }}
          >
            {lines.map((line, i) => (
              <span
                key={i}
                className={`vg-fade block [overflow-wrap:anywhere] ${lines.length > 1 && i % 2 === 1 ? "vg-outline" : ""}`}
                style={{ animationDelay: `${(0.15 + i * 0.08).toFixed(2)}s`, ...(lines.length > 1 && i % 2 === 1 ? { textShadow: "none" } : {}) }}
              >
                {line}
              </span>
            ))}
          </h1>

          {/* Signature centered brand rule — diamond flanked by fading lines.
              Equal margin above and below so it reads as a divider. */}
          <div className="vg-fade mt-8 flex items-center gap-3" style={{ animationDelay: ".3s" }} aria-hidden="true">
            <span className="h-px w-14 sm:w-20" style={{ background: `linear-gradient(270deg, ${brand}, transparent)` }} />
            <span className="size-2 rotate-45" style={{ backgroundColor: brand, boxShadow: `0 0 12px ${brand}` }} />
            <span className="h-px w-14 sm:w-20" style={{ background: `linear-gradient(90deg, ${brand}, transparent)` }} />
          </div>

          {subheadline && (
            <p className="vg-fade mt-8 max-w-xl text-sm text-white/70 sm:text-base" style={{ animationDelay: ".4s" }}>
              {subheadline}
            </p>
          )}

          <div className="vg-fade mt-8 flex flex-wrap items-center justify-center gap-6" style={{ animationDelay: ".5s" }}>
            {ctaHref && (
            <a
              href={ctaHref}
              className="group inline-flex items-center gap-3 px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition hover:scale-[1.03] hover:brightness-110"
              style={{ backgroundColor: `color-mix(in srgb, ${brand} 85%, black)` }}
            >
              {ctaText}
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
            </a>
            )}

            {/* <span>, not <p> — the tier paints every hero <p> the same grey,
                which flattened the two lines into one block. The slogan is
                already in the badge above, so this shows social proof instead. */}
            <div className="hidden items-center gap-2 sm:flex">
              <Award className="size-6 shrink-0" style={{ color: brand }} />
              <div className="text-start leading-tight">
                <span className="vg-sig-name block text-xs font-bold tracking-wide text-white">{brandName}</span>
                {socialProof && <span className="block text-[11px] text-white/60">{socialProof}</span>}
              </div>
            </div>
          </div>

          {/* Mobile only — on ≥sm the signature block beside the CTA carries it. */}
          {socialProof && (
            <p
              className="vg-fade mt-8 text-[11px] tracking-[0.12em] text-white/60 [margin-inline-end:-0.12em] sm:hidden"
              style={{ animationDelay: ".65s" }}
            >
              {socialProof}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
