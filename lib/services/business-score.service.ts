import { createClient } from "@/lib/supabase/server";
import {
  computeBusinessScore,
  type BusinessScore,
  type ScoreHistoryPoint,
  type ScoreMetrics,
} from "@/lib/business-score";
import { computeQuoteTotals } from "@/lib/quote-totals";
import type { QuoteItem } from "@/types/database";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Snapshot cadence: re-snapshot once the latest row is older than this. */
const SNAPSHOT_STALE_MS = 6 * DAY_MS;

/**
 * Gathers business metrics under RLS and computes the deterministic
 * Business Score. Revenue = won deals + accepted-quote totals (incl. VAT).
 *
 * As a side effect (best-effort, never throws), records a history snapshot
 * in business_score_snapshots when the latest one is missing or stale
 * (> 6 days old) — this is what powers the trend sparkline on the score page.
 */
export async function getBusinessScore(
  businessId: string,
  { snapshot = true }: { snapshot?: boolean } = {},
): Promise<{ score: BusinessScore; metrics: ScoreMetrics }> {
  const supabase = await createClient();
  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const head = { count: "exact" as const, head: true };

  const [
    customers,
    deals,
    orders,
    quotes,
    content,
    social,
    ads,
    visits,
    tasks,
    bookings,
    website,
    reviews,
    waMsgs,
    leads,
    business,
  ] = await Promise.all([
    supabase.from("crm_customers").select("id", head).eq("business_id", businessId),
    supabase.from("crm_deals").select("stage, value").eq("business_id", businessId),
    supabase.from("orders").select("status").eq("business_id", businessId),
    supabase.from("quotes").select("status, items, discount, tax_rate").eq("business_id", businessId),
    supabase.from("content_items").select("id", head).eq("business_id", businessId),
    supabase.from("social_profiles").select("id", head).eq("business_id", businessId),
    supabase.from("ad_campaigns").select("id", head).eq("business_id", businessId),
    supabase
      .from("site_visits")
      .select("id", head)
      .eq("business_id", businessId)
      .gte("created_at", since30),
    supabase.from("crm_tasks").select("done").eq("business_id", businessId),
    supabase
      .from("bookings")
      .select("id", head)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .neq("status", "blocked"),
    supabase.from("websites").select("published").eq("business_id", businessId).maybeSingle(),
    supabase.from("reviews").select("rating").eq("business_id", businessId).eq("approved", true),
    supabase
      .from("whatsapp_messages")
      .select("id", head)
      .eq("business_id", businessId)
      .eq("direction", "outbound"),
    supabase.from("crm_leads").select("status").eq("business_id", businessId),
    supabase.from("businesses").select("payment_link").eq("id", businessId).maybeSingle(),
  ]);

  const dealRows = deals.data ?? [];
  const openStages = new Set(["lead", "proposal", "negotiation"]);
  const wonValue = dealRows.filter((d) => d.stage === "won").reduce((s, d) => s + (d.value ?? 0), 0);
  const pipelineValue = dealRows
    .filter((d) => openStages.has(d.stage))
    .reduce((s, d) => s + (d.value ?? 0), 0);

  const orderRows = orders.data ?? [];
  const ordersConfirmed = orderRows.filter(
    (o) => o.status === "confirmed" || o.status === "done",
  ).length;

  const quoteRows = quotes.data ?? [];
  const acceptedQuoteRows = quoteRows.filter((q) => q.status === "accepted");
  const acceptedValue = acceptedQuoteRows.reduce(
    (s, q) => s + computeQuoteTotals((q.items as QuoteItem[]) ?? [], q.discount, q.tax_rate).total,
    0,
  );

  const taskRows = tasks.data ?? [];
  const tasksDone = taskRows.filter((t) => t.done).length;
  const tasksOpen = taskRows.filter((t) => !t.done).length;

  const reviewRows = reviews.data ?? [];
  const reviewsCount = reviewRows.length;
  const avgRating =
    reviewsCount > 0 ? reviewRows.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewsCount : 0;

  const leadRows = leads.data ?? [];
  const leadsTotal = leadRows.length;
  const leadsConverted = leadRows.filter((l) => l.status === "qualified").length;

  const metrics: ScoreMetrics = {
    customers: customers.count ?? 0,
    wonValue,
    ordersConfirmed,
    acceptedQuotes: acceptedQuoteRows.length,
    contentCount: content.count ?? 0,
    socialProfiles: social.count ?? 0,
    adsCampaigns: ads.count ?? 0,
    visits30d: visits.count ?? 0,
    revenue: wonValue + acceptedValue,
    pipelineValue,
    hasPaymentLink: Boolean(business.data?.payment_link),
    tasksDone,
    tasksOpen,
    bookings: bookings.count ?? 0,
    sitePublished: Boolean(website.data?.published),
    reviewsCount,
    avgRating,
    whatsappReplies: waMsgs.count ?? 0,
    leadsTotal,
    leadsConverted,
  };

  const score = computeBusinessScore(metrics);

  // Best-effort history snapshot — never blocks or fails the page render.
  // Only the score-page's own load records it; the client-side metrics fetch
  // (getScoreMetrics) passes snapshot:false so the two calls per view can't
  // race and double-insert a snapshot.
  if (snapshot) recordSnapshotIfStale(businessId, score).catch(() => {});

  return { score, metrics };
}

/** Inserts a business_score_snapshots row if the latest one is missing/stale. */
async function recordSnapshotIfStale(businessId: string, score: BusinessScore): Promise<void> {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("business_score_snapshots")
    .select("created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isStale =
    !latest || Date.now() - new Date(latest.created_at).getTime() > SNAPSHOT_STALE_MS;
  if (!isStale) return;

  await supabase.from("business_score_snapshots").insert({
    business_id: businessId,
    total: score.overall,
    dimensions: score.dimensions,
  });
}

/**
 * Returns the last 8 score snapshots (oldest first) for the trend sparkline.
 * Called from lib/actions/score.ts (the client-facing server action wrapper).
 */
export async function getScoreHistory(businessId: string): Promise<ScoreHistoryPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_score_snapshots")
    .select("created_at, total")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? [])
    .map((r) => ({ date: r.created_at, total: r.total }))
    .reverse();
}

/**
 * Returns the raw score metrics for the "what's dragging the score down"
 * hints. Called from lib/actions/score.ts.
 */
export async function getScoreMetrics(businessId: string): Promise<ScoreMetrics> {
  const { metrics } = await getBusinessScore(businessId, { snapshot: false });
  return metrics;
}
