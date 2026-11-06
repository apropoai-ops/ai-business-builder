"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { lookupOrders, type TrackedOrder } from "@/lib/services/order-tracking.service";

/**
 * Public action — a shopper on /s/[slug] enters their phone to see the status
 * of their own orders. Rate-limited per slug (20/hour), validates the phone has
 * at least 9 digits, then delegates to the service (which only returns exact
 * phone matches scoped to the published site's business).
 */
export async function trackOrdersAction(
  slug: string,
  phone: string,
): Promise<{ ok: boolean; orders?: TrackedOrder[]; error?: string }> {
  if (!(await checkRateLimit(`track:${slug}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const trimmed = (phone ?? "").trim().slice(0, 40);
  if (trimmed.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא להזין מספר טלפון תקין" };
  }

  return lookupOrders(slug, trimmed);
}
