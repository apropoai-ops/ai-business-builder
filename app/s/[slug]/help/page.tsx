import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, RotateCcw, CreditCard, MapPin } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { parseEnabledMethods, paymentMethodLabel } from "@/lib/payments";
import { SiteFooter } from "@/components/public/site-footer";
import { publicSocialLinks } from "@/lib/social-links";
import { inkOn } from "@/lib/storefront-brand";

type Palette = { name: string; hex: string; usage: string }[];

function isLight(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  return (
    parseInt(m.slice(0, 2), 16) +
      parseInt(m.slice(2, 4), 16) +
      parseInt(m.slice(4, 6), 16) >
    660
  );
}

/** Picks a strong brand color (skips near-white backgrounds). */
function pickBrandColor(palette: Palette | null): string {
  const fallback = "#2563EB";
  if (!palette?.length) return fallback;
  const strong = palette.find(
    (c) => /^#[0-9a-fA-F]{6}$/.test(c.hex) && !isLight(c.hex),
  );
  return strong?.hex ?? fallback;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) return { title: "האתר לא נמצא" };

  const name = site.brand?.brand_name ?? site.business.name ?? "העסק";
  return {
    title: `עזרה ומשלוחים — ${name}`,
    description: `משלוחים, החזרות, החלפות ואמצעי תשלום בחנות ${name}.`,
    robots: { index: false },
  };
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();

  const brandName = site.brand?.brand_name ?? site.business.name ?? "העסק";
  const brand = pickBrandColor(site.brand?.color_palette as Palette | null);
  const methods = parseEnabledMethods(site.business.payment_methods);
  const shippingMethods = site.shippingMethods;
  const hasProducts = site.products.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href={`/s/${slug}`} className="text-lg font-bold hover:opacity-80">
            {brandName}
          </Link>
          <Link
            href={`/s/${slug}`}
            className="text-sm font-medium hover:underline"
            style={{ color: brand }}
          >
            חזרה לאתר
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-extrabold sm:text-4xl">עזרה ומשלוחים</h1>
        <p className="mt-2 text-sm text-zinc-500">
          כל מה שצריך לדעת על משלוחים, החזרות ותשלום בחנות{" "}
          <strong className="font-semibold text-zinc-700">{brandName}</strong>
        </p>

        {/* Shipping */}
        <section className="mt-10" aria-labelledby="shipping-heading">
          <h2 id="shipping-heading" className="flex items-center gap-2 text-xl font-bold">
            <Truck className="size-5" style={{ color: brand }} />
            שיטות משלוח
          </h2>

          {hasProducts ? (
            shippingMethods.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-xl border bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-zinc-50 text-right text-xs text-zinc-500">
                      <th className="px-4 py-2.5 font-medium">שיטה</th>
                      <th className="px-4 py-2.5 font-medium">מחיר</th>
                      <th className="px-4 py-2.5 font-medium">זמן אספקה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingMethods.map((sm) => (
                      <tr key={sm.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{sm.name}</td>
                        <td className="px-4 py-3">
                          {sm.price > 0 ? `₪${sm.price}` : "חינם"}
                          {sm.free_over != null && sm.price > 0 && (
                            <div className="mt-0.5 text-xs text-zinc-500">
                              חינם מעל ₪{sm.free_over}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{sm.eta ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 leading-relaxed text-zinc-700">
                {site.business.shipping_fee != null
                  ? `עלות המשלוח היא ₪${site.business.shipping_fee}${
                      site.business.free_shipping_threshold != null
                        ? `, ומשלוח חינם בהזמנה מעל ₪${site.business.free_shipping_threshold}`
                        : ""
                    }.`
                  : "פרטי המשלוח יימסרו בעת ביצוע ההזמנה או בתיאום מול העסק."}
              </p>
            )
          ) : (
            <p className="mt-3 leading-relaxed text-zinc-700">
              העסק אינו מפעיל חנות מקוונת עם משלוחים כרגע — לתיאום שירות פנו
              אלינו דרך טופס יצירת הקשר.
            </p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            ההזמנה תסופק לכתובת שסופקה בעת ביצוע ההזמנה. זמני האספקה המצוינים
            הם זמנים משוערים ועשויים להשתנות בהתאם לאזור המשלוח ולעומס.
          </p>
        </section>

        {/* Returns */}
        <section className="mt-10" aria-labelledby="returns-heading">
          <h2 id="returns-heading" className="flex items-center gap-2 text-xl font-bold">
            <RotateCcw className="size-5" style={{ color: brand }} />
            החזרות והחלפות
          </h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            ניתן לבטל עסקה ולהחזיר מוצר תוך 14 ימים ממועד קבלתו, בהתאם לחוק
            הגנת הצרכן. המוצר יוחזר באריזתו המקורית ובמצב תקין. לפתיחת בקשת
            החזרה ומעקב אחרי הזמנה קיימת, ניתן להשתמש בטופס המעקב באתר או לפנות
            אלינו ישירות.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            לפרטים המלאים ראו את{" "}
            <Link href={`/s/${slug}/terms`} className="hover:underline" style={{ color: brand }}>
              תקנון האתר
            </Link>
            .
          </p>
        </section>

        {/* Payment */}
        <section className="mt-10" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="flex items-center gap-2 text-xl font-bold">
            <CreditCard className="size-5" style={{ color: brand }} />
            אמצעי תשלום
          </h2>
          {methods.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {methods.map((m) => (
                <li
                  key={m}
                  className="rounded-full border bg-white px-3 py-1.5 text-sm font-medium"
                >
                  {paymentMethodLabel(m)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 leading-relaxed text-zinc-700">
              אמצעי התשלום המקובלים יימסרו בעת ביצוע ההזמנה.
            </p>
          )}
        </section>

        {/* Location */}
        {site.business.location && (
          <section className="mt-10" aria-labelledby="location-heading">
            <h2 id="location-heading" className="flex items-center gap-2 text-xl font-bold">
              <MapPin className="size-5" style={{ color: brand }} />
              כתובת / איזור שירות
            </h2>
            <p className="mt-3 leading-relaxed text-zinc-700">{site.business.location}</p>
          </section>
        )}

        <div
          className="mt-10 rounded-2xl border p-6 text-center"
          style={{ background: `${brand}0d`, borderColor: `${brand}33` }}
        >
          <p className="leading-relaxed text-zinc-700">
            יש לכם שאלה נוספת? נשמח לעזור.
          </p>
          <a
            href={`/s/${slug}#contact`}
            className="mt-3 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: brand, color: inkOn(brand) }}
          >
            צרו קשר
          </a>
        </div>
      </main>

      <SiteFooter
        slug={slug}
        brandName={brandName}
        brand={brand}
        description={site.business.description}
        location={site.business.location}
        whatsappLink={null}
        hasProducts={hasProducts}
        hasAbout={Boolean(site.website.page_about)}
        hasFaq={Boolean(site.website.page_faq)}
        socialLinks={publicSocialLinks(site.website.social_links)}
      />
    </div>
  );
}
