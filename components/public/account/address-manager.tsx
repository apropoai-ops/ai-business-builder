"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil, Trash2, MapPin, Star } from "lucide-react";
import { toast } from "sonner";

import { saveAddressAction, deleteAddressAction } from "@/lib/actions/customer-account";
import type { CustomerAddress } from "@/types/database";
import { inkOn } from "@/lib/storefront-brand";

/** Add / edit / delete saved shipping addresses. */
export function AddressManager({
  slug,
  brand,
  addresses,
}: {
  slug: string;
  brand: string;
  addresses: CustomerAddress[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function closeForm() {
    setEditing(null);
    setAdding(false);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveAddressAction(slug, editing?.id ?? null, fd);
      if (res.ok) {
        toast.success("הכתובת נשמרה");
        closeForm();
        router.refresh();
      } else {
        toast.error(res.error ?? "השמירה נכשלה");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("למחוק את הכתובת?")) return;
    startTransition(async () => {
      const res = await deleteAddressAction(slug, id);
      if (res.ok) {
        toast.success("הכתובת נמחקה");
        router.refresh();
      } else {
        toast.error(res.error ?? "המחיקה נכשלה");
      }
    });
  }

  const showForm = adding || editing !== null;

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
          <MapPin className="mx-auto mb-3 size-10 text-zinc-300" />
          <p className="text-zinc-500">אין כתובות שמורות עדיין</p>
        </div>
      )}

      {addresses.map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{a.label || a.recipient_name}</span>
              {a.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <Star className="size-3" /> ברירת מחדל
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-zinc-600">{a.recipient_name} · {a.phone}</div>
            <div className="text-sm text-zinc-600">
              {a.street}, {a.city}
              {a.zip ? `, ${a.zip}` : ""}
            </div>
            {a.notes && <div className="mt-1 text-xs text-zinc-400">{a.notes}</div>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => { setEditing(a); setAdding(false); }}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
              aria-label="עריכה"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => remove(a.id)}
              className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              aria-label="מחיקה"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-bold">{editing ? "עריכת כתובת" : "כתובת חדשה"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="label" label="כינוי (בית / עבודה)" defaultValue={editing?.label ?? ""} />
            <Field name="recipient_name" label="שם הנמען *" required defaultValue={editing?.recipient_name ?? ""} />
            <Field name="phone" label="טלפון *" type="tel" dir="ltr" required defaultValue={editing?.phone ?? ""} />
            <Field name="city" label="עיר *" required defaultValue={editing?.city ?? ""} />
            <Field name="street" label="רחוב ומספר *" required defaultValue={editing?.street ?? ""} className="sm:col-span-2" />
            <Field name="zip" label="מיקוד" defaultValue={editing?.zip ?? ""} />
          </div>
          <Field name="notes" label="הערות למשלוח" defaultValue={editing?.notes ?? ""} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_default" defaultChecked={editing?.is_default ?? false} className="size-4" />
            הגדר ככתובת ברירת המחדל
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
            <button type="button" onClick={closeForm} className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
              ביטול
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 py-4 text-sm font-medium text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700"
        >
          <Plus className="size-4" />
          הוספת כתובת
        </button>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  dir,
  className = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  dir?: "ltr" | "rtl";
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        name={name}
        type={type}
        dir={dir}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
      />
    </div>
  );
}
