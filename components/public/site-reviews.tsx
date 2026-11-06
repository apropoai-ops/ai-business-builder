/**
 * Public customer-reviews section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <SiteReviewsSection slug={slug} brand={brand} />
 *
 * (async server component — fetches its own data; renders the review cards
 * only when there are approved reviews, but the submit form is always shown.)
 */
import { Star, BadgeCheck } from "lucide-react";

import { getApprovedReviews } from "@/lib/services/reviews.service";
import { SiteReviewForm } from "@/components/public/site-review-form";

function BrandStars({ rating, brand }: { rating: number; brand: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`דירוג ${rating} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="size-4"
          style={
            i <= rating
              ? { color: brand, fill: brand }
              : { color: "#d4d4d8", fill: "transparent" }
          }
        />
      ))}
    </div>
  );
}

export async function SiteReviewsSection({
  slug,
  brand,
}: {
  slug: string;
  brand: string;
}) {
  const reviews = await getApprovedReviews(slug, 12);

  return (
    <section id="reviews" className="mx-auto max-w-5xl px-4 py-16">
      {reviews.length > 0 && (
        <>
          <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
            לקוחות ממליצים
          </h2>
          <div className="mb-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <div
                key={r.id}
                data-reveal
                style={{ transitionDelay: `${i * 80}ms` }}
                className="flex flex-col rounded-2xl border bg-white p-6 shadow-sm"
              >
                <BrandStars rating={r.rating} brand={brand} />
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt={`תמונה מ${r.customer_name}`}
                    loading="lazy"
                    className="mt-3 max-h-56 w-full rounded-xl object-cover"
                  />
                )}
                <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {r.content}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                  {r.customer_name}
                  {r.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      <BadgeCheck className="size-3.5" />
                      ✓ קנייה מאומתת
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mx-auto max-w-xl" data-reveal>
        <h3 className="mb-2 text-center text-2xl font-bold">
          {reviews.length > 0 ? "גם לכם יש מה לספר?" : "היו הראשונים להמליץ"}
        </h3>
        <p className="mb-6 text-center text-zinc-600">
          נשמח לשמוע על החוויה שלכם
        </p>
        <SiteReviewForm slug={slug} brandColor={brand} />
      </div>
    </section>
  );
}
