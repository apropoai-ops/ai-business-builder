/**
 * Public "before / after" showcase section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <BeforeAfterSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service role and
 * renders nothing when there are no items.)
 */
import { listPublicBeforeAfter } from "@/lib/services/before-after.service";
import { inkOn } from "@/lib/storefront-brand";

export async function BeforeAfterSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const items = await listPublicBeforeAfter(businessId);
  if (items.length === 0) return null;

  return (
    <section id="before-after" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-bold">לפני ואחרי</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border"
            >
              <div className="grid grid-cols-2">
                <div className="relative">
                  <span className="absolute right-2 top-2 rounded-full bg-zinc-900/80 px-2.5 py-0.5 text-xs font-medium text-white">
                    לפני
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.before_url}
                    alt={item.title ? `לפני — ${item.title}` : "לפני"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="relative">
                  <span
                    className="absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                  >
                    אחרי
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.after_url}
                    alt={item.title ? `אחרי — ${item.title}` : "אחרי"}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </div>
              </div>
              {item.title && (
                <p className="px-4 py-3 text-center text-sm font-medium text-zinc-700">
                  {item.title}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
