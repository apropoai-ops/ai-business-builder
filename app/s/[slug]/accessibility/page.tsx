import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import type { WebsiteData } from "@/lib/ai/schemas/website";

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
    title: `הצהרת נגישות — ${name}`,
    description: `הצהרת הנגישות של האתר ${name}: המחויבות שלנו לנגישות לפי תקן WCAG 2.1 ברמה AA.`,
    robots: { index: false },
  };
}

const IMPLEMENTED: { title: string; description: string }[] = [
  {
    title: "מבנה סמנטי תקין (HTML סמנטי)",
    description:
      "האתר בנוי עם תגיות HTML סמנטיות — כותרות מדורגות, אזורי ניווט ותוכן מוגדרים — כך שקוראי מסך יכולים להבין את מבנה הדף ולנווט בו ביעילות.",
  },
  {
    title: "ניווט מלא באמצעות מקלדת",
    description:
      "כל הקישורים, הכפתורים והטפסים באתר ניתנים להפעלה באמצעות מקלדת בלבד (Tab, Enter), ללא צורך בעכבר.",
  },
  {
    title: "ניגודיות צבעים",
    description:
      "צבעי הטקסט והרקע נבחרו כך שיעמדו ביחסי הניגודיות הנדרשים, לטובת אנשים עם לקות ראייה או עיוורון צבעים.",
  },
  {
    title: "טקסט חלופי לתמונות",
    description:
      "תמונות בעלות משמעות תוכנית מלוות בטקסט חלופי (alt), ותמונות דקורטיביות מסומנות כך שקוראי מסך מדלגים עליהן.",
  },
];

const LIMITATIONS: string[] = [
  "ייתכן שחלק מהתכנים — בפרט תמונות או קבצים שהועלו על ידי בית העסק — אינם נגישים במלואם.",
  "רכיבים של צדדים שלישיים (כגון מפות, נגנים או שירותים חיצוניים) עשויים שלא לעמוד באותה רמת נגישות.",
  "אנו פועלים באופן שוטף לאיתור ולתיקון פערי נגישות. אם נתקלתם בקושי כלשהו — נשמח שתעדכנו אותנו ונטפל בכך בהקדם.",
];

export default async function AccessibilityStatementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();

  const brandName = site.brand?.brand_name ?? site.business.name ?? "העסק";
  const brand = pickBrandColor(site.brand?.color_palette as Palette | null);
  const contact = site.website.page_contact as WebsiteData["contact"] | null;
  const phone = site.whatsappPhone;

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
        <h1 className="text-3xl font-extrabold sm:text-4xl">הצהרת נגישות</h1>
        <p className="mt-2 text-sm text-zinc-500">
          הצהרת הנגישות של האתר <strong className="font-semibold text-zinc-700">{brandName}</strong>
        </p>

        {/* Commitment */}
        <section className="mt-8 space-y-4 leading-relaxed text-zinc-700">
          <p>
            אנו ב{brandName} רואים חשיבות רבה במתן שירות שוויוני לכלל הגולשות והגולשים,
            ובכלל זה אנשים עם מוגבלות. אנו משקיעים מאמצים כדי שהאתר יהיה נגיש, נוח
            ופשוט לשימוש עבור כולם.
          </p>
          <p>
            אתר זה שואף לעמוד בדרישות תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות
            נגישות לשירות), התשע״ג-2013, ובהנחיות הנגישות הבינלאומיות{" "}
            <span dir="ltr" className="font-medium">WCAG 2.1</span> ברמה{" "}
            <span dir="ltr" className="font-medium">AA</span>.
          </p>
        </section>

        {/* What's implemented */}
        <section className="mt-10" aria-labelledby="implemented-heading">
          <h2 id="implemented-heading" className="text-xl font-bold">
            התאמות הנגישות באתר
          </h2>
          <ul className="mt-4 space-y-3">
            {IMPLEMENTED.map((item) => (
              <li key={item.title} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="font-semibold" style={{ color: brand }}>
                  {item.title}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Known limitations */}
        <section className="mt-10" aria-labelledby="limitations-heading">
          <h2 id="limitations-heading" className="text-xl font-bold">
            הסתייגויות ומגבלות ידועות
          </h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            למרות מאמצינו להנגיש את כלל דפי האתר, ייתכן שיתגלו חלקים שטרם הונגשו
            במלואם:
          </p>
          <ul className="mt-3 list-disc space-y-2 pr-5 text-zinc-700">
            {LIMITATIONS.map((item) => (
              <li key={item} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <section
          className="mt-10 rounded-2xl border p-6"
          style={{ background: `${brand}0d`, borderColor: `${brand}33` }}
          aria-labelledby="contact-heading"
        >
          <h2 id="contact-heading" className="text-xl font-bold">
            פנייה בנושא נגישות
          </h2>
          <p className="mt-3 leading-relaxed text-zinc-700">
            נתקלתם בבעיית נגישות באתר? נשמח לשמוע ולתקן. ניתן לפנות אלינו בכל אחת
            מהדרכים הבאות, ואנו נעשה כל מאמץ לחזור אליכם בהקדם:
          </p>
          <ul className="mt-4 space-y-2 text-zinc-800">
            {phone && (
              <li>
                <span className="font-semibold">טלפון: </span>
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="hover:underline" style={{ color: brand }}>
                  {phone}
                </a>
              </li>
            )}
            <li>
              <span className="font-semibold">טופס יצירת קשר באתר: </span>
              <Link href={`/s/${slug}#contact`} className="hover:underline" style={{ color: brand }}>
                {contact?.headline ?? "צרו קשר"}
              </Link>
            </li>
            {site.business.location && (
              <li>
                <span className="font-semibold">כתובת: </span>
                {site.business.location}
              </li>
            )}
          </ul>
          {contact?.responseTime && (
            <p className="mt-3 text-sm font-medium" style={{ color: brand }}>
              {contact.responseTime}
            </p>
          )}
        </section>

        <p className="mt-10 text-xs text-zinc-400">
          הצהרה זו מתעדכנת מעת לעת בהתאם לשיפורים ולשינויים באתר.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6 text-center text-xs text-zinc-400">
        <Link href={`/s/${slug}`} className="hover:underline">
          חזרה לאתר {brandName}
        </Link>
      </footer>
    </div>
  );
}
