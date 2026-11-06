import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { safeJsonLd } from "@/lib/utils";
import { getPublicBlogPost } from "@/lib/services/blog.service";
import { brandForGround, storeBranding } from "@/lib/storefront-brand";
import { resolveSiteTheme } from "@/lib/site-theme";
import { SiteFooter } from "@/components/public/site-footer";
import { publicSocialLinks } from "@/lib/social-links";
import { SiteVisitTracker } from "@/components/public/site-visit-tracker";
import { TierStyles } from "@/components/public/tiers/tier-styles";
import type { WebsiteData } from "@/lib/ai/schemas/website";
import { modeAllowsRoute, resolveSiteMode } from "@/lib/site-mode";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

async function load(slug: string, postId: string) {
  const site = await getPublicSiteBySlug(slug);
  if (!site) return null;
  const post = await getPublicBlogPost(site.website.business_id, postId);
  if (!post) return null;
  return { site, post };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}): Promise<Metadata> {
  const { slug, postId } = await params;
  const data = await load(slug, postId);
  if (!data) return { title: "המאמר לא נמצא" };
  const { site, post } = data;
  const { brandName } = storeBranding(site);
  const title = `${post.title} | ${brandName}`;
  const description = post.excerpt ?? post.body?.slice(0, 160) ?? undefined;
  const canonical = `${BASE_URL}/s/${slug}/blog/${post.slug ?? post.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      locale: "he_IL",
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
      ...(post.cover_url ? { images: [{ url: post.cover_url, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: post.cover_url ? "summary_large_image" : "summary",
      title: post.title,
      description,
    },
  };
}

/** Splits on blank lines into paragraphs; preserves single line breaks within each. */
function BodyText({ body }: { body: string }) {
  const paragraphs = body.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className="mb-5 whitespace-pre-wrap leading-relaxed text-zinc-700">
          {para}
        </p>
      ))}
    </>
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const data = await load(slug, postId);
  if (!data) notFound();

  const { site, post } = data;
  const { brandName, brand: rawBrand, logoUrl } = storeBranding(site);
  // Lifted (or darkened) for THIS site's colour scheme before anything paints
  // with it — see lib/site-theme.ts.
  const theme = resolveSiteTheme(site.website.theme);
  const brand = brandForGround(rawBrand, theme.inkMeasure);
  const tier = site.designTier;
  const canonical = `${BASE_URL}/s/${slug}/blog/${post.slug ?? post.id}`;

  const about = site.website.page_about as WebsiteData["about"] | null;
  const faq = site.website.page_faq as WebsiteData["faq"] | null;
  const waDigits = site.whatsappPhone?.replace(/[^\d]/g, "") ?? null;
  const waLink =
    waDigits && waDigits.length >= 9
      ? `https://wa.me/${waDigits.startsWith("0") ? "972" + waDigits.slice(1) : waDigits}`
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    ...(post.cover_url ? { image: [post.cover_url] } : {}),
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at ?? post.published_at ?? post.created_at,
    author: { "@type": "Organization", name: brandName },
    publisher: {
      "@type": "Organization",
      name: brandName,
      ...(logoUrl ? { logo: { "@type": "ImageObject", url: logoUrl } } : {}),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };

  return (
    <div data-tier={tier} className="min-h-screen bg-zinc-50 text-zinc-900">
      <TierStyles tier={tier} brand={brand} theme={theme.key} heroStyle={site.website.hero_style} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <SiteVisitTracker slug={slug} path={`/blog/${post.slug ?? post.id}`} />

      <header data-el="chrome-header" className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
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
            href={`/s/${slug}/blog`}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowRight className="size-4" />
            כל המאמרים
          </Link>
        </div>
      </header>

      <main data-el="module-section" className="mx-auto max-w-3xl px-4 py-10">
        <article>
          {post.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_url}
              alt={post.title}
              className="mb-8 aspect-[16/9] w-full rounded-2xl object-cover shadow-sm"
            />
          )}
          <h1 data-el="section-title" className="text-2xl font-bold leading-tight sm:text-3xl">{post.title}</h1>
          {post.published_at && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500">
              <CalendarDays className="size-4" style={{ color: brand }} />
              {new Date(post.published_at).toLocaleDateString("he-IL", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
          <div className="mt-8 text-[15px]">
            {post.body ? (
              <BodyText body={post.body} />
            ) : post.excerpt ? (
              <p className="leading-relaxed text-zinc-700">{post.excerpt}</p>
            ) : null}
          </div>
        </article>

        <div className="mt-12 border-t pt-6">
          <Link
            href={`/s/${slug}/blog`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: brand }}
          >
            <ArrowRight className="size-4" />
            חזרה לכל המאמרים
          </Link>
        </div>
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
