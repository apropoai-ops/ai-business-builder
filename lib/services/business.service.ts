import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  Business,
  BusinessProfile,
  BusinessStatus,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";

/**
 * Business service — all reads/writes go through here so UI never touches
 * Supabase directly. RLS guarantees tenant isolation at the database level.
 */

/**
 * Lists businesses visible to the signed-in user — deliberately unfiltered
 * by owner_id: RLS (businesses_all_own + businesses_select_member, see
 * 0067_business_members.sql) already scopes rows to businesses the user owns
 * OR is an active team member of. Do not add an .eq("owner_id", ...) filter
 * here — it would hide businesses the user only has member access to.
 */
export async function listBusinesses(): Promise<Business[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list businesses: ${error.message}`);
  }
  return data ?? [];
}

export async function getBusiness(id: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load business: ${error.message}`);
  }
  return data;
}

export async function createBusiness(
  ownerId: string,
  input: Omit<TablesInsert<"businesses">, "owner_id">,
): Promise<Business> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert({ ...input, owner_id: ownerId })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create business: ${error?.message}`);
  }
  return data;
}

/**
 * Persists the AI-picked set of vertical-specific nav keys to hide for this
 * business (lib/ai/agents/nav-relevance.ts). Best-effort by design — callers
 * swallow errors rather than fail business creation over this.
 */
export async function updateHiddenNavKeys(
  id: string,
  hiddenNavKeys: string[],
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      hidden_nav_keys: hiddenNavKeys,
      ai_nav_classified_at: new Date().toISOString(),
    } as TablesUpdate<"businesses">)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update hidden nav keys: ${error.message}`);
  }
}

/**
 * Uploads one photo to the business's general gallery (site-assets bucket,
 * same pattern as uploadProductImage in lib/services/store.service.ts) and
 * appends it to `gallery_items` — the same table the "מודולים לאתר" gallery
 * manager and the public site's gallery section already read from
 * (lib/services/gallery.service.ts). General photos — of the business, or of
 * products before any product record exists yet — taken at the moment the
 * owner opens a new or existing business.
 */
export async function uploadGalleryImage(businessId: string, file: File): Promise<string> {
  const supabase = createServiceRoleClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${businessId}/gallery/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || "image/jpeg";
  // A Blob, never a raw Buffer — see uploadSiteAsset in lib/services/image-gen.ts:
  // storage-js sends a Buffer as the bare fetch body, which Vercel's runtime
  // UTF-8-mangles. A Blob takes the multipart branch and stays byte-exact.
  const blob = new Blob([new Uint8Array(await file.arrayBuffer())], { type: contentType });
  const { error: uploadError } = await supabase.storage
    .from("site-assets")
    .upload(path, blob, { contentType, upsert: true });
  if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
  const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const client = await createClient();
  const { data: last } = await client
    .from("gallery_items")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: writeError } = await client
    .from("gallery_items")
    .insert({ business_id: businessId, image_url: url, sort: (last?.sort ?? -1) + 1 });
  if (writeError) throw new Error(`Failed to save gallery image: ${writeError.message}`);

  return url;
}

/** Removes one photo from the business's gallery (row only — the storage object is left in place, matching how product image slots are overwritten rather than swept). */
export async function deleteGalleryImage(businessId: string, url: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gallery_items")
    .delete()
    .eq("business_id", businessId)
    .eq("image_url", url);
  if (error) throw new Error(`Failed to remove gallery image: ${error.message}`);
}

export async function setBusinessStatus(
  id: string,
  status: BusinessStatus,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ status } as TablesUpdate<"businesses">)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update business status: ${error.message}`);
  }
}

export async function getBusinessProfile(
  businessId: string,
): Promise<BusinessProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load business profile: ${error.message}`);
  }
  return data;
}

export async function upsertBusinessProfile(
  businessId: string,
  fields: Omit<TablesInsert<"business_profiles">, "business_id">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_profiles")
    .upsert(
      { business_id: businessId, ...fields },
      { onConflict: "business_id" },
    );

  if (error) {
    throw new Error(`Failed to save business profile: ${error.message}`);
  }
}

export async function updateBusinessProfile(
  businessId: string,
  fields: TablesUpdate<"business_profiles">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_profiles")
    .update(fields)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to update business profile: ${error.message}`);
  }
}
