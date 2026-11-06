"use client";

import { useState } from "react";
import { Users, Copy, Check } from "lucide-react";
import { inkOn } from "@/lib/storefront-brand";

/** Shows the shopper's referral code + shareable link, with copy buttons. */
export function ReferralCard({
  slug,
  brand,
  code,
  count,
  points,
}: {
  slug: string;
  brand: string;
  code: string;
  count: number;
  points: number;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${slug}?ref=${code}`
      : `/s/${slug}?ref=${code}`;

  function copy(what: "code" | "link", value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 font-bold">
        <Users className="size-5" style={{ color: brand }} />
        חבר מביא חבר
      </div>
      <p className="text-sm text-zinc-500">
        שתפו את הקוד — וקבלו {points} נקודות על כל חבר שמזמין לראשונה.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copy("code", code)}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2 text-lg font-bold tracking-widest"
          style={{ borderColor: brand, color: brand }}
        >
          {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {code}
        </button>
        <button
          type="button"
          onClick={() => copy("link", link)}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: brand, color: inkOn(brand) }}
        >
          {copied === "link" ? "הקישור הועתק ✓" : "העתקת קישור הזמנה"}
        </button>
      </div>

      <div className="mt-3 text-sm text-zinc-500">
        חברים שהצטרפו: <span className="font-bold text-zinc-800">{count}</span>
      </div>
    </div>
  );
}
