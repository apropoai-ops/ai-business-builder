/**
 * Public menu / catalog section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <MenuSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via service role; renders
 * nothing when there are no items.)
 */
import { listPublicMenu } from "@/lib/services/menu.service";
import type { MenuItem } from "@/types/database";

export async function MenuSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const items = await listPublicMenu(businessId);
  if (items.length === 0) return null;

  // Group items by section (in JS), preserving the sort order they arrive in.
  const groups: { section: string | null; items: MenuItem[] }[] = [];
  for (const item of items) {
    const key = item.section ?? null;
    let group = groups.find((g) => g.section === key);
    if (!group) {
      group = { section: key, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <section id="menu" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-3xl font-bold">התפריט שלנו</h2>

        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.section ?? "__none__"}>
              {group.section && (
                <h3 className="mb-4 text-lg font-bold" style={{ color: brand }}>
                  {group.section}
                </h3>
              )}
              <div className="space-y-5">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="size-16 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-bold text-zinc-900">{item.name}</span>
                        {item.price != null && (
                          <span
                            className="shrink-0 font-semibold"
                            style={{ color: brand }}
                          >
                            ₪{Number(item.price).toLocaleString("he-IL")}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
