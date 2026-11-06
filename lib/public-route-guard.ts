import { notFound } from "next/navigation";

import { getPublicSiteBasicsBySlug } from "@/lib/services/website.service";
import { modeAllowsRoute, type PublicRouteKey } from "@/lib/site-mode";

/**
 * 404s a public sub-route the site's build mode doesn't have.
 *
 * A brochure site has no product pages; a landing page has nothing but itself.
 * Hiding the links isn't enough — a mode that "doesn't sell" must not serve a
 * working /product URL to a crawler or to anyone holding an old link, so the
 * check runs server-side in each sub-tree's layout (one file per sub-tree,
 * which covers every nested page under it).
 *
 * See lib/site-mode.ts for which routes each mode serves.
 */
export async function requirePublicRoute(
  slug: string,
  route: PublicRouteKey,
): Promise<void> {
  const basics = await getPublicSiteBasicsBySlug(slug);
  // An unknown/unpublished slug never reaches here — app/s/[slug]/layout.tsx
  // already 404'd it (and that call is React-cached, so this is free).
  if (!basics) return;
  if (!modeAllowsRoute(basics.mode, route)) notFound();
}
