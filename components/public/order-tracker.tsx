"use client";

/**
 * Public order-tracking section for /s/[slug].
 *
 * ORCHESTRATOR — mount inside app/s/[slug]/page.tsx with exactly:
 *
 *   <OrderTracker slug={slug} brand={brand} />
 *
 * A shopper enters their phone and sees the status of their own orders. The
 * server action only returns exact phone matches scoped to this site.
 */

import { useState, useTransition } from "react";
import { Loader2, Search, PackageSearch } from "lucide-react";

import { trackOrdersAction } from "@/lib/actions/order-tracking";
import type { TrackedOrder } from "@/lib/services/order-tracking.service";
import { inkOn } from "@/lib/storefront-brand";

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

export function OrderTracker({ slug, brand }: { slug: string; brand: string }) {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (phone.replace(/\D/g, "").length < 9) {
      setError("נא להזין מספר טלפון תקין");
      return;
    }
    startTransition(async () => {
      const res = await trackOrdersAction(slug, phone);
      if (!res.ok) {
        setOrders(null);
        setError(res.error ?? "אירעה שגיאה — נסו שוב");
      } else {
        setError(null);
        setOrders(res.orders ?? []);
      }
    });
  }

  return (
    // A card, matching <ReturnRequest> — the two sit side by side in a grid on
    // the storefront, and a full-bleed padded section next to a small card
    // stretched one of them to the other's height. Vertical spacing is owned by
    // the wrapper in app/s/[slug]/page.tsx.
    <section id="order-tracking" className="rounded-2xl border bg-white p-5 text-zinc-900 shadow-sm sm:p-8">
      <div className="mx-auto max-w-xl" data-reveal>
        <div className="mb-6 text-center">
          <PackageSearch className="mx-auto mb-3 size-9" style={{ color: brand }} />
          <h2 className="text-2xl font-bold md:text-3xl">מעקב הזמנות</h2>
          <p className="mt-3 text-zinc-600">
            הזינו את מספר הטלפון שאיתו ביצעתם את ההזמנה כדי לראות את סטטוס ההזמנות שלכם
          </p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm sm:flex-row"
        >
          <input
            className="w-full flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
            placeholder="מספר טלפון"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={isPending || phone.replace(/\D/g, "").length < 9}
            className="flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brand, color: inkOn(brand) }}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            בדוק
          </button>
        </form>

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

        {orders !== null && !error && (
          <div className="mt-6">
            {orders.length === 0 ? (
              <p className="rounded-2xl border bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                לא נמצאו הזמנות למספר הזה
              </p>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => {
                  const label = STATUS_LABEL[o.status] ?? o.status;
                  const style = STATUS_STYLE[o.status] ?? "bg-zinc-200 text-zinc-600";
                  return (
                    <div
                      key={o.id}
                      className="flex flex-col gap-2 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">
                          {o.quantity}× {o.product_name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formatDate(o.created_at)}
                          {o.shipping_method ? ` · 🚚 ${o.shipping_method}` : ""}
                        </div>
                        {o.tracking_number && (
                          <div className="mt-0.5 text-xs font-medium text-blue-700" dir="ltr">
                            📦 {o.tracking_number}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                        <span
                          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style}`}
                        >
                          {label}
                        </span>
                        {o.total != null && (
                          <span className="text-sm font-bold text-zinc-800">
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
        )}
      </div>
    </section>
  );
}
