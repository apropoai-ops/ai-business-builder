import { createClient } from "@/lib/supabase/server";
import type { MarketResearch, TablesInsert } from "@/types/database";

export async function getMarketResearch(
  businessId: string,
): Promise<MarketResearch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_research")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load market research: ${error.message}`);
  return data;
}

export async function upsertMarketResearch(
  businessId: string,
  fields: Omit<TablesInsert<"market_research">, "business_id">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("market_research")
    .upsert(
      { business_id: businessId, ...fields },
      { onConflict: "business_id" },
    );

  if (error) throw new Error(`Failed to save market research: ${error.message}`);
}
