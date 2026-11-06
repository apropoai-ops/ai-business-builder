"use client";

/**
 * ORCHESTRATOR MOUNT NOTE:
 * Mount this section on the public site (app/s/[slug]/page.tsx — NOT edited here):
 *   <ReturnRequest slug={slug} brand={brandHex} />
 */

import { useState, useTransition } from "react";
import { Loader2, RefreshCcw, CheckCircle2 } from "lucide-react";

import { submitReturnAction } from "@/lib/actions/returns";
import { CHIP_HAIRLINE, inkOn } from "@/lib/storefront-brand";

export function ReturnRequest({ slug, brand }: { slug: string; brand: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [item, setItem] = useState("");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"return" | "exchange">("return");
  const [hp, setHp] = useState(""); // honeypot
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setItem("");
    setReason("");
    setKind("return");
    setError(null);
    setDone(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitReturnAction(slug, {
        name,
        phone,
        item: item || undefined,
        reason: reason || undefined,
        kind,
        company_website: hp,
      });
      if (!res.ok) setError(res.error ?? "השליחה נכשלה — נסו שוב");
      else setDone(true);
    });
  }

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCcw className="size-5" style={{ color: brand }} />
        <h3 className="text-base font-semibold text-zinc-800">החזרות והחלפות</h3>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center">
          <CheckCircle2 className="size-8" style={{ color: brand }} />
          <p className="text-sm font-semibold text-zinc-800">
            הבקשה התקבלה! ניצור איתך קשר בהקדם
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline"
          >
            שליחת בקשה נוספת
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="relative flex flex-col gap-2.5">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            aria-hidden="true"
            onChange={(e) => setHp(e.target.value)}
            style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
          />

          <p className="text-xs text-zinc-500">
            רוצים להחזיר או להחליף מוצר? מלאו את הפרטים ונחזור אליכם.
          </p>

          {/* Kind select */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-500">סוג בקשה:</span>
            <div className="flex gap-1.5">
              {(["return", "exchange"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                  style={
                    kind === k
                      ? { borderColor: brand, color: brand, backgroundColor: `${brand}10` }
                      : { borderColor: CHIP_HAIRLINE }
                  }
                >
                  {k === "return" ? "החזרה" : "החלפה"}
                </button>
              ))}
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
          <input
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="איזה מוצר?"
            maxLength={200}
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="סיבת הבקשה (אופציונלי)"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isPending || name.trim().length < 2 || phone.trim().replace(/\D/g, "").length < 9}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brand, color: inkOn(brand) }}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            שליחת בקשה
          </button>
        </form>
      )}
    </section>
  );
}
