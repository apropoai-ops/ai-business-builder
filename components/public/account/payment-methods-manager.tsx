"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, CreditCard, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  savePaymentMethodAction,
  deletePaymentMethodAction,
  setDefaultPaymentMethodAction,
} from "@/lib/actions/customer-account";
import type { CustomerPaymentMethod } from "@/types/database";
import { inkOn } from "@/lib/storefront-brand";

const BRANDS = ["Visa", "Mastercard", "American Express", "Isracard", "Diners"];

/**
 * Saved payment methods. In Wave A these store DISPLAY metadata only (brand +
 * last 4 + expiry) — never a full card number or CVV. Real, secure card
 * vaulting (Stripe SetupIntents) is wired in Wave B (real payments).
 */
export function PaymentMethodsManager({
  slug,
  brand,
  methods,
}: {
  slug: string;
  brand: string;
  methods: CustomerPaymentMethod[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await savePaymentMethodAction(slug, fd);
      if (res.ok) {
        toast.success("אמצעי התשלום נשמר");
        setAdding(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "השמירה נכשלה");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("למחוק את אמצעי התשלום?")) return;
    startTransition(async () => {
      const res = await deletePaymentMethodAction(slug, id);
      if (res.ok) {
        toast.success("נמחק");
        router.refresh();
      } else toast.error(res.error ?? "המחיקה נכשלה");
    });
  }

  function makeDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultPaymentMethodAction(slug, id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "הפעולה נכשלה");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-zinc-100 p-3 text-xs text-zinc-500">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        מטעמי אבטחה נשמרות כאן רק 4 הספרות האחרונות של הכרטיס לזיהוי מהיר. סליקה
        מאובטחת מלאה תתווסף עם הפעלת התשלומים בחנות.
      </div>

      {methods.length === 0 && !adding && (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <CreditCard className="mx-auto mb-3 size-10 text-zinc-300" />
          <p className="text-zinc-500">אין אמצעי תשלום שמורים</p>
        </div>
      )}

      {methods.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100">
              <CreditCard className="size-5" style={{ color: brand }} />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold">
                {m.brand || "כרטיס"} {m.last4 ? `•••• ${m.last4}` : ""}
                {m.is_default && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Star className="size-3" /> ברירת מחדל
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {m.label ? `${m.label} · ` : ""}
                {m.exp_month && m.exp_year ? `תוקף ${String(m.exp_month).padStart(2, "0")}/${String(m.exp_year).slice(-2)}` : "ללא תוקף"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!m.is_default && (
              <button
                onClick={() => makeDefault(m.id)}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              >
                קבע כברירת מחדל
              </button>
            )}
            <button
              onClick={() => remove(m.id)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              aria-label="מחיקה"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-bold">אמצעי תשלום חדש</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">סוג כרטיס</label>
              <select name="brand" className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2">
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">4 ספרות אחרונות</label>
              <input
                name="last4"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                dir="ltr"
                placeholder="1234"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">חודש תוקף</label>
              <input name="exp_month" type="number" min={1} max={12} dir="ltr" placeholder="12" className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">שנת תוקף</label>
              <input name="exp_year" type="number" min={2024} max={2100} dir="ltr" placeholder="2028" className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">כינוי (אופציונלי)</label>
              <input name="label" maxLength={40} placeholder="הכרטיס הפרטי" className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_default" className="size-4" />
            הגדר כברירת המחדל
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brand, color: inkOn(brand) }}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              שמירה
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
              ביטול
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 py-4 text-sm font-medium text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
        >
          <Plus className="size-4" />
          הוספת אמצעי תשלום
        </button>
      )}
    </div>
  );
}
