/**
 * Pure date-math + availability helpers for the vacation-rental (צימר) module.
 * Dates are "YYYY-MM-DD" strings; lexicographic compare == chronological.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Max photos in a unit's gallery. Enforced in the owner picker and in saveUnitAction. */
export const MAX_UNIT_IMAGES = 8;

/**
 * Normalises an owner-supplied gallery: http(s) only, de-duplicated, capped.
 * Index 0 is the cover, which the caller mirrors onto image_url.
 */
export function normalizeUnitImages(urls: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (urls ?? [])
        .map((u) => u.trim())
        .filter((u) => /^https?:\/\/\S+$/i.test(u)),
    ),
  ).slice(0, MAX_UNIT_IMAGES);
}

export function isDateStr(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Number of nights between check-in and check-out (0 if invalid or non-positive). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!isDateStr(checkIn) || !isDateStr(checkOut)) return 0;
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Two half-open date ranges [aIn,aOut) and [bIn,bOut) overlap? */
export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/** Does [checkIn,checkOut) clash with any existing booked range? */
export function isRangeAvailable(
  checkIn: string,
  checkOut: string,
  booked: { check_in: string; check_out: string }[],
): boolean {
  if (nightsBetween(checkIn, checkOut) < 1) return false;
  return !booked.some((b) => rangesOverlap(checkIn, checkOut, b.check_in, b.check_out));
}

export function rentalTotal(nightlyPrice: number, nights: number): number {
  const p = Number(nightlyPrice);
  if (!Number.isFinite(p) || p < 0 || nights < 1) return 0;
  return Math.round(p * nights * 100) / 100;
}

/** Today as YYYY-MM-DD in Israel time. */
export function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

/* ────────────────────────────────────────────────────────────────────────────
 * AVAILABILITY ENGINE
 *
 * THE TIMEZONE RULE, stated once and obeyed everywhere below: a calendar date
 * is a "YYYY-MM-DD" STRING from the database to the rendered cell, and it is
 * never turned into a local `Date`. `new Date("2026-08-10")` parses as UTC
 * midnight and then renders as the 9th for anyone west of Greenwich — the
 * single most common way a booking system shows the wrong night. Every helper
 * here either does string arithmetic or pins the parse to `T00:00:00Z`, and
 * `Date` objects exist only long enough to add days.
 * ──────────────────────────────────────────────────────────────────────────── */

const MS_DAY = 86_400_000;

const toUtc = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** `date` shifted by n days, still as a plain YYYY-MM-DD string. */
export function addDays(date: string, n: number): string {
  if (!isDateStr(date)) return date;
  return fromUtc(toUtc(date) + n * MS_DAY);
}

/** Every date from `from` to `to` INCLUSIVE — the columns of a calendar. */
export function dateRange(from: string, to: string): string[] {
  if (!isDateStr(from) || !isDateStr(to) || to < from) return [];
  const out: string[] = [];
  for (let t = toUtc(from); t <= toUtc(to); t += MS_DAY) out.push(fromUtc(t));
  return out;
}

/**
 * The NIGHTS a stay occupies — check-in inclusive, check-out EXCLUSIVE.
 * 10→13 is three nights (10, 11, 12) and the 13th is free for the next guest.
 * This asymmetry is the whole booking domain in one function.
 */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const nights = nightsBetween(checkIn, checkOut);
  return nights < 1 ? [] : dateRange(checkIn, addDays(checkOut, -1));
}

/** First and last day of a month, as strings. `month` is 1-12. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  // Day 0 of the NEXT month is the last day of this one — no leap-year table.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Sunday-based weekday index (0-6) without constructing a local Date. */
export function weekdayOf(date: string): number {
  return isDateStr(date) ? new Date(toUtc(date)).getUTCDay() : 0;
}

/** The Sunday on or before `date` — the Israeli week starts on Sunday. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/* ── Cell state ───────────────────────────────────────────────────────────── */

/**
 * What a single night of a single unit looks like on the board. Ordered by
 * precedence: when two rows somehow claim one night (only possible for rows
 * the exclusion constraint permits, i.e. one of them cancelled), the more
 * committed state wins so the calendar never under-reports an occupied night.
 */
export type CellState = "free" | "pending" | "booked" | "blocked";

const CELL_RANK: Record<CellState, number> = { free: 0, pending: 1, booked: 2, blocked: 3 };

/** The occupying state a booking row contributes, or null if it frees its dates. */
export function cellStateOf(b: { kind?: string | null; status: string }): CellState | null {
  if (b.status === "cancelled") return null;
  if (b.kind === "block" || b.status === "blocked") return "blocked";
  if (b.status === "pending") return "pending";
  return "booked"; // confirmed | completed | no_show — all held the room
}

export type OccupyingRow = {
  unit_id: string;
  check_in: string;
  check_out: string;
  status: string;
  kind?: string | null;
};

/**
 * `unitId → date → state` for the given window. Built once per calendar render
 * and read O(1) per cell, so a 40-unit × 31-day board is 1,240 map lookups
 * instead of 1,240 scans over every booking.
 */
export function buildOccupancy(
  rows: readonly OccupyingRow[],
  from: string,
  to: string,
): Map<string, Map<string, CellState>> {
  const byUnit = new Map<string, Map<string, CellState>>();
  for (const r of rows) {
    const state = cellStateOf(r);
    if (!state) continue;
    let cells = byUnit.get(r.unit_id);
    if (!cells) byUnit.set(r.unit_id, (cells = new Map()));
    for (const night of nightsOf(r.check_in, r.check_out)) {
      if (night < from || night > to) continue;
      const prev = cells.get(night);
      if (!prev || CELL_RANK[state] > CELL_RANK[prev]) cells.set(night, state);
    }
  }
  return byUnit;
}

export function cellAt(
  occupancy: Map<string, Map<string, CellState>>,
  unitId: string,
  date: string,
): CellState {
  return occupancy.get(unitId)?.get(date) ?? "free";
}

/* ── Search (§7) ──────────────────────────────────────────────────────────── */

export type SearchableUnit = {
  id: string;
  max_guests: number;
  active: boolean;
  nightly_price: number;
};

export type UnitMatch<U> = { unit: U; nights: number; total: number };

/**
 * Which units can take [checkIn, checkOut) for `guests` people.
 *
 * Deliberately checks the SAME `occupying` rows the calendar is drawn from, so
 * "the board says free" and "the search says available" can never disagree —
 * they are one computation. This is an optimistic answer only: the booking is
 * re-validated server-side and, in the end, by the database.
 */
export function findAvailableUnits<U extends SearchableUnit>(
  units: readonly U[],
  occupying: readonly OccupyingRow[],
  checkIn: string,
  checkOut: string,
  guests = 1,
): UnitMatch<U>[] {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return [];

  const takenByUnit = new Map<string, OccupyingRow[]>();
  for (const r of occupying) {
    if (!cellStateOf(r)) continue;
    const arr = takenByUnit.get(r.unit_id) ?? [];
    arr.push(r);
    takenByUnit.set(r.unit_id, arr);
  }

  return units
    .filter((u) => u.active && u.max_guests >= Math.max(1, guests))
    .filter((u) => isRangeAvailable(checkIn, checkOut, takenByUnit.get(u.id) ?? []))
    .map((unit) => ({ unit, nights, total: rentalTotal(Number(unit.nightly_price), nights) }));
}

/* ── Calendar bars (§4) ───────────────────────────────────────────────────── */

/**
 * A stay drawn as ONE continuous bar across the nights it occupies, clipped to
 * the visible window.
 *
 * `startIndex`/`span` are column offsets into the rendered `days` array, and
 * `clippedStart`/`clippedEnd` say whether the real stay continues past the
 * edge of the view — which is what lets the bar render a flat edge there
 * instead of a rounded one, so a stay running into next month reads as
 * continuing rather than as ending on the 31st.
 */
export type BookingBar<B> = {
  booking: B;
  startIndex: number;
  span: number;
  clippedStart: boolean;
  clippedEnd: boolean;
};

export function layoutBars<B extends { check_in: string; check_out: string; status: string }>(
  bookings: readonly B[],
  days: readonly string[],
): BookingBar<B>[] {
  if (days.length === 0) return [];
  const first = days[0];
  const last = days[days.length - 1];
  const indexOf = new Map(days.map((d, i) => [d, i]));

  const bars: BookingBar<B>[] = [];
  for (const b of bookings) {
    const nights = nightsOf(b.check_in, b.check_out);
    if (nights.length === 0) continue;
    const from = nights[0];
    const to = nights[nights.length - 1];
    if (to < first || from > last) continue; // entirely outside the view

    const visibleFrom = from < first ? first : from;
    const visibleTo = to > last ? last : to;
    const startIndex = indexOf.get(visibleFrom);
    const endIndex = indexOf.get(visibleTo);
    if (startIndex === undefined || endIndex === undefined) continue;

    bars.push({
      booking: b,
      startIndex,
      span: endIndex - startIndex + 1,
      clippedStart: from < first,
      clippedEnd: to > last,
    });
  }
  return bars;
}

/* ── Status vocabulary (§9, §15) ──────────────────────────────────────────── */

/**
 * One definition of every status: its Hebrew label, and the CSS custom
 * properties the calendar and the badges paint with. Colours live here rather
 * than in each component so "ירוק = פנוי" can never mean two different greens.
 * Chosen to stay legible without shouting — muted fills, saturated text.
 */
export const RENTAL_STATUS_META: Record<
  CellState | "cancelled",
  { label: string; fill: string; ink: string; dot: string }
> = {
  free:      { label: "פנוי",   fill: "rgba(16,185,129,.10)", ink: "#047857", dot: "#10b981" },
  pending:   { label: "ממתינה", fill: "rgba(245,158,11,.16)", ink: "#92400e", dot: "#f59e0b" },
  booked:    { label: "תפוסה",  fill: "rgba(220,38,38,.14)",  ink: "#991b1b", dot: "#dc2626" },
  blocked:   { label: "חסומה",  fill: "rgba(113,113,122,.16)", ink: "#3f3f46", dot: "#71717a" },
  cancelled: { label: "בוטלה",  fill: "rgba(161,161,170,.10)", ink: "#71717a", dot: "#a1a1aa" },
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "ממתינה",
  confirmed: "מאושרת",
  cancelled: "בוטלה",
  completed: "הושלמה",
  no_show: "לא הגיע",
  blocked: "חסימה",
};

/** Statuses an owner may move a real booking to, in lifecycle order. */
export const BOOKING_STATUS_FLOW = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
] as const;
