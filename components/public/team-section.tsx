/**
 * Public team section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <TeamSection businessId={businessId} brand={brand} />
 *
 * (async server component — service-role fetch; renders nothing when the
 * business has no team members.)
 */
import { listPublicTeam } from "@/lib/services/team.service";
import { inkOn } from "@/lib/storefront-brand";

export async function TeamSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const team = await listPublicTeam(businessId);
  if (team.length === 0) return null;

  return (
    <section id="team" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">הצוות שלנו</h2>
        <div className="grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <div
              key={m.id}
              className="flex flex-col items-center rounded-2xl border bg-white p-6 shadow-sm"
            >
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.photo_url}
                  alt={m.name}
                  loading="lazy"
                  className="size-24 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex size-24 items-center justify-center rounded-full text-3xl font-bold text-white"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  {m.name.trim().charAt(0)}
                </div>
              )}
              <div className="mt-4 text-lg font-bold text-zinc-900">
                {m.name}
              </div>
              {m.role && (
                <div
                  className="mt-1 text-sm font-medium"
                  style={{ color: brand }}
                >
                  {m.role}
                </div>
              )}
              {m.bio && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {m.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
