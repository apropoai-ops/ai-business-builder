/**
 * Public gallery section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <GallerySection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service-role public
 * list; renders nothing when the business has no gallery items.)
 */
import { listPublicGallery } from "@/lib/services/gallery.service";

export async function GallerySection({
  businessId,
  brand,
  title = "הגלריה שלנו",
}: {
  businessId: string;
  brand: string;
  /** Store sites use it to say "product photos"; everyone else keeps "our gallery". */
  title?: string;
}) {
  const items = await listPublicGallery(businessId);
  if (items.length === 0) return null;

  return (
    <section id="gallery" data-el="module-section" className="bg-white px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <figure
              key={it.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.image_url}
                alt={it.title ?? "תמונת גלריה"}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover"
              />
              {(it.title || it.caption) && (
                <figcaption className="px-4 py-3">
                  {it.title && (
                    <p
                      className="text-sm font-semibold"
                      style={{ color: brand }}
                    >
                      {it.title}
                    </p>
                  )}
                  {it.caption && (
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">
                      {it.caption}
                    </p>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
