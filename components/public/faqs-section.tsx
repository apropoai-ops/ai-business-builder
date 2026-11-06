/**
 * Public DB-backed FAQ section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <FaqsSection businessId={businessId} brand={brand} />
 *
 * (async server component — service-role fetches its own data; renders nothing
 * when the business has no FAQs.)
 *
 * NOTE: distinct from the legacy FAQ block sourced from the website JSON —
 * this one is the editable, DB-backed module and uses id="faqs".
 */
import { listPublicFaqs } from "@/lib/services/faqs.service";

export async function FaqsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const faqs = await listPublicFaqs(businessId);
  if (faqs.length === 0) return null;

  return (
    <section id="faqs" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-3xl font-bold">שאלות נפוצות</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.id}
              data-faq
              className="group rounded-xl border bg-zinc-50 p-4"
            >
              <summary
                className="cursor-pointer list-none font-semibold group-open:[color:var(--faq-brand)]"
                style={{ ["--faq-brand" as string]: brand }}
              >
                {f.question}
              </summary>
              {f.answer && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {f.answer}
                </p>
              )}
              {f.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.image_url}
                  alt={f.question}
                  loading="lazy"
                  className="mt-3 max-h-48 rounded-lg object-cover"
                />
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
