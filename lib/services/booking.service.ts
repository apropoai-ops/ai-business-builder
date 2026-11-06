import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "node:crypto";
import type { Booking, BookingSettings, BookingService, Json } from "@/types/database";

import {
  DEFAULT_HOURS,
  zonedToUtc,
  weekdayOf,
  minBookableFrom,
  addDaysToDateStr,
  RECURRENCE_STEP_DAYS,
  RECURRENCE_MAX_OCCURRENCES,
  STAFF_ANY,
  type WeeklyHours,
  type PublicBookingService,
  type PublicBookingStaff,
  type BookingRecurrence,
} from "@/lib/booking-shared";
import { notifyBookingCreated } from "@/lib/services/booking-notify";
import { notifyNewBooking } from "@/lib/services/booking-notify.service";
import { notifyWaitlistForDate } from "@/lib/services/booking-waitlist.service";
import { fireAutomations } from "@/lib/services/automations.service";

const TZ = "Asia/Jerusalem";

export {
  DEFAULT_HOURS,
  zonedToUtc,
  type WeeklyHours,
  type PublicBookingService,
};

// ── Staff helpers (pure — no DB) ────────────────────────────────────────────
// A business "has staff" iff it has ≥1 active booking_staff row; with none,
// every function below falls back to today's single-resource behavior.

/** Staff's own weekly hours if set, otherwise the business's hours. */
function staffWeeklyHours(staff: { hours: Json | null }, businessHours: WeeklyHours): WeeklyHours {
  return (staff.hours as WeeklyHours | null) ?? businessHours;
}

/**
 * staffId → serviceIds it's restricted to. A staff member with no rows in
 * booking_staff_services offers ALL services — represented here as either a
 * missing key or an empty array (isStaffEligible treats both as "all").
 */
function buildStaffServiceMap(
  rows: { staff_id: string; service_id: string }[] | null | undefined,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const r of rows ?? []) (map[r.staff_id] ??= []).push(r.service_id);
  return map;
}

function isStaffEligible(
  staffId: string,
  serviceId: string | null | undefined,
  staffServiceMap: Record<string, string[]>,
): boolean {
  if (!serviceId) return true;
  const restricted = staffServiceMap[staffId];
  return !restricted || restricted.length === 0 || restricted.includes(serviceId);
}

/** Dedupe + sort "HH:MM" slot lists (safe lexicographically — zero-padded 24h). */
function unionSortedSlots(lists: string[][]): string[] {
  return Array.from(new Set(lists.flat())).sort();
}

const israelDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // → "YYYY-MM-DD"
/** Instant → Israel-local calendar date string, for the waitlist notify hook. */
function toIsraelDateStr(d: Date): string {
  return israelDateFmt.format(d);
}

// ── Owner-side (RLS) ────────────────────────────────────────────────────────
export async function getBookingSettings(businessId: string): Promise<BookingSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_settings").select("*").eq("business_id", businessId).maybeSingle();
  return data;
}

export async function upsertBookingSettings(
  businessId: string,
  fields: {
    enabled: boolean;
    auto_confirm?: boolean;
    slot_minutes: number;
    days_ahead: number;
    hours: Json;
    services: Json;
    buffer_minutes?: number;
    min_notice_hours?: number;
    cancel_notice_hours?: number;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_settings")
    .upsert({ business_id: businessId, ...fields }, { onConflict: "business_id" });
  if (error) throw new Error(error.message);
}

export async function listUpcomingBookings(businessId: string): Promise<Booking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings").select("*")
    .eq("business_id", businessId)
    .neq("status", "blocked")
    .gte("starts_at", new Date(Date.now() - 86400_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Wide range for the weekly calendar view: last week → +8 weeks. */
export async function listBookingsRange(businessId: string): Promise<Booking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings").select("*")
    .eq("business_id", businessId)
    .gte("starts_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 56 * 86400_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Bookings whose start falls within a calendar month (±2 day buffer for grid edges). */
export async function listBookingsForMonth(
  businessId: string,
  year: number,
  month: number, // 1-12
): Promise<Booking[]> {
  const supabase = await createClient();
  const start = new Date(Date.UTC(year, month - 1, 1) - 2 * 86400_000);
  const end = new Date(Date.UTC(year, month - 1, 1) + 33 * 86400_000);
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("business_id", businessId)
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at", { ascending: true })
    .limit(800);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setBookingStatus(id: string, status: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("business_id,starts_at")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (status === "cancelled" && data) {
    try {
      await notifyWaitlistForDate(data.business_id, toIsraelDateStr(new Date(data.starts_at)));
    } catch {
      // best-effort — never let a notification hiccup break the status change
    }
  }
}

export async function setBookingNoShow(id: string, noShow: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ no_show: noShow }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Cancels every future, non-cancelled booking in a recurring series.
 * Returns how many rows were cancelled. Scoped to businessId (RLS also
 * enforces this, but the explicit filter keeps the query itself correct).
 */
export async function cancelBookingSeries(
  recurrenceGroup: string,
  businessId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("recurrence_group", recurrenceGroup)
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("starts_at", new Date().toISOString())
    .select("id,starts_at");
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // Best-effort waitlist nudge for every distinct freed-up date in the series.
  const freedDates = Array.from(new Set(rows.map((r) => toIsraelDateStr(new Date(r.starts_at)))));
  for (const dateStr of freedDates) {
    try {
      await notifyWaitlistForDate(businessId, dateStr);
    } catch {
      // best-effort — a notification hiccup must never break series cancellation
    }
  }
  return rows.length;
}

/**
 * Blocks every slot in [from, to) on a given day (vacation / break).
 * Inserts 'blocked' rows; existing bookings keep their slot (duplicates skipped),
 * so the public widget simply stops offering the blocked times.
 */
export async function blockSlots(
  businessId: string,
  date: string,
  from: string,
  to: string,
  reason: string,
  staffId?: string | null,
): Promise<number> {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("booking_settings").select("slot_minutes")
    .eq("business_id", businessId).maybeSingle();
  const slotMs = (settings?.slot_minutes ?? 60) * 60_000;

  const start = zonedToUtc(date, from).getTime();
  const end = zonedToUtc(date, to).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) throw new Error("טווח שעות לא תקין");

  // staffId null/omitted blocks the whole business (staff_id null matches
  // every staff's busy-set query — see loadBusyIntervals); a uuid blocks only
  // that staff member.
  const rows = [];
  for (let t = start; t < end && rows.length < 100; t += slotMs) {
    rows.push({
      business_id: businessId,
      customer_name: reason || "חסימה",
      customer_phone: "-",
      starts_at: new Date(t).toISOString(),
      status: "blocked",
      staff_id: staffId ?? null,
    });
  }
  const { error } = await supabase
    .from("bookings")
    .upsert(rows, { onConflict: "business_id,staff_key,starts_at", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

/**
 * Removes a manual block (never touches real bookings). Matching by primary
 * key already disambiguates business-wide blocks (staff_id null) from
 * per-staff blocks — no extra staff filter needed.
 */
export async function unblockSlot(businessId: string, bookingId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings").delete()
    .eq("id", bookingId).eq("business_id", businessId).eq("status", "blocked");
  if (error) throw new Error(error.message);
}

// ── Public (service role, scoped to published sites) ───────────────────────
type PublicBookingCtx = { businessId: string; settings: BookingSettings };

async function publicCtx(slug: string): Promise<PublicBookingCtx | null> {
  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites").select("business_id")
    .eq("slug", slug).eq("published", true).maybeSingle();
  if (!website) return null;
  const { data: settings } = await s
    .from("booking_settings").select("*")
    .eq("business_id", website.business_id).eq("enabled", true).maybeSingle();
  if (!settings) return null;
  return { businessId: website.business_id, settings };
}

/** Public booking info: open days in the window + the bookable service list. */
export async function getPublicBookingInfo(slug: string): Promise<{
  days: { date: string; label: string }[];
  services: PublicBookingService[];
  staff: PublicBookingStaff[];
  staffServices: Record<string, string[]>;
} | null> {
  const ctx = await publicCtx(slug);
  if (!ctx) return null;
  const hours = (ctx.settings.hours as WeeklyHours | null) ?? DEFAULT_HOURS;

  const days: { date: string; label: string }[] = [];
  const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const fmtLabel = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric" });
  for (let i = 0; i < ctx.settings.days_ahead && days.length < 21; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    const dateStr = fmtDate.format(d);
    if (hours[weekdayOf(dateStr)]) {
      days.push({ date: dateStr, label: fmtLabel.format(d) });
    }
  }

  const s = createServiceRoleClient();
  const { data: rows } = await s
    .from("booking_services")
    .select("id,name,duration_minutes,price")
    .eq("business_id", ctx.businessId)
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  let services: PublicBookingService[];
  if (rows && rows.length > 0) {
    services = rows.map((r) => ({
      id: r.id,
      name: r.name,
      durationMinutes: r.duration_minutes,
      price: r.price,
    }));
  } else {
    // Legacy fallback: plain name list from booking_settings.services JSON.
    const names = ((ctx.settings.services as string[] | null) ?? []).filter(Boolean);
    services = names.map((name) => ({
      id: null,
      name,
      durationMinutes: ctx.settings.slot_minutes,
      price: null,
    }));
  }

  const { data: staffRows } = await s
    .from("booking_staff")
    .select("id,name,role_title,color")
    .eq("business_id", ctx.businessId)
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  const staff: PublicBookingStaff[] = (staffRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    roleTitle: r.role_title,
    color: r.color,
  }));

  let staffServices: Record<string, string[]> = {};
  if (staff.length > 0) {
    const { data: staffServiceRows } = await s
      .from("booking_staff_services")
      .select("staff_id,service_id")
      .eq("business_id", ctx.businessId);
    staffServices = buildStaffServiceMap(staffServiceRows);
    for (const st of staff) staffServices[st.id] ??= []; // no rows = all services
  }

  return { days, services, staff, staffServices };
}

/** Resolves a service by id for a given business (must be active). Service role. */
async function resolveActiveService(
  businessId: string,
  serviceId: string,
): Promise<BookingService | null> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("booking_services")
    .select("*")
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .eq("active", true)
    .maybeSingle();
  return data;
}

/** One booking's occupied interval, buffer-expanded on both sides. */
type BusyInterval = { start: number; end: number };

async function loadBusyIntervals(
  businessId: string,
  dayStartMs: number,
  dayEndMs: number,
  bufferMs: number,
  excludeBookingId?: string,
  staffId?: string | null,
): Promise<BusyInterval[]> {
  const s = createServiceRoleClient();
  let query = s
    .from("bookings")
    .select("id,starts_at,ends_at,duration_minutes")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    // Widen the window so bookings that start before the day but end inside
    // it (or start inside but were fetched near the boundary) aren't missed.
    .gte("starts_at", new Date(dayStartMs - 12 * 3600_000).toISOString())
    .lt("starts_at", new Date(dayEndMs).toISOString());
  if (excludeBookingId) query = query.neq("id", excludeBookingId);
  // Busy set for a specific staff member also includes null-staff bookings
  // (business-wide blocks / legacy bookings block everyone).
  if (staffId) query = query.or(`staff_id.eq.${staffId},staff_id.is.null`);
  const { data } = await query;

  return (data ?? []).map((b) => {
    const start = new Date(b.starts_at).getTime();
    const end = b.ends_at
      ? new Date(b.ends_at).getTime()
      : start + (b.duration_minutes ?? 30) * 60_000;
    return { start: start - bufferMs, end: end + bufferMs };
  });
}

function intersects(aStart: number, aEnd: number, b: BusyInterval): boolean {
  return aStart < b.end && aEnd > b.start;
}

/** Parses a day's optional break window into a busy interval, if present. */
function breakInterval(
  dateStr: string,
  day: { breakFrom?: string; breakTo?: string } | null | undefined,
): BusyInterval | null {
  if (!day?.breakFrom || !day?.breakTo) return null;
  if (!/^\d{2}:\d{2}$/.test(day.breakFrom) || !/^\d{2}:\d{2}$/.test(day.breakTo)) return null;
  const start = zonedToUtc(dateStr, day.breakFrom).getTime();
  const end = zonedToUtc(dateStr, day.breakTo).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  return { start, end };
}

/**
 * Free start times ("HH:MM", Israel time) for a given day + optional service.
 * Duration/overlap aware — see slotsForDayStepped. Steps by the business's
 * configured slot_minutes (not the service duration) so start-time
 * granularity matches what the owner set, while the *window checked* still
 * uses the service's actual duration.
 */
export async function getPublicSlots(
  slug: string,
  dateStr: string,
  serviceId?: string | null,
  staffId?: string | null,
): Promise<string[] | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const ctx = await publicCtx(slug);
  if (!ctx) return null;

  const hours = (ctx.settings.hours as WeeklyHours | null) ?? DEFAULT_HOURS;

  let durationMinutes = ctx.settings.slot_minutes;
  if (serviceId) {
    const service = await resolveActiveService(ctx.businessId, serviceId);
    if (!service) return []; // unknown/inactive service — nothing bookable
    durationMinutes = service.duration_minutes;
  }

  const s = createServiceRoleClient();
  const { data: staffRows } = await s
    .from("booking_staff")
    .select("id,hours")
    .eq("business_id", ctx.businessId)
    .eq("active", true);
  const staffList = staffRows ?? [];

  if (staffList.length === 0) {
    // No staff configured for this business — today's single-resource behavior.
    return slotsForDayStepped(
      ctx.businessId,
      dateStr,
      hours,
      durationMinutes,
      ctx.settings.slot_minutes,
      ctx.settings.buffer_minutes ?? 0,
      ctx.settings.min_notice_hours ?? 0,
      true,
    );
  }

  let staffServiceMap: Record<string, string[]> = {};
  if (serviceId) {
    const { data: rows } = await s
      .from("booking_staff_services")
      .select("staff_id,service_id")
      .eq("business_id", ctx.businessId);
    staffServiceMap = buildStaffServiceMap(rows);
  }

  const requestedStaffId = staffId && staffId !== STAFF_ANY ? staffId : null;
  if (requestedStaffId) {
    const staff = staffList.find((st) => st.id === requestedStaffId);
    if (!staff) return []; // unknown/inactive staff — nothing bookable
    if (serviceId && !isStaffEligible(staff.id, serviceId, staffServiceMap)) return [];
    return slotsForDayStepped(
      ctx.businessId,
      dateStr,
      staffWeeklyHours(staff, hours),
      durationMinutes,
      ctx.settings.slot_minutes,
      ctx.settings.buffer_minutes ?? 0,
      ctx.settings.min_notice_hours ?? 0,
      true,
      staff.id,
    );
  }

  // "any"/no preference — union of slots across every eligible active staff.
  const eligible = staffList.filter((st) => !serviceId || isStaffEligible(st.id, serviceId, staffServiceMap));
  if (eligible.length === 0) return [];
  const lists = await Promise.all(
    eligible.map((st) =>
      slotsForDayStepped(
        ctx.businessId,
        dateStr,
        staffWeeklyHours(st, hours),
        durationMinutes,
        ctx.settings.slot_minutes,
        ctx.settings.buffer_minutes ?? 0,
        ctx.settings.min_notice_hours ?? 0,
        true,
        st.id,
      ),
    ),
  );
  return unionSortedSlots(lists);
}

/**
 * Same search as slotsForDay, but steps candidate starts by `stepMinutes`
 * (the business's slot granularity) rather than the service's own duration —
 * this is what makes e.g. a 90-minute service still offer starts every 30
 * minutes instead of only every 90. An optional staffId scopes the busy-set
 * check to that staff member (plus null-staff/business-wide blocks).
 */
async function slotsForDayStepped(
  businessId: string,
  dateStr: string,
  hours: WeeklyHours,
  durationMinutes: number,
  stepMinutes: number,
  bufferMinutes: number,
  minNoticeHours: number,
  respectMinNotice: boolean,
  staffId?: string | null,
): Promise<string[]> {
  const day = hours[weekdayOf(dateStr)];
  if (!day) return [];

  const durationMs = durationMinutes * 60_000;
  const slotMs = Math.max(1, stepMinutes) * 60_000;
  const bufferMs = bufferMinutes * 60_000;

  const openMs = zonedToUtc(dateStr, day.open).getTime();
  const closeMs = zonedToUtc(dateStr, day.close).getTime();
  if (isNaN(openMs) || isNaN(closeMs) || closeMs <= openMs) return [];

  const busy = await loadBusyIntervals(businessId, openMs, closeMs, bufferMs, undefined, staffId);
  const brk = breakInterval(dateStr, day);
  if (brk) busy.push(brk);

  const minStart = respectMinNotice ? minBookableFrom(minNoticeHours) : Date.now();
  const fmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  const slots: string[] = [];
  for (let t = openMs; t + durationMs <= closeMs; t += slotMs) {
    if (t < minStart) continue;
    const candidateEnd = t + durationMs;
    if (busy.some((b) => intersects(t, candidateEnd, b))) continue;
    slots.push(fmt.format(new Date(t)));
  }
  return slots;
}

/**
 * Owner-side availability for the manual-booking form: same overlap/buffer/
 * break logic as the public flow, but scoped by businessId (works even when
 * the site isn't published) and without the min-notice restriction — the
 * owner is booking a walk-in/phone customer right now.
 */
export async function getOwnerAvailableSlots(
  businessId: string,
  dateStr: string,
  serviceId?: string | null,
  staffId?: string | null,
): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("hours,slot_minutes,buffer_minutes")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!settings) return [];

  const hours = (settings.hours as WeeklyHours | null) ?? DEFAULT_HOURS;
  let durationMinutes = settings.slot_minutes;
  if (serviceId) {
    const { data: service } = await supabase
      .from("booking_services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!service) return [];
    durationMinutes = service.duration_minutes;
  }

  const { data: staffRows } = await supabase
    .from("booking_staff")
    .select("id,hours")
    .eq("business_id", businessId)
    .eq("active", true);
  const staffList = staffRows ?? [];

  if (staffList.length === 0) {
    return slotsForDayStepped(
      businessId,
      dateStr,
      hours,
      durationMinutes,
      settings.slot_minutes,
      settings.buffer_minutes ?? 0,
      0,
      false,
    );
  }

  let staffServiceMap: Record<string, string[]> = {};
  if (serviceId) {
    const { data: rows } = await supabase
      .from("booking_staff_services")
      .select("staff_id,service_id")
      .eq("business_id", businessId);
    staffServiceMap = buildStaffServiceMap(rows);
  }

  const requestedStaffId = staffId && staffId !== STAFF_ANY ? staffId : null;
  if (requestedStaffId) {
    const staff = staffList.find((st) => st.id === requestedStaffId);
    if (!staff) return [];
    if (serviceId && !isStaffEligible(staff.id, serviceId, staffServiceMap)) return [];
    return slotsForDayStepped(
      businessId,
      dateStr,
      staffWeeklyHours(staff, hours),
      durationMinutes,
      settings.slot_minutes,
      settings.buffer_minutes ?? 0,
      0,
      false,
      staff.id,
    );
  }

  const eligible = staffList.filter((st) => !serviceId || isStaffEligible(st.id, serviceId, staffServiceMap));
  if (eligible.length === 0) return [];
  const lists = await Promise.all(
    eligible.map((st) =>
      slotsForDayStepped(
        businessId,
        dateStr,
        staffWeeklyHours(st, hours),
        durationMinutes,
        settings.slot_minutes,
        settings.buffer_minutes ?? 0,
        0,
        false,
        st.id,
      ),
    ),
  );
  return unionSortedSlots(lists);
}

/** Re-verifies a single [start, start+duration) slot is still free (service role). */
async function isSlotFree(
  businessId: string,
  startMs: number,
  durationMinutes: number,
  bufferMinutes: number,
  excludeBookingId?: string,
  staffId?: string | null,
): Promise<boolean> {
  const durationMs = durationMinutes * 60_000;
  const bufferMs = bufferMinutes * 60_000;
  const busy = await loadBusyIntervals(
    businessId,
    startMs - 24 * 3600_000,
    startMs + durationMs + 24 * 3600_000,
    bufferMs,
    excludeBookingId,
    staffId,
  );
  return !busy.some((b) => intersects(startMs, startMs + durationMs, b));
}

/** Bookings-per-staff count for a calendar day (Israel time). */
async function countBookingsPerStaffOnDate(
  businessId: string,
  dateStr: string,
): Promise<Record<string, number>> {
  const s = createServiceRoleClient();
  const dayStart = zonedToUtc(dateStr, "00:00").getTime();
  const dayEnd = zonedToUtc(addDaysToDateStr(dateStr, 1), "00:00").getTime();
  const { data } = await s
    .from("bookings")
    .select("staff_id")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("starts_at", new Date(dayStart).toISOString())
    .lt("starts_at", new Date(dayEnd).toISOString());
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.staff_id) counts[row.staff_id] = (counts[row.staff_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Among candidate staff, keeps only those free for [startMs, +duration) and
 * orders the rest by fewest bookings that day — used to auto-assign "any
 * available staff" bookings so load spreads evenly across the team.
 */
async function rankFreeStaffByLoad(
  businessId: string,
  candidates: { id: string; name: string }[],
  startMs: number,
  durationMinutes: number,
  bufferMinutes: number,
  dateStr: string,
): Promise<{ id: string; name: string }[]> {
  const counts = await countBookingsPerStaffOnDate(businessId, dateStr);
  const free: Array<{ id: string; name: string; count: number }> = [];
  for (const c of candidates) {
    if (await isSlotFree(businessId, startMs, durationMinutes, bufferMinutes, undefined, c.id)) {
      free.push({ ...c, count: counts[c.id] ?? 0 });
    }
  }
  free.sort((a, b) => a.count - b.count);
  return free.map(({ id, name }) => ({ id, name }));
}

export type CreateBookingInput = {
  name: string;
  phone: string;
  email?: string | null;
  service?: string | null; // legacy free-text fallback (no serviceId)
  serviceId?: string | null;
  staffId?: string | null; // uuid = that staff; STAFF_ANY/null/undefined = no preference
  date: string;
  time: string;
  notes?: string | null;
  recurrence?: BookingRecurrence | null;
  customerUserId?: string | null;
};

export type CreateBookingResult = {
  ok: boolean;
  error?: string;
  cancelToken?: string;
  occurrences?: number;
  /** For recurring series: how many of the up-to-8 candidate dates were skipped due to a conflict. */
  skippedOccurrences?: number;
  /** Name of the staff member actually assigned (null when the business has no staff). */
  staffName?: string | null;
};

/**
 * Creates a booking (+ optional recurring series) and CRM lead/task
 * side-effects. Unique constraint guards double-booking races; an explicit
 * overlap re-check (duration + buffer aware) runs before insert since the
 * unique index alone doesn't catch overlapping-but-not-identical starts.
 */
export async function createPublicBooking(
  slug: string,
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const ctx = await publicCtx(slug);
  if (!ctx) return { ok: false, error: "קביעת תורים אינה זמינה" };

  const startsAt = zonedToUtc(input.date, input.time);
  const minStart = minBookableFrom(ctx.settings.min_notice_hours ?? 0);
  if (isNaN(startsAt.getTime()) || startsAt.getTime() < minStart) {
    return { ok: false, error: "מועד לא תקין" };
  }

  // Resolve the service (must belong to this business + be active); null is
  // allowed for legacy/name-only bookings, defaulting duration to slot_minutes.
  let service: BookingService | null = null;
  if (input.serviceId) {
    service = await resolveActiveService(ctx.businessId, input.serviceId);
    if (!service) return { ok: false, error: "השירות שנבחר אינו זמין יותר — בחרו שוב" };
  }
  const durationMinutes = service?.duration_minutes ?? ctx.settings.slot_minutes;
  const bufferMinutes = ctx.settings.buffer_minutes ?? 0;
  const serviceName = service?.name ?? input.service ?? null;

  // Self-service: when auto_confirm is on, the booking is confirmed instantly
  // (no owner approval) and the slot is taken immediately.
  const autoConfirm = ctx.settings.auto_confirm === true;
  const s = createServiceRoleClient();

  // Staff resolution — once for the whole series (recurring occurrences reuse
  // the same staff member). Businesses without staff keep staff_id null.
  const { data: staffRows } = await s
    .from("booking_staff")
    .select("id,name")
    .eq("business_id", ctx.businessId)
    .eq("active", true);
  const staffList = staffRows ?? [];
  let resolvedStaffId: string | null = null;
  let resolvedStaffName: string | null = null;
  // Remaining eligible candidates (fewest-bookings-first) for the one-time
  // 23505 retry when the "any staff" pick loses the race on the first occurrence.
  let staffFallbackQueue: string[] = [];

  if (staffList.length > 0) {
    let staffServiceMap: Record<string, string[]> = {};
    if (service) {
      const { data: rows } = await s
        .from("booking_staff_services")
        .select("staff_id,service_id")
        .eq("business_id", ctx.businessId);
      staffServiceMap = buildStaffServiceMap(rows);
    }
    const requestedStaffId = input.staffId && input.staffId !== STAFF_ANY ? input.staffId : null;

    if (requestedStaffId) {
      const staff = staffList.find((st) => st.id === requestedStaffId);
      if (!staff) return { ok: false, error: "איש הצוות שנבחר אינו זמין" };
      if (service && !isStaffEligible(staff.id, service.id, staffServiceMap)) {
        return { ok: false, error: "איש הצוות שנבחר אינו מבצע את השירות הזה" };
      }
      resolvedStaffId = staff.id;
      resolvedStaffName = staff.name;
    } else {
      const candidates = staffList.filter((st) => !service || isStaffEligible(st.id, service.id, staffServiceMap));
      if (candidates.length === 0) return { ok: false, error: "אין איש צוות זמין לשירות זה" };
      const ranked = await rankFreeStaffByLoad(ctx.businessId, candidates, startsAt.getTime(), durationMinutes, bufferMinutes, input.date);
      if (ranked.length === 0) return { ok: false, error: "התור הזה בדיוק נתפס — בחרו שעה אחרת" };
      resolvedStaffId = ranked[0].id;
      resolvedStaffName = ranked[0].name;
      staffFallbackQueue = ranked.slice(1).map((r) => r.id);
    }
  }

  // Build the occurrence dates (single booking, or up to 8 for a recurring series).
  const occurrenceDates = [input.date];
  if (input.recurrence) {
    const step = RECURRENCE_STEP_DAYS[input.recurrence];
    let cursor = input.date;
    while (occurrenceDates.length < RECURRENCE_MAX_OCCURRENCES) {
      cursor = addDaysToDateStr(cursor, step);
      occurrenceDates.push(cursor);
    }
  }
  const recurrenceGroup = input.recurrence ? crypto.randomUUID() : null;

  const insertOccurrence = (occStart: Date, endsAt: Date, staffIdForRow: string | null) =>
    s
      .from("bookings")
      .insert({
        business_id: ctx.businessId,
        customer_name: input.name,
        customer_phone: input.phone,
        customer_email: input.email ?? null,
        service: serviceName,
        service_id: service?.id ?? null,
        staff_id: staffIdForRow,
        duration_minutes: durationMinutes,
        starts_at: occStart.toISOString(),
        ends_at: endsAt.toISOString(),
        status: autoConfirm ? "confirmed" : "pending",
        notes: input.notes?.trim().slice(0, 500) || null,
        recurrence: input.recurrence ?? null,
        recurrence_group: recurrenceGroup,
        customer_user_id: input.customerUserId ?? null,
      })
      .select("id,cancel_token")
      .single();

  let firstCancelToken: string | undefined;
  let firstBookingId: string | undefined;
  let firstOccStart: Date | undefined;
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < occurrenceDates.length; i++) {
    const dateStr = occurrenceDates[i];
    const occStart = dateStr === input.date ? startsAt : zonedToUtc(dateStr, input.time);
    if (isNaN(occStart.getTime())) {
      skipped++;
      continue;
    }
    const occStartMs = occStart.getTime();
    if (occStartMs < minStart) {
      skipped++;
      continue;
    }
    const free = await isSlotFree(ctx.businessId, occStartMs, durationMinutes, bufferMinutes, undefined, resolvedStaffId);
    if (!free) {
      skipped++;
      continue;
    }

    const endsAt = new Date(occStartMs + durationMinutes * 60_000);
    const { data: row, error } = await insertOccurrence(occStart, endsAt, resolvedStaffId);

    if (error) {
      // Race lost against the unique constraint — treat as "slot just taken".
      if (error.code === "23505") {
        // For the first occurrence of an "any staff" pick, try the next-best
        // eligible candidate once before giving up on this occurrence.
        if (i === 0 && staffFallbackQueue.length > 0) {
          const nextId = staffFallbackQueue.shift()!;
          const nextFree = await isSlotFree(ctx.businessId, occStartMs, durationMinutes, bufferMinutes, undefined, nextId);
          if (nextFree) {
            const { data: row2, error: error2 } = await insertOccurrence(occStart, endsAt, nextId);
            if (!error2) {
              resolvedStaffId = nextId;
              resolvedStaffName = staffList.find((st) => st.id === nextId)?.name ?? null;
              created++;
              if (!firstCancelToken) {
                firstCancelToken = row2.cancel_token;
                firstBookingId = row2.id;
                firstOccStart = occStart;
              }
              continue;
            }
          }
        }
        skipped++;
        continue;
      }
      if (created === 0) return { ok: false, error: "השמירה נכשלה — נסו שוב" };
      skipped++;
      continue;
    }

    created++;
    if (!firstCancelToken) {
      firstCancelToken = row.cancel_token;
      firstBookingId = row.id;
      firstOccStart = occStart;
    }
  }

  if (created === 0) {
    return { ok: false, error: "התור הזה בדיוק נתפס — בחרו שעה אחרת" };
  }

  // Fire-and-forget automation trigger (e.g. WhatsApp/email flows) — never
  // throws and no-ops when nothing is configured for this business.
  if (firstBookingId && firstOccStart) {
    void fireAutomations(ctx.businessId, "booking_created", {
      bookingId: firstBookingId,
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email ?? null,
      serviceName,
      startsAt: firstOccStart.toISOString(),
    });
    // Instant owner (+ assigned staff) alert — fire-and-forget, never throws.
    void notifyNewBooking(ctx.businessId, {
      id: firstBookingId,
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email ?? null,
      serviceName,
      startsAt: firstOccStart.toISOString(),
      staffId: resolvedStaffId,
    });
  }

  const isSeries = Boolean(recurrenceGroup);
  const firstLabel = `${input.date} ${input.time}`;
  const seriesSuffix = isSeries ? ` (סדרה של ${created} תורים)` : "";

  // Best-effort confirmation email — never blocks or fails the booking itself.
  if (input.email && firstCancelToken && firstOccStart) {
    const { data: business } = await s
      .from("businesses").select("name").eq("id", ctx.businessId).maybeSingle();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const dateFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
    void notifyBookingCreated({
      email: input.email,
      businessName: business?.name ?? "העסק",
      serviceName: serviceName,
      dateText: dateFmt.format(firstOccStart),
      timeText: timeFmt.format(firstOccStart),
      cancelUrl: `${appUrl}/cancel/${firstCancelToken}`,
      pending: !autoConfirm,
      staffId: resolvedStaffId,
    });
  }

  // CRM task: a heads-up when auto-confirmed, or an approval task otherwise.
  // One task for the whole series, not one per occurrence.
  await s.from("crm_tasks").insert({
    business_id: ctx.businessId,
    title: isSeries
      ? `סדרת תורים קבועה: ${input.name} — החל מ-${firstLabel}${serviceName ? ` (${serviceName})` : ""}${seriesSuffix}`
      : autoConfirm
        ? `תור חדש נקבע: ${input.name} — ${firstLabel}${serviceName ? ` (${serviceName})` : ""}`
        : `לאשר תור: ${input.name} — ${firstLabel}${serviceName ? ` (${serviceName})` : ""}`,
    priority: autoConfirm && !isSeries ? "medium" : "high",
    due_date: input.date,
  });

  // Remember the shopper's details on their account (fill-only-if-empty) so
  // the next booking is prefilled — the system "knows" returning customers.
  if (input.customerUserId) {
    try {
      const { data: prof } = await s
        .from("customer_profiles").select("full_name, phone")
        .eq("id", input.customerUserId).maybeSingle();
      const fullName = prof?.full_name || input.name;
      const phone = prof?.phone || input.phone;
      if (fullName !== prof?.full_name || phone !== prof?.phone) {
        await s.from("customer_profiles").upsert(
          { id: input.customerUserId, full_name: fullName, phone, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
      }
    } catch {
      // best-effort — never blocks the booking
    }
  }

  // Mirror into CRM as a lead (dedupe by phone).
  const { data: existing } = await s
    .from("crm_leads").select("id")
    .eq("business_id", ctx.businessId).eq("phone", input.phone).maybeSingle();
  if (!existing) {
    await s.from("crm_leads").insert({
      business_id: ctx.businessId,
      name: input.name,
      phone: input.phone,
      status: "new",
      source: "booking",
      notes: `קבע/ה תור ל-${firstLabel}${serviceName ? ` (${serviceName})` : ""}${seriesSuffix}`,
    });
  }

  return {
    ok: true,
    cancelToken: firstCancelToken,
    occurrences: isSeries ? created : undefined,
    skippedOccurrences: isSeries && skipped > 0 ? skipped : undefined,
    staffName: resolvedStaffName,
  };
}

// ── Owner: manual booking (walk-in / phone) ─────────────────────────────────

export type CreateOwnerBookingInput = {
  date: string;
  time: string;
  serviceId?: string | null;
  staffId?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
};

/**
 * Owner-created booking (walk-in / phone call): same availability validation
 * as the public flow, but always inserted as 'confirmed' and without CRM
 * lead/task side-effects (the owner already knows about it).
 */
export async function createOwnerBooking(
  businessId: string,
  input: CreateOwnerBookingInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_minutes,buffer_minutes")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!settings) return { ok: false, error: "הגדרות היומן לא נמצאו" };

  const startsAt = zonedToUtc(input.date, input.time);
  if (isNaN(startsAt.getTime())) return { ok: false, error: "מועד לא תקין" };

  let durationMinutes = settings.slot_minutes;
  let serviceName: string | null = null;
  let resolvedServiceId: string | null = null;
  if (input.serviceId) {
    const { data: service } = await supabase
      .from("booking_services")
      .select("*")
      .eq("id", input.serviceId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!service) return { ok: false, error: "השירות לא נמצא" };
    durationMinutes = service.duration_minutes;
    serviceName = service.name;
    resolvedServiceId = service.id;
  }

  const bufferMinutes = settings.buffer_minutes ?? 0;

  // Staff resolution — businesses without configured staff keep today's
  // single-resource behavior (staff_id stays null).
  const { data: staffRows } = await supabase
    .from("booking_staff")
    .select("id,name")
    .eq("business_id", businessId)
    .eq("active", true);
  const staffList = staffRows ?? [];
  let resolvedStaffId: string | null = null;

  if (staffList.length > 0) {
    let staffServiceMap: Record<string, string[]> = {};
    if (resolvedServiceId) {
      const { data: rows } = await supabase
        .from("booking_staff_services")
        .select("staff_id,service_id")
        .eq("business_id", businessId);
      staffServiceMap = buildStaffServiceMap(rows);
    }
    const requestedStaffId = input.staffId && input.staffId !== STAFF_ANY ? input.staffId : null;

    if (requestedStaffId) {
      const staff = staffList.find((st) => st.id === requestedStaffId);
      if (!staff) return { ok: false, error: "איש הצוות לא נמצא" };
      if (resolvedServiceId && !isStaffEligible(staff.id, resolvedServiceId, staffServiceMap)) {
        return { ok: false, error: "איש הצוות שנבחר אינו מבצע את השירות הזה" };
      }
      resolvedStaffId = staff.id;
    } else {
      const candidates = staffList.filter((st) => !resolvedServiceId || isStaffEligible(st.id, resolvedServiceId, staffServiceMap));
      if (candidates.length === 0) return { ok: false, error: "אין איש צוות זמין לשירות זה" };
      const ranked = await rankFreeStaffByLoad(businessId, candidates, startsAt.getTime(), durationMinutes, bufferMinutes, input.date);
      if (ranked.length === 0) return { ok: false, error: "השעה הזו כבר תפוסה" };
      resolvedStaffId = ranked[0].id;
    }
  }

  const free = await isSlotFree(businessId, startsAt.getTime(), durationMinutes, bufferMinutes, undefined, resolvedStaffId);
  if (!free) return { ok: false, error: "השעה הזו כבר תפוסה" };

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const { data: inserted, error } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name: input.name,
      customer_phone: input.phone,
      customer_email: input.email ?? null,
      service: serviceName,
      service_id: resolvedServiceId,
      staff_id: resolvedStaffId,
      duration_minutes: durationMinutes,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      notes: input.notes?.trim().slice(0, 500) || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "השעה הזו כבר תפוסה" };
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }

  // Fire-and-forget automation trigger — never throws, no-op when unconfigured.
  if (inserted) {
    void fireAutomations(businessId, "booking_created", {
      bookingId: inserted.id,
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email ?? null,
      serviceName,
      startsAt: startsAt.toISOString(),
    });
    // Instant owner (+ assigned staff) alert — fire-and-forget, never throws.
    void notifyNewBooking(businessId, {
      id: inserted.id,
      customerName: input.name,
      customerPhone: input.phone,
      customerEmail: input.email ?? null,
      serviceName,
      startsAt: startsAt.toISOString(),
      staffId: resolvedStaffId,
    });
  }
  return { ok: true };
}

// ── Self-service cancellation (by cancel_token) ─────────────────────────────

/** A booking can be cancelled up to N hours before it starts (default 2 — see cancel_notice_hours). */
export const MIN_CANCEL_NOTICE_MS = 2 * 3600_000;

export type CancelTokenBooking = {
  id: string;
  starts_at: string;
  status: string;
  service: string | null;
  customer_name: string;
  businessName: string;
  cancelNoticeHours: number;
};

/** Looks up a booking by its cancel token (service role — public flow). */
export async function getBookingByCancelToken(
  token: string,
): Promise<CancelTokenBooking | null> {
  const s = createServiceRoleClient();
  const { data: booking } = await s
    .from("bookings")
    .select("id,business_id,starts_at,status,service,customer_name")
    .eq("cancel_token", token)
    .neq("status", "blocked")
    .maybeSingle();
  if (!booking) return null;

  const [{ data: business }, { data: settings }] = await Promise.all([
    s.from("businesses").select("name").eq("id", booking.business_id).maybeSingle(),
    s.from("booking_settings").select("cancel_notice_hours").eq("business_id", booking.business_id).maybeSingle(),
  ]);

  return {
    id: booking.id,
    starts_at: booking.starts_at,
    status: booking.status,
    service: booking.service,
    customer_name: booking.customer_name,
    businessName: business?.name ?? "העסק",
    cancelNoticeHours: settings?.cancel_notice_hours ?? 2,
  };
}

/**
 * Cancels a booking by token. Rules (also enforced in the UI):
 *  - unknown token → invalid link
 *  - already cancelled → explicit message
 *  - starts in less than the business's cancel-notice window (default 2h) → not allowed
 */
export async function cancelBookingByToken(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBookingByCancelToken(token);
  if (!booking) return { ok: false, error: "הקישור אינו תקף" };
  if (booking.status === "cancelled") {
    return { ok: false, error: "התור כבר בוטל" };
  }
  const noticeMs = booking.cancelNoticeHours * 3600_000;
  if (new Date(booking.starts_at).getTime() - Date.now() < noticeMs) {
    return { ok: false, error: "לא ניתן לבטל כה קרוב למועד התור — צרו קשר עם העסק" };
  }

  const s = createServiceRoleClient();
  const { data: cancelled, error } = await s
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id)
    .eq("cancel_token", token)
    .select("business_id")
    .maybeSingle();
  if (error) return { ok: false, error: "הביטול נכשל — נסו שוב" };

  // Owner heads-up in the CRM — the customer cancelled on their own.
  if (cancelled?.business_id) {
    const when = new Date(booking.starts_at);
    const label = new Intl.DateTimeFormat("he-IL", {
      timeZone: TZ,
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(when);
    const dueDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(when);
    await s.from("crm_tasks").insert({
      business_id: cancelled.business_id,
      title: `הלקוח ביטל תור: ${booking.customer_name} — ${label}${booking.service ? ` (${booking.service})` : ""}`,
      priority: "high",
      due_date: dueDate,
    });

    // Best-effort: nudge anyone waiting for a slot on this now-freed-up date.
    try {
      await notifyWaitlistForDate(cancelled.business_id, toIsraelDateStr(when));
    } catch {
      // best-effort — never let a notification hiccup break the cancellation
    }
  }
  return { ok: true };
}

// ── Owner: drag-to-reschedule (week view) ───────────────────────────────────

/**
 * Moves a booking to a new date/time, re-validating availability (duration +
 * buffer + staff-aware, same rules as new bookings). Never touches cancelled
 * or blocked rows.
 */
export async function rescheduleBooking(
  businessId: string,
  bookingId: string,
  dateStr: string,
  timeStr: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return { ok: false, error: "מועד לא תקין" };
  }
  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,duration_minutes,staff_id")
    .eq("id", bookingId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "התור לא נמצא" };
  if (booking.status === "cancelled") return { ok: false, error: "לא ניתן להזיז תור שבוטל" };
  if (booking.status === "blocked") return { ok: false, error: "לא ניתן לגרור חסימה — הזיזו מהיומן" };

  const newStart = zonedToUtc(dateStr, timeStr);
  if (isNaN(newStart.getTime())) return { ok: false, error: "מועד לא תקין" };

  const { data: settings } = await supabase
    .from("booking_settings")
    .select("buffer_minutes")
    .eq("business_id", businessId)
    .maybeSingle();
  const durationMinutes = booking.duration_minutes ?? 60;
  const bufferMinutes = settings?.buffer_minutes ?? 0;

  const free = await isSlotFree(businessId, newStart.getTime(), durationMinutes, bufferMinutes, bookingId, booking.staff_id);
  if (!free) return { ok: false, error: "המשבצת הזו תפוסה" };

  const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);
  const { error } = await supabase
    .from("bookings")
    .update({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() })
    .eq("id", bookingId)
    .eq("business_id", businessId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "המשבצת הזו תפוסה" };
    return { ok: false, error: "העדכון נכשל — נסו שוב" };
  }
  return { ok: true };
}

// ── Live ICS calendar feed (public, token-authenticated) ───────────────────

/**
 * Issues a fresh feed token for a business (invalidates any previously shared
 * feed URL). Upserts — a business that never saved booking settings gets a
 * defaults row created on the spot, so the calendar link works immediately.
 */
export async function regenerateIcsFeedToken(businessId: string): Promise<string> {
  const supabase = await createClient();
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("booking_settings")
    .upsert({ business_id: businessId, ics_feed_token: token }, { onConflict: "business_id" })
    .select("ics_feed_token")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("יצירת הקישור נכשלה — נסו שוב");
  return data.ics_feed_token;
}

/** Verifies a public feed token against booking_settings (service role — no user session). */
export async function verifyIcsFeedToken(businessId: string, token: string): Promise<boolean> {
  if (!token) return false;
  const s = createServiceRoleClient();
  const { data } = await s
    .from("booking_settings")
    .select("ics_feed_token")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data?.ics_feed_token) return false;
  // Constant-time compare — the token is the feed's only credential.
  const a = Buffer.from(data.ics_feed_token);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type FeedBooking = {
  id: string;
  customer_name: string;
  service: string | null;
  staff_id: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number | null;
  status: string;
};

/**
 * Upcoming, non-cancelled bookings for the public live ICS feed (service
 * role). Caller must have already verified the feed token.
 */
export async function getFeedBookings(businessId: string, staffId?: string | null): Promise<FeedBooking[]> {
  const s = createServiceRoleClient();
  let query = s
    .from("bookings")
    .select("id,customer_name,service,staff_id,starts_at,ends_at,duration_minutes,status")
    .eq("business_id", businessId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(400);
  if (staffId) query = query.eq("staff_id", staffId);
  const { data } = await query;
  return data ?? [];
}
