import type { MetadataRoute } from "next";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { listPublicBlogForSitemap } from "@/lib/services/blog.service";
import { modeAllowsRoute, resolveSiteMode, type PublicRouteKey } from "@/lib/site-mode";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

// Google's practical per-sitemap limit is 50,000 URLs — each dynamic section
// below is capped well under that so the queries stay fast and bounded.
const MAX_SITES = 1000;
const MAX_PRODUCTS = 3000;
const MAX_POSTS = 2000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  let siteEntries: MetadataRoute.Sitemap = [];
  let productEntries: MetadataRoute.Sitemap = [];
  let blogEntries: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceRoleClient();
    const { data: websites, error } = await supabase
      .from("websites")
      .select("business_id, slug, updated_at, created_at")
      .eq("published", true)
      .not("slug", "is", null)
      .limit(MAX_SITES);

    if (!error && websites) {
      const sites = websites.filter(
        (site): site is typeof site & { slug: string } => site.slug !== null,
      );

      siteEntries = sites.map((site) => ({
        url: `${BASE_URL}/s/${site.slug}`,
        lastModified: new Date(site.updated_at ?? site.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

      const businessIdToSlug = new Map(sites.map((s) => [s.business_id, s.slug]));
      const businessIds = sites.map((s) => s.business_id);

      // A site only gets the sub-route URLs its build mode actually serves —
      // a landing page has no blog and a brochure site has no product pages,
      // and both now 404 (lib/public-route-guard.ts). Listing them would be
      // submitting soft-404s to Google.
      const { data: modeRows } = await supabase
        .from("businesses")
        .select("id, site_mode")
        .in("id", businessIds);
      const modeByBusiness = new Map(
        (modeRows ?? []).map((b) => [b.id, resolveSiteMode(b.site_mode)]),
      );
      const allows = (businessId: string, route: PublicRouteKey) =>
        modeAllowsRoute(modeByBusiness.get(businessId) ?? "website", route);

      siteEntries.push(
        ...sites
          .filter((site) => allows(site.business_id, "blog"))
          .map((site) => ({
            url: `${BASE_URL}/s/${site.slug}/blog`,
            lastModified: new Date(site.updated_at ?? site.created_at),
            changeFrequency: "weekly" as const,
            priority: 0.5,
          })),
      );

      if (businessIds.length > 0) {
        const [{ data: products }, posts] = await Promise.all([
          supabase
            .from("products")
            .select("id, business_id, updated_at")
            .eq("active", true)
            .in("business_id", businessIds)
            .limit(MAX_PRODUCTS),
          listPublicBlogForSitemap(businessIds),
        ]);

        if (products) {
          productEntries = products
            .map((p) => {
              const slug = businessIdToSlug.get(p.business_id);
              if (!slug || !allows(p.business_id, "product")) return null;
              return {
                url: `${BASE_URL}/s/${slug}/product/${p.id}`,
                lastModified: new Date(p.updated_at),
                changeFrequency: "weekly" as const,
                priority: 0.6,
              };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);
        }

        blogEntries = posts
          .slice(0, MAX_POSTS)
          .map((post) => {
            const slug = businessIdToSlug.get(post.business_id);
            if (!slug || !allows(post.business_id, "blog")) return null;
            return {
              url: `${BASE_URL}/s/${slug}/blog/${post.slug ?? post.id}`,
              lastModified: new Date(post.published_at ?? post.created_at),
              changeFrequency: "monthly" as const,
              priority: 0.5,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
      }
    }
  } catch {
    // If the database is unreachable, still serve the static entries.
  }

  return [...staticEntries, ...siteEntries, ...productEntries, ...blogEntries];
}
