import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Faq } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All FAQs for a business, owner-scoped, ordered for the manager UI. */
export async function listFaqs(businessId: string): Promise<Faq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFaq(
  businessId: string,
  fields: { question: string; answer: string | null; image_url: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Append to the end: next sort = current max + 1 (0 when empty).
  const { data: last } = await supabase
    .from("faqs")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = last ? last.sort + 1 : 0;
  const { error } = await supabase
    .from("faqs")
    .insert({ business_id: businessId, sort, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function updateFaq(
  id: string,
  fields: { question: string; answer: string | null; image_url: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").update(fields).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ──────────────────────────────────────────────────

/** FAQs for a published storefront, ordered as the owner arranged them. */
export async function listPublicFaqs(businessId: string): Promise<Faq[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("faqs")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
