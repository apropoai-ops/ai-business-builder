import { createClient } from "@/lib/supabase/server";
import type { AdCampaign, Json } from "@/types/database";

export async function getAdCampaigns(businessId: string): Promise<AdCampaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("business_id", businessId);

  if (error) throw new Error(`Failed to load ad campaigns: ${error.message}`);
  return data ?? [];
}

export async function upsertAdCampaign(
  businessId: string,
  campaign: {
    platform: string;
    objective: string;
    campaign: Json;
    audiences: Json;
    ad_copies: Json;
    creatives: Json;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_campaigns").upsert(
    {
      business_id: businessId,
      ...campaign,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,platform" },
  );
  if (error) throw new Error(`Failed to upsert ad campaign: ${error.message}`);
}
