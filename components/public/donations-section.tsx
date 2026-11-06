/**
 * Public donation-campaigns section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <DonationsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service role; renders
 * nothing when there are no active campaigns.)
 */
import { listPublicDonations } from "@/lib/services/donations.service";
import { inkOn } from "@/lib/storefront-brand";

export async function DonationsSection({
  businessId,
  brand,
  contactEnabled = true,
}: {
  businessId: string;
  brand: string;
  contactEnabled?: boolean;
}) {
  const items = await listPublicDonations(businessId);
  if (items.length === 0) return null;

  return (
    <section id="donations" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
          קמפיינים לתרומה
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((d, i) => {
            const goal = d.goal_amount != null ? Number(d.goal_amount) : 0;
            const raised = Number(d.raised_amount);
            const hasBar = goal > 0;
            const pct = hasBar ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            return (
              <div
                key={d.id}
                data-reveal
                style={{ transitionDelay: `${i * 80}ms` }}
                className="flex flex-col rounded-2xl border bg-white p-6 shadow-sm"
              >
                {d.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.image_url}
                    alt={d.title}
                    loading="lazy"
                    className="-mx-6 -mt-6 mb-4 aspect-video w-[calc(100%+3rem)] rounded-t-2xl object-cover"
                  />
                )}
                <h3 className="text-lg font-bold text-zinc-900">{d.title}</h3>
                {d.description && (
                  <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                    {d.description}
                  </p>
                )}
                {hasBar && (
                  <div className="mt-4">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: brand }}
                      />
                    </div>
                    <p className="mt-2 text-sm font-medium text-zinc-700">
                      ₪{raised.toLocaleString("he-IL")} מתוך ₪{goal.toLocaleString("he-IL")}
                    </p>
                  </div>
                )}
                {contactEnabled && (
                  <a
                    href="#contact"
                    className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                  >
                    לתרומה
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
