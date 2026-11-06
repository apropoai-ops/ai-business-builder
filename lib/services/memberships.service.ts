import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Membership } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listMemberships(businessId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createMembership(
  businessId: string,
  fields: {
    name: string;
    price: number | null;
    period: string | null;
    perks: string[];
    highlight: boolean;
    imageUrl: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").insert({
    business_id: businessId,
    name: fields.name,
    price: fields.price,
    period: fields.period,
    perks: fields.perks,
    highlight: fields.highlight,
    image_url: fields.imageUrl,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteMembership(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

export async function listPublicMemberships(
  businessId: string,
): Promise<Membership[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("memberships")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}
