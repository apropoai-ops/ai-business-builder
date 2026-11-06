import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { fireAutomations } from "@/lib/services/automations.service";
import type { AbandonedCart, Json } from "@/types/database";

/**
 * Abandoned carts: a shopper started checkout but didn't complete. Captured by
 * phone (the contactable identity). The owner can follow up; the record is
 * marked recovered when an order from that phone lands.
 */

export async function listAbandonedCarts(businessId: string): Promise<AbandonedCart[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("abandoned_carts")
    .select("*")
    .eq("business_id", businessId)
    .eq("recovered", false)
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

/** Public upsert (service role): one open cart per business+phone. */
export async function upsertAbandonedCart(
  slug: string,
  input: { name: string | null; phone: string; items: Json; total: number | null; userId?: string | null },
): Promise<void> {
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length < 9) return;

  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return;

  // Replace any existing open cart for this phone (partial unique index makes a
  // plain upsert awkward, so delete-then-insert).
  await s
    .from("abandoned_carts")
    .delete()
    .eq("business_id", website.business_id)
    .eq("customer_phone", input.phone);

  await s.from("abandoned_carts").insert({
    business_id: website.business_id,
    customer_user_id: input.userId ?? null,
    customer_name: input.name,
    customer_phone: input.phone,
    items: input.items,
    total: input.total,
  });

  // Cart is now a recovery-eligible abandoned cart the owner can follow up
  // on. Fire-and-forget — never throws, never blocks the caller.
  void fireAutomations(website.business_id, "abandoned_cart", {
    customerName: input.name,
    customerEmail: null,
    customerPhone: input.phone,
    total: input.total != null ? Math.round(input.total * 100) : null,
  });
}

/** Marks a phone's open cart recovered after a successful order (service role). */
export async function recoverAbandonedCart(businessId: string, phone: string): Promise<void> {
  if (!phone) return;
  const s = createServiceRoleClient();
  await s
    .from("abandoned_carts")
    .update({ recovered: true })
    .eq("business_id", businessId)
    .eq("customer_phone", phone)
    .eq("recovered", false);
}
