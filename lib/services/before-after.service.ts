import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { BeforeAfter } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listBeforeAfter(businessId: string): Promise<BeforeAfter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("before_after")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBeforeAfter(
  businessId: string,
  fields: { title: string | null; before_url: string; after_url: string },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Append after the current last item.
  const { data: last } = await supabase
    .from("before_after")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (last?.sort ?? -1) + 1;
  const { error } = await supabase.from("before_after").insert({
    business_id: businessId,
    title: fields.title,
    before_url: fields.before_url,
    after_url: fields.after_url,
    sort,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteBeforeAfter(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("before_after").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

export async function listPublicBeforeAfter(businessId: string): Promise<BeforeAfter[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("before_after")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
