"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, CalendarCheck, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";

import { getPublicSlotsAction } from "@/lib/actions/booking";
import { rescheduleBookingByTokenAction } from "@/lib/actions/booking-self";

const TZ = "Asia/Jerusalem";

/** Next N Israel-calendar dates starting tomorrow, as YYYY-MM-DD + a short Hebrew label. */
function nextDays(count: number): { date: string; label: string }[] {
  const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const fmtLabel = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
  const out: { date: string; label: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    out.push({ date: fmtDate.format(d), label: fmtLabel.format(d) });
  }
  return out;
}

export function ReschedulePicker({
  token,
  slug,
  serviceId,
  staffId,
}: {
  token: string;
  slug: string;
  serviceId: string | null;
  /** The original booking's staff — so the customer reschedules with the same person. Pass null for staff-less businesses. */
  staffId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [days] = useState(() => nextDays(14));
  const [date, setDate] = useState<string | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({});
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ date: string; time: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function pickDay(d: string) {
    setDate(d);
    setTime(null);
    setError(null);
    if (slotsByDate[d] !== undefined) return; // cached
    setLoadingDate(d);
    try {
      const res = await getPublicSlotsAction(slug, d, serviceId, staffId ?? null);
      setSlotsByDate((prev) => ({ ...prev, [d]: res.slots ?? [] }));
    } finally {
      setLoadingDate(null);
    }
  }

  function confirm() {
    if (!date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await rescheduleBookingByTokenAction(token, date, time);
      if (res.ok) setDone({ date, time });
      else setError(res.error ?? "שינוי המועד נכשל — נסו שוב");
    });
  }

  if (done) {
    const label = days.find((d) => d.date === done.date)?.label ?? done.date;
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 p-4 text-center">
        <CheckCircle2 className="size-7 text-emerald-600" />
        <p className="font-semibold text-emerald-800">המועד עודכן בהצלחה</p>
        <p className="text-sm text-emerald-700">
          התור החדש: {label} בשעה {done.time}
        </p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-transparent bg-zinc-900 text-white"
        : "bg-white text-zinc-700 hover:border-zinc-400"
    }`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400"
      >
        <ArrowLeftRight className="size-4" />
        שינוי מועד
      </button>
    );
  }

  const slots = date ? slotsByDate[date] : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center justify-between text-sm font-semibold text-zinc-700"
      >
        שינוי מועד
        <ChevronDown className="size-4 rotate-180" />
      </button>

      <div>
        <div className="mb-2 text-xs font-medium text-zinc-500">בחרו יום חדש</div>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              className={chip(date === d.date)}
              onClick={() => pickDay(d.date)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {date && (
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">בחרו שעה</div>
          {loadingDate === date ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> טוען זמנים פנויים...
            </div>
          ) : slots && slots.length > 0 ? (
            <div className="flex flex-wrap gap-2" dir="ltr">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={chip(time === s)}
                  onClick={() => setTime(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">אין זמנים פנויים ביום זה — נסו יום אחר</p>
          )}
        </div>
      )}

      {time && (
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
          אישור המועד החדש
        </button>
      )}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
