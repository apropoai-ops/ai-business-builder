import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Testimonial } from "@/types/database";

/**
 * Owner-curated testimonials / case studies — short quotes the business owner
 * picks to showcase on their public site. Distinct from customer-submitted
 * reviews: these are hand-entered by the owner, never moderated.
 */

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listTestimonials(businessId: string): Promise<Testimonial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTestimonial(
  businessId: string,
  fields: {
    author: string;
    role: string | null;
    quote: string;
    photo_url: string | null;
    rating: number | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("testimonials")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteTestimonial(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ──────────────────────────────────────────────────

export async function listPublicTestimonials(businessId: string): Promise<Testimonial[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("testimonials")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
