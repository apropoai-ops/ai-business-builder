"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Heart, X, Trash2 } from "lucide-react";

import { useWishlist } from "@/components/public/wishlist-context";

export function WishlistDrawer({ brand }: { brand: string }) {
  const { items, remove, count } = useWishlist();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Header wishlist button (inline in the site header, like the cart trigger) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתיחת רשימת המועדפים"
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors hover:bg-black/5"
        style={{ color: brand }}
      >
        {/* Anchored to the icon, not the button — see the cart trigger. */}
        <span className="relative flex">
          <Heart className="size-5" />
          {count > 0 && (
            <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {count}
            </span>
          )}
        </span>
        <span className="hidden lg:inline">מועדפים</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          {/* Panel — pinned to the LEFT, full height. Explicit dark text because
              the portal renders outside the page's text-color context. */}
          <div className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col bg-white text-zinc-900 shadow-2xl" dir="rtl" style={{ color: "#18181b" }}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: "#18181b" }}>
                <Heart className="size-5" style={{ color: brand }} />
                רשימת המועדפים
              </h2>
              <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-zinc-500">
                <Heart className="size-10 text-zinc-300" />
                אין עדיין מועדפים
              </div>
            ) : (
              <>
                {/* Items */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {items.map((i) => (
                    <div key={i.productId} className="flex gap-3 rounded-xl border p-2.5">
                      {i.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.image} alt={i.name} className="size-16 shrink-0 rounded-lg bg-zinc-50 object-contain p-1" />
                      ) : (
                        <div className="size-16 shrink-0 rounded-lg bg-zinc-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{i.name}</div>
                          <button type="button" aria-label="הסרה" onClick={() => remove(i.productId)} className="text-zinc-400 hover:text-red-600">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {i.unitPrice != null && (
                          <div className="mt-1.5 text-sm font-bold" style={{ color: brand }}>
                            ₪{i.unitPrice.toLocaleString("he-IL")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="border-t p-4">
                  <p className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-500">
                    אפשר להוסיף את המוצרים לסל מתוך החנות 🛒
                  </p>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
