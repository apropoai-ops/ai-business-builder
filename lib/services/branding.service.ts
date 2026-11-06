import { createClient } from "@/lib/supabase/server";
import type { BrandAssets, TablesInsert } from "@/types/database";

export async function getBrandAssets(
  businessId: string,
): Promise<BrandAssets | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_assets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load brand assets: ${error.message}`);
  return data;
}

export async function upsertBrandAssets(
  businessId: string,
  fields: Omit<TablesInsert<"brand_assets">, "business_id">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_assets")
    .upsert(
      { business_id: businessId, ...fields },
      { onConflict: "business_id" },
    );

  if (error) throw new Error(`Failed to save brand assets: ${error.message}`);
}
