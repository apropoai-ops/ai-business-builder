"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { computeQuoteTotals, formatILS } from "@/lib/quote-totals";
import type { Quote, QuoteItem } from "@/types/database";

export type QuoteBrand = {
  businessName: string;
  accent: string;
  logoUrl: string | null;
};

/**
 * Downloads a quote as a real .pdf FILE from the owner's dashboard.
 *
 * Why rasterise instead of drawing text into the PDF: the document is Hebrew,
 * right-to-left, and mixes RTL words with LTR currency on the same line. Every
 * JS PDF library needs a hand-embedded font plus manual bidi reordering to get
 * that right, and gets it subtly wrong. The browser has already shaped and laid
 * the text out perfectly, so we photograph its own output. The trade-off is
 * that the text isn't selectable inside the PDF — acceptable for a quote that
 * is looked at, not searched.
 *
 * Why `window.print()` was replaced: it opens a print DIALOG rather than
 * producing a file, and on mobile browsers it frequently does nothing at all —
 * which is exactly where an owner would try to send a quote from.
 *
 * The off-screen document below deliberately uses ONLY inline hex colours and
 * plain CSS. No Tailwind classes: Tailwind v4 emits `lab()` colours, which are
 * a well-known way to make DOM rasterisers fail.
 */
export function QuotePdfButton({
  quote,
  brand,
}: {
  quote: Quote;
  brand: QuoteBrand;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const items = (quote.items ?? []) as QuoteItem[];
  const totals = computeQuoteTotals(items, quote.discount, quote.tax_rate);
  const reference = quote.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : "#2563eb";
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function download() {
    const node = nodeRef.current;
    if (!node) return;
    setBusy(true);
    try {
      // Loaded on demand — together these are ~1MB that no other screen needs.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(node, {
        scale: 2, // retina-sharp text in the PDF
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true, // the logo lives on the Supabase CDN
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.95);

      // A long quote spills onto further pages instead of being squashed.
      let remaining = imgH;
      let offset = 0;
      pdf.addImage(img, "JPEG", 0, 0, imgW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        offset -= pageH;
        pdf.addPage();
        pdf.addImage(img, "JPEG", 0, offset, imgW, imgH);
        remaining -= pageH;
      }

      const safeTitle = (quote.title || "הצעת מחיר").replace(/[\\/:*?"<>|]/g, "-");
      pdf.save(`${safeTitle} — ${reference}.pdf`);
      toast.success("קובץ ה-PDF הורד ✓");
    } catch {
      toast.error("יצירת ה-PDF נכשלה — נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  const cell: React.CSSProperties = {
    padding: "10px 12px",
    borderTop: "1px solid #e4e4e7",
    fontSize: 13,
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={download} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        PDF
      </Button>

      {/* Off-screen render target. Positioned rather than `display:none` —
          a hidden element has no layout, so it would rasterise as blank. */}
      <div style={{ position: "fixed", insetInlineStart: -10000, top: 0, zIndex: -1 }} aria-hidden>
        <div
          ref={nodeRef}
          dir="rtl"
          style={{
            width: 794, // A4 at 96dpi
            background: "#ffffff",
            color: "#18181b",
            fontFamily: "Heebo, Arial, sans-serif",
          }}
        >
          <div
            style={{
              background: accent,
              color: "#ffffff",
              padding: "28px 36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.85 }}>הצעת מחיר</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>
                {brand.businessName}
              </div>
            </div>
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ height: 56, width: "auto", maxWidth: 180, objectFit: "contain", background: "#fff", borderRadius: 10, padding: 6 }}
              />
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 32,
              padding: "16px 36px",
              background: "#fafafa",
              borderBottom: "1px solid #e4e4e7",
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ color: "#71717a" }}>לכבוד</div>
              <div style={{ fontWeight: 600 }}>{quote.customer_name}</div>
            </div>
            <div>
              <div style={{ color: "#71717a" }}>מספר הצעה</div>
              <div style={{ fontWeight: 600 }} dir="ltr">{reference}</div>
            </div>
            {validUntil && (
              <div>
                <div style={{ color: "#71717a" }}>בתוקף עד</div>
                <div style={{ fontWeight: 600 }}>{validUntil}</div>
              </div>
            )}
          </div>

          <div style={{ padding: "28px 36px" }}>
            <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 20 }}>{quote.title}</div>

            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e4e4e7" }}>
              <thead>
                <tr style={{ background: "#f4f4f5" }}>
                  <th style={{ ...cell, textAlign: "right", fontSize: 11, color: "#52525b" }}>תיאור</th>
                  <th style={{ ...cell, textAlign: "center", fontSize: 11, color: "#52525b" }}>כמות</th>
                  <th style={{ ...cell, textAlign: "left", fontSize: 11, color: "#52525b" }}>מחיר ליח׳</th>
                  <th style={{ ...cell, textAlign: "left", fontSize: 11, color: "#52525b" }}>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ background: i % 2 ? "#fafafa" : "#ffffff" }}>
                    <td style={{ ...cell, fontWeight: 500 }}>{it.description}</td>
                    <td style={{ ...cell, textAlign: "center" }}>{it.quantity}</td>
                    <td style={{ ...cell, textAlign: "left" }} dir="ltr">
                      {formatILS(it.unit_price)}
                    </td>
                    <td style={{ ...cell, textAlign: "left", fontWeight: 600 }} dir="ltr">
                      {formatILS((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20, marginInlineStart: "auto", width: 300, fontSize: 13 }}>
              <Row label="סכום ביניים" value={formatILS(totals.subtotal)} />
              {totals.discount > 0 && (
                <Row label="הנחה" value={`−${formatILS(totals.discount)}`} color="#e11d48" />
              )}
              <Row label="לפני מע״מ" value={formatILS(totals.netAmount)} />
              <Row label={`מתוכו מע״מ (${totals.taxRate}%)`} value={formatILS(totals.taxAmount)} />
              <div
                style={{
                  marginTop: 10,
                  background: accent,
                  color: "#ffffff",
                  borderRadius: 10,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600 }}>סה״כ לתשלום</span>
                <span style={{ fontSize: 19, fontWeight: 700 }} dir="ltr">
                  {formatILS(totals.total)}
                </span>
              </div>
            </div>

            {quote.notes && (
              <div
                style={{
                  marginTop: 24,
                  border: "1px solid #e4e4e7",
                  background: "#fafafa",
                  borderRadius: 10,
                  padding: 16,
                  fontSize: 12.5,
                  color: "#52525b",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div style={{ fontWeight: 600, color: "#18181b", marginBottom: 6 }}>
                  הערות ותנאים
                </div>
                {quote.notes}
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid #e4e4e7",
              padding: "14px 36px",
              textAlign: "center",
              fontSize: 11,
              color: "#a1a1aa",
            }}
          >
            הצעת מחיר מאת {brand.businessName} · מספר {reference}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color }}>
      <span style={{ color: color ?? "#71717a" }}>{label}</span>
      <span dir="ltr">{value}</span>
    </div>
  );
}
