"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { respondToQuoteAction } from "@/lib/actions/quotes";

/**
 * Accept / decline buttons.
 *
 * These are plain styled buttons rather than the shared <Button> component on
 * purpose: <Button> paints itself from the app's theme variables, and this page
 * is a fixed light-on-white document. On a device in dark mode the themed
 * button rendered near-white text on a near-white background — invisible. Every
 * colour here is explicit for that reason. See the note in page.tsx.
 */
export function QuoteActions({ token, accent }: { token: string; accent: string }) {
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);
  const router = useRouter();

  function respond(decision: "accepted" | "declined") {
    if (decision === "declined" && !confirm("לדחות את הצעת המחיר?")) return;
    setChoice(decision);
    startTransition(async () => {
      const res = await respondToQuoteAction(token, decision);
      if (!res.ok) {
        toast.error(res.error ?? "אירעה שגיאה");
        setChoice(null);
        return;
      }
      toast.success(decision === "accepted" ? "ההצעה אושרה — תודה!" : "תודה על העדכון");
      router.refresh();
    });
  }

  return (
    <div className="no-print flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
      <p className="text-center text-sm font-medium text-zinc-700">
        רוצים להמשיך עם ההצעה?
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => respond("accepted")}
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-bold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: accent, boxShadow: `0 10px 24px -12px ${accent}` }}
        >
          {isPending && choice === "accepted" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          מאשר/ת את ההצעה
        </button>
        <button
          type="button"
          onClick={() => respond("declined")}
          disabled={isPending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-[15px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending && choice === "declined" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          לא מתאים לי
        </button>
      </div>
      <p className="text-center text-xs text-zinc-500">
        האישור מהווה הסכמה לתנאי ההצעה ואינו מחייב תשלום מיידי.
      </p>
    </div>
  );
}
