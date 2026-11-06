/**
 * Public "by the numbers" section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <StatsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via service role; renders
 * nothing when there are no stats.)
 */
import { listPublicStats } from "@/lib/services/stats.service";

export async function StatsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const stats = await listPublicStats(businessId);
  if (stats.length === 0) return null;

  return (
    <section id="stats" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-bold" data-reveal>
          במספרים
        </h2>
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.id} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              {s.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.image_url}
                  alt={s.label}
                  loading="lazy"
                  className="mx-auto mb-2 size-12 rounded-full object-cover"
                />
              )}
              {/* The number and its suffix are separate elements on purpose:
                  `data-counter` is animated by SitePolish, which only accepts a
                  node whose ENTIRE text is a number. Keeping "+" / "%" outside
                  it means "500+" still counts up, where a combined node would
                  be skipped as unparseable. */}
              <div className="text-4xl font-extrabold" style={{ color: brand }}>
                <span data-counter>{s.value}</span>
                {s.suffix ?? ""}
              </div>
              <div className="mt-2 text-sm text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
