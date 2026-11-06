"use client";

import { useEffect } from "react";

/**
 * Progressive enhancement for the public site: reveal-on-scroll animations.
 * Content is VISIBLE by default — the hidden initial state is applied only
 * after JS confirms IntersectionObserver works (html.js-reveal), and a safety
 * timer reveals everything if the observer never fires. Content can never be
 * stuck invisible.
 */
export function SiteEffects() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // no enhancement — content stays visible
    }

    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    if (els.length === 0) return;

    document.documentElement.classList.add("js-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => observer.observe(el));

    // Safety: if the observer never fired (broken env), reveal everything.
    const safety = setTimeout(() => {
      if (!document.querySelector("[data-reveal].is-visible")) {
        els.forEach((el) => el.classList.add("is-visible"));
      }
    }, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return null;
}
