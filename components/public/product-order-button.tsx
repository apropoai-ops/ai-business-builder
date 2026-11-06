"use client";

/**
 * ORCHESTRATOR MOUNT NOTE:
 * This button replaces/joins the existing per-product WhatsApp CTA inside
 * app/s/[slug]/page.tsx (NOT edited here — the orchestrator wires it).
 * Mount per product card:
 *   <ProductOrderButton slug={slug} productId={p.id} productName={p.name} brand={brandHex} />
 */

import { useState, useTransition } from "react";
import { Loader2, ShoppingBag, CheckCircle2, Minus, Plus, X, Check } from "lucide-react";
import { CHIP_HAIRLINE, inkOn } from "@/lib/storefront-brand";

import { submitOrderAction } from "@/lib/actions/orders";
import type { ProductColor } from "@/types/database";

export function ProductOrderButton({
  slug,
  productId,
  productName,
  brand,
  sizes,
  colors,
  inStock = true,
}: {
  slug: string;
  productId: string;
  productName: string;
  brand: string;
  sizes?: string[] | null;
  colors?: ProductColor[] | null;
  inStock?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasSizes = (sizes?.length ?? 0) > 0;
  const hasColors = (colors?.length ?? 0) > 0;

  function reset() {
    setQuantity(1);
    setSize(null);
    setColor(null);
    setName("");
    setPhone("");
    setNotes("");
    setError(null);
    setDone(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasSizes && !size) return setError("נא לבחור מידה");
    if (hasColors && !color) return setError("נא לבחור צבע");
    const variant = [size && `מידה: ${size}`, color && `צבע: ${color}`]
      .filter(Boolean)
      .join(" · ");
    startTransition(async () => {
      const res = await submitOrderAction(slug, {
        productId,
        quantity,
        name,
        phone,
        notes: notes || undefined,
        variant: variant || undefined,
        company_website: hp,
      });
      if (!res.ok) setError(res.error ?? "השליחה נכשלה — נסו שוב");
      else setDone(true);
    });
  }

  if (!inStock) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-400"
      >
        אזל מהמלאי
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        <ShoppingBag className="size-4" />
        הזמנה
      </button>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center">
        <CheckCircle2 className="size-8" style={{ color: brand }} />
        <p className="text-sm font-semibold text-zinc-800">
          ההזמנה התקבלה! ניצור קשר לאישור
        </p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
        >
          סגירה / הזמנה נוספת
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative flex flex-col gap-2.5 rounded-xl border bg-white p-4 shadow-sm"
    >
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        aria-hidden="true"
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800">
          הזמנת {productName}
        </span>
        <button
          type="button"
          aria-label="סגירה"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Size picker */}
      {hasSizes && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500">מידה:</span>
          <div className="flex flex-wrap gap-1.5">
            {sizes!.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className="min-w-9 rounded-lg border px-2.5 py-1 text-sm font-medium transition"
                style={
                  size === s
                    ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` }
                    : { borderColor: CHIP_HAIRLINE }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color picker */}
      {hasColors && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-500">צבע:</span>
          <div className="flex flex-wrap gap-1.5">
            {colors!.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.name)}
                title={c.name}
                className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition"
                style={
                  color === c.name
                    ? { borderColor: brand, backgroundColor: `${brand}10`, fontWeight: 600 }
                    : { borderColor: CHIP_HAIRLINE }
                }
              >
                <span className="inline-block size-3.5 rounded-full border" style={{ backgroundColor: c.hex }} />
                {c.name}
                {color === c.name && <Check className="size-3" style={{ color: brand }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity stepper */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">כמות:</span>
        <div className="flex items-center rounded-lg border border-zinc-200">
          <button
            type="button"
            aria-label="הפחתת כמות"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-8 text-center text-sm font-semibold text-zinc-800">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="הוספת כמות"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            disabled={quantity >= 99}
            className="px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <input
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        placeholder="שם מלא *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
      />
      <input
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        placeholder="טלפון *"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <textarea
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        placeholder="הערות (אופציונלי)"
        rows={2}
        maxLength={300}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || name.trim().length < 2 || phone.trim().replace(/\D/g, "").length < 9}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
        שליחת הזמנה
      </button>
    </form>
  );
}
