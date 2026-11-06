import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { parseEnabledMethods, paymentMethodLabel } from "@/lib/payments";
import { SiteFooter } from "@/components/public/site-footer";
import { publicSocialLinks } from "@/lib/social-links";
import { modeAllowsRoute, resolveSiteMode } from "@/lib/site-mode";

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
    title: `תקנון — ${name}`,
    description: `תקנון האתר ותנאי השימוש בחנות המקוונת של ${name}.`,
    robots: { index: false },
  };
}

export default async function TermsPage({
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
        <h1 className="text-3xl font-extrabold sm:text-4xl">תקנון האתר</h1>
        <p className="mt-2 text-sm text-zinc-500">
          תקנון השימוש באתר <strong className="font-semibold text-zinc-700">{brandName}</strong>
        </p>

        <section className="mt-8 space-y-4 leading-relaxed text-zinc-700">
          <p>
            השימוש באתר {brandName} ו/או ברכישה במסגרתו מהווה הסכמה לתנאים
            המפורטים בתקנון זה. אנא קראו את התקנון בעיון לפני ביצוע הזמנה.
          </p>
        </section>

        {/* Sections */}
        <section className="mt-10" aria-labelledby="general-heading">
          <h2 id="general-heading" className="text-xl font-bold">כללי</h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            {brandName} (&quot;העסק&quot;) מפעיל אתר זה לשם מכירת מוצרים ו/או שירותים
            ללקוחותיו. כל המחירים המוצגים באתר כוללים מע&quot;מ כדין, אלא אם צוין
            אחרת. העסק שומר לעצמו את הזכות לעדכן את התקנון מעת לעת, ללא הודעה
            מוקדמת.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-xl font-bold">אמצעי תשלום</h2>
          {methods.length > 0 ? (
            <>
              <p className="mt-3 leading-relaxed text-zinc-700">
                ניתן לשלם באתר באמצעות אמצעי התשלום הבאים:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pr-5 text-zinc-700">
                {methods.map((m) => (
                  <li key={m}>{paymentMethodLabel(m)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 leading-relaxed text-zinc-700">
              אמצעי התשלום המקובלים יימסרו בעת ההזמנה או בתיאום ישיר מול העסק.
            </p>
          )}
        </section>

        {hasProducts && (
          <section className="mt-10" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading" className="text-xl font-bold">משלוחים</h2>
            {shippingMethods.length > 0 ? (
              <ul className="mt-3 space-y-2 text-zinc-700">
                {shippingMethods.map((sm) => (
                  <li key={sm.id} className="rounded-xl border bg-white p-3">
                    <span className="font-semibold">{sm.name}</span>
                    {" — "}
                    {sm.price > 0 ? `₪${sm.price}` : "חינם"}
                    {sm.free_over != null && sm.price > 0 && (
                      <span className="text-zinc-500"> (משלוח חינם מעל ₪{sm.free_over})</span>
                    )}
                    {sm.eta && <span className="text-zinc-500"> · זמן אספקה: {sm.eta}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 leading-relaxed text-zinc-700">
                {site.business.shipping_fee != null
                  ? `עלות המשלוח היא ₪${site.business.shipping_fee}${
                      site.business.free_shipping_threshold != null
                        ? `, ומשלוח חינם בהזמנה מעל ₪${site.business.free_shipping_threshold}`
                        : ""
                    }.`
                  : "פרטי המשלוח יימסרו בעת ביצוע ההזמנה."}
              </p>
            )}
            <p className="mt-3 text-sm text-zinc-500">
              למידע נוסף ראו את עמוד{" "}
              <Link href={`/s/${slug}/help`} className="hover:underline" style={{ color: brand }}>
                עזרה ומשלוחים
              </Link>
              .
            </p>
          </section>
        )}

        <section className="mt-10" aria-labelledby="returns-heading">
          <h2 id="returns-heading" className="text-xl font-bold">ביטול עסקה והחזרות</h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            בהתאם לחוק הגנת הצרכן, התשמ&quot;א-1981, ניתן לבטל עסקה תוך 14 ימים
            ממועד קבלת המוצר או קבלת מסמך פרטי העסקה (לפי המאוחר מביניהם).
            ביטול עסקה ייעשה בהודעה בכתב לעסק, ובכפוף להשבת המוצר באריזתו
            המקורית ובמצב תקין. במקרה של ביטול שאינו עקב פגם, ייתכן חיוב בדמי
            ביטול כדין. זיכוי כספי יינתן באמצעי התשלום שבו בוצעה הרכישה, בכפוף
            להוראות החוק.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading" className="text-xl font-bold">פרטיות</h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            הפרטים שתמסרו באתר (כגון שם, טלפון, אימייל וכתובת) ישמשו את העסק
            לצורך טיפול בהזמנה, יצירת קשר ושיפור השירות בלבד, ולא יועברו לצד
            שלישי למעט ככל שנדרש לשם השלמת העסקה (כגון חברת משלוחים או סליקה).
          </p>
        </section>

        <section className="mt-10" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-xl font-bold">יצירת קשר</h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            לכל שאלה או בקשה בנוגע לתקנון זה, ניתן לפנות אלינו דרך{" "}
            <a href={`/s/${slug}#contact`} className="hover:underline" style={{ color: brand }}>
              טופס יצירת הקשר באתר
            </a>
            .
          </p>
        </section>

        <p className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-xs leading-relaxed text-zinc-500">
          תקנון זה הינו תבנית כללית שנוצרה אוטומטית ואינה מהווה ייעוץ משפטי.
          בעל/ת העסק אחראים לוודא שהתוכן מדויק, מעודכן ותואם את פעילות העסק
          בפועל, ומומלץ להיוועץ בעורך/ת דין בהתאם לצורך.
        </p>
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
        hasHelpPage={modeAllowsRoute(resolveSiteMode(site.business.site_mode), "help")}
        socialLinks={publicSocialLinks(site.website.social_links)}
      />
    </div>
  );
}
