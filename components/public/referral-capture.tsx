"use client";

import { useEffect } from "react";

/**
 * Captures a ?ref=CODE referral param into localStorage so it survives browsing
 * and is applied at checkout. Renders nothing.
 */
export function ReferralCapture({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) window.localStorage.setItem(`mode-ref:${slug}`, ref.slice(0, 16).toUpperCase());
    } catch {
      // ignore
    }
  }, [slug]);
  return null;
}
