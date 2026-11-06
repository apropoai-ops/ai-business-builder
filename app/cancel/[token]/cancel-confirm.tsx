"use client";

import { useState, useTransition } from "react";
import { CalendarX, CheckCircle2, Loader2 } from "lucide-react";

import { cancelBookingByTokenAction } from "@/lib/actions/cancel-booking";

export function CancelConfirm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 p-4 text-center">
        <CheckCircle2 className="size-7 text-emerald-600" />
        <p className="font-semibold text-emerald-800">התור בוטל בהצלחה</p>
        <p className="text-sm text-emerald-700">
          אם תרצו לקבוע תור חדש — אפשר לעשות זאת באתר העסק
        </p>
      </div>
    );
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingByTokenAction(token);
      if (res.ok) setDone(true);
      else setError(res.error ?? "הביטול נכשל — נסו שוב");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={confirm}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarX className="size-4" />
        )}
        כן, לבטל את התור
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
