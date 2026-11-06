import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, Menu, MessageCircle, User } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { resolveModules, type ModuleKey } from "@/lib/modules";
import { safeJsonLd } from "@/lib/utils";
import { resolveSiteLayout, type SiteSectionKey } from "@/lib/site-layout";
import { LandingStyles, TierStyles } from "@/components/public/tiers/tier-styles";
import { MarqueeBand } from "@/components/public/tiers/marquee-band";
import { StatementSection } from "@/components/public/tiers/statement-section";
import { storeCardEnabledBySlug } from "@/lib/services/store-checkout.service";
import { CheckoutResult } from "@/components/public/checkout-result";
import { RentalsSection } from "@/components/public/rentals-section";
import { WhatsAppFloat } from "@/components/public/whatsapp-float";
import { SectionDecor, GenerativeBand } from "@/components/public/site-decor";
import { SectionDivider } from "@/components/public/section-divider";
import { getPublicBookingInfo } from "@/lib/services/booking.service";
import { SiteLeadForm } from "@/components/public/site-lead-form";
import { SiteEffects } from "@/components/public/site-effects";
import { SitePolish } from "@/components/public/site-polish";
import { BookingHub } from "@/components/public/booking-hub";
import type { BookingPrefill } from "@/components/public/booking-widget";
import { getCustomerUser } from "@/lib/auth/customer";
import { createClient } from "@/lib/supabase/server";
import { SiteVisitTracker } from "@/components/public/site-visit-tracker";
import { SiteReviewsSection } from "@/components/public/site-reviews";
import { PublicStore } from "@/components/public/public-store";
import { CartProvider } from "@/components/public/cart-context";
import { CartDrawer, type CheckoutPayment } from "@/components/public/cart-drawer";
import { parseEnabledMethods } from "@/lib/payments";
import { WishlistProvider } from "@/components/public/wishlist-context";
import { WishlistDrawer } from "@/components/public/wishlist-drawer";
import { AnnouncementBar } from "@/components/public/announcement-bar";
import { SitePopup } from "@/components/public/site-popup";
import { ReferralCapture } from "@/components/public/referral-capture";
import { StoreHero } from "@/components/public/heroes/store-hero";
import { publicSocialLinks } from "@/lib/social-links";
import { GallerySection } from "@/components/public/gallery-section";
import { TeamSection } from "@/components/public/team-section";
import { PricingSection } from "@/components/public/pricing-section";
import { EventsSection } from "@/components/public/events-section";
import { MenuSection } from "@/components/public/menu-section";
import { JobsSection } from "@/components/public/jobs-section";
import { BlogSection } from "@/components/public/blog-section";
import { FaqsSection } from "@/components/public/faqs-section";
import { listPublicFaqs } from "@/lib/services/faqs.service";
import { TestimonialsSection } from "@/components/public/testimonials-section";
import { GiftCardsSection } from "@/components/public/gift-cards-section";
import { MembershipsSection } from "@/components/public/memberships-section";
import { CoursesSection } from "@/components/public/courses-section";
import { DownloadsSection } from "@/components/public/downloads-section";
import { DonationsSection } from "@/components/public/donations-section";
import { BranchesSection } from "@/components/public/branches-section";
import { PartnersSection } from "@/components/public/partners-section";
import { StatsSection } from "@/components/public/stats-section";
import { BeforeAfterSection } from "@/components/public/before-after-section";
import { ProcessStepsSection } from "@/components/public/process-steps-section";
import { CertificationsSection } from "@/components/public/certifications-section";
import { OrderTracker } from "@/components/public/order-tracker";
import { ReturnRequest } from "@/components/public/return-request";
import { SiteFooter } from "@/components/public/site-footer";
import { MapLinks } from "@/components/public/map-links";
import StoreChatWidget from "@/components/public/store-chat-widget";
import type { WebsiteData } from "@/lib/ai/schemas/website";
import { parseLandingSettings, type LandingData } from "@/lib/ai/schemas/landing";
import {
  isLandingMode,
  modeAllowsModule,
  modeAllowsRoute,
  modeHasCommerce,
  resolveSiteMode,
} from "@/lib/site-mode";
import { LandingPage } from "@/components/public/landing-page";
import { brandForGround, inkOn, pickBrandColor, type Palette } from "@/lib/storefront-brand";
import { resolveSiteTheme } from "@/lib/site-theme";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

type Typography = {
  primary?: { font?: string };
  secondary?: { font?: string };
} | null;

function fontsHref(typography: Typography): string | null {
  const families = [
    typography?.primary?.font,
    typography?.secondary?.font,
  ].filter((f): f is string => Boolean(f && /^[\w\s-]+$/.test(f)));
  if (families.length === 0) return null;
  const params = [...new Set(families)]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/**
 * 4-6 short Hebrew trust items for the "advanced"/"professional" tiers'
 * marquee band — derived from real site data (shipping, payment, booking,
 * returns) wherever it's known, falling back to sensible generic copy so the
 * band never looks empty on a thin storefront.
 */
function buildTrustItems({
  shippingMethods,
  freeShippingThreshold,
  hasPayment,
  hasBooking,
  hasProducts,
}: {
  shippingMethods: { name: string; eta: string | null }[];
  freeShippingThreshold: number | null;
  hasPayment: boolean;
  hasBooking: boolean;
  hasProducts: boolean;
}): string[] {
  const items: string[] = [];
  const primaryShipping = shippingMethods[0];
  if (primaryShipping) {
    // Owners usually name the method "משלוח עד הבית" / "איסוף עצמי" already —
    // prefixing unconditionally produced "משלוח משלוח עד הבית".
    const label = /^(משלוח|איסוף)/.test(primaryShipping.name.trim())
      ? primaryShipping.name
      : `משלוח ${primaryShipping.name}`;
    items.push(`${label}${primaryShipping.eta ? ` · ${primaryShipping.eta}` : ""}`);
  }
  if (freeShippingThreshold) items.push(`משלוח חינם מעל ₪${freeShippingThreshold.toLocaleString()}`);
  if (hasPayment) items.push("תשלום מאובטח ומוצפן");
  if (hasBooking) items.push("קביעת תור אונליין");
  if (hasProducts) items.push("מדיניות החזרות גמישה");
  items.push("שירות לקוחות אישי");
  if (items.length < 4) items.push("איכות ואמינות לאורך זמן");
  return items.slice(0, 6);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) return { title: "האתר לא נמצא" };

  const seo = site.website.seo_meta as WebsiteData["seoMeta"] | null;
  const title = seo?.title ?? site.business.name ?? "אתר עסקי";
  const description = seo?.description ?? site.business.description.slice(0, 160);

  // The generated logo is the site's identity everywhere else — without this
  // the browser tab showed the platform's own favicon on every customer site.
  const logo = site.brand?.logo_url ?? null;
  const ogImage = site.website.hero_image_url ?? logo;

  return {
    title,
    description,
    keywords: seo?.keywords,
    alternates: { canonical: `${BASE_URL}/s/${slug}` },
    ...(logo ? { icons: { icon: [{ url: logo }], apple: [{ url: logo }] } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: "he_IL",
      ...(ogImage
        ? {
            images: site.website.hero_image_url
              ? [{ url: ogImage, width: 1536, height: 1024 }]
              : [{ url: ogImage }],
          }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [site, booking, customerUser] = await Promise.all([
    getPublicSiteBySlug(slug),
    getPublicBookingInfo(slug),
    getCustomerUser().catch(() => null),
  ]);
  if (!site) notFound();

  // Prefill the booking form for signed-in shoppers (name/phone from their
  // profile, verified email from auth) — no extra queries for anonymous
  // visitors or booking-less sites.
  let bookingPrefill: BookingPrefill | undefined;
  if (booking && customerUser) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("full_name, phone")
      .eq("id", customerUser.id)
      .maybeSingle();
    // OAuth signups (Google etc.) have no customer_profiles row yet — fall
    // back to the name the provider supplied in the auth metadata.
    const metaName =
      typeof customerUser.user_metadata?.full_name === "string"
        ? customerUser.user_metadata.full_name
        : typeof customerUser.user_metadata?.name === "string"
          ? customerUser.user_metadata.name
          : null;
    const metaPhone =
      typeof customerUser.user_metadata?.phone === "string"
        ? customerUser.user_metadata.phone
        : null;
    bookingPrefill = {
      name: profile?.full_name ?? metaName,
      phone: profile?.phone ?? metaPhone,
      email: customerUser.email ?? null,
    };
  }

  const home = site.website.page_home as WebsiteData["home"] | null;
  const about = site.website.page_about as WebsiteData["about"] | null;
  const services = site.website.page_services as WebsiteData["services"] | null;
  const contact = site.website.page_contact as WebsiteData["contact"] | null;
  const faq = site.website.page_faq as WebsiteData["faq"] | null;

  const brandName = site.brand?.brand_name ?? site.business.name ?? "העסק";
  const slogan = site.brand?.slogan ?? null;
  const rawBrand = pickBrandColor(site.brand?.color_palette as Palette | null);
  // The site's colour scheme (lib/site-theme.ts) — the ground everything below
  // is painted on, and therefore the thing the brand colour has to be readable
  // against. 'midnight' (the old hard-coded black) when unset.
  const theme = resolveSiteTheme(site.website.theme);
  // Adjusted for that ground before anything paints with it — as the raw pick
  // it can be #111111, which is invisible on a dark scheme as ink, as a border
  // and as the CTA gradient's first stop; on a light scheme the lift has to run
  // the other way (see brandForGround). Landing mode is the exception and must
  // keep the raw value: it branches out below with no data-tier at all and
  // renders its own white sections, outside the scheme system entirely.
  const brand = isLandingMode(site.business.site_mode)
    ? rawBrand
    : brandForGround(rawBrand, theme.inkMeasure);
  // Ink for anything painted ON the brand fill (logo monogram, header CTA pill,
  // floating button). Hard-coded text-white failed at ~2.4:1 on mid-tone brands
  // like #C9A227 — inkOn() picks white or near-black by actual luminance.
  const onBrand = inkOn(brand);
  const typography = site.brand?.typography as Typography;
  const headingFont = typography?.primary?.font;
  const bodyFont = typography?.secondary?.font;
  const googleFonts = fontsHref(typography);
  const logoUrl = site.brand?.logo_url ?? null;
  const heroImg = site.website.hero_image_url ?? null;

  // Design tier — resolved server-side (see getPublicSiteBySlug) from the
  // owner's plan, clamped so a visitor never sees more than what's paid for.
  const tier = site.designTier;
  const heroYear = site.website.created_at ? new Date(site.website.created_at).getFullYear() : null;
  const hudLabels = [
    brandName,
    site.business.location || "ISRAEL",
    heroYear ? `EST. ${heroYear}` : null,
    site.business.industry,
  ].filter((v): v is string => Boolean(v && v.trim()));
  const hasPaymentConfigured = Boolean(
    parseEnabledMethods(site.business.payment_methods).length > 0,
  );

  const waDigits = site.whatsappPhone?.replace(/[^\d]/g, "") ?? null;
  const waLink =
    waDigits && waDigits.length >= 9
      ? `https://wa.me/${waDigits.startsWith("0") ? "972" + waDigits.slice(1) : waDigits}`
      : null;

  // ── Landing mode: a completely different page, so it branches out here,
  // before any of the multi-section storefront machinery below is built.
  // No header nav, no store, no modules, no sub-pages — see LandingPage.
  if (isLandingMode(site.business.site_mode)) {
    const landing = site.website.page_landing as LandingData | null;
    if (!landing) notFound(); // generated_at exists but the landing copy doesn't yet
    return (
      <div
        // `landing` matches no tier stylesheet, so the colour-scheme repaint
        // can never reach this page — but every bare `[data-tier]` rule (design
        // tokens, focus rings, ripple, magnetic pull, the reduced-motion
        // kill-switch) does. See LandingStyles in tiers/tier-styles.tsx.
        data-tier="landing"
        className="min-h-screen"
        style={bodyFont ? { fontFamily: `'${bodyFont}', Heebo, sans-serif` } : undefined}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: brandName,
              description: site.business.description.slice(0, 250),
              ...(logoUrl ? { logo: logoUrl } : {}),
            }),
          }}
        />
        <SiteVisitTracker slug={slug} />
        {/* A landing page IS the content — one ViewContent per campaign visit,
            so Meta/TikTok can optimise on more than a raw PageView. */}
        {googleFonts && <link rel="stylesheet" href={googleFonts} />}
        <style>{`
          @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
          .js-reveal [data-reveal] { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s ease; }
          .js-reveal [data-reveal].is-visible { opacity: 1; transform: none; }
          details[data-faq] summary::-webkit-details-marker { display: none; }
          details[data-faq][open] summary { color: ${brand}; }
          ${headingFont ? `h1,h2,h3 { font-family: '${headingFont}', Heebo, sans-serif; }` : ""}
        `}</style>
        <LandingStyles brand={brand} heroStyle={site.website.hero_style} />
        <SiteEffects />
        <SitePolish brand={brand} />
        <LandingPage
          slug={slug}
          landing={landing}
          settings={parseLandingSettings(site.website.landing_settings)}
          brand={brand}
          brandName={brandName}
          logoUrl={logoUrl}
          whatsappLink={waLink}
          location={site.business.location}
          description={site.business.description}
          socialLinks={publicSocialLinks(site.website.social_links)}
        />
      </div>
    );
  }

  // ── Mode gating (site_mode = 'website' | 'store') ──────────────────────
  // 'website' is a brochure site: it may well have products in the database
  // (an owner who switched modes, or one who uses them as a catalog), but it
  // does not SELL — no store section, no cart, no wishlist, no order tracking.
  // Everything below keys off `commerce` instead of `products.length > 0`,
  // which is what used to auto-enable the shop the moment a product existed.
  //
  // A store can additionally be catalog_only — a shop window. The shelf still
  // renders (that IS the point), so the two questions split here: `showsProducts`
  // decides whether the products are on the page at all, `sellsProducts` whether
  // anything about buying them exists — cart, wishlist, account, order tracking.
  const siteMode = resolveSiteMode(site.business.site_mode);
  const commerce = modeHasCommerce(siteMode);
  const catalogOnly = commerce && site.business.catalog_only === true;
  const showsProducts = commerce && site.products.length > 0;
  const sellsProducts = showsProducts && !catalogOnly;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brandName,
    description: site.business.description.slice(0, 250),
    ...(site.business.location
      ? { address: { "@type": "PostalAddress", addressLocality: site.business.location } }
      : {}),
    ...(heroImg ? { image: heroImg } : {}),
    ...(logoUrl ? { logo: logoUrl } : {}),
  };

  // FAQPage structured data — only when the "faqs" module is on and has content.
  // The mode filter is what turns the commerce-only modules (returns, order
  // tracking) off on a brochure site without touching the owner's saved
  // module_config — switching back to 'store' restores it exactly.
  const modulesEnabled = resolveModules(site.business.module_config)
    .filter((m) => m.enabled)
    .filter((m) => modeAllowsModule(siteMode, m.key));
  const contactEnabled = modulesEnabled.some((m) => m.key === "contact");
  const faqModuleActive = modulesEnabled.some((m) => m.key === "faqs");
  const faqItems = faqModuleActive ? await listPublicFaqs(site.website.business_id) : [];
  // The AI-written FAQ (page_faq) and the owner-managed FAQ module render the
  // same thing. When the module actually has content it wins and the inline
  // block steps aside — otherwise the page shipped two "שאלות ותשובות" sections.
  const showInlineFaq = Boolean(faq && faq.items?.length > 0) && faqItems.length === 0;
  const jsonLdFaqPairs =
    faqItems.length > 0
      ? faqItems.filter((f) => f.answer).map((f) => ({ q: f.question, a: f.answer as string }))
      : showInlineFaq
        ? (faq?.items ?? []).map((f) => ({ q: f.question, a: f.answer }))
        : [];
  const faqJsonLd =
    jsonLdFaqPairs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: jsonLdFaqPairs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  // Structural layout (section order + hints) — orthogonal to hero_style.
  const layout = resolveSiteLayout(site.website.layout_style);
  const { aboutVariant, condensed } = layout.hints;

  const cardStorePayment: CheckoutPayment = {
    methods: parseEnabledMethods(site.business.payment_methods),
    bank: (site.business.bank_details as CheckoutPayment["bank"]) ?? null,
    bitPhone: site.business.bit_phone,
    paypalLink: site.business.paypal_link,
    cardLink: site.business.payment_link,
    stripeCard: await storeCardEnabledBySlug(slug),
  };

  // "advanced"/"professional"-tier extras — a trust-fact marquee under the
  // hero (real site data, generic fallbacks) and an editorial statement quote
  // (the site's own slogan/about copy) right before the contact section.
  const trustItems = buildTrustItems({
    shippingMethods: site.shippingMethods.map((m) => ({ name: m.name, eta: m.eta })),
    freeShippingThreshold: site.business.free_shipping_threshold,
    hasPayment: hasPaymentConfigured,
    hasBooking: Boolean(booking && booking.days.length > 0),
    hasProducts: sellsProducts,
  });
  const quoteText = (slogan ?? about?.story ?? null)?.trim() || null;

  // Every place the hero can actually send a visitor, best first. The primary
  // CTA takes the first; the hero styles built around a two-button row
  // (aurora/horizon) take the second, so their quieter button is always a real
  // destination instead of a decorative href="#". An empty list means the page
  // has nowhere to send anyone, and the heroes drop their buttons entirely.
  const heroTargets = [
    booking && booking.days.length > 0 ? { text: "קביעת תור", href: "#booking" } : null,
    showsProducts ? { text: catalogOnly ? "לקולקציה שלנו" : "לחנות שלנו", href: "#store" } : null,
    contactEnabled ? { text: "צרו קשר", href: "#contact" } : null,
    waLink ? { text: "וואטסאפ", href: waLink } : null,
  ].filter((t): t is { text: string; href: string } => t !== null);

  // --- Named section chunks (internals untouched from the original JSX) ---

  const benefitsSection = home?.benefits && home.benefits.length > 0 && (
    <section key="benefits" data-el="module-section" className="mx-auto max-w-5xl px-4 py-16">
      <div className="grid gap-5 sm:grid-cols-3">
        {home.benefits.map((b, i) => (
          <div
            key={b.title}
            data-reveal
            style={{ transitionDelay: `${i * 90}ms` }}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <CheckCircle2 className="mb-3 size-6" style={{ color: brand }} />
            <h3 className="mb-1.5 font-bold">{b.title}</h3>
            <p className="text-sm leading-relaxed text-zinc-600">{b.description}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const aboutBody = about && (
      <section key="about-body" id="about" data-el="module-section" data-band="raised" className="relative overflow-hidden bg-white px-4 py-16">
        {tier === "standard" && <SectionDecor brand={brand} seed={`${slug}-about`} />}
        {aboutVariant === "split" && heroImg ? (
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2" data-reveal>
            <div className="order-2 md:order-1">
              <h2 data-el="section-title" className="mb-6 text-3xl font-bold">{about.headline}</h2>
              <p className="whitespace-pre-wrap leading-relaxed text-zinc-700">{about.story}</p>
              {about.values?.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {about.values.map((v) => (
                    <div key={v.title} className="rounded-xl bg-zinc-50 p-4">
                      <div className="mb-1 font-semibold" style={{ color: brand }}>
                        {v.title}
                      </div>
                      <p className="text-sm text-zinc-600">{v.description}</p>
                    </div>
                  ))}
                </div>
              )}
              {about.teamNote && (
                <p className="mt-8 text-sm italic text-zinc-500">{about.teamNote}</p>
              )}
            </div>
            <div className="order-1 md:order-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={brandName}
                className="aspect-[4/3] w-full rounded-2xl object-cover shadow-sm"
              />
            </div>
          </div>
        ) : (
          <div className="relative mx-auto max-w-3xl" data-reveal>
            <h2 data-el="section-title" className="mb-6 text-center text-3xl font-bold">{about.headline}</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-700">{about.story}</p>
            {about.values?.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {about.values.map((v) => (
                  <div key={v.title} className="rounded-xl bg-zinc-50 p-4">
                    <div className="mb-1 font-semibold" style={{ color: brand }}>
                      {v.title}
                    </div>
                    <p className="text-sm text-zinc-600">{v.description}</p>
                  </div>
                ))}
              </div>
            )}
            {about.teamNote && (
              <p className="mt-8 text-center text-sm italic text-zinc-500">{about.teamNote}</p>
            )}
          </div>
        )}
      </section>
  );

  const aboutSection = aboutBody && (
    <Fragment key="about">
      <SectionDivider brand={brand} seed={`${slug}-div-about`} />
      {aboutBody}
    </Fragment>
  );

  const servicesSection = services && (
    <Fragment key="services">
      <SectionDivider brand={brand} seed={`${slug}-div-services`} flip />
      <section id="services" data-el="module-section" className="relative overflow-hidden px-4 py-16">
        {tier === "standard" && <SectionDecor brand={brand} seed={`${slug}-services`} />}
        <div className="relative mx-auto max-w-5xl" data-reveal>
          <h2 data-el="section-title" className="mb-4 text-center text-3xl font-bold md:mb-6">{services.headline}</h2>
          {services.intro && (
            <p className="mx-auto -mt-1 mb-10 max-w-xl text-center text-zinc-600">{services.intro}</p>
          )}
        </div>
        {/* The cards need their own max-w-5xl — they used to sit directly under
            the section, so the heading centred at 1024px while the grid ran
            nearly full-bleed. */}
        <div className="relative mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((s, i) => (
            <div
              key={s.name}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className="svc-card flex flex-col rounded-2xl border bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold">{s.name}</h3>
              {s.price && (
                <div className="mt-1 text-sm font-semibold" style={{ color: brand }}>
                  {s.price}
                </div>
              )}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{s.description}</p>
              {s.features?.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: brand }} />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </Fragment>
  );

  const storeSection = showsProducts && (
    <PublicStore
      key="store"
      products={site.products}
      brand={brand}
      slug={slug}
      sizeGuide={site.business.size_guide}
      variantsByProduct={site.variantsByProduct}
      catalogOnly={catalogOnly}
    />
  );

  const bookingSection = booking && booking.days.length > 0 && (
    <section key="booking" id="booking" data-el="module-section" data-band="raised" className="bg-white px-4 py-16">
      <div className="mx-auto max-w-xl" data-reveal>
        <h2 data-el="section-title" className="mb-2 text-center text-3xl font-bold">קביעת תור אונליין</h2>
        <p className="mb-8 text-center text-zinc-600">
          בחרו יום ושעה — ונשריין לכם את המקום
        </p>
        <BookingHub
          slug={slug}
          brandColor={brand}
          days={booking.days}
          services={booking.services}
          staff={booking.staff}
          staffServices={booking.staffServices}
          signedIn={!!customerUser}
          loginHref={`/s/${slug}/account/login?next=${encodeURIComponent(`/s/${slug}`)}`}
          prefill={bookingPrefill}
        />
      </div>
    </section>
  );

  const faqSection = showInlineFaq && faq && (
    <section key="faq" id="faq" data-el="module-section" data-band="raised" className="relative overflow-hidden bg-white px-4 py-16">
      {tier === "standard" && <SectionDecor brand={brand} seed={`${slug}-faq`} />}
      <div className="relative mx-auto max-w-3xl" data-reveal>
        <h2 data-el="section-title" className="mb-8 text-center text-3xl font-bold">{faq.headline}</h2>
        <div className="space-y-3">
          {faq.items.map((item) => (
            <details key={item.question} data-faq className="group rounded-xl border bg-zinc-50 p-4">
              <summary className="cursor-pointer list-none font-semibold">
                {item.question}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );

  const returnsEnabled = modulesEnabled.some((m) => m.key === "returns");
  const orderTrackingEnabled = modulesEnabled.some((m) => m.key === "order_tracking");
  const orderTrackingSection = sellsProducts && (orderTrackingEnabled || returnsEnabled) && (
    <div key="orderTracking" data-el="module-section" className="mx-auto max-w-5xl px-4 py-16">
      <div className={`grid items-start gap-6 ${orderTrackingEnabled && returnsEnabled ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {orderTrackingEnabled && <OrderTracker slug={slug} brand={brand} />}
        {returnsEnabled && <ReturnRequest slug={slug} brand={brand} />}
      </div>
    </div>
  );

  // NOTE: RentalsSection is an async server component that renders null when
  // the business has no active units — it isn't stamped with
  // data-el="module-section" here because wrapping a possibly-null child in a
  // div would leave a padded/hairline-bordered "phantom" band on advanced/
  // professional tiers whenever there's nothing to show.
  const rentalsSection = (
    <RentalsSection key="rentals" slug={slug} businessId={site.website.business_id} brand={brand} />
  );

  const modulesSection = (() => {
    const bid = site.website.business_id;
    const moduleByKey: Record<ModuleKey, React.ReactNode> = {
      testimonials: <TestimonialsSection businessId={bid} brand={brand} />,
      gallery: (
        <GallerySection
          businessId={bid}
          brand={brand}
          {...(siteMode === "store" ? { title: "המוצרים שלנו מקרוב" } : {})}
        />
      ),
      menu: <MenuSection businessId={bid} brand={brand} />,
      pricing: <PricingSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      team: <TeamSection businessId={bid} brand={brand} />,
      events: <EventsSection businessId={bid} brand={brand} />,
      blog: <BlogSection businessId={bid} slug={slug} brand={brand} />,
      faqs: <FaqsSection businessId={bid} brand={brand} />,
      jobs: <JobsSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      gift_cards: <GiftCardsSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      process_steps: <ProcessStepsSection businessId={bid} brand={brand} />,
      stats: <StatsSection businessId={bid} brand={brand} />,
      before_after: <BeforeAfterSection businessId={bid} brand={brand} />,
      courses: <CoursesSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      memberships: <MembershipsSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      downloads: <DownloadsSection businessId={bid} brand={brand} />,
      donations: <DonationsSection businessId={bid} brand={brand} contactEnabled={contactEnabled} />,
      branches: <BranchesSection businessId={bid} brand={brand} />,
      certifications: <CertificationsSection businessId={bid} brand={brand} />,
      partners: <PartnersSection businessId={bid} brand={brand} />,
      // "contact", "returns" and "order_tracking" are core sections rendered
      // separately (the contact form below, both inside orderTrackingSection)
      // — their picker toggles only gate those dedicated renders.
      contact: null,
      returns: null,
      order_tracking: null,
    };
    // NOTE: every module component here is an async server component that
    // renders null when the business has no data for it yet (see e.g.
    // components/public/testimonials-section.tsx). They're intentionally
    // NOT wrapped with data-el="module-section" — a wrapper div around a
    // possibly-null child would leave a padded/hairline-bordered "phantom"
    // band on advanced/professional tiers for every enabled-but-empty module.
    return (
      <div key="modules">
        {modulesEnabled
          .filter((m) => m.key !== "contact" && m.key !== "returns")
          .map((m) => (
            <div key={m.key}>{moduleByKey[m.key]}</div>
          ))}
      </div>
    );
  })();

  const reviewsSection = (
    <div key="reviews" data-el="module-section">
      <SiteReviewsSection slug={slug} brand={brand} />
    </div>
  );

  // The generic decorative band clashes with the editorial/dark tier
  // languages — only the "standard" tier (a light polish of today's look)
  // keeps it.
  const bandSection = tier === "standard" && (
    <GenerativeBand key="band" brand={brand} seed={slug} label={site.brand?.slogan ?? brandName} />
  );

  const contactSection = !contactEnabled ? null : (
    <Fragment key="contact">
      {/* "advanced" tier only — one big editorial quote break right before
          the closing contact section, built from the site's own slogan/about
          copy. Gracefully renders nothing when there's no text. */}
      {tier === "advanced" && quoteText && (
        <StatementSection quote={quoteText} author={brandName} accent={brand} />
      )}
      <section
        id="contact"
        data-el="module-section"
        data-band="cta"
        className="relative overflow-hidden px-4 py-16"
        style={{ background: `${brand}0d` }}
      >
        {tier === "standard" && <SectionDecor brand={brand} seed={`${slug}-contact`} />}
        <div className="relative mx-auto max-w-xl text-center" data-reveal>
          <h2 data-el="section-title" className="text-3xl font-bold">{contact?.headline ?? "צרו קשר"}</h2>
          {contact?.intro && <p className="mt-3 text-zinc-600">{contact.intro}</p>}
          {contact?.responseTime && (
            <p className="mt-1 text-sm font-medium" style={{ color: brand }}>
              {contact.responseTime}
            </p>
          )}
          <div className="mt-8 text-start">
            <SiteLeadForm
              slug={slug}
              brandColor={brand}
              fields={contact?.formFields ?? ["שם", "טלפון", "אימייל", "הודעה"]}
            />
          </div>
          {site.business.location && (
            <>
              <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
                <MapPin className="size-4" />
                {site.business.location}
              </p>
              <div className="mt-2 flex justify-center">
                <MapLinks address={site.business.location} brand={brand} />
              </div>
            </>
          )}
        </div>
      </section>
    </Fragment>
  );

  const sectionByKey: Record<SiteSectionKey, React.ReactNode> = {
    benefits: benefitsSection,
    about: aboutSection,
    services: servicesSection,
    store: storeSection,
    booking: bookingSection,
    faq: faqSection,
    orderTracking: orderTrackingSection,
    rentals: rentalsSection,
    modules: modulesSection,
    reviews: reviewsSection,
    band: bandSection,
    contact: contactSection,
  };

  // 'flow' renders pixel-identical to the original hard-coded order. Other
  // layouts reuse the exact same section internals, just reordered — with
  // "condensed" wrapping everything but store/booking/contact/faq/hero in a
  // narrower column for a tighter one-pager feel.
  const primaryKeys: SiteSectionKey[] = ["store", "booking", "faq", "contact"];
  const orderedSections = layout.sections.map((key) => {
    const node = sectionByKey[key];
    if (!node) return null;
    if (condensed && !primaryKeys.includes(key)) {
      // display:contents — a real box here would clip full-bleed section
      // backgrounds to 56rem. The narrowing is applied to the section's own
      // children by the [data-condensed] rule in tier-styles.tsx.
      return (
        <div key={key} data-condensed className="contents">
          {node}
        </div>
      );
    }
    return node;
  });

  // Header navigation — one source for both the desktop nav and the mobile
  // menu, so an anchor can never exist in one and not the other.
  const navLinks = [
    about ? { href: "#about", label: "אודות" } : null,
    services ? { href: "#services", label: "שירותים" } : null,
    showsProducts ? { href: "#store", label: catalogOnly ? "קולקציה" : "חנות" } : null,
    // Matches whichever FAQ actually renders — page_faq can be a non-null
    // object with zero items, and the module's own section id is "faqs".
    showInlineFaq
      ? { href: "#faq", label: "שאלות" }
      : faqItems.length > 0
        ? { href: "#faqs", label: "שאלות" }
        : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  const headerCta =
    booking && booking.days.length > 0
      ? { href: "#booking", label: "קביעת תור" }
      : contactEnabled
        ? { href: "#contact", label: "צרו קשר" }
        : waLink
          ? { href: waLink, label: "וואטסאפ" }
          : null;

  return (
    <CartProvider slug={slug}>
    <WishlistProvider slug={slug}>
    <div
      data-tier={tier}
      className="min-h-screen bg-zinc-50 text-zinc-900"
      style={bodyFont ? { fontFamily: `'${bodyFont}', Heebo, sans-serif` } : undefined}
    >
      <TierStyles tier={tier} brand={brand} theme={theme.key} heroStyle={site.website.hero_style} />
      <AnnouncementBar text={site.business.announcement_bar} brand={brand} />
      {site.business.popup_enabled && site.business.popup_title && (
        <SitePopup
          slug={slug}
          brand={brand}
          title={site.business.popup_title}
          text={site.business.popup_text}
          coupon={site.business.popup_coupon}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
        />
      )}
      <SiteVisitTracker slug={slug} />
      <StoreChatWidget
        businessId={site.website.business_id}
        slug={slug}
        businessName={brandName}
        accent={brand}
      />
      <WhatsAppFloat phone={site.whatsappPhone} text={`שלום, הגעתי מהאתר של ${brandName}`} />
      <CheckoutResult brand={brand} />
      <ReferralCapture slug={slug} />
      {googleFonts && <link rel="stylesheet" href={googleFonts} />}
      <style>{`
        @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
        .js-reveal [data-reveal] { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s ease; }
        .js-reveal [data-reveal].is-visible { opacity: 1; transform: none; }
        .svc-card { transition: transform .25s ease, box-shadow .25s ease; }
        .svc-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px -12px ${brand}66; }
        details[data-faq] summary::-webkit-details-marker { display: none; }
        details[data-faq][open] summary { color: ${brand}; }
        .float-btn { animation: floatPulse 2.6s ease-in-out infinite; }
        @keyframes floatPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        ${headingFont ? `h1,h2,h3 { font-family: '${headingFont}', Heebo, sans-serif; }` : ""}
      `}</style>
      <SiteEffects />
      <SitePolish brand={brand} accent={theme.accent} />

      {/* Header */}
      <header data-el="chrome-header" className="sticky top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {logoUrl ? (
              // The generated logo is a 512×256 LOCK-UP (see svg-design.ts), so a
              // square box renders the wordmark at ~4px. Fixed height + free width
              // keeps it legible; the white pad is what makes a dark-ink logo
              // survive the professional tier's near-black header.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`לוגו ${brandName}`}
                className="h-9 w-auto max-w-[168px] shrink-0 rounded-lg bg-white/90 object-contain p-1 shadow-sm"
              />
            ) : (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-bold"
                style={{ backgroundColor: brand, color: onBrand }}
              >
                {brandName.charAt(0)}
              </div>
            )}
            <span className="truncate text-lg font-bold">{brandName}</span>
          </div>
          {/* Three groups, in reading order and never interleaved: BROWSE
              (nav) · ACCOUNT (personal area, wishlist, cart) · ACT (the CTA,
              always last so the strongest action sits at the outer edge). The
              CTA used to be spliced between the nav and the icons, which read
              as one undifferentiated row of nine controls. */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Hover state is owned by the tier stylesheet — a local
                hover:opacity-70 made the professional tier's links DARKEN on a
                black header instead of brightening. */}
            <nav data-el="chrome-nav" className="hidden items-center gap-6 text-sm lg:flex">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href}>{l.label}</a>
              ))}
            </nav>

            {/* Hairline between browsing and the account/cart cluster. Drawn
                from currentColor so it works on the dark tier and a white
                header without a second rule. */}
            {navLinks.length > 0 && (sellsProducts || booking) && (
              <span
                aria-hidden
                className="mx-1 hidden h-5 w-px shrink-0 lg:block"
                style={{ background: "currentColor", opacity: 0.18 }}
              />
            )}

            {/* Only mounted when it has something in it — an empty cluster
                still ate a gap-2 slot next to the CTA on brochure sites. */}
            {(sellsProducts || (booking && booking.days.length > 0)) && (
            <div className="flex items-center gap-0.5">
              {(sellsProducts || (booking && booking.days.length > 0)) && (
                <Link
                  href={`/s/${slug}/account`}
                  aria-label="האזור האישי"
                  className="flex size-9 items-center justify-center rounded-full text-zinc-600 transition hover:bg-black/5"
                >
                  <User className="size-5" />
                </Link>
              )}
              {sellsProducts && <WishlistDrawer brand={brand} />}
              {sellsProducts && (
                <CartDrawer
                  slug={slug}
                  brand={brand}
                  shippingFee={site.business.shipping_fee}
                  freeThreshold={site.business.free_shipping_threshold}
                  payment={cardStorePayment}
                  shippingMethods={site.shippingMethods}
                  products={site.products}
                />
              )}
            </div>
            )}

            {/* The CTA lives OUTSIDE the nav so it survives below the nav's
                breakpoint, where the links collapse into the hamburger — it's
                the page's primary action and used to disappear entirely on
                mobile. */}
            {headerCta && (
              <a
                data-el="btn-primary"
                href={headerCta.href}
                className="ms-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium max-sm:px-3 max-sm:text-xs"
                style={{ backgroundColor: brand, color: onBrand }}
              >
                {headerCta.label}
              </a>
            )}

            {/* Hamburger last, at the outer edge, on every width the nav is
                hidden — including the tablet range, where six links plus the
                icon cluster plus the CTA no longer fit on one row. */}
            {navLinks.length > 0 && (
              <details data-el="chrome-menu" className="relative lg:hidden">
                <summary
                  aria-label="תפריט"
                  className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-zinc-600 transition hover:bg-black/5 [&::-webkit-details-marker]:hidden"
                >
                  <Menu className="size-5" />
                </summary>
                <div className="absolute end-0 top-11 z-50 w-44 rounded-xl border border-black/10 bg-white p-1.5 text-sm shadow-xl">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="block rounded-lg px-3 py-2 text-zinc-800 hover:bg-black/5"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </header>

      {/* Hero — swappable style per websites.hero_style */}
      <StoreHero
        style={site.website.hero_style}
        brand={brand}
        brandName={brandName}
        slogan={slogan}
        headline={home?.hero.headline ?? brandName}
        subheadline={home?.hero.subheadline ?? null}
        ctaText={home?.hero.cta.text ?? "צרו קשר"}
        // Booking-enabled sites send the hero CTA straight to the calendar (the
        // AI copy usually says "קבעו תור") — store, then contact, after. When
        // nothing on the page can receive the click this is null and the hero
        // drops the button entirely rather than rendering href="#".
        ctaHref={heroTargets[0]?.href ?? null}
        secondaryText={heroTargets[1]?.text ?? null}
        secondaryHref={heroTargets[1]?.href ?? null}
        socialProof={home?.socialProof ?? null}
        heroImg={heroImg}
        seed={slug}
        tier={tier}
        hudLabels={hudLabels}
        heroParticlesEnabled={site.website.hero_particles_enabled}
        marqueeItems={trustItems}
      />

      {/* "advanced"/"professional" tiers only — an editorial/cinematic trust
          marquee right under the hero. Renders nothing on "standard" or when
          there's no trust copy to show. The nova hero runs the same items in a
          marquee of its own along its bottom edge, so this one stands down
          rather than stacking a second scrolling band directly beneath it. */}
      {tier !== "standard" && site.website.hero_style !== "nova" && (
        <MarqueeBand items={trustItems} dark={theme.mode === "dark"} />
      )}

      {/* Sections — rendered in the order dictated by websites.layout_style
          (registry in lib/site-layout.ts). 'flow' = original fixed order. */}
      {orderedSections}

      {/* Floating contact button. The WhatsApp case is already covered by
          <WhatsAppFloat> above (body-portaled, same bottom-5 left-5 spot), so
          this only renders the "צרו קשר" fallback for sites WITHOUT a WhatsApp
          number — otherwise two identical green buttons would stack. */}
      {!waLink && contactEnabled && (
        <a
          href="#contact"
          aria-label="צרו קשר"
          className="float-btn fixed bottom-5 left-5 z-50 flex size-14 items-center justify-center rounded-full shadow-xl"
          style={{ backgroundColor: brand, color: onBrand }}
        >
          <MessageCircle className="size-7" />
        </a>
      )}

      {/* Footer — data-el="chrome-footer" is stamped on the real <footer> inside SiteFooter */}
      <SiteFooter
        slug={slug}
        brandName={brandName}
        brand={brand}
        description={site.business.description}
        location={site.business.location}
        whatsappLink={waLink}
        hasProducts={sellsProducts}
        hasAbout={Boolean(about)}
        hasFaq={Boolean(faq && faq.items?.length > 0)}
        contactEnabled={contactEnabled}
        hasHelpPage={modeAllowsRoute(siteMode, "help")}
        socialLinks={publicSocialLinks(site.website.social_links)}
      />
    </div>
    </WishlistProvider>
    </CartProvider>
  );
}
