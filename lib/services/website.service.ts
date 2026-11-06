import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  Website, Business, BrandAssets, Product, ProductVariant, ShippingMethod, TablesInsert,
} from "@/types/database";
import { getPlanForBusiness } from "@/lib/quota";
import { resolveDesignTier, type DesignTier } from "@/lib/design-tier";
import { resolveSiteMode, type SiteMode } from "@/lib/site-mode";
import { cache } from "react";

export async function getWebsite(businessId: string): Promise<Website | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("websites")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load website: ${error.message}`);
  return data;
}

export async function upsertWebsite(
  businessId: string,
  fields: Omit<TablesInsert<"websites">, "business_id">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("websites")
    .upsert(
      { business_id: businessId, ...fields },
      { onConflict: "business_id" },
    );

  if (error) throw new Error(`Failed to save website: ${error.message}`);
}

/**
 * The publish switch. `websites.published` is what the whole paywall hangs on
 * (lib/actions/website.ts:65-79), so since 0085 no client role may write it —
 * trg_guard_publish raises 42501 on any INSERT/UPDATE that changes it. The
 * write therefore has to run as service_role, which means RLS no longer proves
 * the caller owns this business: that check moves here, on the user-scoped
 * client, so a future call site can't publish someone else's site by passing
 * its id.
 */
export async function setWebsitePublishState(
  businessId: string,
  fields: { slug?: string; published: boolean },
): Promise<void> {
  const rls = await createClient();
  const { data: owned } = await rls
    .from("websites")
    .select("business_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!owned) throw new Error("האתר לא נמצא");

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("websites")
    .update(fields)
    .eq("business_id", businessId);
  if (error) {
    if (error.code === "23505") {
      throw new Error("הכתובת הזו כבר תפוסה — נסו כתובת אחרת");
    }
    throw new Error(`Failed to update publish state: ${error.message}`);
  }
}

/**
 * Strips invisible directional / zero-width / BOM chars that can get appended
 * when a link is copied out of RTL (Hebrew) text — otherwise the slug won't
 * match and the storefront renders a confusing 404.
 */
function cleanSlug(slug: string): string {
  return slug.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").trim();
}

/**
 * The one thing EVERY public page needs before it renders anything: does this
 * slug exist and published, and which build mode is it in (does this route even
 * exist?). Deliberately tiny — the sub-route guards and the public layout run on
 * pages that never call getPublicSiteBySlug (e.g. /account), and React's `cache`
 * keeps it to one round trip per request no matter how many of them ask.
 */
export const getPublicSiteBasicsBySlug = cache(
  async (slug: string): Promise<{ mode: SiteMode } | null> => {
    const supabase = createServiceRoleClient();
    const { data: website } = await supabase
      .from("websites")
      .select("business_id")
      .eq("slug", cleanSlug(slug))
      .eq("published", true)
      .maybeSingle();
    if (!website) return null;

    const { data: business } = await supabase
      .from("businesses")
      .select("site_mode")
      .eq("id", website.business_id)
      .maybeSingle();

    return { mode: resolveSiteMode(business?.site_mode) };
  },
);

export type PublicSite = {
  website: Website;
  business: Pick<
    Business,
    | "name"
    | "description"
    | "location"
    | "industry"
    | "shipping_fee"
    | "free_shipping_threshold"
    | "announcement_bar"
    | "size_guide"
    | "payment_methods"
    | "bank_details"
    | "bit_phone"
    | "paypal_link"
    | "payment_link"
    | "popup_enabled"
    | "popup_title"
    | "popup_text"
    | "popup_coupon"
    | "loyalty_enabled"
    | "loyalty_earn"
    | "loyalty_value"
    | "referral_enabled"
    | "referral_points"
    | "module_config"
    | "design_tier"
    | "site_mode"
    | "catalog_only"
  >;
  brand: Pick<
    BrandAssets,
    "brand_name" | "slogan" | "color_palette" | "typography" | "logo_url"
  > | null;
  whatsappPhone: string | null;
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  shippingMethods: ShippingMethod[];
  /** Resolved visual "league" the storefront renders in — derived server-side
   *  from businesses.design_tier + the OWNER's plan (never trust a stale
   *  client value; a downgraded plan always clamps back down). */
  designTier: DesignTier;
};

/**
 * Public site lookup for /s/[slug]. Uses the service-role client because the
 * visitor is anonymous — access is intentionally restricted in code to
 * published sites only, and only display fields are returned.
 */
export async function getPublicSiteBySlug(slug: string): Promise<PublicSite | null> {
  const supabase = createServiceRoleClient();

  slug = cleanSlug(slug);

  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return null;

  const [{ data: business }, { data: brand }, { data: wa }, { data: products }] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, description, location, industry, shipping_fee, free_shipping_threshold, announcement_bar, size_guide, payment_methods, bank_details, bit_phone, paypal_link, payment_link, popup_enabled, popup_title, popup_text, popup_coupon, loyalty_enabled, loyalty_earn, loyalty_value, referral_enabled, referral_points, module_config, design_tier, site_mode, catalog_only")
      .eq("id", website.business_id)
      .maybeSingle(),
    supabase
      .from("brand_assets")
      .select("brand_name, slogan, color_palette, typography, logo_url")
      .eq("business_id", website.business_id)
      .maybeSingle(),
    supabase
      .from("whatsapp_config")
      .select("display_phone")
      .eq("business_id", website.business_id)
      .maybeSingle(),
    // sort_order alone is NOT a total order: nothing in the app writes it, so
    // every product added through the product form sits at the column default
    // 0 and Postgres is free to return tied rows in any order — which, with
    // the .limit(24) below, also makes *which* products render arbitrary.
    // created_at then id break every tie, matching listProducts (store.service)
    // so the owner's list and the public storefront agree.
    supabase
      .from("products")
      .select("*")
      .eq("business_id", website.business_id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(24),
  ]);
  if (!business) return null;

  // Variants for inventory-tracked products (service role — public read).
  const variantsByProduct: Record<string, ProductVariant[]> = {};
  const trackedIds = (products ?? [])
    .filter((p) => p.track_inventory)
    .map((p) => p.id);
  if (trackedIds.length > 0) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .in("product_id", trackedIds)
      .order("sort", { ascending: true });
    for (const v of variants ?? []) (variantsByProduct[v.product_id] ??= []).push(v);
  }

  const { data: shippingMethods } = await supabase
    .from("shipping_methods")
    .select("*")
    .eq("business_id", website.business_id)
    .eq("active", true)
    .order("sort", { ascending: true });

  // Resolved server-side from the OWNER's plan — a visitor never sees a tier
  // above what the owner currently pays for, even if design_tier is stale
  // from a since-downgraded plan.
  const plan = await getPlanForBusiness(website.business_id).catch(() => null);
  const designTier = resolveDesignTier(business.design_tier, plan?.tier ?? "free");

  return {
    website,
    business,
    brand: brand ?? null,
    whatsappPhone: wa?.display_phone ?? null,
    products: (products ?? []) as Product[],
    variantsByProduct,
    shippingMethods: shippingMethods ?? [],
    designTier,
  };
}
