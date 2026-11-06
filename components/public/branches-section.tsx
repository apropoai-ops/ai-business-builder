/**
 * Public branches / locations section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <BranchesSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service-role client;
 * renders nothing when the business has no branches.)
 */
import { MapPin, Phone, Clock } from "lucide-react";

import { listPublicBranches } from "@/lib/services/branches.service";
import { MapLinks } from "@/components/public/map-links";

export async function BranchesSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const branches = await listPublicBranches(businessId);
  if (branches.length === 0) return null;

  return (
    <section id="branches" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
          הסניפים שלנו
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b, i) => (
            <div
              key={b.id}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className="flex flex-col gap-2 rounded-2xl border bg-white p-6 shadow-sm"
            >
              {b.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.image_url}
                  alt={b.name}
                  loading="lazy"
                  className="-mx-6 -mt-6 mb-2 aspect-video w-[calc(100%+3rem)] object-cover"
                />
              )}
              <h3 className="text-lg font-bold text-zinc-900">{b.name}</h3>

              {b.address && (
                <p className="flex items-start gap-2 text-sm text-zinc-600">
                  <MapPin className="mt-0.5 size-4 shrink-0" style={{ color: brand }} />
                  <span>{b.address}</span>
                </p>
              )}

              {b.phone && (
                <p className="flex items-center gap-2 text-sm text-zinc-600">
                  <Phone className="size-4 shrink-0" style={{ color: brand }} />
                  <a href={`tel:${b.phone}`} dir="ltr" className="hover:underline">
                    {b.phone}
                  </a>
                </p>
              )}

              {b.hours && (
                <p className="flex items-start gap-2 text-sm text-zinc-600">
                  <Clock className="mt-0.5 size-4 shrink-0" style={{ color: brand }} />
                  <span className="whitespace-pre-wrap">{b.hours}</span>
                </p>
              )}

              {(b.address || b.map_url) && (
                <MapLinks address={b.address} mapUrl={b.map_url} brand={brand} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
