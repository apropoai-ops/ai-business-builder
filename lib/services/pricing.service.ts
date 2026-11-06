import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { PricingPlan } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listPricing(businessId: string): Promise<PricingPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_plans")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPricingPlan(
  businessId: string,
  fields: {
    name: string;
    price: number | null;
    period: string | null;
    features: string[];
    highlight: boolean;
    imageUrl: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_plans").insert({
    business_id: businessId,
    name: fields.name,
    price: fields.price,
    period: fields.period,
    features: fields.features,
    highlight: fields.highlight,
    image_url: fields.imageUrl,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deletePricingPlan(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

export async function listPublicPricing(
  businessId: string,
): Promise<PricingPlan[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("pricing_plans")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}
