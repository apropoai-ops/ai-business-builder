"use client";

import { useEffect, useRef, useState } from "react";
import { Award } from "lucide-react";

import type { HeroProps } from "./store-hero";
import { brandOnDark, inkOn } from "@/lib/storefront-brand";
import { HeroImage, HeroImagePreload } from "@/components/public/hero-image";

/**
 * Soda hero — playful "product in a fizzy void". A deep radial gradient built
 * from the brand colour fills the section, translucent bubbles rise endlessly
 * from the bottom, glassy orbs drift on three parallax layers and are REPELLED
 * by the pointer like a force field, and the business's own hero photo floats
 * dead centre, tilting toward the cursor in 3D.
 *
 * Its signature is the mood switch in the corner: clicking a chip morphs the
 * background gradient, spins the product 720° through a motion blur while
 * swapping its tint at the peak of the spin, and implodes every orb toward the
 * centre before exploding it back out to fresh random positions.
 *
 * Adapted from a reference that did all of this with <model-viewer> GLB models,
 * GSAP and `body { overflow: hidden }`. None of the three survives contact with
 * a real storefront: the CDNs are not on this app's CSP allowlist, a WebGL
 * engine per storefront is a heavy price for decoration, and locking body
 * scroll would break every page this hero sits on top of. So the choreography
 * is reproduced with the same fixed numbers (parallax ×60/-30/-15, repulsion
 * radius 400px at strength -80 with a 0.1 lerp, implode 0.5s → hold 0.3s →
 * explode 0.9s to ±100px, 1.2s background morph) driven by one rAF loop and
 * plain CSS. The reference's two soda flavours become two brand-derived moods,
 * and its pink accent becomes the business's own colour, since every other
 * surface on the page is brand-driven.
 *
 * All pointer state lives in refs and is written straight to the DOM — React
 * state only ever changes on a click. The loop and the bubble spawner both
 * park themselves when the hero scrolls out of view.
 */

type Orb = { top: number; left: number; size: number; near: boolean; opacity: number };

/** The reference's berry grid, kept at its original positions and sizes. */
const ORBS: Orb[] = [
  { top: 25, left: 30, size: 220, near: true, opacity: 0.5 },
  { top: 60, left: 42, size: 100, near: true, opacity: 0.65 },
  { top: 30, left: 62, size: 250, near: true, opacity: 0.42 },
  { top: 15, left: 48, size: 140, near: true, opacity: 0.55 },
  { top: 75, left: 20, size: 120, near: true, opacity: 0.6 },
  { top: 45, left: 75, size: 180, near: true, opacity: 0.5 },
  { top: 15, left: 40, size: 80, near: false, opacity: 0.7 },
  { top: 50, left: 55, size: 70, near: false, opacity: 0.6 },
  { top: 80, left: 35, size: 75, near: false, opacity: 0.7 },
];

/** The reference's four background leaves — soft blurred blobs here. */
const BLOBS = [
  { top: 10, left: 15, size: 160, opacity: 0.5 },
  { top: 40, left: 80, size: 280, opacity: 0.4 },
  { top: 70, left: 75, size: 200, opacity: 0.5 },
  { top: 85, left: 20, size: 240, opacity: 0.3 },
];

/** Per-orb float periods, straight from the reference. */
const FLOAT_DUR = [5, 7, 6, 8, 5.5, 6.5, 9, 11, 10];

const MOODS = ["קלאסי", "לילה"];

/**
 * The two background moods. The first is the brand colour lit from the centre;
 * the second is a cold night that keeps only a whisper of it — so the pair
 * stays visibly different whatever colour the business picked, which a
 * naive "brand vs. shifted brand" pair does not (a blue brand would give two
 * identical blues).
 */
function moodVars(brand: string, i: number) {
  return i === 1
    ? {
        "--sd-inner": `color-mix(in srgb, ${brand} 22%, #0d1b2a)`,
        "--sd-mid": `color-mix(in srgb, ${brand} 9%, #060d16)`,
        "--sd-outer": "#02040a",
      }
    : {
        "--sd-inner": `color-mix(in srgb, ${brand} 70%, #001014)`,
        "--sd-mid": `color-mix(in srgb, ${brand} 30%, #001014)`,
        "--sd-outer": `color-mix(in srgb, ${brand} 8%, #000000)`,
      };
}

export function SodaHero({
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
  const sectionRef = useRef<HTMLElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const deepRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const switching = useRef(false);
  const timers = useRef<number[]>([]);
  const orbState = useRef(
    ORBS.map((_, i) => ({ rx: 0, ry: 0, baseX: 0, baseY: 0, angle: (i * 137) % 360 })),
  );

  // The background swaps the moment the chip is clicked; the product's tint
  // waits for the peak of the spin, exactly as the reference swaps its texture.
  const [mood, setMood] = useState(0);
  const [prodMood, setProdMood] = useState(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const orbs = Array.from(section.querySelectorAll<HTMLElement>("[data-orb]"));
    const blobs = Array.from(section.querySelectorAll<HTMLElement>("[data-blob]"));
    const near = nearRef.current;
    const far = farRef.current;
    const deep = deepRef.current;
    const product = productRef.current;

    // Parked far outside the section so nothing is repelled before the pointer
    // has ever entered it.
    const m = { x: 0, y: 0, cx: 0, cy: 0, px: -99999, py: -99999 };

    function onMove(e: MouseEvent) {
      const r = section!.getBoundingClientRect();
      m.x = (e.clientX - r.left) / r.width - 0.5;
      m.y = (e.clientY - r.top) / r.height - 0.5;
      m.px = e.clientX;
      m.py = e.clientY;
    }
    function onLeave() {
      m.x = 0;
      m.y = 0;
      m.px = -99999;
      m.py = -99999;
    }

    let raf = 0;
    let live = false;

    const tick = () => {
      const t = performance.now() * 0.001;
      m.cx += (m.x - m.cx) * 0.05;
      m.cy += (m.y - m.cy) * 0.05;

      if (near) near.style.transform = `translate(${m.cx * 60}px, ${m.cy * 60}px)`;
      if (far) far.style.transform = `translate(${m.cx * -30}px, ${m.cy * -30}px)`;
      if (deep) deep.style.transform = `translate(${m.cx * -15}px, ${m.cy * -15}px)`;

      if (product) {
        const bob = Math.sin(t * ((Math.PI * 2) / 6)) * 14;
        product.style.transform = `perspective(1100px) translateY(${bob}px) rotateY(${m.cx * 26}deg) rotateX(${m.cy * -16}deg)`;
      }

      // Frozen for the duration of a mood switch — the implode/explode owns the
      // orbs' transforms while it runs, and a loop writing over them every
      // frame would erase the whole animation.
      if (!switching.current) {
        orbs.forEach((el, i) => {
          const s = orbState.current[i];
          const r = el.getBoundingClientRect();
          const dx = m.px - (r.left + r.width / 2);
          const dy = m.py - (r.top + r.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);

          let tx = 0;
          let ty = 0;
          let speed = 1;
          if (dist < 400 && dist > 0) {
            const force = (400 - dist) / 400;
            tx = (dx / dist) * force * -80;
            ty = (dy / dist) * force * -80;
            speed = 1 + force * 5;
          }

          s.rx += (tx - s.rx) * 0.1;
          s.ry += (ty - s.ry) * 0.1;
          s.angle += 0.2 * speed;

          const dur = FLOAT_DUR[i % FLOAT_DUR.length];
          const phase = (t + i * 0.7) * ((Math.PI * 2) / dur);
          const floatY = Math.sin(phase) * 15;
          const floatAngle = Math.cos(phase) * 6;

          el.style.transform = `translate(${s.rx + s.baseX}px, ${s.ry + s.baseY + floatY}px) rotate(${s.angle + floatAngle}deg)`;
        });
      }

      blobs.forEach((el, i) => {
        const dur = 10 + i * 2;
        const phase = (t + i * 1.2) * ((Math.PI * 2) / dur);
        el.style.transform = `translate(${Math.cos(phase * 0.5) * 15}px, ${Math.sin(phase) * 20}px) rotate(${Math.sin(phase * 0.3) * 15}deg)`;
      });

      raf = requestAnimationFrame(tick);
    };

    // A bubble every 400ms, sized/timed exactly as the reference. Each one
    // removes itself when its rise ends, so the layer never accumulates.
    let bubbleTimer = 0;
    const spawn = () => {
      const host = bubblesRef.current;
      if (!host) return;
      const b = document.createElement("span");
      b.className = "sd-bubble";
      const size = Math.random() * 20 + 10;
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.insetInlineStart = `${Math.random() * 100}%`;
      b.style.opacity = String(Math.random() * 0.4 + 0.2);
      const duration = Math.random() * 6 + 4;
      b.style.animationDuration = `${duration}s`;
      host.appendChild(b);
      window.setTimeout(() => b.remove(), duration * 1000);
    };

    const start = () => {
      if (live) return;
      live = true;
      section.addEventListener("mousemove", onMove);
      section.addEventListener("mouseleave", onLeave);
      raf = requestAnimationFrame(tick);
      bubbleTimer = window.setInterval(spawn, 400);
    };
    const stop = () => {
      if (!live) return;
      live = false;
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
      clearInterval(bubbleTimer);
    };

    // The hero sits at the top of a long page — once it has scrolled away there
    // is no reason to keep burning a frame and a bubble every 400ms.
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(section);

    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  function switchMood(next: number) {
    if (next === mood || switching.current) return;
    setMood(next);

    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProdMood(next);
      return;
    }

    switching.current = true;

    // Restart the spin even if one just finished — removing the class and
    // reading offsetWidth forces the reflow that lets it play again.
    const spin = spinRef.current;
    if (spin) {
      spin.classList.remove("sd-spin");
      void spin.offsetWidth;
      spin.classList.add("sd-spin");
    }

    const push = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    // The texture swap at the peak of the spin.
    push(() => setProdMood(next), 600);
    push(() => spin?.classList.remove("sd-spin"), 2100);

    const rect = section.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    section.querySelectorAll<HTMLElement>("[data-orb]").forEach((el, i) => {
      const s = orbState.current[i];
      const r = el.getBoundingClientRect();
      // The rect already carries the orb's own transform AND its parallax
      // parent's, so the delta to the centre can be added straight onto the
      // translate the orb is currently sitting at.
      const toX = s.rx + s.baseX + (cx - (r.left + r.width / 2));
      const toY = s.ry + s.baseY + (cy - (r.top + r.height / 2));

      el.style.transition = "transform .5s cubic-bezier(.55,.085,.68,.53), opacity .5s ease-in";
      el.style.transform = `translate(${toX}px, ${toY}px) rotate(${s.angle + 45}deg) scale(.1)`;
      el.style.opacity = "0";

      push(() => {
        const nx = (Math.random() - 0.5) * 200;
        const ny = (Math.random() - 0.5) * 200;
        s.baseX = nx;
        s.baseY = ny;
        s.rx = 0;
        s.ry = 0;
        s.angle += 90;
        el.style.transition = "transform .9s cubic-bezier(.34,1.56,.64,1), opacity .45s ease-out";
        el.style.transform = `translate(${nx}px, ${ny}px) rotate(${s.angle}deg) scale(1)`;
        // From the element, not from ORBS[i]: the orbs are split across two
        // parallax layers, so document order is not ORBS order and indexing the
        // table here restored the wrong orb's opacity.
        el.style.opacity = el.dataset.opacity ?? "1";
      }, 800);
    });

    push(() => {
      section
        .querySelectorAll<HTMLElement>("[data-orb]")
        .forEach((el) => (el.style.transition = ""));
      switching.current = false;
    }, 1750);
  }

  // A charcoal or navy brand is invisible as a display word on this ground.
  const glow = brandOnDark(brand);

  const text = headline || brandName || "";
  const words = text.split(" ").filter(Boolean);
  const mid = Math.max(1, Math.ceil(words.length / 2));
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");

  // The reference sizes its headline for two short English words. A Hebrew
  // headline three times as long at that size is a wall, so the ceiling scales
  // with the copy the business actually wrote.
  const size =
    text.length <= 14
      ? "clamp(3rem, 1rem + 9vw, 7.5rem)"
      : text.length <= 26
        ? "clamp(2.5rem, 1rem + 6.5vw, 5.5rem)"
        : "clamp(2.1rem, 1rem + 4.5vw, 4rem)";

  return (
    <section
      ref={sectionRef}
      className="sd-section relative flex overflow-hidden"
      style={{ ...moodVars(brand, mood) } as React.CSSProperties}
    >
      {heroImg && <HeroImagePreload src={heroImg} />}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Secular+One&family=Outfit:wght@400;700;900&display=swap"
      />
      <style>{`
        .sd-section {
          min-height: 92vh;
          background: radial-gradient(circle at center, var(--sd-inner) 0%, var(--sd-mid) 50%, var(--sd-outer) 100%);
          transition: background 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @supports (height: 100dvh) { .sd-section { min-height: 92dvh; } }
        /* Secular One carries the Hebrew (the reference's Galada is Latin-only,
           so a Hebrew headline in it fell back to a system font); Outfit picks
           up any Latin the business wrote. */
        .sd-display { font-family: 'Secular One', 'Outfit', var(--font-sans), sans-serif; font-weight: 400; }
        /* The copy column and the floating product share the middle of the
           frame by design, so on a wide screen the last glyphs of a long
           headline sit over the photo. A shadow on the copy keeps it readable
           there without dimming the product the whole style is built around. */
        .sd-ink { text-shadow: 0 2px 22px rgba(0,0,0,.6), 0 1px 3px rgba(0,0,0,.45); }

        @keyframes sd-rise {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: var(--sd-bo, .4); }
          90% { opacity: var(--sd-bo, .4); }
          100% { transform: translateY(-110vh) translateX(30px) rotate(360deg); opacity: 0; }
        }
        .sd-bubble {
          position: absolute;
          bottom: -50px;
          display: block;
          border-radius: 9999px;
          background: radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), rgba(255,255,255,.18) 45%, rgba(255,255,255,.04) 70%);
          box-shadow: inset 0 0 6px rgba(255,255,255,.35);
          animation-name: sd-rise;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        /* Two-stage spin: into the blur on an ease-in, out of it on a settle
           that overshoots — the reference's power2.in then back.out(0.7). */
        @keyframes sd-spin {
          0% { transform: rotate(0deg); filter: blur(0px); animation-timing-function: cubic-bezier(.55,.085,.68,.53); }
          28.6% { transform: rotate(360deg); filter: blur(15px); animation-timing-function: cubic-bezier(.18,.89,.32,1.15); }
          100% { transform: rotate(720deg); filter: blur(0px); }
        }
        .sd-spin { animation: sd-spin 2.1s both; }

        @keyframes sd-in {
          0% { opacity: 0; transform: translateY(22px); }
          100% { opacity: 1; transform: none; }
        }
        .sd-in { animation: sd-in .9s cubic-bezier(.22,.8,.3,1) both; }

        .sd-glass {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.2);
          box-shadow: 0 8px 32px rgba(0,0,0,.1), inset 0 0 0 1px rgba(255,255,255,.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* The professional tier paints every hero h1 with one gold gradient,
           which would erase the two-tone headline this style is built on. */
        [data-tier="professional"] [data-el="hero"] h1.sd-h1 {
          background: none;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff;
          font-weight: 400;
          line-height: .85;
          animation: none;
        }
        [data-tier="professional"] [data-el="hero"] h1.sd-h1 .sd-accent {
          color: var(--sd-glow) !important;
          -webkit-text-fill-color: var(--sd-glow);
        }
        [data-tier="professional"] [data-el="hero"] p.sd-sub { color: rgba(255,255,255,.72) !important; animation: none; }

        @media (prefers-reduced-motion: reduce) {
          .sd-section { transition: none; }
          .sd-bubble, .sd-spin, .sd-in { animation: none !important; }
          .sd-in { opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* Rising bubbles. Decorative and JS-spawned, so it starts empty on the
          server and never affects hydration. */}
      <div
        ref={bubblesRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      />

      {/* Deep layer — the reference's leaves, as soft brand blobs. */}
      <div ref={deepRef} aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {BLOBS.map((b, i) => (
          <span
            key={i}
            data-blob
            className="absolute block rounded-full blur-2xl"
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${glow} 60%, transparent), transparent 70%)`,
            }}
          />
        ))}
      </div>

      {/* Far orbs — parallax runs against the pointer. */}
      <div ref={farRef} aria-hidden className="pointer-events-none absolute inset-0 z-[2]">
        {ORBS.map((o, i) =>
          o.near ? null : <OrbDot key={i} i={i} o={o} glow={glow} />,
        )}
      </div>

      {/* The product itself. Everything else in the frame orbits this. */}
      <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center">
        <div ref={productRef} className="will-change-transform">
          <div
            ref={spinRef}
            className="relative aspect-[4/5] w-[min(70vw,260px)] opacity-40 lg:w-[min(26vw,320px)] lg:opacity-100"
          >
            {heroImg ? (
              <>
                <HeroImage
                  src={heroImg}
                  className="size-full rounded-[2rem] object-cover shadow-[0_40px_90px_rgba(0,0,0,.55)] ring-1 ring-white/15"
                />
                {/* The "texture" that swaps at the peak of the spin. */}
                <span
                  className="absolute inset-0 rounded-[2rem] transition-colors duration-700"
                  style={{
                    background:
                      prodMood === 1
                        ? "linear-gradient(160deg, rgba(8,16,32,.55), rgba(2,6,14,.15))"
                        : `linear-gradient(160deg, color-mix(in srgb, ${brand} 42%, transparent), transparent 65%)`,
                  }}
                />
              </>
            ) : (
              <span
                className="absolute inset-0 rounded-full shadow-[0_40px_90px_rgba(0,0,0,.55)] transition-colors duration-700"
                style={{
                  background:
                    prodMood === 1
                      ? `radial-gradient(circle at 32% 26%, rgba(255,255,255,.6), color-mix(in srgb, ${brand} 45%, #0d1b2a) 45%, #04070f 100%)`
                      : `radial-gradient(circle at 32% 26%, rgba(255,255,255,.75), ${brand} 45%, color-mix(in srgb, ${brand} 25%, #000) 100%)`,
                }}
              />
            )}
            <span className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(115deg,rgba(255,255,255,.35),transparent_38%)] mix-blend-screen" />
          </div>
        </div>
      </div>

      {/* Near orbs — in front of the product, behind the copy. The reference
          floats these above its text; at 250px over a Hebrew headline that is
          simply unreadable, so the whole layer sits under it here. */}
      <div ref={nearRef} aria-hidden className="pointer-events-none absolute inset-0 z-[4]">
        {ORBS.map((o, i) => (o.near ? <OrbDot key={i} i={i} o={o} glow={glow} /> : null))}
      </div>

      {/* Keeps the copy legible on a phone, where the product sits directly
          behind it instead of between two columns. */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(to_top,rgba(0,0,0,.72),rgba(0,0,0,.3)_45%,transparent)] lg:hidden" />

      <div
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-16 lg:flex-row lg:items-stretch lg:justify-between lg:gap-8 lg:py-20"
        style={{ ["--sd-glow" as string]: glow }}
      >
        {/* Copy column */}
        <div className="flex flex-col gap-6 lg:max-w-[48%]">
          <h1
            className="sd-h1 sd-display sd-in sd-ink text-balance text-white [overflow-wrap:anywhere]"
            style={{ fontSize: size, lineHeight: 0.85, animationDelay: ".05s" }}
          >
            {line1 && <span className="block">{line1}</span>}
            {line2 && (
              <span className="sd-accent block" style={{ color: glow }}>
                {line2}
              </span>
            )}
          </h1>

          {subheadline && (
            <p
              className="sd-sub sd-in sd-ink max-w-md text-base leading-7 text-white/70 sm:text-lg"
              style={{ animationDelay: ".18s" }}
            >
              {subheadline}
            </p>
          )}

          <div className="sd-in flex flex-wrap items-center gap-4" style={{ animationDelay: ".3s" }}>
            {ctaHref && (
              <a
                href={ctaHref}
                className="group inline-flex items-center gap-5 rounded-full bg-black/50 py-1.5 ps-6 pe-1.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {ctaText}
                <span
                  className="flex size-9 items-center justify-center rounded-full text-xl font-black leading-none"
                  style={{ background: glow, color: inkOn(glow) }}
                  aria-hidden
                >
                  +
                </span>
              </a>
            )}
            {secondaryHref && secondaryText && (
              <a
                href={secondaryHref}
                className="text-sm font-medium text-white/75 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {secondaryText}
              </a>
            )}
          </div>

          {socialProof && (
            <div className="sd-in mt-auto flex items-center gap-4 pt-6" style={{ animationDelay: ".42s" }}>
              <span className="sd-glass flex size-12 shrink-0 items-center justify-center rounded-xl">
                <Award className="size-5" style={{ color: glow }} aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-[0.7rem] uppercase tracking-[0.1em] text-white/60">
                  {brandName}
                </span>
                <span className="text-sm font-semibold text-white">{socialProof}</span>
              </span>
            </div>
          )}
        </div>

        {/* Mood switch + the second display line */}
        <div className="flex flex-col items-start justify-between gap-10 lg:items-end lg:text-end">
          <div className="sd-in flex flex-col gap-3 lg:items-end" style={{ animationDelay: ".24s" }}>
            <span className="text-[0.7rem] uppercase tracking-[0.14em] text-white/50">אווירה</span>
            <div className="flex gap-3">
              {MOODS.map((label, i) => {
                const v = moodVars(brand, i) as Record<string, string>;
                const active = mood === i;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => switchMood(i)}
                    aria-pressed={active}
                    className={`sd-glass flex w-[104px] flex-col items-center gap-3 rounded-3xl p-3 transition duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${active ? "" : "opacity-70 hover:opacity-100"}`}
                    style={active ? { borderColor: glow } : undefined}
                  >
                    <span
                      className="size-11 rounded-full shadow-inner"
                      style={{
                        background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.6), ${v["--sd-inner"]} 45%, ${v["--sd-outer"]} 100%)`,
                      }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold text-white">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {slogan && (
            <p
              className="sd-display sd-in sd-ink max-w-[13ch] text-balance text-white/90"
              style={{
                fontSize: "clamp(1.9rem, 1rem + 3.4vw, 3.6rem)",
                lineHeight: 0.9,
                animationDelay: ".36s",
              }}
            >
              {slogan}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * One glassy orb. The off-centre specular highlight is what makes the constant
 * rotation readable — a flat disc would spin invisibly.
 */
function OrbDot({ i, o, glow }: { i: number; o: Orb; glow: string }) {
  return (
    <span
      data-orb
      data-opacity={o.opacity}
      className="absolute block rounded-full will-change-transform"
      style={{
        top: `${o.top}%`,
        left: `${o.left}%`,
        width: o.size,
        height: o.size,
        opacity: o.opacity,
        background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,.55), color-mix(in srgb, ${glow} 55%, transparent) 42%, color-mix(in srgb, ${glow} 12%, transparent) 72%, transparent 78%)`,
        filter: `drop-shadow(0 10px 20px rgba(0,0,0,.3)) blur(${i % 3 === 0 ? 1 : 0}px)`,
      }}
    />
  );
}
