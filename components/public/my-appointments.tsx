"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarX,
  Clock,
  History,
  Loader2,
  Scissors,
} from "lucide-react";

import { cancelMyAppointmentAction } from "@/lib/actions/booking-self";
import type { MyAppointment } from "@/lib/services/booking-self.service";
import { inkOn } from "@/lib/storefront-brand";

const TZ = "Asia/Jerusalem";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const pastDateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-200 text-zinc-600",
};

function UpcomingCard({
  booking,
  slug,
  brand,
  onCancelled,
}: {
  booking: MyAppointment;
  slug: string;
  brand: string;
  onCancelled: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const when = new Date(booking.starts_at);
  const label = STATUS_LABEL[booking.status] ?? booking.status;
  const style = STATUS_STYLE[booking.status] ?? "bg-zinc-200 text-zinc-600";

  function doCancel() {
    setError(null);
    startTransition(async () => {
      const res = await cancelMyAppointmentAction(slug, booking.id);
      if (res.ok) onCancelled(booking.id);
      else setError(res.error ?? "הביטול נכשל — נסו שוב");
    });
  }

  return (
    <div
      className="rounded-2xl border border-s-4 bg-white p-5 shadow-sm"
      style={{ borderInlineStartColor: brand }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {booking.service && (
            <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Scissors className="size-3.5" style={{ color: brand }} />
              {booking.service}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-zinc-600">
            <Clock className="size-3.5 text-zinc-400" />
            {dateFmt.format(when)} בשעה {timeFmt.format(when)}
            {booking.duration_minutes ? ` · ${booking.duration_minutes} דק'` : ""}
          </div>
          {booking.staffName && (
            <div className="mt-0.5 text-xs text-zinc-500">אצל {booking.staffName}</div>
          )}
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
          {label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <Link
          href={`/cancel/${booking.cancel_token}`}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:border-zinc-400"
        >
          שינוי מועד
        </Link>

        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={doCancel}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarX className="size-3.5" />}
              אישור ביטול
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              חזרה
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50"
          >
            ביטול
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PastRow({ booking }: { booking: MyAppointment }) {
  const when = new Date(booking.starts_at);
  const label = booking.no_show ? "לא הגעת" : STATUS_LABEL[booking.status] ?? booking.status;
  const style = booking.no_show
    ? "bg-red-100 text-red-800"
    : STATUS_STYLE[booking.status] ?? "bg-zinc-200 text-zinc-600";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-3 last:border-0">
      <div>
        <div className="text-sm font-medium">
          {pastDateFmt.format(when)}
          {booking.service ? ` · ${booking.service}` : ""}
        </div>
        <div className="text-xs text-zinc-400">
          {timeFmt.format(when)}
          {booking.staffName ? ` · אצל ${booking.staffName}` : ""}
        </div>
      </div>
      <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
        {label}
      </span>
    </div>
  );
}

export function MyAppointments({
  slug,
  brand,
  upcoming: initialUpcoming,
  past,
}: {
  slug: string;
  brand: string;
  upcoming: MyAppointment[];
  past: MyAppointment[];
}) {
  const [upcoming, setUpcoming] = useState(initialUpcoming);

  function handleCancelled(id: string) {
    setUpcoming((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-5" style={{ color: brand }} />
          התורים הקרובים שלי
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <CalendarClock className="mx-auto mb-3 size-10 text-zinc-300" />
            <p className="mb-4 text-zinc-500">אין לך תורים קרובים</p>
            <Link
              href={`/s/${slug}#booking`}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: brand, color: inkOn(brand) }}
            >
              קביעת תור חדש
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <UpcomingCard key={b.id} booking={b} slug={slug} brand={brand} onCancelled={handleCancelled} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <History className="size-5" style={{ color: brand }} />
          היסטוריית ביקורים
        </h2>
        {past.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-zinc-500">עדיין אין היסטוריית ביקורים</p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            {past.map((b) => (
              <PastRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
