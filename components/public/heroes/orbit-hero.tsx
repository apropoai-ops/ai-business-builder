"use client";

import { useEffect, useRef } from "react";
import type { HeroProps } from "./store-hero";

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Up to 6 short initials from the brand name to label the orbit dots.
 * Unique only — repeating the same letter three times around the ring reads as
 * a bug, and the angular spread below adapts to however many we end up with.
 */
function orbitInitials(brandName: string): string[] {
  const words = brandName.trim().split(/\s+/).filter(Boolean);
  const chars = words.length > 1 ? words.map((w) => w[0]) : brandName.replace(/\s+/g, "").split("");
  const uniq = Array.from(new Set(chars.filter(Boolean)));
  while (uniq.length < 3) uniq.push("•");
  return uniq.slice(0, 6);
}

// Ratios of the container size (not px) so the whole composition shrinks with
// the box on mobile instead of being `scale()`d — a scaled box still reserves
// its full layout height, which left ~140px of dead space under it.
const RING_RATIOS = [0.45, 0.625, 0.8, 1];
const RING_DURATIONS = ["34s", "46s", "58s", "70s"];
/** Dot orbit radius, as a share of the container's half-width. */
const DOT_RADIUS_PCT = 37.5;

/**
 * Orbit hero — dark, tech-forward storefront style. Client component: a
 * char-by-char typewriter headline, slowly rotating orbit rings with static
 * avatar dots, and a count-up stat in the center. All animation state lives in
 * refs/DOM writes (never React state set synchronously in an effect body).
 */
export function OrbitHero(p: HeroProps) {
  const { brand, brandName, slogan, headline, subheadline, ctaText, ctaHref, socialProof, seed } = p;
  const typeRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const fullHeadline = headline || brandName;
  const target = 500 + hashSeed(seed || brandName) % 4500;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Typewriter — write directly to the DOM via refs, never via setState.
    if (reduced) {
      if (typeRef.current) typeRef.current.textContent = fullHeadline;
      if (cursorRef.current) cursorRef.current.style.display = "none";
    } else {
      let i = 0;
      const id = setInterval(() => {
        i++;
        if (typeRef.current) typeRef.current.textContent = fullHeadline.slice(0, i);
        if (i >= fullHeadline.length) {
          clearInterval(id);
          if (cursorRef.current) cursorRef.current.style.opacity = "0";
        }
      }, 35);
      return () => clearInterval(id);
    }
  }, [fullHeadline]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (countRef.current) countRef.current.textContent = `+${target.toLocaleString("he-IL")}`;
      return;
    }
    const duration = 2000;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      if (countRef.current) countRef.current.textContent = `+${Math.round(eased * target).toLocaleString("he-IL")}`;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const initials = orbitInitials(brandName);

  return (
    <section
      className="relative overflow-hidden px-4 py-20"
      style={{ background: `linear-gradient(160deg, #070319, color-mix(in srgb, ${brand} 22%, #070319))` }}
    >
      <style>{`
        @property --orbit-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes orbit-spin { to { transform: rotate(360deg); } }
        @keyframes orbit-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes orbit-cursor-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .orbit-cursor { animation: orbit-cursor-blink 1s step-end infinite; }
        @keyframes orbit-dot-in {
          0% { opacity: 0; transform: scale(.3); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        .orbit-dot { animation: orbit-dot-in .7s cubic-bezier(.22,1,.36,1) both; }
        @keyframes orbit-border-spin { to { --orbit-angle: 360deg; } }
        .orbit-cta-border {
          background: conic-gradient(from var(--orbit-angle, 0deg), ${brand}, #070319, ${brand}, #070319, ${brand});
          animation: orbit-border-spin 4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .orbit-ring, .orbit-dot, .orbit-cta-border, .orbit-cursor {
            animation: none !important;
          }
          .orbit-cursor { opacity: 0 !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute -top-24 right-0 size-[420px] rounded-full blur-3xl"
          style={{ background: brand, opacity: 0.18 }}
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        {/* Copy first on mobile — the decorative orbit used to push the headline
            below the fold on a phone. */}
        <div className="order-1 text-center md:text-right">
          {slogan && <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/50">{slogan}</p>}
          {/* The size is pinned with `!` because the professional tier sets an
              unlayered clamp(...6.5rem) on every hero h1 — at that size a
              half-column headline collapsed the two-column layout.
              Two stacked layers in one grid cell: an invisible one carries the
              real text for the server HTML / SEO / screen readers and locks in
              the final height (no CLS), the visible one is typed out. */}
          <h1
            className="grid text-balance text-white"
            style={{
              fontSize: "clamp(1.75rem, 1.1rem + 2.2vw, 3.25rem)",
              fontWeight: 700,
              lineHeight: 1.12,
            }}
          >
            <span className="invisible col-start-1 row-start-1">{fullHeadline}</span>
            <span className="col-start-1 row-start-1" aria-hidden="true">
              <span ref={typeRef} />
              <span ref={cursorRef} className="orbit-cursor" style={{ color: brand }}>
                |
              </span>
            </span>
          </h1>
          {subheadline && <p className="mx-auto mt-5 max-w-md text-balance text-white/70 md:mx-0">{subheadline}</p>}

          {ctaHref && (
          <div className="mt-8 flex justify-center md:justify-start">
            <div className="orbit-cta-border inline-block rounded-full p-[3px]">
              <a
                href={ctaHref}
                // Solid hover, not bg-white/10 — this button is the opaque core
                // of the spinning conic border, and any transparency exposes it.
                className="block rounded-full bg-[#070319] px-8 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#171034] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {ctaText}
              </a>
            </div>
          </div>
          )}
          {socialProof && <p className="mt-5 text-xs text-white/50">{socialProof}</p>}
        </div>

        <div className="order-2 flex justify-center" aria-hidden="true">
          <div className="relative size-[260px] sm:size-[320px] md:size-[400px]">
            {RING_RATIOS.map((ratio, i) => (
              <div
                key={ratio}
                className="orbit-ring absolute rounded-full"
                style={{
                  width: `${ratio * 100}%`,
                  height: `${ratio * 100}%`,
                  top: `calc(50% - ${(ratio * 100) / 2}%)`,
                  left: `calc(50% - ${(ratio * 100) / 2}%)`,
                  background: `conic-gradient(from ${i * 40}deg, transparent 0%, ${brand}66 25%, transparent 50%, ${brand}33 75%, transparent 100%)`,
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  animation: `${i % 2 === 0 ? "orbit-spin" : "orbit-spin-rev"} ${RING_DURATIONS[i]} linear infinite`,
                }}
              />
            ))}

            {/* Center count-up stat */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
              <span ref={countRef} dir="ltr" className="text-3xl font-extrabold tabular-nums text-white">
                +0
              </span>
              {/* Deliberately NOT socialProof — that line already renders under
                  the CTA, and pairing the owner's real copy with this generated
                  number read as if the number were theirs. */}
              <span className="mt-1 max-w-[9rem] text-[11px] leading-snug text-white/50">לקוחות מרוצים</span>
            </div>

            {/* Static avatar dots placed around the rings (not rotating). */}
            {initials.map((ch, i) => {
              const angle = (360 / initials.length) * i - 90;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * DOT_RADIUS_PCT;
              const y = Math.sin(rad) * DOT_RADIUS_PCT;
              const rounded = i % 2 === 0 ? "rounded-full" : "rounded-xl";
              return (
                // Outer div only positions the dot (translate is fixed, never animated) so
                // disabling the entrance animation under reduced-motion can't shift it off-center.
                <div
                  key={i}
                  className="absolute"
                  style={{ left: `calc(50% + ${x}%)`, top: `calc(50% + ${y}%)`, transform: "translate(-50%, -50%)" }}
                >
                  <div
                    className={`orbit-dot flex size-10 items-center justify-center ${rounded} text-sm font-bold text-white`}
                    style={{
                      background: `linear-gradient(140deg, ${brand}, color-mix(in srgb, ${brand} 55%, #070319))`,
                      boxShadow: `0 0 18px ${brand}66`,
                      animationDelay: `${0.15 * i}s`,
                    }}
                  >
                    {ch}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
