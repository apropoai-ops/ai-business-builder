import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { NewsletterSubscriber } from "@/types/database";

/**
 * Newsletter service — owner reads go through RLS; the public subscribe path
 * uses the service-role client strictly scoped to a PUBLISHED website.
 */

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

/** Lists a business's newsletter subscribers, newest first (RLS). */
export async function listSubscribers(
  businessId: string,
): Promise<NewsletterSubscriber[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Public (service role, scoped to published sites) ────────────────────────

/**
 * Subscribes an email to a published site's newsletter (/s/[slug]):
 * resolves the published website → business and inserts the row. A unique
 * violation (already subscribed) is treated as success — idempotent by design.
 */
export async function subscribeNewsletter(
  slug: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();

  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "האתר אינו זמין" };

  const { error } = await s.from("newsletter_subscribers").insert({
    business_id: website.business_id,
    email,
  });
  // 23505 = unique_violation → already subscribed, which is perfectly fine.
  if (error && error.code !== "23505") {
    return { ok: false, error: "ההרשמה נכשלה — נסו שוב" };
  }

  return { ok: true };
}
