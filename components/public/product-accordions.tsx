/**
 * Product-page accordions: full description, shipping & returns, size guide.
 * Styled to match the storefront FAQ section (native <details>/<summary>).
 */
import { SizeGuide } from "@/components/public/size-guide";
import type { ShippingMethod } from "@/types/database";

function Accordion({
  title,
  brand,
  defaultOpen = false,
  children,
}: {
  title: string;
  brand: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      data-faq
      open={defaultOpen}
      className="group rounded-xl border bg-zinc-50 p-4"
    >
      <summary
        className="cursor-pointer list-none font-semibold group-open:[color:var(--faq-brand)]"
        style={{ ["--faq-brand" as string]: brand }}
      >
        {title}
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-zinc-600">{children}</div>
    </details>
  );
}

export function ProductAccordions({
  description,
  shippingMethods,
  sizeGuide,
  brand,
  slug,
}: {
  description: string | null;
  shippingMethods: ShippingMethod[];
  sizeGuide: unknown;
  brand: string;
  slug: string;
}) {
  const hasSizeGuide =
    !!sizeGuide &&
    typeof sizeGuide === "object" &&
    Array.isArray((sizeGuide as Record<string, unknown>).rows) &&
    ((sizeGuide as Record<string, unknown>).rows as unknown[]).length > 0;

  if (!description && shippingMethods.length === 0 && !hasSizeGuide) return null;

  return (
    <div className="mt-8 space-y-3">
      {description && (
        <Accordion title="תיאור מלא" brand={brand} defaultOpen>
          <p className="whitespace-pre-wrap">{description}</p>
        </Accordion>
      )}

      <Accordion title="משלוחים והחזרות" brand={brand}>
        {shippingMethods.length > 0 ? (
          <ul className="space-y-1.5">
            {shippingMethods.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span>
                  {m.name}
                  {m.eta ? ` · ${m.eta}` : ""}
                </span>
                <span className="font-semibold text-zinc-700">
                  {m.price > 0 ? `₪${m.price.toLocaleString()}` : "חינם"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            אנו שולחים את המוצרים במהירות ובאריזה בטוחה. ניתן להחזיר או להחליף מוצר בהתאם למדיניות
            החנות. לפרטים נוספים{" "}
            <a href={`/s/${slug}/help`} className="underline underline-offset-2" style={{ color: brand }}>
              עמוד העזרה
            </a>
            .
          </p>
        )}
      </Accordion>

      {hasSizeGuide && (
        <Accordion title="מדריך מידות" brand={brand}>
          <SizeGuide guide={sizeGuide} brand={brand} />
        </Accordion>
      )}
    </div>
  );
}
