import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Newspaper } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { listPublicBlogAll } from "@/lib/services/blog.service";
import { brandForGround, inkOn, storeBranding } from "@/lib/storefront-brand";
import { resolveSiteTheme } from "@/lib/site-theme";
import { SiteFooter } from "@/components/public/site-footer";
import { publicSocialLinks } from "@/lib/social-links";
import { SiteVisitTracker } from "@/components/public/site-visit-tracker";
import { TierStyles } from "@/components/public/tiers/tier-styles";
import type { WebsiteData } from "@/lib/ai/schemas/website";
import { modeAllowsRoute, resolveSiteMode } from "@/lib/site-mode";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) return { title: "האתר לא נמצא" };
  const { brandName } = storeBranding(site);
  const title = `בלוג | ${brandName}`;
  const description = `מאמרים ותכנים מ${brandName}`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/s/${slug}/blog` },
    openGraph: { title, description, type: "website", locale: "he_IL" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();

  const posts = await listPublicBlogAll(site.website.business_id);
  const { brandName, brand: rawBrand, logoUrl } = storeBranding(site);
  // Lifted (or darkened) for THIS site's colour scheme before anything paints
  // with it — see lib/site-theme.ts.
  const theme = resolveSiteTheme(site.website.theme);
  const brand = brandForGround(rawBrand, theme.inkMeasure);
  const tier = site.designTier;

  const about = site.website.page_about as WebsiteData["about"] | null;
  const faq = site.website.page_faq as WebsiteData["faq"] | null;
  const waDigits = site.whatsappPhone?.replace(/[^\d]/g, "") ?? null;
  const waLink =
    waDigits && waDigits.length >= 9
      ? `https://wa.me/${waDigits.startsWith("0") ? "972" + waDigits.slice(1) : waDigits}`
      : null;

  return (
    <div data-tier={tier} className="min-h-screen bg-zinc-50 text-zinc-900">
      <TierStyles tier={tier} brand={brand} theme={theme.key} heroStyle={site.website.hero_style} />
      <SiteVisitTracker slug={slug} path="/blog" />

      <header data-el="chrome-header" className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/s/${slug}`} className="flex items-center gap-2 font-bold" style={{ color: brand }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={brandName}
                className="h-8 w-auto max-w-[150px] shrink-0 rounded-lg bg-white/90 object-contain p-1"
              />
            ) : (
              <span>{brandName}</span>
            )}
          </Link>
          <Link
            href={`/s/${slug}`}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowRight className="size-4" />
            חזרה לאתר
          </Link>
        </div>
      </header>

      <main data-el="module-section" className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-10 flex items-center gap-3">
          <div
            className="flex size-11 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: brand, color: inkOn(brand) }}
          >
            <Newspaper className="size-5" />
          </div>
          <div>
            <h1 data-el="section-title" className="text-2xl font-bold sm:text-3xl">הבלוג של {brandName}</h1>
            <p className="mt-1 text-sm text-zinc-500">מאמרים, טיפים ועדכונים</p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-zinc-500">
            <Newspaper className="mx-auto mb-3 size-8 text-zinc-300" />
            עדיין אין מאמרים בבלוג.
          </div>
        ) : (
          <div data-el="product-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/s/${slug}/blog/${p.slug ?? p.id}`}
                data-el="product-card"
                className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
              >
                {p.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.cover_url}
                    alt={p.title}
                    loading="lazy"
                    className="h-44 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="h-44 w-full" style={{ backgroundColor: `${brand}1a` }} />
                )}
                <div className="p-5">
                  <h2 className="font-bold leading-snug group-hover:underline">{p.title}</h2>
                  {p.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                      {p.excerpt}
                    </p>
                  )}
                  {p.published_at && (
                    <p className="mt-3 text-xs text-zinc-500">
                      {new Date(p.published_at).toLocaleDateString("he-IL")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <div data-el="chrome-footer">
        <SiteFooter
          slug={slug}
          brandName={brandName}
          brand={brand}
          description={site.business.description}
          location={site.business.location}
          whatsappLink={waLink}
          hasProducts={site.products.length > 0}
          hasAbout={Boolean(about)}
          hasFaq={Boolean(faq && faq.items?.length > 0)}
          hasHelpPage={modeAllowsRoute(resolveSiteMode(site.business.site_mode), "help")}
          socialLinks={publicSocialLinks(site.website.social_links)}
        />
      </div>
    </div>
  );
}
