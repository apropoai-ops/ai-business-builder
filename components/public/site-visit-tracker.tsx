"use client";

import { useEffect, useRef } from "react";

import { trackSiteVisitAction } from "@/lib/actions/site-visit";

/**
 * Invisible visit beacon for public business sites.
 *
 * Mount it once inside the public site page:
 *
 * ```tsx
 * // app/s/[slug]/page.tsx
 * <SiteVisitTracker slug={slug} />
 * // or, on an inner route, to power the top-pages breakdown:
 * <SiteVisitTracker slug={slug} path="/product/some-item" />
 * ```
 *
 * Fires `trackSiteVisitAction` exactly once on mount (guarded against
 * StrictMode double-invocation) with `document.referrer`, and renders nothing.
 * `path` is optional — when omitted, the current pathname is used. The
 * action is fire-and-forget — failures are swallowed and never affect the
 * visitor.
 */
export function SiteVisitTracker({ slug, path }: { slug: string; path?: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const resolvedPath = path ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
    trackSiteVisitAction(slug, document.referrer || undefined, resolvedPath).catch(() => {
      // Tracking is best-effort; never surface errors to the visitor.
    });
  }, [slug, path]);

  return null;
}
