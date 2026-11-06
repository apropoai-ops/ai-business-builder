import { notFound } from "next/navigation";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { formatILS } from "@/lib/payments";
import { PrintButton } from "@/components/public/account/print-button";

export const metadata = { title: "אישור הזמנה" };

type Line = {
  product_name?: string;
  variant?: string | null;
  quantity?: number;
  unit_price?: number | null;
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // RLS: only the business owner OR the customer of the order can read this.
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("order_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) notFound();

  // The viewer proved access via RLS above; fetch merchant display info (name +
  // tax id) with the service role since the businesses table is owner-only RLS.
  const s = createServiceRoleClient();
  const [{ data: biz }, { data: brand }] = await Promise.all([
    s.from("businesses").select("name, business_tax_id, location").eq("id", invoice.business_id).maybeSingle(),
    s.from("brand_assets").select("brand_name, logo_url").eq("business_id", invoice.business_id).maybeSingle(),
  ]);

  const merchantName = brand?.brand_name ?? biz?.name ?? "העסק";
  const lines = (Array.isArray(invoice.lines) ? invoice.lines : []) as Line[];

  return (
    <div className="min-h-screen bg-zinc-100 py-8 text-zinc-900 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm print:rounded-none print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b pb-6">
            <div className="flex items-center gap-3">
              {brand?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo_url}
                  alt=""
                  className="h-12 w-auto max-w-[160px] shrink-0 rounded-lg object-contain"
                />
              )}
              <div>
                <div className="text-lg font-bold">{merchantName}</div>
                {biz?.business_tax_id && (
                  <div className="text-xs text-zinc-500">ע.מ/ח.פ: {biz.business_tax_id}</div>
                )}
                {biz?.location && <div className="text-xs text-zinc-500">{biz.location}</div>}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xl font-extrabold">אישור הזמנה</div>
              <div className="mt-1 text-sm text-zinc-600">מס׳ {invoice.invoice_number}</div>
              <div className="text-xs text-zinc-500">{fmtDate(invoice.issued_at)}</div>
            </div>
          </div>

          {/* Customer */}
          <div className="border-b py-4 text-sm">
            <span className="text-zinc-500">לכבוד: </span>
            <span className="font-medium">{invoice.customer_name}</span>
            {invoice.customer_tax_id && (
              <span className="text-zinc-500"> · ע.מ/ח.פ {invoice.customer_tax_id}</span>
            )}
          </div>

          {/* Lines */}
          {lines.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-end text-xs text-zinc-500">
                  <th className="py-2 text-start font-medium">פריט</th>
                  <th className="py-2 font-medium">כמות</th>
                  <th className="py-2 font-medium">מחיר</th>
                  <th className="py-2 font-medium">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b text-end">
                    <td className="py-2 text-start">
                      {l.product_name}
                      {l.variant ? ` (${l.variant})` : ""}
                    </td>
                    <td className="py-2">{l.quantity ?? 1}</td>
                    <td className="py-2">{l.unit_price != null ? formatILS(l.unit_price) : "—"}</td>
                    <td className="py-2">
                      {l.unit_price != null ? formatILS(l.unit_price * (l.quantity ?? 1)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="mt-6 ms-auto max-w-xs space-y-1.5 text-sm">
            <Row label="סכום לפני מע״מ" value={formatILS(invoice.subtotal)} />
            <Row label={`מע״מ (${invoice.vat_rate}%)`} value={formatILS(invoice.vat_amount)} />
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>סה״כ לתשלום</span>
              <span>{formatILS(invoice.total)}</span>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-zinc-400">תודה על הקנייה</p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-400">
            מסמך זה הוא אישור הזמנה לצורכי מידע בלבד ואינו מהווה חשבונית מס או
            קבלה. מסמך חשבונאי כדין יופק וישלח על ידי בית העסק בהתאם לסוג העוסק
            שלו.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
