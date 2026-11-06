import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Partner } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All partners for a business, ordered for the manager list. */
export async function listPartners(businessId: string): Promise<Partner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPartner(
  businessId: string,
  fields: { name: string; logo_url: string | null; link: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deletePartner(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, for the published storefront) ─────────────────────

/** Partners for a business, in display order, fetched with the service role. */
export async function listPublicPartners(businessId: string): Promise<Partner[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("partners")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
