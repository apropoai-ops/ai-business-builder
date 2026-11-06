import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Certification } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All certifications for a business, owner-scoped (RLS), ordered for display. */
export async function listCertifications(businessId: string): Promise<Certification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCertification(
  businessId: string,
  fields: {
    title: string;
    issuer: string | null;
    year: string | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("certifications")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteCertification(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("certifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Published-site fetch (service role), ordered for the storefront grid. */
export async function listPublicCertifications(businessId: string): Promise<Certification[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("certifications")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
