import { createClient } from "@/lib/supabase/server";
import { normalizePhoneE164 } from "@/lib/services/crm.service";

/** One row in the command-palette results — already shaped for direct rendering + navigation. */
export type DashboardSearchRow = {
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

export type DashboardSearchGroup = {
  kind: "leads" | "customers" | "bookings" | "orders" | "products" | "quotes";
  /** Hebrew group label shown above the rows. */
  title: string;
  rows: DashboardSearchRow[];
};

export type DashboardSearchResults = {
  groups: DashboardSearchGroup[];
};

const GROUP_TITLES: Record<DashboardSearchGroup["kind"], string> = {
  leads: "לידים",
  customers: "לקוחות",
  bookings: "תורים",
  orders: "הזמנות",
  products: "מוצרים",
  quotes: "הצעות מחיר",
};

const ROWS_PER_ENTITY = 6;

/** Strips characters that would break a `.or(...)`/`ilike` filter string (mirrors crm.service.ts). */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%_,()]/g, " ").trim();
}

const EMPTY: DashboardSearchResults = { groups: [] };

/**
 * Server-side search across the dashboard's main entities, capped ~6 rows
 * each — powers the global Ctrl+K command palette. Uses the owner-RLS
 * client, so every table here is already scoped to businesses the caller
 * owns; callers must still verify the caller owns `businessId` before
 * calling (see dashboard-search.ts action).
 */
export async function searchDashboard(businessId: string, query: string): Promise<DashboardSearchResults> {
  const term = sanitizeSearchTerm(query);
  if (term.length < 2) return EMPTY;
  const like = `%${term}%`;
  // Phone numbers are stored E.164-normalized (e.g. "050-1234567" -> "+972501234567"),
  // so a plain substring match against the user's raw local-format input misses —
  // also try the normalized form so searches for "0501234567" still find it.
  const normalizedPhone = normalizePhoneE164(term);
  const phoneLike = normalizedPhone && normalizedPhone !== term ? `%${normalizedPhone}%` : null;
  const phoneFilter = (col: string) =>
    phoneLike ? `${col}.ilike.${like},${col}.ilike.${phoneLike}` : `${col}.ilike.${like}`;

  const base = `/businesses/${businessId}`;
  const supabase = await createClient();

  const [leadsRes, customersRes, bookingsRes, ordersRes, productsRes, quotesRes] = await Promise.all([
    supabase.from("crm_leads").select("id,name,phone,email").eq("business_id", businessId)
      .or(`name.ilike.${like},${phoneFilter("phone")},email.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(ROWS_PER_ENTITY),
    supabase.from("crm_customers").select("id,name,phone,email").eq("business_id", businessId)
      .or(`name.ilike.${like},${phoneFilter("phone")},email.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(ROWS_PER_ENTITY),
    supabase.from("bookings").select("id,customer_name,customer_phone,starts_at").eq("business_id", businessId)
      .or(`customer_name.ilike.${like},${phoneFilter("customer_phone")}`)
      .order("starts_at", { ascending: false }).limit(ROWS_PER_ENTITY),
    supabase.from("orders").select("id,customer_name,customer_phone,product_name,created_at").eq("business_id", businessId)
      .or(`customer_name.ilike.${like},${phoneFilter("customer_phone")},id.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(ROWS_PER_ENTITY),
    supabase.from("products").select("id,name,category").eq("business_id", businessId)
      .ilike("name", like)
      .order("created_at", { ascending: false }).limit(ROWS_PER_ENTITY),
    supabase.from("quotes").select("id,title,customer_name,status").eq("business_id", businessId)
      .or(`title.ilike.${like},customer_name.ilike.${like}`)
      .order("created_at", { ascending: false }).limit(ROWS_PER_ENTITY),
  ]);

  if (leadsRes.error) throw new Error(leadsRes.error.message);
  if (customersRes.error) throw new Error(customersRes.error.message);
  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (quotesRes.error) throw new Error(quotesRes.error.message);

  const groups: DashboardSearchGroup[] = ([
    {
      kind: "leads",
      title: GROUP_TITLES.leads,
      rows: (leadsRes.data ?? []).map((l) => ({
        id: l.id,
        label: l.name,
        sublabel: l.phone ?? l.email ?? null,
        href: `${base}/crm`,
      })),
    },
    {
      kind: "customers",
      title: GROUP_TITLES.customers,
      rows: (customersRes.data ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.phone ?? c.email ?? null,
        href: `${base}/crm`,
      })),
    },
    {
      kind: "bookings",
      title: GROUP_TITLES.bookings,
      rows: (bookingsRes.data ?? []).map((b) => ({
        id: b.id,
        label: b.customer_name,
        sublabel: b.customer_phone,
        href: `${base}/bookings`,
      })),
    },
    {
      kind: "orders",
      title: GROUP_TITLES.orders,
      rows: (ordersRes.data ?? []).map((o) => ({
        id: o.id,
        label: o.customer_name,
        sublabel: o.product_name,
        href: `${base}/orders`,
      })),
    },
    {
      kind: "products",
      title: GROUP_TITLES.products,
      rows: (productsRes.data ?? []).map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: p.category,
        href: `${base}/store`,
      })),
    },
    {
      kind: "quotes",
      title: GROUP_TITLES.quotes,
      rows: (quotesRes.data ?? []).map((q) => ({
        id: q.id,
        label: q.title,
        sublabel: q.customer_name,
        href: `${base}/quotes`,
      })),
    },
  ] as DashboardSearchGroup[]).filter((g) => g.rows.length > 0);

  return { groups };
}
