/** Client-safe booking types/constants/helpers (no server imports). */

export type WeeklyHours = Record<string, { open: string; close: string; breakFrom?: string; breakTo?: string } | null>;

/** A duration/overlap-aware bookable service offered by the business. */
export type PublicBookingService = {
  id: string | null;
  name: string;
  durationMinutes: number;
  price: number | null;
};

/** A staff member the customer can pick when booking (public-safe fields). */
export type PublicBookingStaff = {
  id: string;
  name: string;
  roleTitle: string | null;
  color: string | null;
};

/** Sentinel staff id meaning "no preference — any available staff member". */
export const STAFF_ANY = "any";

/** Recurrence cadence for repeat-booking a series of appointments. */
export type BookingRecurrence = "weekly" | "biweekly" | "every4weeks";
export const RECURRENCE_LABEL: Record<BookingRecurrence, string> = {
  weekly: "כל שבוע",
  biweekly: "כל שבועיים",
  every4weeks: "כל 4 שבועות",
};
/** Days to add per occurrence for each recurrence cadence. */
export const RECURRENCE_STEP_DAYS: Record<BookingRecurrence, number> = {
  weekly: 7,
  biweekly: 14,
  every4weeks: 28,
};
/** Hard cap on how many occurrences a recurring series creates (incl. the first). */
export const RECURRENCE_MAX_OCCURRENCES = 8;

const TZ = "Asia/Jerusalem";

// ── Timezone helpers (DST-correct for Israel) ───────────────────────────────
function tzOffsetMs(date: Date): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** "2026-06-15" + "10:30" in Israel time → UTC Date. */
export function zonedToUtc(dateStr: string, timeStr: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  return new Date(naive.getTime() - tzOffsetMs(naive));
}

/** JS weekday ("0"=Sunday … "6"=Saturday) of a YYYY-MM-DD date string. */
export function weekdayOf(dateStr: string): string {
  return String(new Date(`${dateStr}T12:00:00Z`).getUTCDay());
}

export const DEFAULT_HOURS: WeeklyHours = {
  "0": { open: "09:00", close: "18:00" },
  "1": { open: "09:00", close: "18:00" },
  "2": { open: "09:00", close: "18:00" },
  "3": { open: "09:00", close: "18:00" },
  "4": { open: "09:00", close: "18:00" },
  "5": null,
  "6": null,
};

/**
 * Earliest bookable instant given a minimum-notice policy: at least 30
 * minutes from now, and at least `minNoticeHours` hours from now — whichever
 * is later.
 */
export function minBookableFrom(minNoticeHours: number): number {
  return Math.max(Date.now() + 30 * 60_000, Date.now() + minNoticeHours * 3600_000);
}

/**
 * Adds `days` calendar days (Israel time) to a YYYY-MM-DD date string,
 * returning a new YYYY-MM-DD string. Used to step through recurrence
 * occurrences without drifting across DST boundaries (each occurrence is
 * re-resolved from its own calendar date + the original clock time).
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
