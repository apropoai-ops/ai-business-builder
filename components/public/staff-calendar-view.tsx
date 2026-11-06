import { CalendarDays, Clock } from "lucide-react";

import type { StaffCalendarDay } from "@/lib/services/staff-calendar.service";

const TZ = "Asia/Jerusalem";
const DAYS_SHOWN = 14;
const DAY_MS = 86_400_000;

const todayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const dayHeaderFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

const STATUS_STYLE: Record<string, string> = {
  "מאושר": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "ממתין לאישור": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "אירוע פנימי": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
};

/** First-name-only display for a walk-in-friendly, slightly more private agenda. */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** Builds the next DAYS_SHOWN date keys (YYYY-MM-DD, Asia/Jerusalem), starting today. */
function buildDateRange(): string[] {
  const todayStr = todayFmt.format(new Date());
  const anchor = new Date(`${todayStr}T12:00:00Z`);
  return Array.from({ length: DAYS_SHOWN }, (_, i) =>
    new Date(anchor.getTime() + i * DAY_MS).toISOString().slice(0, 10));
}

export function StaffCalendarView({
  businessName,
  staffName,
  days,
}: {
  businessName: string;
  staffName?: string;
  days: StaffCalendarDay[];
}) {
  const dayMap = new Map(days.map((d) => [d.date, d.items]));
  const dateRange = buildDateRange();
  const todayStr = dateRange[0];

  return (
    <div dir="rtl" className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-zinc-50 px-4 py-6 dark:bg-zinc-950">
      <header className="rounded-2xl border bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <CalendarDays className="size-3.5" />
          {businessName}
        </div>
        <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {staffName ? `היומן של ${staffName}` : "היומן המלא"}
        </h1>
        <p className="mt-1 text-[11px] text-zinc-400">
          קישור אישי לצפייה בלבד · {DAYS_SHOWN} הימים הקרובים
        </p>
      </header>

      <div className="flex flex-col gap-3 pb-8">
        {dateRange.map((date) => {
          const items = dayMap.get(date) ?? [];
          const isToday = date === todayStr;
          const label = dayHeaderFmt.format(new Date(`${date}T12:00:00Z`));
          return (
            <section
              key={date}
              className={`rounded-2xl border p-4 shadow-sm ${
                isToday
                  ? "border-primary/40 bg-primary/5"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {label}
                  {isToday && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                      היום
                    </span>
                  )}
                </h2>
                {items.length > 0 && (
                  <span className="shrink-0 text-xs text-zinc-400">{items.length} תורים</span>
                )}
              </div>

              {items.length === 0 ? (
                <p className="py-2 text-center text-xs text-zinc-400">אין תורים ביום זה</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100" dir="ltr">
                          <Clock className="size-3 text-zinc-400" />
                          {it.start}–{it.end}
                        </div>
                        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {it.title}
                          {it.customer ? ` · ${firstName(it.customer)}` : ""}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          STATUS_STYLE[it.status] ?? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {it.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
