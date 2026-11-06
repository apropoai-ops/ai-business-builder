/**
 * Public testimonials / case-studies section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <TestimonialsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service-role client;
 * renders nothing when the owner hasn't curated any testimonials.)
 *
 * These are owner-curated quotes — DISTINCT from customer-submitted reviews
 * (see site-reviews.tsx).
 */
import { Star } from "lucide-react";

import { listPublicTestimonials } from "@/lib/services/testimonials.service";
import { inkOn } from "@/lib/storefront-brand";

function BrandStars({ rating, brand }: { rating: number; brand: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`דירוג ${rating} מתוך 5`}>
      {Array.from({ length: rating }, (_, i) => (
        <Star key={i} className="size-4" style={{ color: brand, fill: brand }} />
      ))}
    </div>
  );
}

export async function TestimonialsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const items = await listPublicTestimonials(businessId);
  if (items.length === 0) return null;

  return (
    <section id="testimonials" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">ממליצים עלינו</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <figure
              key={t.id}
              className="flex flex-col rounded-2xl border bg-white p-6 shadow-sm"
            >
              {t.rating != null && t.rating > 0 && (
                <BrandStars rating={t.rating} brand={brand} />
              )}
              <blockquote className="mt-3 flex-1 whitespace-pre-wrap text-lg leading-relaxed text-zinc-700">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {t.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.photo_url}
                    alt={t.author}
                    loading="lazy"
                    className="size-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                    aria-hidden
                  >
                    {t.author.trim().charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-zinc-900">{t.author}</div>
                  {t.role && <div className="text-sm text-zinc-500">{t.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
