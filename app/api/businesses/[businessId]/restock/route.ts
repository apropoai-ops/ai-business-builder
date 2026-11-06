import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/run";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

const schema = z.object({
  items: z
    .array(
      z.object({
        product: z.string().describe("שם המוצר"),
        action: z.enum(["restock", "reduce", "ok"]).describe("חידוש מלאי / הפחתה / תקין"),
        suggestedQty: z.number().describe("כמות מומלצת להזמנה (0 אם אין צורך)"),
        reason: z.string().describe("נימוק קצר בעברית"),
      }),
    )
    .max(25),
});

const SYSTEM = `אתה מנהל רכש ומלאי לחנות אופנה בישראל.
על סמך מהירות המכירה (יחידות שנמכרו ב-60 הימים האחרונים) והמלאי הנוכחי לכל מוצר,
המלץ אילו מוצרים לחדש ובאיזו כמות, אילו להפחית, ואילו תקינים. כתוב בעברית, קצר וענייני.`;

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

  const supabase = await createClient();
  const [{ data: products }, { data: items }, { data: variants }] = await Promise.all([
    supabase.from("products").select("id, name, stock_qty, track_inventory").eq("business_id", businessId).eq("active", true),
    supabase.from("order_items").select("product_id, quantity, created_at").eq("business_id", businessId),
    supabase.from("product_variants").select("product_id, stock_qty").eq("business_id", businessId),
  ]);

  if (!products?.length) {
    return NextResponse.json({ error: "אין מוצרים פעילים לניתוח" }, { status: 400 });
  }

  // Units sold per product in the last 60 days.
  const cutoff = Date.now() - 60 * 86_400_000;
  const sold = new Map<string, number>();
  for (const it of items ?? []) {
    if (!it.product_id) continue;
    if (new Date(it.created_at).getTime() < cutoff) continue;
    sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + (Number(it.quantity) || 0));
  }
  // Variant stock totals per product.
  const variantStock = new Map<string, number>();
  for (const v of variants ?? []) {
    variantStock.set(v.product_id, (variantStock.get(v.product_id) ?? 0) + (Number(v.stock_qty) || 0));
  }

  const lines = products.slice(0, 40).map((p) => {
    const stock = p.track_inventory ? variantStock.get(p.id) ?? 0 : p.stock_qty ?? 0;
    return `${p.name}: נמכרו ${sold.get(p.id) ?? 0} ב-60 יום, מלאי נוכחי ${stock}`;
  });

  try {
    const result = await runStructured({
      agent: "restock",
      businessId,
      schema,
      system: SYSTEM,
      prompt: `מוצרים:\n${lines.join("\n")}`,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת ההמלצות נכשלה" },
      { status: 500 },
    );
  }
}
