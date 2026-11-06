import { listPublicUnits } from "@/lib/services/rentals.service";
import { RentalBooking } from "@/components/public/rental-booking";

/**
 * Public vacation-rental (צימר) section for /s/[slug] — lists the active units
 * with a live availability + booking form each. Renders nothing when the owner
 * has no active units.
 */
export async function RentalsSection({
  slug,
  businessId,
  brand,
}: {
  slug: string;
  businessId: string;
  brand: string;
}) {
  const units = await listPublicUnits(businessId);
  if (units.length === 0) return null;

  return (
    <section id="rentals" data-el="module-section" className="bg-zinc-50 px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-3xl font-bold">שריון תאריכים</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <RentalBooking key={u.id} slug={slug} unit={u} brand={brand} />
          ))}
        </div>
      </div>
    </section>
  );
}
