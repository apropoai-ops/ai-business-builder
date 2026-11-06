import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Branch } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listBranches(businessId: string): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBranch(
  businessId: string,
  fields: {
    name: string;
    address: string | null;
    phone: string | null;
    hours: string | null;
    map_url: string | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteBranch(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Branches for a published storefront, in display order. */
export async function listPublicBranches(businessId: string): Promise<Branch[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("branches")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
