import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { ProcessStep } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listProcessSteps(businessId: string): Promise<ProcessStep[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("process_steps")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProcessStep(
  businessId: string,
  fields: { title: string; description: string | null; image_url: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Append to the end: next sort = current max + 1.
  const { data: last } = await supabase
    .from("process_steps")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (last?.sort ?? -1) + 1;
  const { error } = await supabase.from("process_steps").insert({
    business_id: businessId,
    title: fields.title,
    description: fields.description,
    image_url: fields.image_url,
    sort,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteProcessStep(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("process_steps").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

export async function listPublicProcessSteps(businessId: string): Promise<ProcessStep[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("process_steps")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}
