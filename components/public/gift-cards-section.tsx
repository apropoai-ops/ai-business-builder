/**
 * Public gift-card promo for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <GiftCardsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data; renders the promo only when
 * the business has at least one active gift card.)
 */
import { countActiveGiftCards } from "@/lib/services/gift-cards.service";
import { inkOn } from "@/lib/storefront-brand";

export async function GiftCardsSection({
  businessId,
  brand,
  contactEnabled = true,
}: {
  businessId: string;
  brand: string;
  contactEnabled?: boolean;
}) {
  const activeCount = await countActiveGiftCards(businessId);
  if (activeCount < 1) return null;

  return (
    <section id="giftcards" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold">גיפט קארד</h2>
        <div
          className="mx-auto rounded-2xl border bg-white p-8 shadow-sm"
          data-reveal
        >
          <h3 className="mb-2 text-2xl font-bold">גיפט קארד</h3>
          <p className="mb-6 text-zinc-600">מתנה מושלמת לכל אירוע</p>
          {contactEnabled && (
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: brand, color: inkOn(brand) }}
            >
              לרכישת שובר מתנה
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
