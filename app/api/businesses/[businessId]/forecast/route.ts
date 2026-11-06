import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";
import { getStoreSalesStats } from "@/lib/services/store-analytics.service";
import { runStructured } from "@/lib/ai/run";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

const schema = z.object({
  summary: z.string().describe("משפט-שניים בעברית שמסכמים את מצב המכירות והצפי"),
  nextPeriodRevenue: z.number().describe("הכנסה צפויה ל-30 הימים הקרובים, ₪, מספר בלבד"),
  nextPeriodUnits: z.number().describe("יחידות צפויות ל-30 הימים הקרובים"),
  trend: z.enum(["up", "down", "stable"]).describe("מגמה: עולה / יורד / יציב"),
  recommendations: z.array(z.string()).min(2).max(5).describe("2-5 המלצות פעולה קצרות בעברית"),
});

const SYSTEM = `אתה אנליסט מכירות לחנות אופנה אונליין בישראל.
על סמך נתוני המכירות שתקבל, תן תחזית ריאלית ל-30 הימים הקרובים והמלצות מעשיות.
היה זהיר ומציאותי; אם הנתונים דלים, ציין זאת והערך בזהירות. כתוב בעברית.`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "ai_insights")) {
    return NextResponse.json({ error: upgradeMessage("ai_insights") }, { status: 403 });
  }

  // Gather sales stats + last-30 vs prior-30 day revenue for trend context.
  const supabase = await createClient();
  const stats = await getStoreSalesStats(businessId);
  const { data: orders } = await supabase
    .from("orders")
    .select("total, status, created_at")
    .eq("business_id", businessId)
    .neq("status", "cancelled");

  const now = Date.now();
  const DAY = 86_400_000;
  let last30 = 0;
  let prev30 = 0;
  for (const o of orders ?? []) {
    const age = now - new Date(o.created_at).getTime();
    const v = Number(o.total) || 0;
    if (age <= 30 * DAY) last30 += v;
    else if (age <= 60 * DAY) prev30 += v;
  }

  try {
    const forecast = await runStructured({
      agent: "sales_forecast",
      businessId,
      schema,
      system: SYSTEM,
      prompt: [
        `העסק: ${business.name ?? ""} — ${business.description.slice(0, 160)}`,
        `סה"כ הכנסות: ₪${stats.revenue}, הזמנות: ${stats.orderCount}, ממוצע הזמנה: ₪${stats.aov}, יחידות: ${stats.units}.`,
        `הכנסות 30 ימים אחרונים: ₪${Math.round(last30)}; 30 הימים שלפניהם: ₪${Math.round(prev30)}.`,
        stats.bestSellers.length
          ? `מוצרים מובילים: ${stats.bestSellers.map((b) => `${b.name} (${b.qty})`).join(", ")}.`
          : "אין עדיין נתוני מוצרים מובילים.",
      ].join("\n"),
    });
    return NextResponse.json({ forecast });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת התחזית נכשלה" },
      { status: 500 },
    );
  }
}
