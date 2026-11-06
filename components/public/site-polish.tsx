"use client";

import { useEffect, useRef, useState } from "react";

import { counterTarget, formatCounter } from "@/lib/animated-counter";

/**
 * The public storefront's PREMIUM INTERACTION LAYER.
 *
 * ── What this is ───────────────────────────────────────────────────────────
 * `SiteEffects` handles reveal-on-scroll and nothing else. Everything a
 * storefront needs to feel like a product rather than a page — a reading
 * progress rail, a way back to the top, buttons that answer the pointer,
 * numbers that count up, a nav that knows where you are — lived nowhere.
 * This component owns all of it, in one mount, with no dependencies.
 *
 * ── The rules it plays by ──────────────────────────────────────────────────
 * 1. PROGRESSIVE ENHANCEMENT. Every visual it adds is decoration. Nothing
 *    here is required to read, buy, or navigate. With JS off the page is
 *    exactly the page it is today.
 * 2. REDUCED MOTION IS A HARD STOP, not a slowdown. When the user asks for
 *    less motion we skip the pointer listeners entirely, and counters keep
 *    their FINAL value — an accessibility setting must never cost someone the
 *    information.
 * 3. NO LAYOUT SHIFT. Everything is `position: fixed` or a transform. Nothing
 *    added here can move a single pixel of real content, so CLS is untouched.
 * 4. PASSIVE + rAF-COALESCED. The progress rail and the back-to-top trigger
 *    share ONE scroll handler, so a long store page doesn't pay for two.
 *
 * ── Why the effects target `data-el` hooks ─────────────────────────────────
 * `btn-primary`, `chrome-nav`, `chrome-header` are the same stable contract
 * the tier stylesheet paints (components/public/tiers/tier-styles.tsx). Using
 * them here means a new section gets the polish for free the moment it stamps
 * the attribute, and a markup refactor can't silently half-break the effects.
 */
export function SitePolish({ brand, accent }: { brand: string; accent?: string | null }) {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const reducedRef = useRef(false);

  /* ── Scroll: progress rail + back-to-top trigger, one handler ──────────── */
  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    const read = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // A page shorter than the viewport has nothing to progress through;
      // reporting 100% there would paint a full rail on a one-screen site.
      setProgress(scrollable > 40 ? Math.min(1, window.scrollY / scrollable) : 0);
      setShowTop(window.scrollY > 700);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  /* ── Active section indicator in the header nav ────────────────────────── */
  useEffect(() => {
    const nav = document.querySelector('[data-el="chrome-nav"]');
    if (!nav || typeof IntersectionObserver === "undefined") return;

    // Only in-page anchors can have an "active" state; a link to /blog can't.
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const targets = links
      .map((a) => ({ a, el: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
      .filter((t): t is { a: HTMLAnchorElement; el: HTMLElement } => t.el !== null);
    if (targets.length === 0) return;

    const visible = new Set<Element>();
    const paint = () => {
      // The topmost visible section wins, so overlapping sections during a
      // fast scroll can't leave two links lit at once.
      let best: HTMLElement | null = null;
      for (const t of targets) {
        if (!visible.has(t.el)) continue;
        if (!best || t.el.getBoundingClientRect().top < best.getBoundingClientRect().top) best = t.el;
      }
      for (const t of targets) t.a.toggleAttribute("data-active", best === t.el);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        paint();
      },
      // Bias the band toward the upper half: a section is "current" when its
      // top has passed the header, not when its bottom edge grazes the fold.
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    targets.forEach((t) => observer.observe(t.el));
    return () => {
      observer.disconnect();
      targets.forEach((t) => t.a.removeAttribute("data-active"));
    };
  }, []);

  /* ── Animated counters ─────────────────────────────────────────────────── */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-counter]"));
    if (els.length === 0) return;

    // Which values may animate at all — and to what — is a product rule about
    // the owner's own copy, so it lives in lib/ with a test rather than here.
    const parsed = els
      .map((el) => {
        const t = counterTarget(el.textContent);
        return t ? { el, target: t.value, grouped: t.grouped } : null;
      })
      .filter((x): x is { el: HTMLElement; target: number; grouped: boolean } => x !== null);
    if (parsed.length === 0) return;

    // Reduced motion: the final value is already in the DOM. Do nothing.
    if (reducedRef.current || typeof IntersectionObserver === "undefined") return;

    const fmt = formatCounter;

    const run = (item: { el: HTMLElement; target: number; grouped: boolean }) => {
      const duration = 1100;
      const start = performance.now();
      // Tabular numerals so the width doesn't jitter while the digits change.
      item.el.style.fontVariantNumeric = "tabular-nums";
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        item.el.textContent = fmt(item.target * eased, item.grouped);
        if (t < 1) requestAnimationFrame(step);
        else item.el.textContent = fmt(item.target, item.grouped);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const item = parsed.find((p) => p.el === e.target);
          if (item) run(item);
          observer.unobserve(e.target);
        }
      },
      { threshold: 0.4 },
    );
    parsed.forEach((p) => observer.observe(p.el));

    // Safety net, same contract as SiteEffects: if the observer never fires we
    // must not leave a business's numbers half-counted.
    const safety = setTimeout(() => {
      parsed.forEach((p) => {
        const done = fmt(p.target, p.grouped);
        if (p.el.textContent !== done) p.el.textContent = done;
      });
    }, 4000);

    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, []);

  /* ── Magnetic pull + ripple on primary CTAs ────────────────────────────── */
  useEffect(() => {
    if (reducedRef.current) return;
    // Pointer pull is a mouse idiom. On touch it does nothing but cost work,
    // and `hover: none` is the honest test for that (not a UA-string sniff).
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // Scoped to `[data-tier]` deliberately. The ripple node is styled — and,
    // crucially, ANIMATED — by the tier stylesheet, and it removes itself on
    // `animationend`. Outside a tier (landing mode renders no data-tier at all)
    // there is no animation, so the event never fires and every click would
    // leave a permanent invisible span behind.
    const btns = Array.from(
      document.querySelectorAll<HTMLElement>('[data-tier] [data-el="btn-primary"]'),
    );
    if (btns.length === 0) return;
    const cleanups: Array<() => void> = [];

    for (const btn of btns) {
      // Header CTAs sit in a 64px bar; pulling them shoves the icon cluster.
      const inChrome = btn.closest('[data-el="chrome-header"]') !== null;

      if (fine && !inChrome) {
        const move = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          btn.style.setProperty("--pull-x", `${dx * 10}px`);
          btn.style.setProperty("--pull-y", `${dy * 6}px`);
        };
        const leave = () => {
          btn.style.setProperty("--pull-x", "0px");
          btn.style.setProperty("--pull-y", "0px");
        };
        btn.addEventListener("pointermove", move);
        btn.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          btn.removeEventListener("pointermove", move);
          btn.removeEventListener("pointerleave", leave);
          leave();
        });
      }

      const ripple = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect();
        const span = document.createElement("span");
        span.className = "sp-ripple";
        const size = Math.max(r.width, r.height) * 2;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.left = `${e.clientX - r.left - size / 2}px`;
        span.style.top = `${e.clientY - r.top - size / 2}px`;
        // The button owns the clip; a CTA is a pill and a square ripple would
        // spill past the radius.
        if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
        btn.style.overflow = "hidden";
        btn.appendChild(span);
        span.addEventListener("animationend", () => span.remove(), { once: true });
      };
      btn.addEventListener("pointerdown", ripple);
      cleanups.push(() => btn.removeEventListener("pointerdown", ripple));
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const rail = accent ?? brand;

  return (
    <>
      {/* Reading progress. aria-hidden: it duplicates the scrollbar, which
          assistive tech already reports — announcing it twice is noise. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
        style={{ opacity: progress > 0.005 ? 1 : 0, transition: "opacity .25s ease" }}
      >
        <div
          className="h-full origin-right"
          style={{
            transform: `scaleX(${progress})`,
            background: `linear-gradient(90deg, ${brand}, ${rail})`,
            boxShadow: `0 0 12px -2px ${rail}`,
          }}
        />
      </div>

      <button
        type="button"
        onClick={() =>
          window.scrollTo({ top: 0, behavior: reducedRef.current ? "auto" : "smooth" })
        }
        aria-label="חזרה לראש העמוד"
        // `hidden` (not just opacity) keeps it out of the tab order when it is
        // off-screen, so a keyboard user isn't sent to an invisible control.
        hidden={!showTop}
        className="fixed bottom-24 start-5 z-40 flex size-11 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-110 focus-visible:scale-110"
        style={{ background: `linear-gradient(135deg, ${brand}, ${rail})` }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
