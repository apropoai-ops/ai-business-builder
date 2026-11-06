"use client";

import { useEffect, useState } from "react";
import { X, Gift, Copy, Check } from "lucide-react";
import { brandInk, inkOn } from "@/lib/storefront-brand";

/**
 * Storefront marketing popup. Appears a few seconds after load (once per
 * browser, remembered in localStorage). Optionally shows a coupon code to copy.
 */
export function SitePopup({
  slug,
  brand,
  title,
  text,
  coupon,
}: {
  slug: string;
  brand: string;
  title: string;
  text: string | null;
  coupon: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = `mode-popup:${slug}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    const t = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(t);
  }, [key]);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  }

  function copy() {
    if (!coupon) return;
    navigator.clipboard?.writeText(coupon).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <button
          type="button"
          aria-label="סגירה"
          onClick={close}
          className="absolute end-3 top-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
        >
          <X className="size-5" />
        </button>
        <div
          className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: brand, color: inkOn(brand) }}
        >
          <Gift className="size-6" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
        {text && <p className="mt-2 text-sm text-zinc-600">{text}</p>}
        {coupon && (
          <button
            type="button"
            onClick={copy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-lg font-bold tracking-wider"
            style={{ borderColor: brand, color: brandInk(brand) }}
          >
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            {coupon}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: brand, color: inkOn(brand) }}
        >
          לקנייה
        </button>
      </div>
    </div>
  );
}
