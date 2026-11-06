import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { JobOpening } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All openings for the owner dashboard, newest first. */
export async function listJobs(businessId: string): Promise<JobOpening[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_openings")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createJob(
  businessId: string,
  fields: {
    title: string;
    location: string | null;
    employment_type: string | null;
    description: string | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_openings")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setJobActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_openings")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Active openings for the published site, in display order. */
export async function listPublicJobs(businessId: string): Promise<JobOpening[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("job_openings")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
