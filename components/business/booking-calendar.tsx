"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronRight, ChevronLeft, Check, X, CalendarDays, Ban, Loader2, Phone, Users, CalendarPlus2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  setBookingStatusAction,
  blockSlotsAction,
  unblockSlotAction,
  createOwnerBookingAction,
} from "@/lib/actions/booking";
import { listBookingStaffAction } from "@/lib/actions/booking-staff";
import {
  listBusinessEventsAction,
  rescheduleBookingAction,
} from "@/lib/actions/business-events";
import { EventDialog, type EventDialogState } from "@/components/business/event-dialog";
import { DEFAULT_HOURS, type WeeklyHours } from "@/lib/booking-shared";
import type { Booking, BookingService, BookingStaff, BusinessEvent } from "@/types/database";

const TZ = "Asia/Jerusalem";
const DAY_MS = 86_400_000;
const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;
const NEUTRAL_STAFF_COLOR = "#a1a1aa"; // zinc-400 — unassigned bookings / blocks

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const headFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "short" });
const dayNumFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "numeric" });
const fullDayFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric" });

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type WeekDay = { dateStr: string; dayName: string; dayNum: string; weekday: string };

/** A grid column — either a plain day (normal view) or a day×staff pair (staff-columns view). */
type GridColumn = {
  key: string;
  dateStr: string;
  staffId: string | null;
  dayName: string;
  dayNum: string;
  weekday: string;
  subLabel: string | null;
  subColor: string | null;
};

type CalItem =
  | { id: string; kind: "booking"; start: number; end: number; booking: Booking }
  | { id: string; kind: "event"; start: number; end: number; event: BusinessEvent };

type LaidOutItem = CalItem & { top: number; height: number; col: number; cols: number };

/** Packs same-day items (bookings + events) into non-overlapping side-by-side columns. */
function packDayItems(items: CalItem[], railStartMin: number): LaidOutItem[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);

  const col: number[] = new Array(sorted.length).fill(0);
  const cluster: number[] = new Array(sorted.length).fill(0);
  let colEnds: number[] = [];
  let clusterMaxEnd = -Infinity;
  let clusterId = -1;

  sorted.forEach((it, i) => {
    if (it.start >= clusterMaxEnd) {
      clusterId += 1;
      colEnds = [];
      clusterMaxEnd = -Infinity;
    }
    let c = colEnds.findIndex((end) => end <= it.start);
    if (c === -1) {
      c = colEnds.length;
      colEnds.push(it.end);
    } else {
      colEnds[c] = it.end;
    }
    col[i] = c;
    cluster[i] = clusterId;
    clusterMaxEnd = Math.max(clusterMaxEnd, it.end);
  });

  const clusterCols = new Map<number, number>();
  sorted.forEach((_, i) => {
    clusterCols.set(cluster[i], Math.max(clusterCols.get(cluster[i]) ?? 0, col[i] + 1));
  });

  return sorted.map((it, i) => ({
    ...it,
    top: (it.start - railStartMin) * PX_PER_MIN,
    height: Math.max(20, (it.end - it.start) * PX_PER_MIN),
    col: col[i],
    cols: clusterCols.get(cluster[i]) ?? 1,
  }));
}

/** Hebrew status word used in the cards' accessible names. */
function statusWord(b: Booking): string {
  if (b.no_show) return "לא הגיע";
  if (b.status === "confirmed") return "מאושר";
  if (b.status === "pending") return "ממתין לאישור";
  return b.status;
}

/** Accessible name for a booking card — customer, time and status, per the audit. */
function bookingCardLabel(b: Booking): string {
  const time = timeFmt.format(new Date(b.starts_at));
  const parts = [b.customer_name, `שעה ${time}`, statusWord(b)];
  if (b.service) parts.push(b.service);
  if (b.recurrence) parts.push("תור בסדרה חוזרת");
  return `${parts.join(", ")} — פתיחת פרטי התור`;
}

function bookingToItem(b: Booking): CalItem {
  const start = toMinutes(hmFmt.format(new Date(b.starts_at)));
  const dur = b.duration_minutes ?? 60;
  return { id: `b:${b.id}`, kind: "booking", start, end: start + dur, booking: b };
}

function eventToItem(e: BusinessEvent): CalItem {
  const start = toMinutes(hmFmt.format(new Date(e.starts_at)));
  const end = toMinutes(hmFmt.format(new Date(e.ends_at)));
  return { id: `e:${e.id}`, kind: "event", start, end: Math.max(end, start + 15), event: e };
}

export function BookingCalendar({
  businessId,
  bookings,
  hours,
  services,
}: {
  businessId: string;
  bookings: Booking[];
  hours: WeeklyHours | null;
  services: BookingService[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Staff list — fetched once on mount (client-fetch-then-set, mirroring
  // MarketResearchWatcher's pattern: async call kicked off from the effect,
  // state updates land in its own .then(), not synchronously in the effect body).
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string>("all");
  // Whether the per-staff columns view is on. Until the owner explicitly
  // toggles it (staffColumnsTouched), the effective value is DERIVED below:
  // it defaults on once there's >1 active staff (a barbershop opens straight
  // into per-barber columns) — computed during render, no setState-in-effect.
  const [staffColumnsPref, setStaffColumnsPref] = useState(false);
  const [staffColumnsTouched, setStaffColumnsTouched] = useState(false);

  // Internal calendar events — same client-fetch-then-set pattern.
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  function reloadEvents() {
    listBusinessEventsAction(businessId).then((res) => {
      if (res.error) toast.error(res.error);
      else setEvents(res.events ?? []);
    });
  }

  useEffect(() => {
    let active = true;
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setStaff(res.staff ?? []);
    });
     
    listBusinessEventsAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setEvents(res.events ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  // Current-time indicator — ticks once a minute via setInterval, so the
  // setState call happens inside the timer callback, not the effect body.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Block-slots dialog state
  const [blockDay, setBlockDay] = useState<{ dateStr: string; weekday: string } | null>(null);
  const [blockFrom, setBlockFrom] = useState("09:00");
  const [blockTo, setBlockTo] = useState("17:00");
  const [blockReason, setBlockReason] = useState("");
  const [blockStaffId, setBlockStaffId] = useState("none");
  const [blocking, setBlocking] = useState(false);

  // Create-booking dialog state
  const [createSlot, setCreateSlot] = useState<{ dateStr: string; label: string } | null>(null);
  const [createTime, setCreateTime] = useState("09:00");
  const [createServiceId, setCreateServiceId] = useState("none");
  const [createStaffId, setCreateStaffId] = useState("none");
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [creating, setCreating] = useState(false);

  // Booking-detail dialog state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  // Reschedule-from-the-dialog state — the keyboard route to what drag-and-drop
  // does with the mouse. Drag stays as a pointer enhancement on top of this.
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Internal-event dialog state (shared component — create/edit/delete)
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null);

  // Today (Israel) captured once on mount — render-pure.
  const [todayStr] = useState(() => dateFmt.format(new Date()));

  // 7 anchor dates (noon-UTC of each IL calendar day) for the viewed week.
  const week: WeekDay[] = useMemo(() => {
    const anchor = new Date(`${todayStr}T12:00:00Z`);
    const weekStart = new Date(
      anchor.getTime() - anchor.getUTCDay() * DAY_MS + weekOffset * 7 * DAY_MS,
    );
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getTime() + i * DAY_MS);
      return {
        dateStr: d.toISOString().slice(0, 10),
        dayName: headFmt.format(d),
        dayNum: dayNumFmt.format(d),
        weekday: String(d.getUTCDay()),
      };
    });
  }, [todayStr, weekOffset]);

  const byDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = dateFmt.format(new Date(b.starts_at));
      (map.get(key) ?? map.set(key, []).get(key)!).push(b);
    }
    return map;
  }, [bookings]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, BusinessEvent[]>();
    for (const e of events) {
      const key = dateFmt.format(new Date(e.starts_at));
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return map;
  }, [events]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const activeStaffList = useMemo(() => staff.filter((s) => s.active), [staff]);

  // Effective columns view: the owner's explicit choice once they've toggled,
  // otherwise the >1-active-staff default. Pure derivation — no effect.
  const staffColumnsView = staffColumnsTouched
    ? staffColumnsPref
    : activeStaffList.length > 1;

  const gridColumns: GridColumn[] = useMemo(() => {
    if (!staffColumnsView || activeStaffList.length === 0) {
      return week.map((day) => ({
        key: day.dateStr, dateStr: day.dateStr, staffId: null,
        dayName: day.dayName, dayNum: day.dayNum, weekday: day.weekday,
        subLabel: null, subColor: null,
      }));
    }
    return week.flatMap((day) =>
      activeStaffList.map((s) => ({
        key: `${day.dateStr}:${s.id}`, dateStr: day.dateStr, staffId: s.id,
        dayName: day.dayName, dayNum: day.dayNum, weekday: day.weekday,
        subLabel: s.name, subColor: s.color || NEUTRAL_STAFF_COLOR,
      })),
    );
  }, [staffColumnsView, activeStaffList, week]);

  // Vertical span of the rail: earliest open → latest close across the week.
  const { railStartMin, railEndMin } = useMemo(() => {
    const src = hours ?? DEFAULT_HOURS;
    let earliest = 24 * 60;
    let latest = 0;
    for (const day of Object.values(src)) {
      if (!day) continue;
      earliest = Math.min(earliest, toMinutes(day.open));
      latest = Math.max(latest, toMinutes(day.close));
    }
    if (earliest >= latest) { earliest = 8 * 60; latest = 20 * 60; }
    earliest = Math.floor(earliest / 60) * 60;
    latest = Math.ceil(latest / 60) * 60;
    return { railStartMin: earliest, railEndMin: latest };
  }, [hours]);

  const totalHeightPx = (railEndMin - railStartMin) * PX_PER_MIN;
  const hourLabels = useMemo(() => {
    const arr: number[] = [];
    for (let h = railStartMin / 60; h <= railEndMin / 60; h++) arr.push(h);
    return arr;
  }, [railStartMin, railEndMin]);
  // Hour bands that actually fit inside the rail — the closing hour is a label, not a slot.
  const slotHours = useMemo(() => hourLabels.slice(0, -1), [hourLabels]);

  const nowMinutes = useMemo(() => toMinutes(hmFmt.format(new Date(nowMs))), [nowMs]);

  function setStatus(id: string, status: "confirmed" | "cancelled") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setBookingStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      else setSelectedBooking(null);
      setBusyId(null);
    });
  }

  function unblock(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await unblockSlotAction(businessId, id);
      if (res.error) toast.error(res.error);
      else setSelectedBooking(null);
      setBusyId(null);
    });
  }

  function openBlockDialog(day: { dateStr: string; weekday: string }) {
    const dayHours = hours?.[day.weekday];
    setBlockFrom(dayHours?.open ?? "09:00");
    setBlockTo(dayHours?.close ?? "17:00");
    setBlockReason("");
    setBlockStaffId("none");
    setBlockDay(day);
  }

  function submitBlock() {
    if (!blockDay) return;
    setBlocking(true);
    startTransition(async () => {
      const res = await blockSlotsAction(
        businessId,
        { date: blockDay.dateStr, from: blockFrom, to: blockTo, reason: blockReason },
        blockStaffId === "none" ? null : blockStaffId,
      );
      setBlocking(false);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`נחסמו ${res.blocked} משבצות`);
        setBlockDay(null);
      }
    });
  }

  /** Computes a 15-min-rounded time string from a vertical click/drop offset within a day column. */
  function timeFromOffsetY(e: { currentTarget: HTMLDivElement; clientY: number }): string {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    let minutes = railStartMin + offsetY / PX_PER_MIN;
    minutes = Math.round(minutes / 15) * 15;
    minutes = Math.min(Math.max(minutes, railStartMin), railEndMin - 15);
    return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
  }

  /**
   * Opens the create-booking dialog at an explicit time. The pointer path derives
   * that time from the cursor's Y offset; the keyboard path passes the slot's own
   * hour, so it never needs a clientY it doesn't have.
   */
  function openCreateDialogAt(col: GridColumn, time: string) {
    setCreateTime(time);
    setCreateServiceId("none");
    setCreateStaffId(col.staffId ?? "none");
    setCreateName("");
    setCreatePhone("");
    setCreateSlot({ dateStr: col.dateStr, label: `${fullDayFmt.format(new Date(`${col.dateStr}T12:00:00Z`))} · ${time}` });
  }

  function openCreateDialog(col: GridColumn, e: React.MouseEvent<HTMLDivElement>) {
    openCreateDialogAt(col, timeFromOffsetY(e));
  }

  /** Opens the booking-detail dialog with the reschedule fields primed to the current slot. */
  function openBookingDialog(b: Booking) {
    setRescheduleOpen(false);
    setRescheduleDate(dateFmt.format(new Date(b.starts_at)));
    setRescheduleTime(hmFmt.format(new Date(b.starts_at)));
    setSelectedBooking(b);
  }

  function submitReschedule() {
    if (!selectedBooking) return;
    const id = selectedBooking.id;
    setBusyId(id);
    startTransition(async () => {
      const res = await rescheduleBookingAction(businessId, id, rescheduleDate, rescheduleTime);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`התור הועבר ל-${rescheduleTime} ✓`);
        setRescheduleOpen(false);
        setSelectedBooking(null);
      }
      setBusyId(null);
    });
  }

  function openEventDialog(col: GridColumn, e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const time = timeFromOffsetY(e);
    setEventDialog({ editing: null, date: col.dateStr, startTime: time });
  }

  function submitCreate() {
    if (!createSlot) return;
    if (createName.trim().length < 2 || createPhone.replace(/\D/g, "").length < 9) {
      toast.error("נא למלא שם וטלפון תקינים");
      return;
    }
    setCreating(true);
    startTransition(async () => {
      const res = await createOwnerBookingAction(businessId, {
        date: createSlot.dateStr,
        time: createTime,
        serviceId: createServiceId === "none" ? null : createServiceId,
        name: createName.trim(),
        phone: createPhone.trim(),
        staffId: createStaffId === "none" ? null : createStaffId,
      });
      setCreating(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("התור נוסף ואושר");
      setCreateSlot(null);
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, col: GridColumn) {
    e.preventDefault();
    const bookingId = e.dataTransfer.getData("text/plain");
    if (!bookingId) return;
    const time = timeFromOffsetY(e);
    setBusyId(bookingId);
    startTransition(async () => {
      const res = await rescheduleBookingAction(businessId, bookingId, col.dateStr, time);
      if (res.error) toast.error(res.error);
      else toast.success(`התור הועבר ל-${time} ✓`);
      setBusyId(null);
    });
  }

  const isCurrentWeek = week.some((d) => d.dateStr === todayStr);
  const colWidthPx = staffColumnsView ? 78 : 96;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {/* Week navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" />
            {week[0].dayNum} – {week[6].dayNum}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {activeStaffList.length > 1 && (
              <Button
                variant={staffColumnsView ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                aria-pressed={staffColumnsView}
                title={staffColumnsView ? "חזרה לתצוגת ימים רגילה" : "פיצול לעמודה נפרדת לכל איש/אשת צוות"}
                onClick={() => {
                  setStaffColumnsPref(!staffColumnsView);
                  setStaffColumnsTouched(true);
                }}
              >
                <Users className="size-3.5" />
                תצוגת צוות
                {staffColumnsView && <Check className="size-3.5" />}
              </Button>
            )}
            <Button
              variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => setEventDialog({ editing: null, date: todayStr, startTime: "09:00" })}
            >
              <CalendarPlus2 className="size-3.5" />
              אירוע חדש
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
              היום
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>

        {/* Staff filter chips (hidden in staff-columns view, which already separates by staff) */}
        {staff.length > 0 && !staffColumnsView && (
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

        {/* Block-slots panel */}
        {blockDay && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                <Ban className="size-4 text-destructive" />
                חסימת שעות — {fullDayFmt.format(new Date(`${blockDay.dateStr}T12:00:00Z`))}
              </span>
              <button type="button" aria-label="סגירת חסימת שעות" onClick={() => setBlockDay(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="block-from" className="text-xs">משעה</Label>
                <Input id="block-from" type="time" dir="ltr" className="h-8 w-28" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="block-to" className="text-xs">עד שעה</Label>
                <Input id="block-to" type="time" dir="ltr" className="h-8 w-28" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
              </div>
              {staff.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">איש/אשת צוות</Label>
                  <Select value={blockStaffId} onValueChange={(v) => setBlockStaffId(v ?? "none")}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">כל הצוות</SelectItem>
                      {staff.filter((s) => s.active).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="min-w-40 flex-1 space-y-1">
                <Label htmlFor="block-reason" className="text-xs">סיבה (לא מוצגת ללקוחות)</Label>
                <Input id="block-reason" className="h-8" placeholder="חופשה, הפסקה..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} maxLength={80} />
              </div>
              <Button size="sm" className="h-8" onClick={submitBlock} disabled={blocking}>
                {blocking && <Loader2 className="size-3.5 animate-spin" />}
                חסימה
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              השעות החסומות לא יוצעו ללקוחות באתר. תורים שכבר נקבעו לא נמחקים.
            </p>
          </div>
        )}

        {/* Time-grid week view */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: 56 + gridColumns.length * colWidthPx }} dir="rtl">
            {/* Day / staff headers */}
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${gridColumns.length}, minmax(${colWidthPx}px, 1fr))` }}>
              <div />
              {gridColumns.map((col) => {
                const closed = hours ? !hours[col.weekday] : false;
                const isToday = col.dateStr === todayStr;
                const isPast = col.dateStr < todayStr;
                return (
                  <div key={col.key} className={`group relative pb-1.5 text-center text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {col.dayName}
                    <div className="text-[10px] font-normal">{col.dayNum}</div>
                    {col.subLabel && (
                      <div
                        className="mx-auto mt-1 flex max-w-full items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          color: col.subColor ?? NEUTRAL_STAFF_COLOR,
                          backgroundColor: `${col.subColor ?? NEUTRAL_STAFF_COLOR}1a`,
                        }}
                        title={col.subLabel}
                      >
                        <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: col.subColor ?? NEUTRAL_STAFF_COLOR }} />
                        <span className="truncate">{col.subLabel}</span>
                      </div>
                    )}
                    {closed && <div className="text-[9px] text-muted-foreground/60">סגור</div>}
                    {!isPast && !col.staffId && (
                      <button
                        type="button"
                        title="חסימת שעות ביום זה"
                        aria-label={`חסימת שעות ב${col.dayName}׳ ${col.dayNum}`}
                        onClick={() => openBlockDialog(col)}
                        className="absolute start-0 top-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                      >
                        <Ban className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rail + columns */}
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${gridColumns.length}, minmax(${colWidthPx}px, 1fr))` }}>
              <div className="relative" style={{ height: totalHeightPx }}>
                {hourLabels.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 -translate-y-1/2 text-center text-[10px] text-muted-foreground"
                    style={{ top: (h * 60 - railStartMin) * PX_PER_MIN }}
                  >
                    {pad2(h % 24)}:00
                  </div>
                ))}
              </div>

              {gridColumns.map((col) => {
                const closed = hours ? !hours[col.weekday] : false;
                const colBookings = (byDate.get(col.dateStr) ?? []).filter(
                  (b) => b.status !== "cancelled"
                    && (activeStaffId === "all" || b.staff_id === activeStaffId)
                    && (col.staffId === null || b.staff_id === col.staffId),
                );
                const colEvents = (eventsByDate.get(col.dateStr) ?? []).filter(
                  (ev) => (activeStaffId === "all" || ev.staff_id === activeStaffId)
                    && (col.staffId === null || ev.staff_id === col.staffId),
                );
                const laidOut = packDayItems(
                  [...colBookings.map(bookingToItem), ...colEvents.map(eventToItem)],
                  railStartMin,
                );
                const isToday = col.dateStr === todayStr;
                return (
                  <div
                    key={col.key}
                    className={`relative border-s ${closed ? "bg-muted/20" : ""}`}
                    style={{
                      height: totalHeightPx,
                      backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                      backgroundSize: `100% ${PX_PER_HOUR}px`,
                      // Faint staff-color top bar so an idle staff member's empty
                      // column is still visually tied to them at a glance.
                      borderTop: col.staffId ? `2px solid ${staffById.get(col.staffId)?.color || NEUTRAL_STAFF_COLOR}` : undefined,
                    }}
                    onClick={(e) => openCreateDialog(col, e)}
                    onContextMenu={(e) => openEventDialog(col, e)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, col)}
                  >
                    {isToday && isCurrentWeek && nowMinutes >= railStartMin && nowMinutes <= railEndMin && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500"
                        style={{ top: (nowMinutes - railStartMin) * PX_PER_MIN }}
                      >
                        <span className="absolute -top-1 end-0 size-2 rounded-full bg-red-500" />
                      </div>
                    )}

                    {laidOut.map((item) => {
                      const leftPct = (item.col / item.cols) * 100;
                      const widthPct = 100 / item.cols;
                      const posStyle: React.CSSProperties = {
                        position: "absolute",
                        top: item.top,
                        height: item.height,
                        insetInlineStart: `${leftPct}%`,
                        width: `calc(${widthPct}% - 2px)`,
                      };

                      if (item.kind === "event") {
                        const ev = item.event;
                        const staffColor = ev.staff_id ? staffById.get(ev.staff_id)?.color || NEUTRAL_STAFF_COLOR : NEUTRAL_STAFF_COLOR;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            style={{ ...posStyle, borderRight: `4px solid ${staffColor}` }}
                            className="cursor-pointer overflow-hidden rounded-md border border-indigo-300 bg-indigo-50 p-1 text-start text-[10px] leading-tight dark:border-indigo-700 dark:bg-indigo-950/40"
                            onClick={(e) => { e.stopPropagation(); setEventDialog({ editing: ev }); }}
                            title={ev.title}
                            aria-label={`אירוע פנימי: ${ev.title}, שעה ${timeFmt.format(new Date(ev.starts_at))} — עריכה`}
                          >
                            <div className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300" dir="ltr">
                              {timeFmt.format(new Date(ev.starts_at))}
                            </div>
                            <div className="truncate font-medium text-indigo-900 dark:text-indigo-200">{ev.title}</div>
                          </button>
                        );
                      }

                      const b = item.booking;
                      const staffColor = b.staff_id ? staffById.get(b.staff_id)?.color || NEUTRAL_STAFF_COLOR : NEUTRAL_STAFF_COLOR;
                      if (b.status === "blocked") {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            style={{
                              ...posStyle,
                              backgroundImage:
                                "repeating-linear-gradient(45deg, rgba(113,113,122,0.18) 0 4px, transparent 4px 8px)",
                            }}
                            className="cursor-pointer overflow-hidden rounded-md border border-zinc-300 bg-zinc-100/80 p-1 text-start text-[10px] leading-tight dark:border-zinc-600 dark:bg-zinc-800/80"
                            onClick={(e) => { e.stopPropagation(); openBookingDialog(b); }}
                            aria-label={`משבצת חסומה בשעה ${timeFmt.format(new Date(b.starts_at))} — פתיחה להסרת החסימה`}
                          >
                            <div className="flex items-center gap-1 truncate font-medium text-zinc-500" dir="ltr">
                              <Ban className="size-2.5 shrink-0" />
                              {timeFmt.format(new Date(b.starts_at))}
                            </div>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={item.id}
                          type="button"
                          draggable={busyId !== b.id}
                          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", b.id); e.dataTransfer.effectAllowed = "move"; }}
                          style={{ ...posStyle, borderRight: `4px solid ${staffColor}` }}
                          className={`cursor-grab overflow-hidden rounded-md border p-1 text-start text-[10px] leading-tight active:cursor-grabbing ${
                            b.no_show
                              ? "border-zinc-300 bg-zinc-100 opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                              : b.status === "confirmed"
                                ? "border-green-300 bg-green-50 dark:bg-green-950/30"
                                : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                          }`}
                          onClick={(e) => { e.stopPropagation(); openBookingDialog(b); }}
                          title={`${b.customer_name}${b.service ? " · " + b.service : ""}`}
                          aria-label={bookingCardLabel(b)}
                        >
                          <div className={`flex items-center justify-between gap-1 font-bold tabular-nums ${b.no_show ? "line-through" : ""}`} dir="ltr">
                            <span>{timeFmt.format(new Date(b.starts_at))}</span>
                            {b.recurrence && <span title="סדרה">🔁</span>}
                          </div>
                          <div className={`truncate font-medium ${b.no_show ? "line-through" : ""}`}>{b.customer_name}</div>
                          {b.service && <div className="truncate text-muted-foreground">{b.service}</div>}
                        </button>
                      );
                    })}

                    {/* Keyboard route to the create dialog: one control per hour band,
                        carrying its own time so it never needs a clientY. Invisible and
                        click-through until focused, so the pointer keeps the finer
                        15-minute targeting of the column click. Rendered after the cards
                        so tabbing into a column reaches its bookings first. */}
                    {slotHours.map((h) => {
                      const time = `${pad2(h % 24)}:00`;
                      return (
                        <button
                          key={`slot-${h}`}
                          type="button"
                          aria-label={`תור חדש ב${col.dayName}׳ ${col.dayNum} בשעה ${time}${col.subLabel ? ` · ${col.subLabel}` : ""}`}
                          onClick={(e) => { e.stopPropagation(); openCreateDialogAt(col, time); }}
                          style={{ top: (h * 60 - railStartMin) * PX_PER_MIN, height: PX_PER_HOUR }}
                          className="pointer-events-none absolute inset-x-0 z-0 flex items-center justify-center rounded-md border border-dashed border-primary bg-primary/10 px-1 text-[10px] font-medium text-primary opacity-0 focus:pointer-events-auto focus:z-20 focus:opacity-100"
                        >
                          תור חדש בשעה {time}
                        </button>
                      );
                    })}
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
            <span className="size-2.5 rounded-sm border border-zinc-300 bg-zinc-100" /> חסום / לא הגיע
          </span>
          <span>
            לחיצה על משבצת פנויה ← תור ידני · קליק ימני ← אירוע · גררו תור להזזה ·
            במקלדת: Tab מגיע לכל תור ולכפתורי &quot;תור חדש בשעה&quot;, ושינוי מועד נעשה מתוך פרטי התור
          </span>
        </div>
      </CardContent>

      {/* Booking detail dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent>
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedBooking.status === "blocked" ? "משבצת חסומה" : selectedBooking.customer_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground" dir="ltr">
                  {new Date(selectedBooking.starts_at).toLocaleString("he-IL", {
                    timeZone: TZ, weekday: "long", day: "numeric", month: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
                {selectedBooking.service && <div>{selectedBooking.service}</div>}
                {selectedBooking.recurrence && (
                  <div className="text-xs text-muted-foreground">🔁 תור בסדרה חוזרת</div>
                )}
                {selectedBooking.staff_id && staffById.get(selectedBooking.staff_id) && (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full" style={{ background: staffById.get(selectedBooking.staff_id)!.color || NEUTRAL_STAFF_COLOR }} />
                    {staffById.get(selectedBooking.staff_id)!.name}
                  </div>
                )}
                {selectedBooking.status !== "blocked" && (
                  <>
                    <a href={`tel:${selectedBooking.customer_phone}`} dir="ltr" className="inline-flex items-center gap-1 text-primary">
                      <Phone className="size-3" />
                      {selectedBooking.customer_phone}
                    </a>
                    <div>
                      <Badge
                        variant={selectedBooking.status === "confirmed" ? "default" : "secondary"}
                        className={selectedBooking.status === "confirmed" ? "bg-green-600" : ""}
                      >
                        {selectedBooking.status === "pending" ? "ממתין לאישור" : selectedBooking.status === "confirmed" ? "מאושר" : selectedBooking.status}
                      </Badge>
                    </div>
                  </>
                )}
                {selectedBooking.status !== "blocked" && selectedBooking.status !== "cancelled" && (
                  <div className="rounded-lg border border-dashed p-2">
                    {rescheduleOpen ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label htmlFor="reschedule-date" className="text-xs">תאריך חדש</Label>
                            <Input id="reschedule-date" type="date" dir="ltr" className="h-9" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="reschedule-time" className="text-xs">שעה חדשה</Label>
                            <Input id="reschedule-time" type="time" dir="ltr" className="h-9" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={busyId === selectedBooking.id} onClick={submitReschedule}>
                            {busyId === selectedBooking.id && <Loader2 className="size-3.5 animate-spin" />}
                            עדכון המועד
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setRescheduleOpen(false)}>
                            ביטול
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRescheduleOpen(true)}>
                        <CalendarDays className="size-3.5" />
                        שינוי מועד
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedBooking.status === "blocked" ? (
                  <Button variant="outline" disabled={busyId === selectedBooking.id} onClick={() => unblock(selectedBooking.id)} className="gap-1.5">
                    {busyId === selectedBooking.id && <Loader2 className="size-3.5 animate-spin" />}
                    הסרת חסימה
                  </Button>
                ) : (
                  <>
                    {selectedBooking.status === "pending" && (
                      <Button className="gap-1.5 bg-green-600 hover:bg-green-700" disabled={busyId === selectedBooking.id} onClick={() => setStatus(selectedBooking.id, "confirmed")}>
                        <Check className="size-3.5" /> אשר
                      </Button>
                    )}
                    {selectedBooking.status !== "cancelled" && (
                      <Button variant="outline" className="gap-1.5" disabled={busyId === selectedBooking.id} onClick={() => setStatus(selectedBooking.id, "cancelled")}>
                        <X className="size-3.5" /> בטל
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create-booking dialog */}
      <Dialog open={!!createSlot} onOpenChange={(open) => !open && setCreateSlot(null)}>
        <DialogContent>
          {createSlot && (
            <>
              <DialogHeader>
                <DialogTitle>הוספת תור ידני</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{createSlot.label}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">שעה</Label>
                    <Input type="time" dir="ltr" className="h-9" value={createTime} onChange={(e) => setCreateTime(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">שירות</Label>
                    <Select value={createServiceId} onValueChange={(v) => setCreateServiceId(v ?? "none")}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">כללי</SelectItem>
                        {services.filter((s) => s.active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {staff.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">איש/אשת צוות</Label>
                    <Select value={createStaffId} onValueChange={(v) => setCreateStaffId(v ?? "none")}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא שיוך</SelectItem>
                        {staff.filter((s) => s.active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <Input placeholder="שם מלא *" className="h-9" value={createName} onChange={(e) => setCreateName(e.target.value)} />
                  <Input placeholder="טלפון *" type="tel" dir="ltr" className="h-9" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submitCreate} disabled={creating} className="gap-1.5">
                  {creating && <Loader2 className="size-3.5 animate-spin" />}
                  הוספה ואישור התור
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Internal-event create/edit/delete dialog */}
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
