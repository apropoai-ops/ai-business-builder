import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { StatItem } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All stat rows for a business, in display order (owner-scoped via RLS). */
export async function listStats(businessId: string): Promise<StatItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stats")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createStat(
  businessId: string,
  fields: {
    label: string;
    value: string;
    suffix: string | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Append after the current last item.
  const { data: last } = await supabase
    .from("stats")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (last?.sort ?? -1) + 1;
  const { error } = await supabase
    .from("stats")
    .insert({ business_id: businessId, ...fields, sort });
  if (error) return { error: error.message };
  return {};
}

export async function deleteStat(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("stats").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Stats for a business's public site, in display order. */
export async function listPublicStats(businessId: string): Promise<StatItem[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("stats")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}
