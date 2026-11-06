"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

import { useCart } from "@/components/public/cart-context";

/**
 * Shows a confirmation banner after the shopper returns from Stripe Checkout
 * (?checkout=success | cancel). On success it empties the cart and cleans the
 * URL so a refresh doesn't re-show the banner.
 */
export function CheckoutResult({ brand }: { brand: string }) {
  const { clear } = useCart();
  // Read the query param only after mount — reading it in the useState
  // initializer made the client's first (hydration) render differ from the
  // server HTML on every ?checkout= return from Stripe (hydration mismatch).
  const [status, setStatus] = useState<"success" | "cancel" | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("checkout");
    const next = p === "success" ? "success" : p === "cancel" ? "cancel" : null;
    if (!next) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only URL read; SSR has no access to the query string
    setStatus(next);
    if (next === "success") clear();
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, []);

  if (!status) return null;

  return (
    <div className="fixed inset-x-0 top-[68px] z-[120] flex justify-center p-3" dir="rtl">
      <div
        className="flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-2xl ring-1 ring-black/5"
        style={{ color: "#18181b" }}
      >
        {status === "success" ? (
          <>
            <CheckCircle2 className="size-6 shrink-0" style={{ color: brand }} />
            <div>
              <div className="font-bold">התשלום בוצע — ההזמנה התקבלה! 🎉</div>
              <div className="text-sm text-zinc-500">תודה על הרכישה. נשלח אליך אישור בקרוב.</div>
            </div>
          </>
        ) : (
          <>
            <XCircle className="size-6 shrink-0 text-zinc-400" />
            <div>
              <div className="font-bold">התשלום בוטל</div>
              <div className="text-sm text-zinc-500">הסל שלך נשמר — אפשר לנסות שוב בכל עת.</div>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setStatus(null)}
          aria-label="סגירה"
          className="ms-2 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
