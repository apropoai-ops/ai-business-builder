import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Donation } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listDonations(businessId: string): Promise<Donation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("donations")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDonation(
  businessId: string,
  fields: {
    title: string;
    description: string | null;
    goal_amount: number | null;
    raised_amount: number;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("donations")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteDonation(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("donations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setDonationActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("donations").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, scoped to active campaigns) ───────────────────────

export async function listPublicDonations(businessId: string): Promise<Donation[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("donations")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
