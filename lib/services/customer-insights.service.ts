import { createClient } from "@/lib/supabase/server";
import type { Booking, Order } from "@/types/database";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

/**
 * Aggregated per-customer insights (visit/order history) computed from
 * `bookings` + `orders`. Both tables key customers by phone/email snapshot
 * (not a foreign key), so matching happens in JS after a bounded fetch —
 * see matchesContact() below.
 */

export type CustomerUpcoming = {
  id: string;
  service: string | null;
  starts_at: string;
};

export type CustomerRecentBooking = {
  id: string;
  service: string | null;
  starts_at: string;
  status: string;
  no_show: boolean;
};

export type CustomerRecentOrder = {
  id: string;
  total: number;
  created_at: string;
  status: string;
  payment_status: string;
};

export type CustomerInsights = {
  visits: number;
  noShows: number;
  upcoming: CustomerUpcoming | null;
  lastVisit: string | null;
  ordersCount: number;
  totalSpent: number;
  recentBookings: CustomerRecentBooking[];
  recentOrders: CustomerRecentOrder[];
};

const EMPTY_INSIGHTS: CustomerInsights = {
  visits: 0,
  noShows: 0,
  upcoming: null,
  lastVisit: null,
  ordersCount: 0,
  totalSpent: 0,
  recentBookings: [],
  recentOrders: [],
};

/**
 * Normalized-phone match key (via lib/phone.ts, same normalization used when
 * writing CRM leads/customers) — stable across "050-1234567" / "+972501234567"
 * / "0501234567" style formatting differences on either side of the match.
 */
function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizePhoneForWhatsapp(raw);
}

function emailKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

function matchesContact(
  row: { customer_phone?: string | null; customer_email?: string | null },
  wantPhone: string | null,
  wantEmail: string | null,
): boolean {
  if (wantPhone && phoneKey(row.customer_phone) === wantPhone) return true;
  if (wantEmail && emailKey(row.customer_email) === wantEmail) return true;
  return false;
}

/**
 * Computes visit/order insights for a single customer, matched by phone
 * and/or email against a business's bookings + orders. Owner-RLS client
 * (same pattern as crm.service.ts) — callers must already have verified
 * the caller owns `businessId`.
 */
export async function getCustomerInsights(
  businessId: string,
  contact: { phone?: string | null; email?: string | null },
): Promise<CustomerInsights> {
  const wantPhone = phoneKey(contact.phone);
  const wantEmail = emailKey(contact.email);
  if (!wantPhone && !wantEmail) return EMPTY_INSIGHTS;

  const supabase = await createClient();
  const oneYearAgo = new Date(Date.now() - 365 * 86400_000).toISOString();
  const now = Date.now();

  const [bookingsRes, ordersRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,service,starts_at,status,no_show,customer_phone,customer_email")
      .eq("business_id", businessId)
      .neq("status", "blocked")
      .gte("starts_at", oneYearAgo)
      .order("starts_at", { ascending: false })
      .limit(500),
    supabase
      .from("orders")
      .select("id,total,created_at,status,payment_status,customer_phone,customer_name")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  type BookingRow = Pick<Booking, "id" | "service" | "starts_at" | "status" | "no_show" | "customer_phone" | "customer_email">;
  type OrderRow = Pick<Order, "id" | "total" | "created_at" | "status" | "payment_status" | "customer_phone">;

  const bookings = ((bookingsRes.data ?? []) as BookingRow[]).filter((b) =>
    matchesContact(b, wantPhone, wantEmail),
  );
  // orders table has no customer_email column — phone-only match.
  const orders = ((ordersRes.data ?? []) as OrderRow[]).filter(
    (o) => wantPhone && phoneKey(o.customer_phone) === wantPhone,
  );

  const past = bookings.filter((b) => new Date(b.starts_at).getTime() <= now);
  const future = bookings
    .filter((b) => new Date(b.starts_at).getTime() > now && b.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const visits = past.filter((b) => b.status === "confirmed" && !b.no_show).length;
  const noShows = past.filter((b) => b.no_show).length;
  const lastVisit = past.find((b) => b.status === "confirmed" && !b.no_show)?.starts_at ?? null;

  const upcoming: CustomerUpcoming | null = future[0]
    ? { id: future[0].id, service: future[0].service, starts_at: future[0].starts_at }
    : null;

  const paidStatuses = new Set(["paid", "completed", "complete", "success"]);
  const paidOrders = orders.filter(
    (o) => paidStatuses.has((o.payment_status ?? "").toLowerCase()) || paidStatuses.has((o.status ?? "").toLowerCase()),
  );
  const totalSpent = paidOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const recentBookings: CustomerRecentBooking[] = past.slice(0, 10).map((b) => ({
    id: b.id,
    service: b.service,
    starts_at: b.starts_at,
    status: b.status,
    no_show: b.no_show,
  }));

  const recentOrders: CustomerRecentOrder[] = orders.slice(0, 5).map((o) => ({
    id: o.id,
    total: o.total ?? 0,
    created_at: o.created_at,
    status: o.status,
    payment_status: o.payment_status,
  }));

  return {
    visits,
    noShows,
    upcoming,
    lastVisit,
    ordersCount: orders.length,
    totalSpent,
    recentBookings,
    recentOrders,
  };
}
