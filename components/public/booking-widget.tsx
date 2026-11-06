"use client";

import { useState, useTransition } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Repeat,
} from "lucide-react";

import { getPublicSlotsAction, submitBookingAction } from "@/lib/actions/booking";
import { joinWaitlistAction } from "@/lib/actions/booking-waitlist";
import { inkOn } from "@/lib/storefront-brand";
import {
  RECURRENCE_LABEL,
  STAFF_ANY,
  addDaysToDateStr,
  weekdayOf,
  zonedToUtc,
  type BookingRecurrence,
  type PublicBookingService,
  type PublicBookingStaff,
} from "@/lib/booking-shared";

/** Formats a Date as UTC basic format for Google Calendar / ICS: YYYYMMDDTHHMMSSZ. */
function toCalUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function googleCalendarUrl(title: string, start: Date, end: Date, details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toCalUtc(start)}/${toCalUtc(end)}`,
    details,
    ctz: "Asia/Jerusalem",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Single-event .ics as a data: URL, for a client-side "download to calendar" link. */
function icsDownloadUrl(title: string, start: Date, end: Date, details: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//AI Business Builder//Booking//HE",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}-${Math.random().toString(36).slice(2)}@ai-business-builder`,
    `DTSTAMP:${toCalUtc(new Date())}`,
    `DTSTART:${toCalUtc(start)}`,
    `DTEND:${toCalUtc(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    ...(details ? [`DESCRIPTION:${icsEscape(details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

const TZ = "Asia/Jerusalem";

const RECURRENCE_OPTIONS: { value: "" | BookingRecurrence; label: string }[] = [
  { value: "", label: "חד-פעמי" },
  { value: "weekly", label: RECURRENCE_LABEL.weekly },
  { value: "biweekly", label: RECURRENCE_LABEL.biweekly },
  { value: "every4weeks", label: RECURRENCE_LABEL.every4weeks },
];

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export type BookingPrefill = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

/** Staff eligible for a service: no explicit list (offers everything) OR the list includes this service. */
function eligibleStaffFor(
  staff: PublicBookingStaff[],
  staffServices: Record<string, string[]>,
  serviceId: string | null,
): PublicBookingStaff[] {
  if (!serviceId) return staff;
  return staff.filter((s) => {
    const ids = staffServices[s.id] ?? [];
    return ids.length === 0 || ids.includes(serviceId);
  });
}

function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function daysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthTitle(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

function groupSlots(slots: string[]): { label: string; items: string[] }[] {
  const morning: string[] = [];
  const noon: string[] = [];
  const evening: string[] = [];
  for (const s of slots) {
    const h = Number(s.slice(0, 2));
    if (h < 12) morning.push(s);
    else if (h < 16) noon.push(s);
    else evening.push(s);
  }
  return [
    { label: "בוקר", items: morning },
    { label: "צהריים", items: noon },
    { label: "ערב", items: evening },
  ].filter((g) => g.items.length > 0);
}

export function BookingWidget({
  slug,
  brandColor,
  days,
  services,
  staff,
  staffServices,
  prefill,
}: {
  slug: string;
  brandColor: string;
  days: { date: string; label: string }[];
  services: PublicBookingService[];
  staff: PublicBookingStaff[];
  staffServices?: Record<string, string[]>;
  prefill?: BookingPrefill;
}) {
  const staffServicesMap = staffServices ?? {};
  const skipServiceStep = services.length <= 1;
  const [service, setService] = useState<PublicBookingService | null>(services[0] ?? null);

  const [staffId, setStaffId] = useState<string | null>(() => {
    if (staff.length === 0) return null;
    const elig = eligibleStaffFor(staff, staffServicesMap, services[0]?.id ?? null);
    return elig.length === 1 ? elig[0].id : STAFF_ANY;
  });

  const [viewMonth, setViewMonth] = useState(() =>
    days.length ? firstOfMonth(days[0].date) : firstOfMonth(todayStr()),
  );
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState(prefill?.name ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<"" | BookingRecurrence>("");
  const [hp, setHp] = useState("");
  // Signed-in shoppers with a complete profile get one-tap booking — the
  // details form collapses into a confirmation card unless they expand it.
  const recognized = Boolean(prefill?.name && prefill?.phone);
  const [editDetails, setEditDetails] = useState(false);
  const [done, setDone] = useState(false);
  const [bookedStaffName, setBookedStaffName] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<number | undefined>(undefined);
  const [skippedOccurrences, setSkippedOccurrences] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const eligibleStaff = eligibleStaffFor(staff, staffServicesMap, service?.id ?? null);
  const hasStaffStep = staff.length > 0;
  const skipStaffStep = !hasStaffStep || eligibleStaff.length <= 1;
  const selectedStaffMember = staff.find((m) => m.id === staffId) ?? null;

  function pickService(s: PublicBookingService) {
    setService(s);
    const elig = eligibleStaffFor(staff, staffServicesMap, s.id);
    setStaffId(staff.length === 0 ? null : elig.length === 1 ? elig[0].id : STAFF_ANY);
    setDate(null);
    setTime(null);
    setSlots(null);
    setWaitlistJoined(false);
    setWaitlistError(null);
  }

  function pickStaff(id: string) {
    setStaffId(id);
    setDate(null);
    setTime(null);
    setSlots(null);
    setWaitlistJoined(false);
    setWaitlistError(null);
  }

  function pickDay(d: string) {
    setDate(d);
    setTime(null);
    setSlots(null);
    setWaitlistJoined(false);
    setWaitlistError(null);
    setLoadingSlots(true);
    startTransition(async () => {
      const staffPick = hasStaffStep ? (staffId ?? STAFF_ANY) : null;
      const res = await getPublicSlotsAction(slug, d, service?.id ?? null, staffPick);
      if (res.error) setError(res.error);
      setSlots(res.slots ?? []);
      setLoadingSlots(false);
    });
  }

  function joinWaitlist() {
    if (!date) return;
    setWaitlistError(null);
    startTransition(async () => {
      const res = await joinWaitlistAction({
        slug,
        date,
        serviceId: service?.id ?? null,
        staffId: hasStaffStep ? (staffId ?? STAFF_ANY) : null,
        name,
        phone,
        email: email || undefined,
        website: hp,
      });
      if (!res.ok) setWaitlistError(res.error ?? "ההצטרפות לרשימת ההמתנה נכשלה");
      else setWaitlistJoined(true);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await submitBookingAction(slug, {
        name, phone, date, time,
        email: email || undefined,
        service: service?.name,
        serviceId: service?.id ?? null,
        staffId: hasStaffStep ? staffId : null,
        notes: notes || undefined,
        recurrence: recurrence || null,
        company_website: hp,
      });
      if (!res.ok) setError(res.error ?? "השמירה נכשלה");
      else {
        setOccurrences(res.occurrences);
        setSkippedOccurrences(res.skippedOccurrences);
        setBookedStaffName(res.staffName ?? null);
        setDone(true);
      }
    });
  }

  if (done) {
    const eventStart = date && time ? zonedToUtc(date, time) : null;
    const eventEnd = eventStart
      ? new Date(eventStart.getTime() + (service?.durationMinutes ?? 60) * 60_000)
      : null;
    const eventTitle = `תור${service ? `: ${service.name}` : ""}`;
    const eventDetails = bookedStaffName ? `אצל ${bookedStaffName}` : "";

    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="size-10" style={{ color: brandColor }} />
        <p className="text-lg font-semibold">התור נקבע! 🎉</p>
        <p className="text-sm text-zinc-500">
          {days.find((d) => d.date === date)?.label} בשעה {time}
          {service ? ` · ${service.name}` : ""}
          {service?.durationMinutes ? ` · ${service.durationMinutes} דק'` : ""}
          {service?.price != null ? ` · ₪${service.price}` : ""}
          {bookedStaffName ? ` · אצל ${bookedStaffName}` : ""}
          {" — נשלח אישור בהקדם"}
        </p>
        {occurrences && occurrences > 1 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <Repeat className="size-3.5" />
            נקבעו {occurrences} תורים בסדרה ({RECURRENCE_LABEL[recurrence as BookingRecurrence]})
            {!!skippedOccurrences && ` — ${skippedOccurrences} תאריכים היו תפוסים ולא נכללו`}
          </p>
        )}
        {eventStart && eventEnd && !isNaN(eventStart.getTime()) && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <a
              href={googleCalendarUrl(eventTitle, eventStart, eventEnd, eventDetails)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400"
            >
              <CalendarPlus className="size-3.5" />
              הוסף ליומן Google
            </a>
            <a
              href={icsDownloadUrl(eventTitle, eventStart, eventEnd, eventDetails)}
              download="booking.ics"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400"
            >
              <Download className="size-3.5" />
              הורדה ליומן (.ics)
            </a>
          </div>
        )}
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      active ? "text-white" : "bg-white text-zinc-700 hover:border-zinc-400"
    }`;
  const chipStyle = (active: boolean) =>
    active ? { backgroundColor: brandColor, borderColor: brandColor , color: inkOn(brandColor) } : undefined;

  const cardBtn = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-start text-sm transition-colors ${
      active ? "" : "bg-white hover:border-zinc-400"
    }`;
  const cardStyle = (active: boolean) =>
    active ? { borderColor: brandColor, backgroundColor: `${brandColor}10` } : undefined;

  // Step numbering shifts by one when the service/staff steps are skipped.
  let stepCounter = 0;
  const stepServiceNum = skipServiceStep ? 0 : ++stepCounter;
  const stepStaffNum = skipStaffStep ? 0 : ++stepCounter;
  const stepDateNum = ++stepCounter;
  const stepTimeNum = ++stepCounter;
  const stepDetailsNum = ++stepCounter;

  const minMonth = days.length ? firstOfMonth(days[0].date) : viewMonth;
  const maxMonth = days.length ? firstOfMonth(days[days.length - 1].date) : viewMonth;
  const openSet = new Set(days.map((d) => d.date));
  const monthDays: string[] = [];
  for (let i = 0; i < daysInMonth(viewMonth); i++) monthDays.push(addDaysToDateStr(viewMonth, i));
  const leadingBlanks = Number(weekdayOf(viewMonth));

  const readyForDay = (skipServiceStep || service) && (skipStaffStep || staffId);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm">
      <input type="text" tabIndex={-1} autoComplete="off" value={hp} aria-hidden="true"
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />

      {/* Step: service (skipped when there's 0-1 services) */}
      {!skipServiceStep && (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">{stepServiceNum}. בחרו שירות</div>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <button
                key={s.id ?? s.name}
                type="button"
                onClick={() => pickService(s)}
                className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-start text-sm transition-colors ${
                  service?.name === s.name ? "" : "bg-white hover:border-zinc-400"
                }`}
                style={service?.name === s.name ? { borderColor: brandColor, backgroundColor: `${brandColor}10` } : undefined}
              >
                <span className="font-medium text-zinc-800">{s.name}</span>
                <span dir="ltr" className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                  {s.durationMinutes && <span>{s.durationMinutes} דק&apos;</span>}
                  {s.price != null && <span className="font-semibold text-zinc-700">₪{s.price}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: staff (skipped when there's no staff, or only one eligible option) */}
      {!skipStaffStep && (skipServiceStep || service) && (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">{stepStaffNum}. בחרו איש/אשת צוות</div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => pickStaff(STAFF_ANY)}
              className={cardBtn(staffId === STAFF_ANY)}
              style={cardStyle(staffId === STAFF_ANY)}
            >
              <span className="font-medium text-zinc-800">לא משנה לי — הזמינות הרחבה ביותר</span>
            </button>
            {eligibleStaff.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickStaff(m.id)}
                className={cardBtn(staffId === m.id)}
                style={cardStyle(staffId === m.id)}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color ?? "#a1a1aa" }} />
                <span className="flex flex-col">
                  <span className="font-medium text-zinc-800">{m.name}</span>
                  {m.roleTitle && <span className="text-xs text-zinc-500">{m.roleTitle}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: day — mini month calendar */}
      {readyForDay && (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">{stepDateNum}. בחרו יום</div>
          <div className="rounded-xl border border-zinc-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                disabled={viewMonth <= minMonth}
                onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="חודש קודם"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="text-sm font-semibold text-zinc-700">{monthTitle(viewMonth)}</span>
              <button
                type="button"
                disabled={viewMonth >= maxMonth}
                onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="חודש הבא"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-400">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`b${i}`} />
              ))}
              {monthDays.map((d) => {
                const isOpen = openSet.has(d);
                const isSelected = date === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!isOpen}
                    onClick={() => pickDay(d)}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border text-white"
                        : isOpen
                          ? "border bg-white text-zinc-700 hover:border-zinc-400"
                          : "border border-transparent text-zinc-300"
                    }`}
                    style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor , color: inkOn(brandColor) } : undefined}
                  >
                    {Number(d.slice(8, 10))}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step: time */}
      {date && (
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">{stepTimeNum}. בחרו שעה</div>
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="size-4 animate-spin" /> טוען זמנים פנויים...
            </div>
          ) : slots && slots.length > 0 ? (
            <div className="flex flex-col gap-3">
              {groupSlots(slots).map((g) => (
                <div key={g.label}>
                  <div className="mb-1.5 text-xs font-medium text-zinc-400">{g.label}</div>
                  <div className="flex flex-wrap gap-2" dir="ltr">
                    {g.items.map((s) => (
                      <button key={s} type="button" className={chip(time === s)}
                        style={chipStyle(time === s)}
                        onClick={() => setTime(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {waitlistJoined ? (
                <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <CheckCircle2 className="size-4" />
                  נעדכן אתכם ברגע שיתפנה תור ביום הזה
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <Bell className="size-4" />
                    היום הזה מלא — הצטרפו לרשימת ההמתנה
                  </p>
                  <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="שם מלא *"
                    value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="טלפון *" type="tel"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="אימייל (אופציונלי)" type="email" dir="ltr"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                  {waitlistError && <p className="text-xs text-red-600">{waitlistError}</p>}
                  <button
                    type="button"
                    onClick={joinWaitlist}
                    disabled={isPending || name.trim().length < 2 || phone.trim().length < 9}
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
                    הצטרפות לרשימת ההמתנה
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step: details — recognized customers get a one-tap confirmation card */}
      {time && recognized && !editDetails && (
        <div className="space-y-2.5">
          <div className="text-sm font-semibold text-zinc-700">{stepDetailsNum}. אישור</div>
          <div className="rounded-xl border p-4" style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}>
            <p className="text-sm font-semibold text-zinc-800">
              {days.find((d) => d.date === date)?.label} בשעה {time}
              {service ? ` · ${service.name}` : ""}
              {selectedStaffMember ? ` · אצל ${selectedStaffMember.name}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              התור יירשם על שם {name} · {phone}
            </p>
            <button
              type="button"
              onClick={() => setEditDetails(true)}
              className="mt-2 text-xs font-medium underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
              style={{ color: brandColor }}
            >
              עריכת פרטים / הוספת הערה / תור קבוע
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
            אישור וקביעת התור
          </button>
        </div>
      )}

      {/* Step: details */}
      {time && (!recognized || editDetails) && (
        <div className="space-y-2.5">
          <div className="text-sm font-semibold text-zinc-700">{stepDetailsNum}. פרטים</div>
          {selectedStaffMember && (
            <p className="text-xs text-zinc-500">עם {selectedStaffMember.name}</p>
          )}
          <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="שם מלא *"
            value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="טלפון *" type="tel"
            value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <div>
            <input className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="אימייל (אופציונלי)" type="email" dir="ltr"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-zinc-400">לקבלת אישור ותזכורת במייל</p>
          </div>
          <textarea className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" placeholder="הערות (אופציונלי)"
            rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">תור קבוע</label>
            <select
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as "" | BookingRecurrence)}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {recurrence && (
              <p className="mt-1 text-xs text-zinc-400">ייקבעו עד 8 תורים קדימה, כל עוד השעה פנויה</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit"
            disabled={isPending || name.trim().length < 2 || phone.trim().length < 9}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
            קבעו לי תור
          </button>
        </div>
      )}
    </form>
  );
}
