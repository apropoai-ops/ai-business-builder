import {
  Check,
  ChevronDown,
  MapPin,
  MessageCircle,
  Minus,
  Quote,
  X,
} from "lucide-react";

import type { LandingData, LandingSettings } from "@/lib/ai/schemas/landing";
import type { SocialLink } from "@/lib/social-links";
import { toVideoEmbedUrl } from "@/lib/video-embed";
import { brandInk, inkOn } from "@/lib/storefront-brand";
import { CountdownTimer } from "@/components/public/countdown-timer";
import { SiteLeadForm } from "@/components/public/site-lead-form";
import { SiteFooter } from "@/components/public/site-footer";
import { MapLinks } from "@/components/public/map-links";

/**
 * The landing-page renderer (site_mode = 'landing').
 *
 * One page, ELEVEN sections, in the order the spec fixes:
 *   hero → בעיה → פתרון → יתרונות → למי מתאים → תמונות → סרטון → ביקורות →
 *   FAQ → CTA → טופס
 *
 * The order is hard-coded on purpose — unlike the brochure/store site there is
 * no layout preset and no module picker here, because reordering a conversion
 * page is how you break it. Sections whose content the owner hasn't supplied
 * yet (gallery images, video URL) hide themselves rather than render empty.
 *
 * Chrome is deliberately minimal: a logo-only header with one CTA and a sticky
 * action bar. No nav links — every link out of a landing page is a lost lead.
 */
export function LandingPage({
  slug,
  landing,
  settings,
  brand,
  brandName,
  logoUrl,
  whatsappLink,
  location,
  description,
  socialLinks = [],
}: {
  slug: string;
  landing: LandingData;
  settings: LandingSettings;
  brand: string;
  brandName: string;
  logoUrl: string | null;
  whatsappLink: string | null;
  location: string | null;
  description: string | null;
  socialLinks?: SocialLink[];
}) {
  // The brand hex is whatever the AI picked for this industry — it can be navy
  // or it can be #FACC15. `ink` is what stays readable ON a brand fill; `accentInk`
  // is the brand darkened until it is readable AS text on white. Hard-coded
  // text-white was giving yellow-brand sites a CTA at ~1.5:1.
  const ink = inkOn(brand);
  const accentInk = brandInk(brand);
  const onLightBrand = ink !== "#ffffff";
  const videoEmbed = toVideoEmbedUrl(settings.videoUrl);
  const gallery = (settings.galleryUrls ?? []).filter(Boolean);
  const hasCaptions = gallery.some((_, i) => Boolean(landing.gallery.captions[i]));
  const showCountdown =
    settings.countdownEnabled === true && Boolean(settings.countdownEndsAt);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* ── Header: logo + one CTA. No navigation, by design. ── */}
      <header
        data-el="chrome-header"
        className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              // Fixed box, not fixed image dimensions: the asset is either
              // 512×256 or a square 1024×1024, so guessing an aspect ratio just
              // moves the layout shift instead of removing it.
              <span className="flex h-8 w-[140px] items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={brandName} className="max-h-8 w-auto max-w-full object-contain" />
              </span>
            ) : (
              <span className="truncate text-lg font-bold">{brandName}</span>
            )}
          </div>
          <a
            href="#lead-form"
            data-el="btn-primary"
            className="hidden rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 sm:inline-block"
            style={{ background: brand, color: ink }}
          >
            {landing.hero.ctaText}
          </a>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section
        className="relative overflow-hidden px-4 py-20 sm:py-28"
        style={{
          background: `linear-gradient(160deg, ${brand}14 0%, #ffffff 55%, ${brand}0a 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 start-[-10%] size-[26rem] rounded-full blur-3xl"
          style={{ background: `${brand}22` }}
        />
        <div className="relative mx-auto max-w-3xl text-center" data-reveal>
          {/* Spacing lives on the OPTIONAL element — an mt-5 on the h1 was
              margin-collapsing away when there was no badge above it. */}
          {landing.hero.badge && (
            <span
              className="mb-5 inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: `${brand}1f`, color: accentInk }}
            >
              {landing.hero.badge}
            </span>
          )}
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl [text-wrap:balance]">
            {landing.hero.headline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600 sm:text-xl">
            {landing.hero.subheadline}
          </p>
          <a
            href="#lead-form"
            data-el="btn-primary"
            className="mt-9 inline-block rounded-full px-9 py-4 text-lg font-bold motion-safe:transition-transform motion-safe:hover:scale-[1.03]"
            style={{ background: brand, color: ink, boxShadow: `0 18px 40px -16px ${brand}80` }}
          >
            {landing.hero.ctaText}
          </a>
        </div>
      </section>

      {/* ── 2. הבעיה ── */}
      <section className="bg-zinc-950 px-4 py-20 text-zinc-100">
        <div className="mx-auto max-w-5xl" data-reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{landing.problem.headline}</h2>
            <p className="mt-4 text-zinc-400">{landing.problem.intro}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {/* The grid is md:grid-cols-3 — a 4th point from older saved
                content would leave one orphan on its own row. */}
            {landing.problem.points.slice(0, 3).map((point, i) => (
              <div
                key={i}
                data-card
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                  <X className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. הפתרון ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl" data-reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{landing.solution.headline}</h2>
            <p className="mt-4 text-zinc-600">{landing.solution.intro}</p>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {landing.solution.points.slice(0, 3).map((point, i) => (
              <li key={i} data-card className="relative rounded-2xl bg-zinc-50 p-6 ring-1 ring-black/5">
                <span
                  className="flex size-10 items-center justify-center rounded-full text-lg font-bold"
                  style={{ background: brand, color: ink }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {point.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 4. יתרונות ── */}
      <section className="px-4 py-20" style={{ background: `${brand}08` }}>
        <div className="mx-auto max-w-5xl" data-reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl">
            {landing.benefits.headline}
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {landing.benefits.items.slice(0, 4).map((item, i) => (
              <div
                key={i}
                data-card
                className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
              >
                <span
                  className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: brand, color: ink }}
                >
                  <Check className="size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. למי זה מתאים ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl" data-reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl">
            {landing.audience.headline}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border-2 p-6" style={{ borderColor: `${brand}4d` }}>
              <h3 className="font-semibold" style={{ color: accentInk }}>
                זה בשבילכם אם…
              </h3>
              <ul className="mt-4 space-y-3">
                {landing.audience.fits.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0" style={{ color: accentInk }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-zinc-200 p-6">
              <h3 className="font-semibold text-zinc-500">זה לא בשבילכם אם…</h3>
              <ul className="mt-4 space-y-3">
                {landing.audience.notFits.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-zinc-600">
                    <Minus className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. תמונות — hidden until the owner uploads any ── */}
      {gallery.length > 0 && (
        <section className="bg-zinc-50 px-4 py-20">
          <div className="mx-auto max-w-5xl" data-reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">{landing.gallery.headline}</h2>
              <p className="mt-3 text-zinc-600">{landing.gallery.intro}</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((src, i) => (
                <figure key={src} data-card className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={landing.gallery.captions[i] ?? landing.gallery.headline}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  {/* All-or-nothing caption strip: when only some images have a
                      caption the row goes ragged. The nbsp keeps the empty ones
                      the same height (a plain space collapses to 0). */}
                  {hasCaptions && (
                    <figcaption className="px-4 py-3 text-sm text-zinc-600">
                      {landing.gallery.captions[i] || " "}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 7. סרטון — hidden until the owner pastes a usable link ── */}
      {videoEmbed && (
        <section className="px-4 py-20">
          <div className="mx-auto max-w-3xl text-center" data-reveal>
            <h2 className="text-3xl font-bold sm:text-4xl">{landing.video.headline}</h2>
            <p className="mt-3 text-zinc-600">{landing.video.intro}</p>
            <div className="mt-8 overflow-hidden rounded-2xl bg-black shadow-xl">
              <iframe
                src={videoEmbed}
                title={landing.video.headline}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="aspect-video w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 8. ביקורות ── */}
      <section className="bg-zinc-50 px-4 py-20">
        <div className="mx-auto max-w-5xl" data-reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl">
            {landing.testimonials.headline}
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {landing.testimonials.items.map((item, i) => (
              <blockquote
                key={i}
                data-card
                className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
              >
                <Quote className="size-6 opacity-25" style={{ color: brand }} />
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-700">
                  {item.quote}
                </p>
                {/* No star row: the schema has no rating field, so five filled
                    stars on every quote was a claim the data never made. */}
                <footer className="mt-5 text-sm">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-zinc-500"> · {item.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. שאלות נפוצות ── */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl" data-reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold text-balance sm:text-4xl">
            {landing.faq.headline}
          </h2>
          <div className="mt-10 space-y-3">
            {landing.faq.items.map((item, i) => (
              <details
                key={i}
                data-faq
                className="group rounded-xl bg-zinc-50 px-5 ring-1 ring-black/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-semibold">
                  {item.question}
                  <ChevronDown className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-zinc-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. קריאה לפעולה + טיימר ── */}
      <section className="px-4 py-20" style={{ background: brand, color: ink }}>
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="text-3xl font-bold sm:text-4xl [text-wrap:balance]">
            {landing.cta.headline}
          </h2>
          <p className="mt-4 text-lg opacity-85">{landing.cta.subheadline}</p>
          {showCountdown && (
            <div className="mt-8">
              <CountdownTimer
                endsAt={settings.countdownEndsAt!}
                label={settings.countdownLabel ?? landing.cta.urgency}
                accent={brand}
                onLight={onLightBrand}
              />
            </div>
          )}
          {!showCountdown && landing.cta.urgency && (
            <p className="mt-6 text-sm font-medium opacity-80">{landing.cta.urgency}</p>
          )}
          <a
            href="#lead-form"
            data-el="btn-primary"
            className="mt-9 inline-block rounded-full px-9 py-4 text-lg font-bold shadow-lg motion-safe:transition-transform motion-safe:hover:scale-[1.03]"
            style={{ background: ink, color: brand }}
          >
            {landing.cta.buttonText}
          </a>
        </div>
      </section>

      {/* ── 11. טופס ── */}
      <section id="lead-form" className="scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-xl" data-reveal>
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{landing.form.headline}</h2>
            <p className="mt-3 text-zinc-600">{landing.form.intro}</p>
          </div>
          <div className="mt-8 text-start">
            <SiteLeadForm
              slug={slug}
              brandColor={brand}
              fields={["שם מלא", "טלפון", "אימייל"]}
            />
          </div>
          {landing.form.privacyNote && (
            <p className="mt-4 text-center text-xs text-zinc-500">
              {landing.form.privacyNote}
            </p>
          )}
          {location && (
            <>
              <p className="mt-8 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
                <MapPin className="size-4" />
                {location}
              </p>
              <div className="mt-2 flex justify-center">
                <MapLinks address={location} brand={brand} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Sticky action bar — the only floating element on the page, so it never
          fights the WhatsApp float for the same corner. */}
      <div
        // Bottom padding clears the iPhone home indicator, which was cutting
        // through the buttons.
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        className="sticky bottom-0 z-40 border-t border-black/5 bg-white/90 px-4 pt-3 backdrop-blur-lg sm:hidden"
      >
        <div className="flex items-center gap-2">
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ווטסאפ"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white"
            >
              <MessageCircle className="size-6" />
            </a>
          )}
          <a
            href="#lead-form"
            data-el="btn-primary"
            className="flex-1 rounded-full py-3 text-center font-bold"
            style={{ background: brand, color: ink }}
          >
            {landing.cta.buttonText}
          </a>
        </div>
      </div>

      <SiteFooter
        slug={slug}
        brandName={brandName}
        brand={brand}
        description={description}
        location={location}
        whatsappLink={whatsappLink}
        hasProducts={false}
        hasAbout={false}
        hasFaq={false}
        contactEnabled={false}
        hasHelpPage={false}
        socialLinks={socialLinks}
      />
      {/* The sticky bar is pinned to the bottom of this container, so without a
          spacer it sat on top of the footer's last row on mobile. */}
      <div aria-hidden className="h-[76px] sm:hidden" />
    </div>
  );
}
