"use client";

import { useEffect, useRef } from "react";
import type { HeroProps } from "./store-hero";
import { inkOn } from "@/lib/storefront-brand";
import { HeroImage } from "@/components/public/hero-image";

/**
 * Spotlight hero — cinematic, full-bleed storefront style. Client component:
 * a soft circular "spotlight" reveals a vivid color layer over a desaturated
 * base image (or a generative gradient when there's no hero photo) following
 * the cursor. Cursor position lives entirely in refs/DOM writes — never React
 * state — so the effect never re-renders the component.
 */
export function SpotlightHero({ brand, brandName, slogan, headline, subheadline, ctaText, ctaHref, socialProof, heroImg }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ curX: 50, curY: 38, tgtX: 50, tgtY: 38 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    const section = sectionRef.current;
    const layer = revealRef.current;
    if (!section || !layer) return;

    if (reduced || noHover) {
      // No pointer to follow — drop the mask entirely rather than leaving a
      // static circle, which reads as a smudge on a phone. The vivid layer then
      // covers the desaturated base completely, which is the intent.
      layer.style.maskImage = "none";
      layer.style.webkitMaskImage = "none";
      return;
    }

    let raf = 0;
    let running = true;
    const tick = () => {
      const p = posRef.current;
      p.curX += (p.tgtX - p.curX) * 0.1;
      p.curY += (p.tgtY - p.curY) * 0.1;
      layer!.style.setProperty("--sx", `${p.curX}%`);
      layer!.style.setProperty("--sy", `${p.curY}%`);
      if (Math.abs(p.tgtX - p.curX) < 0.05 && Math.abs(p.tgtY - p.curY) < 0.05) {
        p.curX = p.tgtX;
        p.curY = p.tgtY;
        layer!.style.setProperty("--sx", `${p.curX}%`);
        layer!.style.setProperty("--sy", `${p.curY}%`);
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    function onMove(e: MouseEvent) {
      const rect = section!.getBoundingClientRect();
      posRef.current.tgtX = ((e.clientX - rect.left) / rect.width) * 100;
      posRef.current.tgtY = ((e.clientY - rect.top) / rect.height) * 100;
      // The loop parks itself once the spotlight catches up — restart it when
      // the cursor moves again instead of burning a frame forever.
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    }

    section.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      section.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const words = (headline || brandName).split(" ").filter(Boolean);
  const mid = Math.max(1, Math.ceil(words.length / 2));
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");

  // --sr keeps the spotlight proportional to the viewport instead of a fixed
  // 260px disc that looked like a stain on a phone and a pinhole on a 4K screen.
  const maskImage =
    "radial-gradient(circle var(--sr,40vmin) at var(--sx,50%) var(--sy,38%), black 0%, black 40%, rgba(0,0,0,.55) 62%, transparent 100%)";
  const maskStyle = { maskImage, WebkitMaskImage: maskImage } as const;

  return (
    <section ref={sectionRef} className="spot-section relative flex items-end overflow-hidden bg-[#0a0a0a]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=David+Libre:wght@500&display=swap"
      />
      <style>{`
        .spot-section { min-height: 92vh; --sr: 40vmin; }
        @supports (height: 100dvh) { .spot-section { min-height: 92dvh; } }
        @media (min-width: 1024px) { .spot-section { --sr: 300px; } }
        /* Hebrew first: Playfair Display has no Hebrew glyphs, so an italic
           serif on a Hebrew headline produced a fake-slanted system font.
           The contrast with line 2 now comes from serif-vs-sans + weight. */
        .spot-serif { font-family: 'David Libre', 'Playfair Display', serif; font-weight: 500; letter-spacing: -.01em; }
        @keyframes spot-kenburns { 0% { transform: scale(1.12); } 100% { transform: scale(1); } }
        .spot-kenburns { animation: spot-kenburns 1.8s ease-out both; }
        @keyframes spot-reveal {
          0% { opacity: 0; transform: translateY(24px); filter: blur(10px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .spot-reveal { animation: spot-reveal .9s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .spot-kenburns { animation: none !important; transform: none !important; }
          .spot-reveal { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
        }
      `}</style>

      {heroImg ? (
        <>
          <HeroImage
            src={heroImg}
            className="spot-kenburns absolute inset-0 size-full object-cover"
            style={{ filter: "grayscale(.55) brightness(.55)" }}
          />
          <div
            ref={revealRef}
            className="absolute inset-0"
            style={maskStyle}
          >
            <HeroImage
              src={heroImg}
              className="absolute inset-0 size-full object-cover"
              style={{ filter: "saturate(1.15) brightness(1.05)" }}
            />
          </div>
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(120% 90% at 50% 10%, color-mix(in srgb, ${brand} 30%, #0a0a0a), #0a0a0a 70%)` }}
          />
          <div ref={revealRef} className="absolute inset-0" style={maskStyle}>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${brand}, color-mix(in srgb, ${brand} 45%, #ffffff) 40%, color-mix(in srgb, ${brand} 60%, #0a0a0a) 75%, ${brand})`,
              }}
            />
          </div>
        </>
      )}

      {/* Monotonic scrim — the old via-black/10 left a bright band across the
          middle of the image, right where the eye lands. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.85)_0%,rgba(0,0,0,.45)_38%,rgba(0,0,0,.12)_100%)]" />

      <div className="relative z-10 w-full px-4 pb-16 sm:pb-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl text-white">
            {/* Both lines set their own colour: the professional tier paints
                every hero h1 with one gold gradient, which erased the
                serif/sans contrast this hero is built on. */}
            <h1 className="text-balance text-4xl leading-[1.1] sm:text-6xl">
              {line1 && (
                <span
                  className="spot-reveal spot-serif block text-white/90 [-webkit-text-fill-color:currentColor]"
                  style={{ animationDelay: ".1s" }}
                >
                  {line1}
                </span>
              )}
              {line2 && (
                <span
                  className="spot-reveal block font-bold text-white [-webkit-text-fill-color:currentColor]"
                  style={{ animationDelay: ".28s" }}
                >
                  {line2}
                </span>
              )}
            </h1>
            {subheadline && (
              <p className="spot-reveal mt-5 max-w-lg text-balance text-white/80" style={{ animationDelay: ".42s" }}>
                {subheadline}
              </p>
            )}
          </div>

          {/* text-end, not text-right — under RTL the physical value fought the
              logical items-end and split the block's alignment. */}
          <div className="flex flex-col items-start gap-3 sm:items-end sm:text-end">
            {slogan && <p className="max-w-xs text-sm text-white/80">{slogan}</p>}
            {ctaHref && (
            <a
              href={ctaHref}
              className="inline-block rounded-full px-7 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.05] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:scale-100"
              style={{ backgroundColor: brand, color: inkOn(brand), boxShadow: `0 8px 30px ${brand}66` }}
            >
              {ctaText}
            </a>
            )}
            {socialProof && <p className="text-xs text-white/60">{socialProof}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
