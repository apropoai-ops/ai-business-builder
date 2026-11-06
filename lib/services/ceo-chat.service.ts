import { createClient } from "@/lib/supabase/server";
import type { CeoMessage } from "@/types/database";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CeoSalesContext = {
  /** Paid-order revenue in the last 30 days. */
  revenue30d: number;
  /** Paid orders in the last 30 days. */
  ordersCount30d: number;
  /** Non-cancelled bookings in the last 30 days. */
  bookingsCount30d: number;
  /** Top 5 products by units sold (paid orders, last 30 days). */
  topProducts: { name: string; qty: number }[];
};

/**
 * Fetches real sales numbers (last 30 days) for the AI CEO's system prompt —
 * revenue, order/booking counts, and top products — so it can answer
 * questions about actual performance instead of talking generically.
 * RLS-scoped (owner-only). Never throws — callers treat this as best-effort
 * context and should fall back to omitting the `sales` section on failure.
 */
export async function getCeoSalesContext(businessId: string): Promise<CeoSalesContext> {
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [orders, bookings] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total")
      .eq("business_id", businessId)
      .eq("payment_status", "paid")
      .gte("paid_at", since30),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("status", "blocked")
      .gte("starts_at", since30),
  ]);

  const orderRows = orders.data ?? [];
  const revenue30d = orderRows.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const orderIds = orderRows.map((o) => o.id);

  let topProducts: { name: string; qty: number }[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .in("order_id", orderIds);
    const byName = new Map<string, number>();
    for (const it of items ?? []) {
      byName.set(it.product_name, (byName.get(it.product_name) ?? 0) + (Number(it.quantity) || 0));
    }
    topProducts = [...byName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }

  return {
    revenue30d,
    ordersCount30d: orderRows.length,
    bookingsCount30d: bookings.count ?? 0,
    topProducts,
  };
}

export async function listMessages(businessId: string): Promise<CeoMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ceo_messages")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveMessage(
  businessId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ceo_messages")
    .insert({ business_id: businessId, role, content });
  if (error) throw new Error(error.message);
}

export async function clearMessages(businessId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ceo_messages")
    .delete()
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}
