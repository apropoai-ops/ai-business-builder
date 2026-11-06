import { createClient } from "@/lib/supabase/server";
import { sendPushToBusinessOwner } from "@/lib/services/push.service";

export type BusinessNotification = {
  key: "bookings" | "leads" | "tasks" | "orders" | "reviews" | "quotes" | "stock" | "ai_cost";
  label: string;
  count: number;
  href: string;
};

// How far back "new activity" push alerts look. Slightly wider than the
// client watcher's 45s poll interval so a slow tick doesn't miss an item.
const PUSH_LOOKBACK_MS = 70_000;

/**
 * Notifications service — computes the business-header bell items on the
 * server using the RLS client, so tenant isolation is enforced at the DB
 * level. Only items with count > 0 are returned.
 */
export async function getNotifications(
  businessId: string,
): Promise<BusinessNotification[]> {
  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const since48hIso = new Date(now.getTime() - 48 * 3600_000).toISOString();
  const today = nowIso.slice(0, 10);

  const [
    pendingBookings,
    newLeads,
    overdueTasks,
    newOrders,
    pendingReviews,
    acceptedQuotes,
    lowStock,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending")
      .gte("starts_at", nowIso),
    supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "new")
      .gte("created_at", since48hIso),
    supabase
      .from("crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("done", false)
      .lt("due_date", today),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "new"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("approved", false),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "accepted")
      .gte("accepted_at", since48hIso),
    // Low stock: tracked products at/below their threshold (column comparison
    // can't be done server-side here, so fetch the tracked ones and count).
    supabase
      .from("products")
      .select("stock_qty, low_stock_threshold")
      .eq("business_id", businessId)
      .eq("active", true)
      .not("stock_qty", "is", null)
      .not("low_stock_threshold", "is", null),
  ]);

  const lowStockCount = (lowStock.data ?? []).filter(
    (p) => p.stock_qty != null && p.low_stock_threshold != null && p.stock_qty <= p.low_stock_threshold,
  ).length;

  const base = `/businesses/${businessId}`;
  const candidates: BusinessNotification[] = [
    {
      key: "bookings",
      count: pendingBookings.count ?? 0,
      label: `${pendingBookings.count ?? 0} תורים ממתינים לאישור`,
      href: `${base}/bookings`,
    },
    {
      key: "leads",
      count: newLeads.count ?? 0,
      label: `${newLeads.count ?? 0} לידים חדשים ב-48 השעות האחרונות`,
      href: `${base}/crm`,
    },
    {
      key: "tasks",
      count: overdueTasks.count ?? 0,
      label: `${overdueTasks.count ?? 0} משימות פתוחות באיחור`,
      href: `${base}/crm`,
    },
    {
      key: "orders",
      count: newOrders.count ?? 0,
      label: `${newOrders.count ?? 0} הזמנות חדשות בחנות`,
      href: `${base}/orders`,
    },
    {
      key: "reviews",
      count: pendingReviews.count ?? 0,
      label: `${pendingReviews.count ?? 0} ביקורות ממתינות לאישור`,
      href: `${base}/reviews`,
    },
    {
      key: "quotes",
      count: acceptedQuotes.count ?? 0,
      label: `${acceptedQuotes.count ?? 0} הצעות מחיר אושרו לאחרונה`,
      href: `${base}/quotes`,
    },
    {
      key: "stock",
      count: lowStockCount,
      label: `${lowStockCount} מוצרים במלאי נמוך`,
      href: `${base}/store`,
    },
  ];

  // Best-effort web-push alert for genuinely new activity (owner notification
  // creation point — there's no persisted "notifications" row in this app,
  // counts are computed live, so we alert on items created within the lookback
  // window). Fire-and-forget: never awaited, never throws, never blocks the
  // response the caller (bell + poll) is waiting on.
  void notifyOwnerOfRecentActivity(businessId, base).catch(() => {});

  return candidates.filter((n) => n.count > 0);
}

/**
 * Looks for bookings/leads/orders created in the last PUSH_LOOKBACK_MS and
 * pushes a browser notification to the business owner for each, deep-linked
 * to the relevant dashboard page. Best-effort — swallows all errors.
 */
async function notifyOwnerOfRecentActivity(businessId: string, base: string): Promise<void> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - PUSH_LOOKBACK_MS).toISOString();

  const [recentBookings, recentLeads, recentOrders] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, customer_name")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .gte("created_at", sinceIso)
      .limit(5),
    supabase
      .from("crm_leads")
      .select("id, name")
      .eq("business_id", businessId)
      .gte("created_at", sinceIso)
      .limit(5),
    supabase
      .from("orders")
      .select("id, customer_name")
      .eq("business_id", businessId)
      .eq("status", "new")
      .gte("created_at", sinceIso)
      .limit(5),
  ]);

  const pushes: Promise<void>[] = [];

  for (const b of recentBookings.data ?? []) {
    pushes.push(
      sendPushToBusinessOwner(businessId, {
        title: "תור חדש ממתין לאישור",
        body: b.customer_name ? `נקבע תור עבור ${b.customer_name}` : "התקבל תור חדש",
        url: `${base}/bookings`,
      }),
    );
  }
  for (const l of recentLeads.data ?? []) {
    pushes.push(
      sendPushToBusinessOwner(businessId, {
        title: "ליד חדש התקבל",
        body: l.name ? `ליד חדש: ${l.name}` : "התקבל ליד חדש",
        url: `${base}/crm`,
      }),
    );
  }
  for (const o of recentOrders.data ?? []) {
    pushes.push(
      sendPushToBusinessOwner(businessId, {
        title: "הזמנה חדשה בחנות",
        body: o.customer_name ? `הזמנה חדשה מ${o.customer_name}` : "התקבלה הזמנה חדשה",
        url: `${base}/orders`,
      }),
    );
  }

  await Promise.all(pushes);
}
