import { notFound } from "next/navigation";

import {
  modeAllowsNav,
  modeAllowsStoreScreen,
  type BusinessNavKey,
} from "@/lib/site-mode";

/**
 * 404s a dashboard page the business's build mode doesn't have.
 *
 * components/shared/business-nav.tsx already hides these links, but hiding a
 * link is cosmetic: a bookmark, a stale tab or a shared URL would otherwise
 * open a fully working "הזמנות" screen on a landing page. Every page whose key
 * appears in some mode's `hiddenNav` (lib/site-mode.ts) calls this right after
 * it loads the business row.
 */
export function assertNavAllowed(siteMode: unknown, key: BusinessNavKey): void {
  if (!modeAllowsNav(siteMode, key)) notFound();
}

/**
 * The "חנות" screen's own guard. It can't use `assertNavAllowed` because the
 * screen now hosts "תזמון לילות" too, which a brochure-mode צימר is entitled to
 * even though its mode hides the products nav — see `modeAllowsStoreScreen`.
 */
export function assertStoreScreenAllowed(
  siteMode: unknown,
  opts?: { sellsNights?: boolean },
): void {
  if (!modeAllowsStoreScreen(siteMode, opts)) notFound();
}
