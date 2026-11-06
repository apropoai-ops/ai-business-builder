import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/run";
import { dailyBriefSchema, type DailyBriefContent } from "@/lib/ai/schemas/daily-brief";
import type { Business, DailyBrief, Json } from "@/types/database";

const SYSTEM_PROMPT = `אתה ה-AI CEO — היועץ העסקי האישי של בעל העסק.
כל בוקר אתה מנתח את נתוני העסק ומפיק "תדריך יומי" קצר, חד ומעשי.

הנחיות:
- כתוב בעברית ישירה, בגובה העיניים, בלי קלישאות.
- התבסס אך ורק על הנתונים שקיבלת — אל תמציא מספרים.
- לידים שלא טופלו, עסקאות תקועות, ומשימות באיחור = עדיפות גבוהה.
- אם אין הרבה נתונים — המלץ על פעולות שמייצרות תנועה (פרסום תוכן, פנייה ללידים).
- הפעולות חייבות להיות ברות-ביצוע היום, לא חזון רחוק.`;

/** Gathers a compact snapshot of the business (service role — cron has no user). */
async function gatherContext(businessId: string): Promise<string> {
  const s = createServiceRoleClient();
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const in7d = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  const [leads, deals, tasks, calendar, waMsgs, bookings] = await Promise.all([
    s.from("crm_leads").select("name,status,source,created_at")
      .eq("business_id", businessId).order("created_at", { ascending: false }).limit(25),
    s.from("crm_deals").select("title,stage,value,updated_at")
      .eq("business_id", businessId).limit(25),
    s.from("crm_tasks").select("title,due_date")
      .eq("business_id", businessId).eq("done", false).limit(20),
    s.from("calendar_entries").select("title,platform,scheduled_for,status")
      .eq("business_id", businessId).gte("scheduled_for", today).lte("scheduled_for", in7d).limit(15),
    s.from("whatsapp_messages").select("direction")
      .eq("business_id", businessId).gte("created_at", since7d),
    s.from("bookings").select("customer_name,service,starts_at,status")
      .eq("business_id", businessId)
      .not("status", "in", "(cancelled,blocked)")
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", new Date(Date.now() + 7 * 86400_000).toISOString())
      .order("starts_at", { ascending: true }).limit(15),
  ]);

  const newLeads = (leads.data ?? []).filter((l) => l.status === "new");
  const staleDeals = (deals.data ?? []).filter(
    (d) => !["won", "lost"].includes(d.stage) &&
      new Date(d.updated_at) < new Date(Date.now() - 7 * 86400_000),
  );
  const overdueTasks = (tasks.data ?? []).filter(
    (t) => t.due_date && t.due_date < today,
  );

  return [
    `תאריך: ${today}`,
    `## לידים (${leads.data?.length ?? 0} סה"כ, ${newLeads.length} חדשים שלא טופלו)`,
    ...(leads.data ?? []).slice(0, 10).map(
      (l) => `- ${l.name} | סטטוס: ${l.status} | מקור: ${l.source ?? "—"}`,
    ),
    `## עסקאות (${deals.data?.length ?? 0}, מתוכן ${staleDeals.length} תקועות מעל שבוע)`,
    ...(deals.data ?? []).slice(0, 10).map(
      (d) => `- ${d.title} | שלב: ${d.stage} | שווי: ${d.value ?? "—"}`,
    ),
    `## משימות פתוחות (${tasks.data?.length ?? 0}, באיחור: ${overdueTasks.length})`,
    ...(tasks.data ?? []).slice(0, 8).map((t) => `- ${t.title} | יעד: ${t.due_date ?? "—"}`),
    `## לוח תוכן לשבוע הקרוב (${calendar.data?.length ?? 0} פריטים)`,
    ...(calendar.data ?? []).slice(0, 8).map(
      (c) => `- ${c.scheduled_for} | ${c.platform} | ${c.title} | ${c.status}`,
    ),
    `## תורים קרובים (7 ימים): ${bookings.data?.length ?? 0}${
      (bookings.data ?? []).filter((b) => b.status === "pending").length > 0
        ? ` — מתוכם ${(bookings.data ?? []).filter((b) => b.status === "pending").length} ממתינים לאישור!`
        : ""
    }`,
    ...(bookings.data ?? []).slice(0, 8).map(
      (b) =>
        `- ${new Date(b.starts_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} | ${b.customer_name}${b.service ? ` | ${b.service}` : ""} | ${b.status}`,
    ),
    `## וואטסאפ (7 ימים): ${
      (waMsgs.data ?? []).filter((m) => m.direction === "inbound").length
    } נכנסות, ${
      (waMsgs.data ?? []).filter((m) => m.direction === "outbound").length
    } תגובות סוכן`,
  ].join("\n");
}

/** Generates and stores today's brief (idempotent per day unless force=true). */
export async function generateDailyBrief(
  business: Business,
  force = false,
): Promise<DailyBriefContent> {
  const s = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  if (!force) {
    const { data: existing } = await s
      .from("daily_briefs")
      .select("content")
      .eq("business_id", business.id)
      .eq("brief_date", today)
      .maybeSingle();
    if (existing) return existing.content as DailyBriefContent;
  }

  const context = await gatherContext(business.id);
  const brief = await runStructured({
    agent: "daily_brief",
    businessId: business.id,
    schema: dailyBriefSchema,
    system: SYSTEM_PROMPT,
    prompt: `הפק תדריך יומי לעסק "${business.name ?? "העסק"}" (${business.industry ?? business.type ?? ""}).\n\n${context}`,
  });

  await s.from("daily_briefs").upsert(
    {
      business_id: business.id,
      brief_date: today,
      content: brief as unknown as Json,
    },
    { onConflict: "business_id,brief_date" },
  );

  return brief;
}

/** Past briefs for the dashboard history (authenticated, RLS-scoped), excluding today's. */
export async function listRecentBriefs(
  businessId: string,
  limit = 7,
): Promise<DailyBrief[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("business_id", businessId)
    .lt("brief_date", today)
    .order("brief_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Latest brief for the dashboard (authenticated, RLS-scoped). */
export async function getLatestBrief(businessId: string): Promise<DailyBrief | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("business_id", businessId)
    .order("brief_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
