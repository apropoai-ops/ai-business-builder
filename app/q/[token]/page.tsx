import type { Metadata } from "next";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  LinkIcon,
  MessageCircle,
  XCircle,
} from "lucide-react";

import { getPublicQuote } from "@/lib/services/quotes.service";
import { computeQuoteTotals, formatILS } from "@/lib/quote-totals";
import { buildWaMeUrl } from "@/lib/phone";
import { pickBrandColor } from "@/lib/storefront-brand";
import { QuoteActions } from "./quote-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "הצעת מחיר",
  robots: { index: false, follow: false },
};

/**
 * A quote is a DOCUMENT the business sends to its customer — so it is a fixed
 * light page, identical for every recipient, and it prints.
 *
 * ⚠️ Every colour here is explicit on purpose. The app is theme-aware
 * (next-themes puts `dark` on <html> when the visitor's OS prefers dark), and
 * this page hard-codes light backgrounds. Anything that fell back to the themed
 * default `--foreground` therefore rendered near-WHITE on white — the whole
 * quote was invisible to any recipient in dark mode. Never introduce an
 * unstyled text node or a themed shared component into this subtree.
 */

/**
 * Has the validity date passed? Kept out of the component body because
 * react-hooks/purity is an ERROR in this repo and forbids calling `Date.now()`
 * during render — even in a server component, where reading the clock per
 * request is exactly what we want.
 */
function isExpired(date: Date | null): boolean {
  return date !== null && date.getTime() < Date.now();
}

/** Readable ink for text sitting on the accent colour. */
function inkOn(hex: string): string {
  const full = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.55 ? "#18181b" : "#ffffff";
}

/**
 * Print rules. Inline <style> is permitted by the app CSP (style-src allows
 * 'unsafe-inline'). `print-color-adjust` keeps the brand band from being
 * stripped to white by the print engine.
 */
const PRINT_CSS = `
  .quote-doc { color-scheme: light; }
  @media print {
    @page { size: A4; margin: 12mm; }
    html, body { background: #fff !important; }
    .no-print { display: none !important; }
    .quote-doc { padding: 0 !important; }
    .quote-card {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      max-width: none !important;
    }
    .quote-band, .quote-total {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { page-break-inside: auto; }
    tr, .avoid-break { page-break-inside: avoid; }
  }
`;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      className="quote-doc flex min-h-screen items-start justify-center bg-zinc-100 px-4 py-8 text-zinc-900 sm:py-12"
    >
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="quote-card w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-900/5">
        {children}
      </div>
    </div>
  );
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = UUID_RE.test(token) ? await getPublicQuote(token) : null;

  if (!quote) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <LinkIcon className="size-10 text-zinc-400" />
          <p className="text-lg font-semibold text-zinc-900">הקישור אינו תקף</p>
          <p className="text-sm text-zinc-500">
            לא מצאנו הצעת מחיר שמתאימה לקישור הזה — ייתכן שהוא שגוי או ישן.
          </p>
        </div>
      </Shell>
    );
  }

  // pickBrandColor is the app-wide canonical extractor: it reads `.hex` from the
  // palette objects, skips near-white colours, validates the format and falls
  // back safely — so `accent` is always a usable #RRGGBB.
  const accent = pickBrandColor(quote.colorPalette);
  const onAccent = inkOn(accent);
  const waUrl = quote.whatsappPhone
    ? buildWaMeUrl(
        quote.whatsappPhone,
        `היי, יש לי שאלה לגבי הצעת המחיר "${quote.title}"`,
      )
    : null;
  const totals = computeQuoteTotals(quote.items, quote.discount, quote.taxRate);

  const validUntilDate = quote.validUntil ? new Date(quote.validUntil) : null;
  const validUntil = validUntilDate
    ? validUntilDate.toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const expired = isExpired(validUntilDate);

  // Short, human-quotable reference — customers say "הצעה 4F2A9C" on the phone.
  const reference = quote.id.replace(/-/g, "").slice(0, 6).toUpperCase();

  return (
    <Shell>
      {/* ── Brand band ── */}
      <header
        className="quote-band relative overflow-hidden px-7 py-7 sm:px-9"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}d9 100%)`,
          color: onAccent,
        }}
      >
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
              הצעת מחיר
            </p>
            <p className="mt-1 truncate text-2xl font-bold">{quote.businessName}</p>
          </div>
          {quote.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external brand asset
            <img
              src={quote.logoUrl}
              alt={quote.businessName}
              className="h-12 w-auto max-w-[180px] shrink-0 rounded-xl bg-white/90 object-contain px-2 py-1.5 shadow-sm"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <FileText className="size-7" />
            </div>
          )}
        </div>
      </header>

      {/* ── Meta strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-200 bg-zinc-50/80 px-7 py-4 sm:px-9">
        <div>
          <p className="text-[11px] font-medium text-zinc-500">לכבוד</p>
          <p className="text-sm font-semibold text-zinc-900">{quote.customerName}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-zinc-500">מספר הצעה</p>
          <p className="text-sm font-semibold tabular-nums text-zinc-900" dir="ltr">
            {reference}
          </p>
        </div>
        {validUntil && (
          <div>
            <p className="text-[11px] font-medium text-zinc-500">בתוקף עד</p>
            <p
              className={`text-sm font-semibold ${expired ? "text-rose-600" : "text-zinc-900"}`}
            >
              {validUntil}
              {expired && " · פג תוקף"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-7 px-7 py-8 sm:px-9">
        <h1 className="text-2xl font-bold leading-snug text-zinc-900 [text-wrap:balance]">
          {quote.title}
        </h1>

        {/* ── Items ── */}
        <div className="overflow-hidden rounded-xl ring-1 ring-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: `${accent}14` }}>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  תיאור
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  כמות
                </th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  מחיר ליח׳
                </th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  סה״כ
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it, i) => (
                <tr
                  key={i}
                  className={`border-t border-zinc-200 ${i % 2 === 1 ? "bg-zinc-50/60" : "bg-white"}`}
                >
                  <td className="px-4 py-3.5 font-medium text-zinc-900">
                    {it.description}
                  </td>
                  <td className="px-3 py-3.5 text-center tabular-nums text-zinc-700">
                    {it.quantity}
                  </td>
                  <td
                    className="px-3 py-3.5 text-end tabular-nums text-zinc-700"
                    dir="ltr"
                  >
                    {formatILS(it.unit_price)}
                  </td>
                  <td
                    className="px-4 py-3.5 text-end font-semibold tabular-nums text-zinc-900"
                    dir="ltr"
                  >
                    {formatILS(
                      (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals ── */}
        <div className="avoid-break ms-auto w-full sm:max-w-sm">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">סכום ביניים</dt>
              <dd className="tabular-nums text-zinc-800" dir="ltr">
                {formatILS(totals.subtotal)}
              </dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between font-medium text-rose-600">
                <dt>הנחה</dt>
                <dd className="tabular-nums" dir="ltr">
                  −{formatILS(totals.discount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-zinc-500">לפני מע״מ</dt>
              <dd className="tabular-nums text-zinc-800" dir="ltr">
                {formatILS(totals.netAmount)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">מתוכו מע״מ ({totals.taxRate}%)</dt>
              <dd className="tabular-nums text-zinc-800" dir="ltr">
                {formatILS(totals.taxAmount)}
              </dd>
            </div>
          </dl>

          <div
            className="quote-total mt-3 flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            <span className="text-sm font-semibold">סה״כ לתשלום</span>
            <span className="text-xl font-bold tabular-nums" dir="ltr">
              {formatILS(totals.total)}
            </span>
          </div>
          <p className="mt-1.5 text-end text-[11px] text-zinc-500">
            המחיר כולל מע״מ בשיעור {totals.taxRate}%
          </p>
        </div>

        {quote.notes && (
          <div className="avoid-break rounded-xl border border-zinc-200 bg-zinc-50/70 p-5">
            <p className="mb-1.5 text-sm font-semibold text-zinc-900">
              הערות ותנאים
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
              {quote.notes}
            </p>
          </div>
        )}

        {/* ── Decision ── */}
        {quote.status === "sent" && <QuoteActions token={token} accent={accent} />}

        {quote.status === "accepted" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-center font-semibold text-green-700">
              <CheckCircle2 className="size-5" /> ההצעה אושרה — תודה!
            </div>
            {quote.paymentLink && (
              <a
                href={quote.paymentLink}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="no-print flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-center font-bold shadow-sm"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                <CreditCard className="size-5" /> לתשלום מאובטח
              </a>
            )}
          </div>
        )}

        {quote.status === "declined" && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center font-semibold text-rose-700">
            <XCircle className="size-5" /> ההצעה נדחתה. תודה על העדכון.
          </div>
        )}

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="no-print flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
          >
            <MessageCircle className="size-4" /> שאלה? דברו איתנו בוואטסאפ
          </a>
        )}
      </div>

      <footer className="border-t border-zinc-200 px-7 py-4 text-center text-[11px] text-zinc-400 sm:px-9">
        הצעת מחיר מאת {quote.businessName} · מספר {reference}
      </footer>
    </Shell>
  );
}
