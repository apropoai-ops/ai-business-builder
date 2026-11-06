/**
 * Public job-openings ("דרושים") section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <JobsSection businessId={businessId} brand={brand} />
 *
 * (async server component — service-role fetches its own active openings;
 * renders null when there are none.)
 */
import { MapPin, Clock } from "lucide-react";

import { listPublicJobs } from "@/lib/services/jobs.service";
import { inkOn } from "@/lib/storefront-brand";

export async function JobsSection({
  businessId,
  brand,
  contactEnabled = true,
}: {
  businessId: string;
  brand: string;
  contactEnabled?: boolean;
}) {
  const jobs = await listPublicJobs(businessId);
  if (jobs.length === 0) return null;

  return (
    <section id="jobs" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-3xl font-bold">דרושים</h2>

        <div className="space-y-4">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-3">
                {j.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={j.image_url}
                    alt={j.title}
                    loading="lazy"
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                )}
                <h3 className="text-lg font-bold">{j.title}</h3>
              </div>

              {(j.location || j.employment_type) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {j.location && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${brand}1a`, color: brand }}
                    >
                      <MapPin className="size-3.5" />
                      {j.location}
                    </span>
                  )}
                  {j.employment_type && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${brand}1a`, color: brand }}
                    >
                      <Clock className="size-3.5" />
                      {j.employment_type}
                    </span>
                  )}
                </div>
              )}

              {j.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {j.description}
                </p>
              )}

              {contactEnabled && (
                <a
                  href="#contact"
                  className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  להגשת מועמדות
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
