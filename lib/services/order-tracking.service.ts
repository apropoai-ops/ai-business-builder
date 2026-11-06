import { createServiceRoleClient } from "@/lib/supabase/server";

/** A single order row exposed to the shopper tracking their own orders. */
export type TrackedOrder = {
  id: string;
  product_name: string;
  quantity: number;
  total: number | null;
  status: string;
  tracking_number: string | null;
  shipping_method: string | null;
  created_at: string;
};

/**
 * Public order tracking (anonymous shopper on /s/[slug]):
 * resolves the published website → business, normalizes the phone the shopper
 * typed, and returns ONLY that business's orders whose customer_phone matches
 * exactly (digits-only, or by the last 9 digits to ignore country/leading-zero
 * differences). Never leaks other customers' data — matching is on the exact
 * phone the shopper proves they know.
 */
export async function lookupOrders(
  slug: string,
  phone: string,
): Promise<{ ok: boolean; orders?: TrackedOrder[]; error?: string }> {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 9) {
    return { ok: false, error: "נא להזין מספר טלפון תקין" };
  }

  const s = createServiceRoleClient();

  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "החנות אינה זמינה כרגע" };

  // Match on the full digit string or the last 9 digits, so "0541234567",
  // "541234567" and "+972541234567" all resolve to the same shopper.
  const last9 = digits.slice(-9);
  const candidates = [...new Set([digits, last9])];

  const { data, error } = await s
    .from("orders")
    .select("id, product_name, quantity, total, status, tracking_number, shipping_method, created_at, customer_phone")
    .eq("business_id", website.business_id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: "אירעה שגיאה — נסו שוב" };

  const orders: TrackedOrder[] = (data ?? [])
    .filter((o) => {
      const od = (o.customer_phone ?? "").replace(/\D/g, "");
      if (!od) return false;
      // Exact match on the typed digits, or last-9 equality in either direction.
      return candidates.includes(od) || od.slice(-9) === last9;
    })
    .slice(0, 20)
    .map((o) => ({
      id: o.id,
      product_name: o.product_name,
      quantity: o.quantity,
      total: o.total,
      status: o.status,
      tracking_number: o.tracking_number,
      shipping_method: o.shipping_method,
      created_at: o.created_at,
    }));

  return { ok: true, orders };
}
