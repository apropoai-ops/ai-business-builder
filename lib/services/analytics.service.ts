import { createClient } from "@/lib/supabase/server";
import { computeQuoteTotals } from "@/lib/quote-totals";
import { zonedToUtc } from "@/lib/booking-shared";
import type { QuoteItem } from "@/types/database";

export type BusinessAnalytics = {
  leads: { total: number; byStatus: Record<string, number> };
  customers: number;
  deals: {
    total: number;
    byStage: Record<string, number>;
    pipelineValue: number; // open deals
    wonValue: number;
  };
  tasks: { open: number; done: number };
  quotes: {
    total: number;
    byStatus: Record<string, number>;
    /** Total value (incl. VAT) of accepted quotes. */
    acceptedValue: number;
    /** Accepted ÷ all quotes that left draft (sent/accepted/declined). 0 if none. */
    conversionRate: number;
  };
  content: { total: number; byType: Record<string, number> };
  calendar: { planned: number; published: number };
  whatsapp: { conversations: number; inbound: number; outbound: number };
  ai: {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    byAgent: Record<string, number>;
  };
  visits: {
    /** Total site visits in the last 30 days (rolling window). */
    last30Days: number;
    /** Total site visits in the last 7 days (rolling window). */
    last7Days: number;
    /**
     * Per-day visit counts for the last 14 calendar days (Asia/Jerusalem),
     * oldest first; missing days are filled with 0. `day` is YYYY-MM-DD.
     */
    daily: { day: string; count: number }[];
    /** Top referrer hosts in the last 30 days (top 8), most first. */
    byReferrer: { referrer: string; count: number }[];
    /** Top visited paths in the last 30 days (top 8), most first. */
    byPath: { path: string; count: number }[];
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Formats a date as a YYYY-MM-DD day key in the business's timezone. */
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Extracts a compact host label from a referrer URL, or "ישיר" for none. */
function referrerLabel(referrer: string | null): string {
  if (!referrer) return "ישיר / לא ידוע";
  try {
    return new URL(referrer).host || referrer;
  } catch {
    return referrer.slice(0, 60);
  }
}

function topN(counts: Record<string, number>, n: number): { label: string; count: number }[] {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Aggregates a full business snapshot for the analytics dashboard.
 * All queries run under the authenticated client (RLS-scoped to the owner).
 */
export async function getBusinessAnalytics(
  businessId: string,
): Promise<BusinessAnalytics> {
  const supabase = await createClient();

  const now = new Date();
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const [leads, customers, deals, tasks, quotes, content, calendar, conversations, messages, logs, visits] =
    await Promise.all([
      supabase.from("crm_leads").select("status").eq("business_id", businessId),
      supabase
        .from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase.from("crm_deals").select("stage, value").eq("business_id", businessId),
      supabase.from("crm_tasks").select("done").eq("business_id", businessId),
      supabase.from("quotes").select("status, items, discount, tax_rate").eq("business_id", businessId),
      supabase.from("content_items").select("type").eq("business_id", businessId),
      supabase.from("calendar_entries").select("status").eq("business_id", businessId),
      supabase
        .from("whatsapp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase.from("whatsapp_messages").select("direction").eq("business_id", businessId),
      supabase
        .from("agent_logs")
        .select("agent, tokens_in, tokens_out")
        .eq("business_id", businessId),
      supabase
        .from("site_visits")
        .select("created_at, referrer, path")
        .eq("business_id", businessId)
        .gte("created_at", thirtyDaysAgoIso),
    ]);

  const dealRows = deals.data ?? [];
  const openStages = new Set(["lead", "proposal", "negotiation"]);
  const pipelineValue = dealRows
    .filter((d) => openStages.has(d.stage))
    .reduce((s, d) => s + (d.value ?? 0), 0);
  const wonValue = dealRows
    .filter((d) => d.stage === "won")
    .reduce((s, d) => s + (d.value ?? 0), 0);

  const taskRows = tasks.data ?? [];
  const msgRows = messages.data ?? [];
  const logRows = logs.data ?? [];

  // Quotes: status breakdown, accepted value (incl. VAT), and conversion rate.
  const quoteRows = quotes.data ?? [];
  const acceptedValue = quoteRows
    .filter((q) => q.status === "accepted")
    .reduce(
      (s, q) =>
        s + computeQuoteTotals((q.items as QuoteItem[]) ?? [], q.discount, q.tax_rate).total,
      0,
    );
  const respondedStages = new Set(["sent", "accepted", "declined"]);
  const sentOut = quoteRows.filter((q) => respondedStages.has(q.status)).length;
  const acceptedCount = quoteRows.filter((q) => q.status === "accepted").length;
  const conversionRate = sentOut > 0 ? acceptedCount / sentOut : 0;

  // Site visits: 7/30-day rolling totals + a gap-free 14-day daily series
  // + referrer / top-pages breakdowns (last 30 days).
  const visitRows = visits.data ?? [];
  const sevenDaysAgoMs = now.getTime() - 7 * DAY_MS;
  const visitsLast7Days = visitRows.filter(
    (v) => new Date(v.created_at).getTime() >= sevenDaysAgoMs,
  ).length;
  const visitsByDay = countBy(visitRows, (v) => dayKeyFormat.format(new Date(v.created_at)));
  const visitsDaily = Array.from({ length: 14 }, (_, i) => {
    const day = dayKeyFormat.format(new Date(now.getTime() - (13 - i) * DAY_MS));
    return { day, count: visitsByDay[day] ?? 0 };
  });
  const referrerCounts = countBy(visitRows, (v) => referrerLabel(v.referrer));
  const pathCounts = countBy(
    visitRows.filter((v) => v.path),
    (v) => v.path as string,
  );

  return {
    leads: {
      total: leads.data?.length ?? 0,
      byStatus: countBy(leads.data ?? [], (r) => r.status),
    },
    customers: customers.count ?? 0,
    deals: {
      total: dealRows.length,
      byStage: countBy(dealRows, (r) => r.stage),
      pipelineValue,
      wonValue,
    },
    tasks: {
      open: taskRows.filter((t) => !t.done).length,
      done: taskRows.filter((t) => t.done).length,
    },
    quotes: {
      total: quoteRows.length,
      byStatus: countBy(quoteRows, (r) => r.status),
      acceptedValue,
      conversionRate,
    },
    content: {
      total: content.data?.length ?? 0,
      byType: countBy(content.data ?? [], (r) => r.type),
    },
    calendar: {
      planned: (calendar.data ?? []).filter((c) => c.status === "planned").length,
      published: (calendar.data ?? []).filter((c) => c.status === "published").length,
    },
    whatsapp: {
      conversations: conversations.count ?? 0,
      inbound: msgRows.filter((m) => m.direction === "inbound").length,
      outbound: msgRows.filter((m) => m.direction === "outbound").length,
    },
    ai: {
      calls: logRows.length,
      tokensIn: logRows.reduce((s, l) => s + (l.tokens_in ?? 0), 0),
      tokensOut: logRows.reduce((s, l) => s + (l.tokens_out ?? 0), 0),
      byAgent: countBy(logRows, (r) => r.agent),
    },
    visits: {
      last30Days: visitRows.length,
      last7Days: visitsLast7Days,
      daily: visitsDaily,
      byReferrer: topN(referrerCounts, 8).map((r) => ({ referrer: r.label, count: r.count })),
      byPath: topN(pathCounts, 8).map((r) => ({ path: r.label, count: r.count })),
    },
  };
}

/** Compact KPI strip for the overview page's top-of-page summary. */
export type KpiStrip = {
  /** Paid-order revenue for the current calendar month (Asia/Jerusalem). */
  monthRevenue: number;
  /** New leads created in the last 7 days. */
  newLeadsWeek: number;
  /** Open (not-done) CRM tasks. */
  openTasks: number;
  /** Site visits in the last 7 days. */
  visits7d: number;
};

/** Fetches the four headline KPIs shown at the top of the overview page. */
export async function getKpiStrip(businessId: string): Promise<KpiStrip> {
  const supabase = await createClient();

  const now = new Date();
  // First day of the current month AT Israel-local midnight, as the correct UTC
  // instant — a plain `new Date("YYYY-MM-01").toISOString()` is UTC midnight,
  // which lands ~3h into the Israeli month and drops early-of-month revenue.
  const ymIsrael = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const monthStart = zonedToUtc(`${ymIsrael}-01`, "00:00").toISOString();
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [orders, leads, tasks, visits] = await Promise.all([
    supabase
      .from("orders")
      .select("total")
      .eq("business_id", businessId)
      .eq("payment_status", "paid")
      .gte("paid_at", monthStart),
    supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", sevenDaysAgoIso),
    supabase.from("crm_tasks").select("done").eq("business_id", businessId),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", sevenDaysAgoIso),
  ]);

  const monthRevenue = (orders.data ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0);
  const openTasks = (tasks.data ?? []).filter((t) => !t.done).length;

  return {
    monthRevenue,
    newLeadsWeek: leads.count ?? 0,
    openTasks,
    visits7d: visits.count ?? 0,
  };
}

// ── Reports dashboard ───────────────────────────────────────────────────────

export type ReportBucket = "day" | "week" | "month";

/** Formats a bucket_start timestamp for chart axis labels and CSV exports. */
export function bucketLabel(iso: string, bucket: ReportBucket): string {
  const d = new Date(iso);
  if (bucket === "month") {
    return d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit" });
}

export type ReportPoint = {
  bucketStart: string;
  revenue: number;
  ordersCount: number;
  bookingsCount: number;
  leadsCount: number;
  visitsCount: number;
};

/**
 * Bucketed time series (day/week/month) of revenue, orders, bookings, leads
 * and site visits, via the get_business_report() SECURITY DEFINER RPC.
 */
export async function getBusinessReport(
  businessId: string,
  from: Date,
  to: Date,
  bucket: ReportBucket,
): Promise<ReportPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_business_report", {
    p_business_id: businessId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_bucket: bucket,
  });
  if (error) throw new Error(`Failed to load report: ${error.message}`);

  return (data ?? []).map((r) => ({
    bucketStart: r.bucket_start,
    revenue: Number(r.revenue) || 0,
    ordersCount: Number(r.orders_count) || 0,
    bookingsCount: Number(r.bookings_count) || 0,
    leadsCount: Number(r.leads_count) || 0,
    visitsCount: Number(r.visits_count) || 0,
  }));
}

/** Sums a report series into totals, for period-vs-previous-period deltas. */
export function sumReport(points: ReportPoint[]) {
  return points.reduce(
    (s, p) => ({
      revenue: s.revenue + p.revenue,
      ordersCount: s.ordersCount + p.ordersCount,
      bookingsCount: s.bookingsCount + p.bookingsCount,
      leadsCount: s.leadsCount + p.leadsCount,
      visitsCount: s.visitsCount + p.visitsCount,
    }),
    { revenue: 0, ordersCount: 0, bookingsCount: 0, leadsCount: 0, visitsCount: 0 },
  );
}

export type TopRow = { name: string; count: number; value: number };

/** Top products (by paid order line items) and top services (by bookings). */
export async function getTopProductsAndServices(
  businessId: string,
  from: Date,
  to: Date,
): Promise<{ products: TopRow[]; services: TopRow[] }> {
  const supabase = await createClient();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [paidOrders, bookings] = await Promise.all([
    supabase
      .from("orders")
      .select("id")
      .eq("business_id", businessId)
      .eq("payment_status", "paid")
      .gte("paid_at", fromIso)
      .lte("paid_at", toIso),
    supabase
      .from("bookings")
      .select("service")
      .eq("business_id", businessId)
      .not("status", "in", "(cancelled,blocked)")
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso),
  ]);

  const paidOrderIds = (paidOrders.data ?? []).map((o) => o.id);
  const productMap = new Map<string, TopRow>();
  if (paidOrderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price")
      .in("order_id", paidOrderIds);
    for (const it of items ?? []) {
      const cur = productMap.get(it.product_name) ?? { name: it.product_name, count: 0, value: 0 };
      cur.count += Number(it.quantity) || 0;
      cur.value += (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
      productMap.set(it.product_name, cur);
    }
  }

  const serviceMap = new Map<string, TopRow>();
  for (const b of bookings.data ?? []) {
    const name = b.service || "לא צוין";
    const cur = serviceMap.get(name) ?? { name, count: 0, value: 0 };
    cur.count += 1;
    serviceMap.set(name, cur);
  }

  return {
    products: [...productMap.values()].sort((a, b) => b.value - a.value).slice(0, 10),
    services: [...serviceMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}
