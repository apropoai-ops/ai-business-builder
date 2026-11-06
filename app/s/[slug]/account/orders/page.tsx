import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageOpen, FileText } from "lucide-react";

import { paymentMethodLabel } from "@/lib/payments";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { requireCustomerUser } from "@/lib/auth/customer";
import { getCustomerOrders } from "@/lib/services/customer-account.service";
import { AccountNav } from "@/components/public/account/account-nav";

export const metadata = { title: "ההזמנות שלי" };

const STATUS_LABEL: Record<string, string> = {
  new: "התקבלה",
  confirmed: "אושרה",
  done: "הושלמה",
  cancelled: "בוטלה",
};
const STATUS_STYLE: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-200 text-zinc-600",
};

const PAY_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  refunded: "זוכה",
  partially_refunded: "זוכה חלקית",
  failed: "תשלום נכשל",
};
const PAY_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  refunded: "bg-zinc-200 text-zinc-600",
  partially_refunded: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-800",
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AccountOrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();
  const { brand } = storeBranding(site);

  const user = await requireCustomerUser(slug, `/s/${slug}/account/orders`);
  const orders = await getCustomerOrders(slug, user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ההזמנות שלי</h1>
      <AccountNav slug={slug} brand={brand} />

      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <PackageOpen className="mx-auto mb-3 size-10 text-zinc-300" />
          <p className="text-zinc-500">עדיין אין לך הזמנות</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const label = STATUS_LABEL[o.status] ?? o.status;
            const style = STATUS_STYLE[o.status] ?? "bg-zinc-200 text-zinc-600";
            return (
              <div key={o.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-zinc-400">
                      הזמנה #{o.id.slice(0, 8)} · {formatDate(o.created_at)}
                    </div>
                    <div className="mt-1 font-semibold">{o.product_name}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
                      {label}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${PAY_STYLE[o.payment_status] ?? "bg-zinc-100 text-zinc-600"}`}>
                      {PAY_LABEL[o.payment_status] ?? o.payment_status}
                    </span>
                  </div>
                </div>

                {o.items.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-zinc-600">
                    {o.items.map((it) => (
                      <li key={it.id} className="flex justify-between gap-3">
                        <span>
                          {it.quantity}× {it.product_name}
                          {it.variant ? ` (${it.variant})` : ""}
                        </span>
                        {it.unit_price != null && (
                          <span className="text-zinc-400">
                            ₪{(Number(it.unit_price) * it.quantity).toLocaleString("he-IL")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    {o.customer_address && <span>משלוח אל: {o.customer_address}</span>}
                    {o.shipping_method && (
                      <span>🚚 {o.shipping_method}{o.shipping_details ? ` · ${o.shipping_details}` : ""}</span>
                    )}
                    {o.tracking_number && (
                      <span className="font-medium text-blue-700" dir="ltr">📦 {o.tracking_number}</span>
                    )}
                    {o.payment_method && <span>אמצעי תשלום: {paymentMethodLabel(o.payment_method)}</span>}
                    {o.invoiceId && (
                      <Link
                        href={`/invoice/${o.invoiceId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        style={{ color: brand }}
                      >
                        <FileText className="size-3.5" />
                        אישור הזמנה
                      </Link>
                    )}
                  </div>
                  {o.total != null && (
                    <span className="text-base font-bold" style={{ color: brand }}>
                      ₪{Number(o.total).toLocaleString("he-IL")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
