import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { GalleryItem } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All gallery items for a business, owner-scoped, ordered by sort. */
export async function listGallery(businessId: string): Promise<GalleryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createGalleryItem(
  businessId: string,
  fields: { image_url: string; title?: string | null; caption?: string | null },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // New items go to the end of the gallery.
  const { data: last } = await supabase
    .from("gallery_items")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (last?.sort ?? -1) + 1;
  const { error } = await supabase.from("gallery_items").insert({
    business_id: businessId,
    image_url: fields.image_url,
    title: fields.title ?? null,
    caption: fields.caption ?? null,
    sort,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, no RLS) ───────────────────────────────────────────

/** Gallery items for a business storefront, ordered by sort. */
export async function listPublicGallery(businessId: string): Promise<GalleryItem[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("gallery_items")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
