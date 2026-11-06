import { createClient } from "@/lib/supabase/server";
import type { Job, JobStatus, JobType, Json } from "@/types/database";

/**
 * Job service — async work queue for heavy AI generation tasks.
 */

export async function createJob(
  businessId: string,
  type: JobType,
  payload?: Json,
): Promise<Job> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({ business_id: businessId, type, payload: payload ?? null })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message}`);
  }
  return data;
}

export async function getLatestJob(
  businessId: string,
  type: JobType,
): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("business_id", businessId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load job: ${error.message}`);
  }
  return data;
}

export async function setJobStatus(
  jobId: string,
  status: JobStatus,
  extra?: { error?: string | null; result?: Json | null },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status,
      error: extra?.error ?? null,
      result: extra?.result ?? null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }
}
