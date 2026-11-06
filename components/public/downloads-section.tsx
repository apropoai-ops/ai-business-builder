/**
 * Public digital-downloads / resources section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <DownloadsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service role and
 * renders nothing when there are no resources.)
 */
import { FileDown } from "lucide-react";

import { listPublicDownloads } from "@/lib/services/downloads.service";
import { inkOn } from "@/lib/storefront-brand";

export async function DownloadsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const items = await listPublicDownloads(businessId);
  if (items.length === 0) return null;

  return (
    <section id="downloads" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
          להורדה
        </h2>
        <div className="space-y-4">
          {items.map((d) => (
            <div
              key={d.id}
              data-reveal
              className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm"
            >
              {d.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.image_url}
                  alt={d.title}
                  loading="lazy"
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <FileDown className="size-8 shrink-0" style={{ color: brand }} />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-zinc-900">{d.title}</div>
                {d.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                    {d.description}
                  </p>
                )}
                <div className="mt-1 text-sm font-semibold text-zinc-700">
                  {d.price != null ? `₪${d.price}` : "חינם"}
                </div>
              </div>
              {/* A priced file has nothing to be paid through — there is no
                  digital-goods checkout — so it routes to the contact form the
                  same way courses and memberships do, instead of handing the
                  file over for free. The API refuses it too. */}
              {d.price != null && Number(d.price) > 0 ? (
                <a
                  href="#contact"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:opacity-90"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  <FileDown className="size-4" />
                  לרכישה — צרו קשר
                </a>
              ) : (
                <a
                  href={d.storage_path ? `/api/downloads/${d.id}` : d.file_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  <FileDown className="size-4" />
                  הורדה
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
