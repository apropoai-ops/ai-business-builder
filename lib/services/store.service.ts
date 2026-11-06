import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Product, ProductColor, ProductEngraving, ProductVariant } from "@/types/database";

/** Canonical UUID shape — gates anything interpolated into a storage key. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One editable variant row (size/color combo with its own stock + barcode). */
export type VariantInput = {
  id?: string;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  barcode?: string | null;
  stock_qty?: number;
};

/** Editable product fields shared by create + update (clothing-store aware). */
export type ProductFields = {
  name?: string;
  description?: string | null;
  price?: number | null;
  sale_price?: number | null;
  category?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  sizes?: string[] | null;
  colors?: ProductColor[] | null;
  engraving?: ProductEngraving | null;
  tags?: string[] | null;
  attributes?: Record<string, string>;
  sku?: string | null;
  brand?: string | null;
  subcategory?: string | null;
  full_description?: string | null;
  stock_qty?: number | null;
  low_stock_threshold?: number | null;
  track_inventory?: boolean;
  preorder?: boolean;
  barcode?: string | null;
  cost_price?: number | null;
  video_url?: string | null;
  wholesale_price?: number | null;
  status?: string;
  in_stock?: boolean;
  active?: boolean;
};

export async function listProducts(businessId: string): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    // id last so the order is total even if two rows share a created_at
    // (CSV import inserts in a tight loop). Must match the public query in
    // website.service.ts getPublicSiteBySlug.
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  // colors/sizes/engraving/images/tags are jsonb — always written in the
  // shape `Product` narrows them to (parseColors/parseEngraving in
  // lib/actions/store.ts), so this is a read-boundary cast, not a real gap.
  return (data ?? []) as Product[];
}

export async function createProduct(
  businessId: string,
  fields: ProductFields & { name: string },
): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ business_id: businessId, ...fields })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create product");
  return data as Product;
}

export async function updateProduct(
  id: string,
  fields: ProductFields,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Variants (per-size/color stock) ─────────────────────────────────────────

/** All variants for a business, grouped by product id (owner, RLS). */
export async function listVariantsByProduct(
  businessId: string,
): Promise<Record<string, ProductVariant[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true });
  const map: Record<string, ProductVariant[]> = {};
  for (const v of data ?? []) (map[v.product_id] ??= []).push(v);
  return map;
}

/**
 * Replaces a product's variant set (delete-then-insert is simplest and the
 * volumes are tiny). Owner RLS. Empty list just clears them.
 */
export async function replaceVariants(
  businessId: string,
  productId: string,
  variants: VariantInput[],
): Promise<void> {
  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId)
    .eq("business_id", businessId);
  if (delErr) throw new Error(delErr.message);

  const rows = variants
    .filter((v) => (v.size && v.size.trim()) || (v.color && v.color.trim()))
    .map((v, i) => ({
      business_id: businessId,
      product_id: productId,
      size: v.size?.trim() || null,
      color: v.color?.trim() || null,
      sku: v.sku?.trim() || null,
      barcode: v.barcode?.trim() || null,
      stock_qty: Math.max(0, Math.floor(Number(v.stock_qty) || 0)),
      sort: i,
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("product_variants").insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Uploads a product image (service role — storage has no user policies).
 * `slot` distinguishes gallery images so multiple uploads for one product
 * don't overwrite each other (slot 0 = primary).
 *
 * `businessId`/`productKey` are validated as UUIDs before they reach the
 * storage key. Storage has NO user policies — this runs as service role with
 * `upsert: true` — and the object key is sent as a URL path, so `fetch`
 * resolves any `..` segment in it before the request leaves us. An unvalidated
 * key like "../../<otherBusinessId>/products/x" would therefore escape the
 * caller's own "<businessId>/products/" prefix and overwrite another
 * business's image. The prefix is the only tenant boundary this bucket has, so
 * it is enforced here, at the point the path is built, rather than trusted
 * from callers.
 */
export async function uploadProductImage(
  businessId: string,
  productKey: string,
  file: File,
  slot = 0,
): Promise<string> {
  if (!UUID_RE.test(businessId) || !UUID_RE.test(productKey)) {
    throw new Error("Invalid image path");
  }
  const supabase = createServiceRoleClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const suffix = slot > 0 ? `-${slot}` : "";
  const path = `${businessId}/products/${productKey}${suffix}.${ext}`;
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
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Public single-product fetch for the product detail page (service role). */
export async function getPublicProductById(
  businessId: string,
  productId: string,
): Promise<{ product: Product; variants: ProductVariant[] } | null> {
  const s = createServiceRoleClient();
  const { data: product } = await s
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", businessId)
    .eq("active", true)
    .maybeSingle();
  if (!product) return null;

  let variants: ProductVariant[] = [];
  if (product.track_inventory) {
    const { data } = await s
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort", { ascending: true });
    variants = data ?? [];
  }
  return { product: product as Product, variants };
}
