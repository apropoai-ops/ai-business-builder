/**
 * Public upcoming-events section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <EventsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via service role; renders
 * nothing when there are no active, upcoming events.)
 */
import { MapPin, Users } from "lucide-react";

import { listPublicEvents } from "@/lib/services/events.service";
import { inkOn } from "@/lib/storefront-brand";

// timeZone is required, not decorative: this renders server-side, where the
// runtime clock is UTC — an event stored for 19:00 Israel time is ~22:00 UTC,
// so a late-evening event could even print on the wrong calendar day without it.
const dayFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", timeZone: "Asia/Jerusalem" });
const monthFmt = new Intl.DateTimeFormat("he-IL", { month: "short", timeZone: "Asia/Jerusalem" });
const timeFmt = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

export async function EventsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const events = await listPublicEvents(businessId);
  if (events.length === 0) return null;

  return (
    <section id="events" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-8 text-center text-3xl font-bold">אירועים קרובים</h2>
        <div className="space-y-4">
          {events.map((e) => {
            const when = e.starts_at ? new Date(e.starts_at) : null;
            return (
              <div
                key={e.id}
                className="flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm"
              >
                {e.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e.title}
                    loading="lazy"
                    className="hidden aspect-video w-32 shrink-0 rounded-xl object-cover sm:block"
                  />
                )}
                {when && (
                  <div
                    className="flex shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 text-white"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                  >
                    <span className="text-2xl font-bold leading-none">
                      {dayFmt.format(when)}
                    </span>
                    <span className="text-xs font-medium">{monthFmt.format(when)}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-zinc-900">{e.title}</h3>
                  {e.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                      {e.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4" />
                        {e.location}
                      </span>
                    )}
                    {when && (
                      <span className="inline-flex items-center gap-1">
                        {timeFmt.format(when)}
                      </span>
                    )}
                    {e.capacity != null && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-4" />
                        עד {e.capacity} משתתפים
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
