import { createClient } from "@/lib/supabase/server";

/**
 * Store sales analytics (owner, RLS): revenue, average order value, units,
 * gross profit (from product cost_price), paid revenue and best sellers.
 * Cancelled orders are excluded. All computed in JS over the order tables.
 */
export type StoreSalesStats = {
  orderCount: number;
  revenue: number;
  paidRevenue: number;
  aov: number;
  units: number;
  profit: number | null; // null when no cost prices are set
  bestSellers: { name: string; qty: number }[];
};

/** A customer segment row for the owner's VIP / segmentation view. */
export type CustomerSegment = {
  name: string;
  phone: string;
  orders: number;
  spent: number;
  tier: "vip" | "returning" | "new";
};

/** Groups non-cancelled orders by phone into spend-based segments (top 12). */
export async function getCustomerSegments(businessId: string): Promise<CustomerSegment[]> {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("customer_name, customer_phone, total, status")
    .eq("business_id", businessId)
    .neq("status", "cancelled");

  const byPhone = new Map<string, CustomerSegment>();
  for (const o of orders ?? []) {
    const phone = (o.customer_phone ?? "").trim();
    if (!phone) continue;
    const cur =
      byPhone.get(phone) ?? { name: o.customer_name ?? "", phone, orders: 0, spent: 0, tier: "new" as const };
    cur.orders += 1;
    cur.spent += Number(o.total) || 0;
    if (!cur.name && o.customer_name) cur.name = o.customer_name;
    byPhone.set(phone, cur);
  }

  return [...byPhone.values()]
    .map((c): CustomerSegment => ({
      ...c,
      tier: c.spent >= 1000 ? "vip" : c.orders >= 2 ? "returning" : "new",
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 12);
}

export async function getStoreSalesStats(businessId: string): Promise<StoreSalesStats> {
  const supabase = await createClient();

  const [{ data: orders }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("orders").select("id, status, total, payment_status").eq("business_id", businessId),
    supabase.from("order_items").select("order_id, product_id, product_name, quantity, unit_price").eq("business_id", businessId),
    supabase.from("products").select("id, cost_price").eq("business_id", businessId),
  ]);

  const valid = (orders ?? []).filter((o) => o.status !== "cancelled");
  const validIds = new Set(valid.map((o) => o.id));

  const revenue = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const paidRevenue = valid
    .filter((o) => o.payment_status === "paid")
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const orderCount = valid.length;
  const aov = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  // Cost lookup by product name (order_items snapshot the name, not always the id).
  const costById = new Map((products ?? []).map((p) => [p.id, p.cost_price]));
  const hasAnyCost = (products ?? []).some((p) => p.cost_price != null);

  let units = 0;
  let merchandise = 0;
  let cost = 0;
  const sellers = new Map<string, number>();
  for (const it of items ?? []) {
    if (!validIds.has(it.order_id)) continue;
    const qty = Number(it.quantity) || 0;
    units += qty;
    merchandise += (Number(it.unit_price) || 0) * qty;
    const unitCost = it.product_id != null ? costById.get(it.product_id) : null;
    if (unitCost != null) cost += Number(unitCost) * qty;
    sellers.set(it.product_name, (sellers.get(it.product_name) ?? 0) + qty);
  }
  // Gross profit (merchandise − cost). Only meaningful once cost prices are set.
  const profit = hasAnyCost ? Math.round(merchandise - cost) : null;

  const bestSellers = [...sellers.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return { orderCount, revenue, paidRevenue, aov, units, profit, bestSellers };
}
