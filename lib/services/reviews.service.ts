import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Review } from "@/types/database";

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

/** All reviews for a business (owner dashboard), newest first. */
export async function listReviews(businessId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Publish (approve=true) or hide (approve=false) a review. */
export async function setReviewApproved(
  id: string,
  approved: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ approved })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Mark a review as a verified purchase (or clear the flag). */
export async function setReviewVerified(
  id: string,
  verified: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ verified })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteReview(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** The published-site slug for a business (used to revalidate /s/[slug]). */
export async function getBusinessSlug(businessId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("slug")
    .eq("business_id", businessId)
    .maybeSingle();
  return data?.slug ?? null;
}

// ── Public (service role, scoped to published sites) ───────────────────────

export type PublicReview = Pick<
  Review,
  "id" | "customer_name" | "rating" | "content" | "created_at" | "image_url" | "verified"
>;

/**
 * Uploads an optional customer photo for a review (service role — storage has
 * no user-facing policies). Mirrors `uploadProductImage` in store.service.ts:
 * writes to the `site-assets` bucket and returns a public URL.
 */
export async function uploadReviewImage(
  businessId: string,
  file: File,
): Promise<string> {
  const supabase = createServiceRoleClient();
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${businessId}/reviews/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "image/jpeg";
  // A Blob, never a raw Buffer — see uploadSiteAsset in lib/services/image-gen.ts:
  // storage-js sends a Buffer as the bare fetch body, which Vercel's runtime
  // UTF-8-mangles. A Blob takes the multipart branch and stays byte-exact.
  const blob = new Blob([new Uint8Array(await file.arrayBuffer())], { type: contentType });
  const { error } = await supabase.storage
    .from("site-assets")
    .upload(path, blob, { contentType, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
  return data.publicUrl;
}

/** Resolves a slug to its business id — only for PUBLISHED sites. */
async function publicBusinessId(slug: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return website?.business_id ?? null;
}

/** Approved reviews for a published site, newest first. */
export async function getApprovedReviews(
  slug: string,
  limit = 12,
): Promise<PublicReview[]> {
  const businessId = await publicBusinessId(slug);
  if (!businessId) return [];

  const s = createServiceRoleClient();
  const { data } = await s
    .from("reviews")
    .select("id,customer_name,rating,content,created_at,image_url,verified")
    .eq("business_id", businessId)
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Anonymous visitor submits a review. It lands UNAPPROVED (approved=false)
 * and only appears on the site after the owner publishes it from the dashboard.
 */
export async function createPublicReview(
  slug: string,
  input: { name: string; rating: number; content: string; image?: File | null },
): Promise<{ ok: boolean; error?: string }> {
  const businessId = await publicBusinessId(slug);
  if (!businessId) return { ok: false, error: "האתר אינו זמין" };

  let imageUrl: string | null = null;
  if (input.image) {
    try {
      imageUrl = await uploadReviewImage(businessId, input.image);
    } catch {
      return { ok: false, error: "העלאת התמונה נכשלה — נסו שוב" };
    }
  }

  const s = createServiceRoleClient();
  const { error } = await s.from("reviews").insert({
    business_id: businessId,
    customer_name: input.name,
    rating: input.rating,
    content: input.content,
    image_url: imageUrl,
    approved: false,
  });
  if (error) return { ok: false, error: "השליחה נכשלה — נסו שוב" };
  return { ok: true };
}
