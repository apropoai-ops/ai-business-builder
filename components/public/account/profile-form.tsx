"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { saveCustomerProfileAction } from "@/lib/actions/customer-account";
import { inkOn } from "@/lib/storefront-brand";

/** Edit the shopper's display name + phone (used to prefill checkout). */
export function ProfileForm({
  slug,
  brand,
  email,
  fullName,
  phone,
}: {
  slug: string;
  brand: string;
  email: string;
  fullName: string;
  phone: string;
}) {
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("full_name", name);
    fd.set("phone", tel);
    startTransition(async () => {
      const res = await saveCustomerProfileAction(slug, fd);
      if (res.ok) toast.success("הפרטים נשמרו");
      else toast.error(res.error ?? "השמירה נכשלה");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="font-bold">הפרטים שלי</h2>
      <div>
        <label className="mb-1 block text-sm font-medium">אימייל</label>
        <input
          value={email}
          dir="ltr"
          disabled
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">שם מלא</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
            placeholder="ישראל ישראלי"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">טלפון</label>
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            type="tel"
            dir="ltr"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
            placeholder="050-0000000"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        שמירה
      </button>
    </form>
  );
}
