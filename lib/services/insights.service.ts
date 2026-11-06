import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/services/business.service";
import { getBusinessScore } from "@/lib/services/business-score.service";
import { generateInsights } from "@/lib/ai/agents/insights";
import type { Insights } from "@/lib/ai/schemas/insights";
import type { Json } from "@/types/database";

export type StoredInsights = {
  content: Insights;
  overallScore: number | null;
  generatedAt: string;
};

/** Latest stored insights for a business (RLS). */
export async function getInsights(businessId: string): Promise<StoredInsights | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_insights")
    .select("content, overall_score, generated_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    content: data.content as unknown as Insights,
    overallScore: data.overall_score,
    generatedAt: data.generated_at,
  };
}

/** Generates fresh AI insights from the current score + metrics and stores them. */
export async function generateAndStoreInsights(businessId: string): Promise<StoredInsights> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("העסק לא נמצא");

  const { score, metrics } = await getBusinessScore(businessId);
  const insights = await generateInsights(business, score, metrics);

  const supabase = await createClient();
  const generatedAt = new Date().toISOString();
  const { error } = await supabase.from("business_insights").upsert(
    {
      business_id: businessId,
      overall_score: score.overall,
      content: insights as unknown as Json,
      generated_at: generatedAt,
    },
    { onConflict: "business_id" },
  );
  if (error) throw new Error(error.message);

  return { content: insights, overallScore: score.overall, generatedAt };
}
