"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight, ChevronLeft, CalendarRange, Check, X, Loader2, Plus, Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMonthBookingsAction, setBookingStatusAction } from "@/lib/actions/booking";
import { listBookingStaffAction } from "@/lib/actions/booking-staff";
import { getMonthBusinessEventsAction } from "@/lib/actions/business-events";
import { listTasksAction } from "@/lib/actions/projects";
import { EventDialog, type EventDialogState } from "@/components/business/event-dialog";
import type { WeeklyHours } from "@/lib/booking-shared";
import type { Booking, BookingStaff, BusinessEvent } from "@/types/database";
import type { TaskWithProject } from "@/lib/services/projects.service";

const NEUTRAL_STAFF_COLOR = "#a1a1aa"; // zinc-400 — unassigned bookings

const TZ = "Asia/Jerusalem";
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const monthFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, month: "long", year: "numeric" });

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const pad = (n: number) => String(n).padStart(2, "0");

export function BookingMonthCalendar({
  businessId,
  hours,
  initialBookings,
  initialYear,
  initialMonth,
  todayStr,
}: {
  businessId: string;
  hours: WeeklyHours | null;
  initialBookings: Booking[];
  initialYear: number;
  initialMonth: number; // 1-12
  todayStr: string;
}) {
  const [view, setView] = useState({ year: initialYear, month: initialMonth });
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null);

  // Staff list — fetched once on mount, client-fetch-then-set (mirrors
  // MarketResearchWatcher: async call kicked off in the effect, state lands
  // in its own .then(), not synchronously in the effect body).
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string>("all");

  useEffect(() => {
    let active = true;
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setStaff(res.staff ?? []);
    });
     
    listTasksAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setTasks(res.tasks ?? []);
    });
     
    getMonthBusinessEventsAction(businessId, initialYear, initialMonth).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setEvents(res.events ?? []);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const staffById = new Map(staff.map((s) => [s.id, s]));

  async function fetchMonth(year: number, month: number) {
    setLoading(true);
    const [bookingsRes, eventsRes] = await Promise.all([
      getMonthBookingsAction(businessId, year, month),
      getMonthBusinessEventsAction(businessId, year, month),
    ]);
    if (bookingsRes.error) toast.error(bookingsRes.error);
    else setBookings(bookingsRes.bookings ?? []);
    if (eventsRes.error) toast.error(eventsRes.error);
    else setEvents(eventsRes.events ?? []);
    setLoading(false);
  }

  function reloadEvents() {
    getMonthBusinessEventsAction(businessId, view.year, view.month).then((res) => {
      if (res.error) toast.error(res.error);
      else setEvents(res.events ?? []);
    });
  }

  function move(delta: number) {
    const idx = view.year * 12 + (view.month - 1) + delta;
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    setView({ year, month });
    void fetchMonth(year, month);
  }
  function goToday() {
    const [y, m] = todayStr.split("-").map(Number);
    setView({ year: y, month: m });
    void fetchMonth(y, m);
  }

  function setStatus(id: string, status: "confirmed" | "cancelled") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setBookingStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      else await fetchMonth(view.year, view.month);
      setBusyId(null);
    });
  }

  // Group non-cancelled bookings by IL date (filtered by the active staff chip).
  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    if (activeStaffId !== "all" && b.staff_id !== activeStaffId) continue;
    const key = dateFmt.format(new Date(b.starts_at));
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(b);
  }

  const eventsByDate = new Map<string, BusinessEvent[]>();
  for (const ev of events) {
    if (activeStaffId !== "all" && ev.staff_id !== activeStaffId) continue;
    const key = dateFmt.format(new Date(ev.starts_at));
    (eventsByDate.get(key) ?? eventsByDate.set(key, []).get(key)!).push(ev);
  }

  const tasksByDate = new Map<string, TaskWithProject[]>();
  for (const t of tasks) {
    if (!t.due_date || t.status === "done") continue;
    if (activeStaffId !== "all" && t.staff_id !== activeStaffId) continue;
    (tasksByDate.get(t.due_date) ?? tasksByDate.set(t.due_date, []).get(t.due_date)!).push(t);
  }

  // Build the month grid (Sunday-first, IL).
  const firstWeekday = new Date(Date.UTC(view.year, view.month - 1, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate();
  const cells: ({ day: number; dateStr: string; weekday: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      dateStr: `${view.year}-${pad(view.month)}-${pad(d)}`,
      weekday: (firstWeekday + d - 1) % 7,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = monthFmt.format(new Date(Date.UTC(view.year, view.month - 1, 15, 12)));

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-primary" />
            {monthLabel}
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => move(-1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
              היום
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => move(1)}>
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        {staff.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveStaffId("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeStaffId === "all" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              כולם
            </button>
            {staff.filter((s) => s.active).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStaffId(s.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeStaffId === s.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                <span className="inline-block size-2 rounded-full" style={{ background: s.color || NEUTRAL_STAFF_COLOR }} />
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-xs font-semibold text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`e${i}`} />;
                const closed = hours ? !hours[String(cell.weekday)] : false;
                const isToday = cell.dateStr === todayStr;
                const dayBookings = byDate.get(cell.dateStr) ?? [];
                const dayEvents = eventsByDate.get(cell.dateStr) ?? [];
                const dayTasks = tasksByDate.get(cell.dateStr) ?? [];
                const dayStaffColors = [...new Set(
                  dayBookings
                    .filter((b) => b.status !== "blocked")
                    .map((b) => (b.staff_id ? staffById.get(b.staff_id)?.color || NEUTRAL_STAFF_COLOR : null))
                    .filter((c): c is string => !!c),
                )];
                return (
                  <div
                    key={cell.dateStr}
                    className={`group flex min-h-24 flex-col rounded-lg border p-1 ${
                      closed ? "bg-muted/40 opacity-60" : "bg-background"
                    } ${isToday ? "border-primary ring-1 ring-primary/30" : ""}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span />
                      <div className={`flex items-center gap-1 text-center text-[11px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {cell.day}
                        {dayStaffColors.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            {dayStaffColors.slice(0, 4).map((c) => (
                              <span key={c} className="inline-block size-1.5 rounded-full" style={{ background: c }} />
                            ))}
                          </span>
                        )}
                      </div>
                      <button
                        title="אירוע חדש"
                        onClick={() => setEventDialog({ editing: null, date: cell.dateStr, startTime: "09:00" })}
                        className="rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-primary focus:opacity-100 group-hover:opacity-100"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {dayBookings.map((b) =>
                        b.status === "blocked" ? (
                          <div key={b.id} className="rounded border border-zinc-300 bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800" dir="ltr">
                            {timeFmt.format(new Date(b.starts_at))} · חסום
                          </div>
                        ) : (
                          <div
                            key={b.id}
                            style={b.staff_id ? { borderRight: `3px solid ${staffById.get(b.staff_id)?.color || NEUTRAL_STAFF_COLOR}` } : undefined}
                            className={`rounded border px-1 py-0.5 text-[10px] leading-tight ${
                              b.no_show
                                ? "border-zinc-300 bg-zinc-100 opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                                : b.status === "confirmed"
                                  ? "border-green-300 bg-green-50 dark:bg-green-950/30"
                                  : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-bold tabular-nums ${b.no_show ? "line-through" : ""}`} dir="ltr">
                                {timeFmt.format(new Date(b.starts_at))}
                              </span>
                              <span className="flex items-center gap-0.5">
                                {b.recurrence && <span title="סדרה">🔁</span>}
                                {b.status === "pending" && (
                                  <button title="אשר" disabled={busyId === b.id} onClick={() => setStatus(b.id, "confirmed")}
                                    className="rounded bg-green-600 p-0.5 text-white hover:bg-green-700">
                                    <Check className="size-2.5" />
                                  </button>
                                )}
                                <button title="בטל" disabled={busyId === b.id} onClick={() => setStatus(b.id, "cancelled")}
                                  className="rounded bg-zinc-200 p-0.5 text-zinc-600 hover:bg-red-100 hover:text-red-600 dark:bg-zinc-700 dark:text-zinc-300">
                                  <X className="size-2.5" />
                                </button>
                              </span>
                            </div>
                            <div className={`truncate font-medium ${b.no_show ? "line-through" : ""}`}>
                              {b.customer_name}
                            </div>
                            {b.service && (
                              <div className="truncate text-muted-foreground">
                                {b.service}{b.duration_minutes ? ` · ${b.duration_minutes}'` : ""}
                              </div>
                            )}
                          </div>
                        ),
                      )}

                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setEventDialog({ editing: ev })}
                          style={ev.staff_id ? { borderRight: `3px solid ${staffById.get(ev.staff_id)?.color || NEUTRAL_STAFF_COLOR}` } : undefined}
                          className="w-full rounded border border-indigo-300 bg-indigo-50 px-1 py-0.5 text-start text-[10px] leading-tight dark:border-indigo-700 dark:bg-indigo-950/40"
                        >
                          <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300" dir="ltr">
                            {timeFmt.format(new Date(ev.starts_at))}
                          </span>{" "}
                          <span className="truncate font-medium text-indigo-900 dark:text-indigo-200">{ev.title}</span>
                        </button>
                      ))}

                      {dayTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-1 truncate rounded border border-amber-200 bg-amber-50/70 px-1 py-0.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                          title={t.title}
                        >
                          <Flag className="size-2.5 shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="px-1 text-[9px] text-muted-foreground">+{dayTasks.length - 3} משימות נוספות</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm border border-amber-300 bg-amber-50" /> ממתין לאישור
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm border border-green-300 bg-green-50" /> מאושר
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm border border-indigo-300 bg-indigo-50" /> אירוע פנימי
          </span>
          <span className="flex items-center gap-1">
            <Flag className="size-3 text-amber-600" /> משימה עם תאריך יעד
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm border border-zinc-300 bg-zinc-100" /> חסום / לא הגיע
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-muted" /> יום סגור (לפי ההגדרות שלך)
          </span>
        </div>
      </CardContent>

      <EventDialog
        businessId={businessId}
        staff={staff}
        state={eventDialog}
        onClose={() => setEventDialog(null)}
        onSaved={() => { setEventDialog(null); reloadEvents(); }}
      />
    </Card>
  );
}
