"use server";

import { headers } from "next/headers";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/**
 * Records a single visit to a published public site (/s/[slug]).
 *
 * Fire-and-forget beacon called by <SiteVisitTracker /> on mount. Anonymous
 * visitors trigger it, so it is hardened accordingly:
 * - slug shape is validated before any query
 * - rate limited per slug (600/hour — busy sites can generate a lot of
 *   legitimate traffic; this only guards against abuse, not real visits)
 * - only resolves PUBLISHED websites (service-role read, scoped by slug)
 * - referrer is trimmed to 300 chars; empty or same-origin referrers → null
 * - path is trimmed to 200 chars; anything not starting with "/" is dropped
 *
 * NEVER throws — a broken analytics beacon must not affect the visitor.
 */
export async function trackSiteVisitAction(
  slug: string,
  referrer?: string,
  path?: string,
): Promise<void> {
  try {
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) return;

    // Anti-abuse: cap recorded visits per site per hour. Fail silently.
    if (!(await checkRateLimit(`visit:${slug}`, 600, 3600))) return;

    const supabase = createServiceRoleClient();

    const { data: website } = await supabase
      .from("websites")
      .select("business_id")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (!website) return;

    // Normalize referrer: trim, cap length, null out empty / same-origin.
    let ref: string | null = (referrer ?? "").trim().slice(0, 300) || null;
    if (ref) {
      try {
        const refHost = new URL(ref).host;
        const selfHost = (await headers()).get("host");
        if (!refHost || (selfHost && refHost === selfHost)) ref = null;
      } catch {
        // Unparsable referrer — keep the raw (trimmed) value as-is.
      }
    }

    // Normalize path: must be an in-app path starting with "/".
    const cleanPath = (path ?? "").trim().slice(0, 200);
    const safePath = cleanPath.startsWith("/") ? cleanPath : null;

    await supabase.from("site_visits").insert({
      business_id: website.business_id,
      slug,
      referrer: ref,
      path: safePath,
    });
  } catch {
    // Swallow everything — tracking must never surface to the visitor.
  }
}
