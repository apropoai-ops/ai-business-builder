/**
 * Public certifications / awards / badges section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <CertificationsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via service role; renders
 * nothing when the business has no certifications.)
 */
import { Award } from "lucide-react";

import { listPublicCertifications } from "@/lib/services/certifications.service";

export async function CertificationsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const items = await listPublicCertifications(businessId);
  if (items.length === 0) return null;

  return (
    <section id="certifications" data-el="module-section" className="bg-white px-4 py-14 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
          תעודות והסמכות
        </h2>
        <div className="grid grid-cols-2 gap-5 text-center sm:grid-cols-3 lg:grid-cols-4">
          {items.map((c, i) => (
            <div
              key={c.id}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className="rounded-2xl border bg-white p-5"
            >
              <div className="flex h-16 items-center justify-center">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.title}
                    loading="lazy"
                    className="h-16 object-contain"
                  />
                ) : (
                  <Award className="size-12" style={{ color: brand }} />
                )}
              </div>
              <p className="mt-3 font-bold text-zinc-900">{c.title}</p>
              {(c.issuer || c.year) && (
                <p className="mt-1 text-sm text-zinc-500">
                  {[c.issuer, c.year].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
