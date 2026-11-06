/**
 * Public "how it works" / process section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <ProcessStepsSection businessId={businessId} brand={brand} />
 *
 * (async server component — fetches its own data via the service role and
 * renders nothing when the business has no steps.)
 */
import { listPublicProcessSteps } from "@/lib/services/process-steps.service";
import { inkOn } from "@/lib/storefront-brand";

export async function ProcessStepsSection({
  businessId,
  brand,
}: {
  businessId: string;
  brand: string;
}) {
  const steps = await listPublicProcessSteps(businessId);
  if (steps.length === 0) return null;

  // Up to 4 steps read well side-by-side; more than that stack vertically.
  const grid = steps.length <= 4;

  return (
    <section id="process" data-el="module-section" className="px-4 py-16 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold" data-reveal>
          איך זה עובד
        </h2>

        <div
          className={
            grid
              ? "grid gap-6 sm:grid-cols-3"
              : "flex flex-col gap-6"
          }
        >
          {steps.map((step, i) => (
            <div
              key={step.id}
              data-reveal
              style={{ transitionDelay: `${i * 80}ms` }}
              className={
                grid
                  ? "flex flex-col items-center text-center"
                  : "flex items-start gap-4 text-start"
              }
            >
              {step.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={step.image_url}
                  alt={step.title}
                  loading="lazy"
                  className={
                    grid
                      ? "aspect-video w-full rounded-lg object-cover"
                      : "aspect-video w-40 shrink-0 rounded-lg object-cover"
                  }
                />
              )}
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm"
                style={{ backgroundColor: brand, color: inkOn(brand) }}
                aria-hidden
              >
                {i + 1}
              </div>
              <div className={grid ? "mt-4" : "min-w-0 flex-1"}>
                <h3 className="text-lg font-bold text-zinc-900">{step.title}</h3>
                {step.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
