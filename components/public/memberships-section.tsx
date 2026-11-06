/**
 * Public memberships section for the storefront.
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <MembershipsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service-role client;
 * renders nothing when the business has no memberships.)
 */
import { Check } from "lucide-react";

import { listPublicMemberships } from "@/lib/services/memberships.service";
import { inkOn } from "@/lib/storefront-brand";

export async function MembershipsSection({
  businessId,
  brand,
  contactEnabled = true,
}: {
  businessId: string;
  brand: string;
  contactEnabled?: boolean;
}) {
  const memberships = await listPublicMemberships(businessId);
  if (memberships.length === 0) return null;

  return (
    <section id="memberships" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">מסלולי חברות</h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => {
            const perks = Array.isArray(m.perks) ? (m.perks as string[]) : [];
            return (
              <div
                key={m.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  m.highlight ? "border-2" : ""
                }`}
                style={m.highlight ? { borderColor: brand } : undefined}
              >
                {m.highlight && (
                  <span
                    className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                  >
                    מומלץ
                  </span>
                )}

                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt={m.name}
                    loading="lazy"
                    className="-mx-6 -mt-6 mb-4 aspect-video w-[calc(100%+3rem)] rounded-t-2xl object-cover"
                  />
                )}

                <h3 className="text-xl font-bold text-zinc-900">{m.name}</h3>

                {m.price != null && (
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-zinc-900">
                      ₪{Number(m.price).toLocaleString("he-IL")}
                    </span>
                    {m.period && (
                      <span className="text-sm text-zinc-500">{m.period}</span>
                    )}
                  </div>
                )}

                {perks.length > 0 && (
                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-zinc-600">
                    {perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 size-4 shrink-0"
                          style={{ color: brand }}
                        />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {contactEnabled && (
                  <a
                    href="#contact"
                    className="mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: brand, color: inkOn(brand) }}
                  >
                    להצטרפות
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
