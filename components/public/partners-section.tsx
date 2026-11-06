/**
 * Public partners / client-logos strip for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <PartnersSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data with the service role and
 * renders nothing when there are no partners.)
 */
import { listPublicPartners } from "@/lib/services/partners.service";

export async function PartnersSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  void brand;
  const partners = await listPublicPartners(businessId);
  if (partners.length === 0) return null;

  return (
    <section id="partners" data-el="module-section" className="bg-white px-4 py-14 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-bold">
          השותפים והלקוחות שלנו
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-10">
          {partners.map((p) => {
            const logo = p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url} alt={p.name} className="h-10 w-auto max-w-[140px] object-contain" />
            ) : (
              <span className="text-lg font-semibold text-zinc-500">{p.name}</span>
            );
            const content = (
              <div className="grayscale opacity-60 transition hover:opacity-100">
                {logo}
              </div>
            );
            return p.link ? (
              <a
                key={p.id}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.name}
              >
                {content}
              </a>
            ) : (
              <div key={p.id}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
