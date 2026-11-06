"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  upsertBookingSettings,
  setBookingStatus,
  setBookingNoShow,
  cancelBookingSeries,
  blockSlots,
  unblockSlot,
  getPublicSlots,
  getOwnerAvailableSlots,
  createPublicBooking,
  createOwnerBooking,
  listBookingsForMonth,
} from "@/lib/services/booking.service";
import { STAFF_ANY } from "@/lib/booking-shared";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { Booking, Json } from "@/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if a staffId param (uuid, STAFF_ANY, null, or undefined) is well-formed. */
function isValidStaffIdParam(staffId: string | null | undefined): boolean {
  return staffId == null || staffId === STAFF_ANY || UUID_RE.test(staffId);
}

// ── Owner actions ───────────────────────────────────────────────────────────

/** Owner: fetch a month's bookings for the monthly calendar view. */
export async function getMonthBookingsAction(
  businessId: string,
  year: number,
  month: number,
): Promise<{ bookings?: Booking[]; error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const bookings = await listBookingsForMonth(businessId, year, month);
    return { bookings };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת היומן נכשלה" };
  }
}

export async function saveBookingSettingsAction(
  businessId: string,
  data: {
    enabled: boolean;
    auto_confirm?: boolean;
    slot_minutes: number;
    days_ahead: number;
    hours: Record<string, { open: string; close: string; breakFrom?: string; breakTo?: string } | null>;
    services: string[];
    buffer_minutes?: number;
    min_notice_hours?: number;
    cancel_notice_hours?: number;
  },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    if (![15, 30, 45, 60, 90, 120].includes(data.slot_minutes)) {
      return { error: "אורך תור לא תקין" };
    }
    if (data.buffer_minutes != null && ![0, 5, 10, 15].includes(data.buffer_minutes)) {
      return { error: "זמן חיץ לא תקין" };
    }
    if (data.min_notice_hours != null && ![0, 1, 2, 4, 12, 24].includes(data.min_notice_hours)) {
      return { error: "זמן הודעה מוקדמת לא תקין" };
    }
    if (data.cancel_notice_hours != null && ![2, 4, 12, 24].includes(data.cancel_notice_hours)) {
      return { error: "זמן ביטול מוקדם לא תקין" };
    }
    await upsertBookingSettings(businessId, {
      enabled: data.enabled,
      auto_confirm: data.auto_confirm ?? false,
      slot_minutes: data.slot_minutes,
      days_ahead: Math.min(60, Math.max(1, data.days_ahead)),
      hours: data.hours as unknown as Json,
      services: data.services as unknown as Json,
      buffer_minutes: data.buffer_minutes,
      min_notice_hours: data.min_notice_hours,
      cancel_notice_hours: data.cancel_notice_hours,
    });
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function setBookingStatusAction(
  businessId: string,
  bookingId: string,
  status: "confirmed" | "cancelled",
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    await setBookingStatus(bookingId, status);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Owner: marks/unmarks a past booking as a no-show. */
export async function setNoShowAction(
  businessId: string,
  bookingId: string,
  noShow: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    await setBookingNoShow(bookingId, noShow);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Owner: cancels every future booking in a recurring series. */
export async function cancelSeriesAction(
  businessId: string,
  recurrenceGroup: string,
): Promise<{ cancelled?: number; error?: string }> {
  await requireUser();
  if (!UUID_RE.test(recurrenceGroup)) return { error: "סדרה לא תקינה" };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const cancelled = await cancelBookingSeries(recurrenceGroup, businessId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { cancelled };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ביטול הסדרה נכשל" };
  }
}

export async function blockSlotsAction(
  businessId: string,
  data: { date: string; from: string; to: string; reason: string },
  staffId?: string | null,
): Promise<{ blocked?: number; error?: string }> {
  await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { error: "תאריך לא תקין" };
  if (!/^\d{2}:\d{2}$/.test(data.from) || !/^\d{2}:\d{2}$/.test(data.to)) {
    return { error: "שעות לא תקינות" };
  }
  if (staffId != null && !UUID_RE.test(staffId)) return { error: "איש צוות לא תקין" };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const blocked = await blockSlots(
      businessId,
      data.date,
      data.from,
      data.to,
      data.reason.trim().slice(0, 80),
      staffId ?? null,
    );
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { blocked };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "החסימה נכשלה" };
  }
}

export async function unblockSlotAction(
  businessId: string,
  bookingId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    await unblockSlot(businessId, bookingId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Owner: available start times for the manual-booking form (no min-notice restriction). */
export async function getOwnerAvailableSlotsAction(
  businessId: string,
  date: string,
  serviceId?: string | null,
  staffId?: string | null,
): Promise<{ slots?: string[]; error?: string }> {
  await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "תאריך לא תקין" };
  if (serviceId != null && !UUID_RE.test(serviceId)) return { error: "שירות לא תקין" };
  if (!isValidStaffIdParam(staffId)) return { error: "איש צוות לא תקין" };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const slots = await getOwnerAvailableSlots(businessId, date, serviceId ?? null, staffId ?? null);
    return { slots };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת הזמינות נכשלה" };
  }
}

const ownerBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "שעה לא תקינה"),
  serviceId: z.string().regex(UUID_RE).optional().nullable(),
  staffId: z.string().uuid().or(z.literal(STAFF_ANY)).optional().nullable(),
  name: z.string().trim().min(2, "נא למלא שם").max(120),
  phone: z.string().trim().min(9, "נא למלא טלפון תקין").max(40),
  email: z.string().trim().email("אימייל לא תקין").max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});

/** Owner: manual booking for a walk-in / phone customer — always confirmed. */
export async function createOwnerBookingAction(
  businessId: string,
  input: { date: string; time: string; serviceId?: string | null; staffId?: string | null; name: string; phone: string; email?: string; notes?: string },
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const parsed = ownerBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const res = await createOwnerBooking(businessId, {
      date: parsed.data.date,
      time: parsed.data.time,
      serviceId: parsed.data.serviceId || null,
      staffId: parsed.data.staffId || null,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    });
    if (res.ok) revalidatePath(`/businesses/${businessId}/bookings`);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

// ── Public actions (anonymous visitors on /s/[slug]) ───────────────────────

export async function getPublicSlotsAction(
  slug: string,
  date: string,
  serviceId?: string | null,
  staffId?: string | null,
): Promise<{ slots?: string[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "תאריך לא תקין" };
  if (serviceId != null && !UUID_RE.test(serviceId)) return { error: "שירות לא תקין" };
  if (!isValidStaffIdParam(staffId)) return { error: "איש צוות לא תקין" };
  const slots = await getPublicSlots(slug, date, serviceId ?? null, staffId ?? null);
  if (slots === null) return { error: "קביעת תורים אינה זמינה" };
  return { slots };
}

const recurrenceSchema = z.enum(["weekly", "biweekly", "every4weeks"]);

const submitBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "שעה לא תקינה"),
  name: z.string().trim().min(2, "נא למלא שם").max(120),
  phone: z.string().trim().max(40),
  email: z.string().trim().email("אימייל לא תקין").max(160).optional().or(z.literal("")),
  service: z.string().trim().max(120).optional(),
  serviceId: z.string().regex(UUID_RE).optional().nullable(),
  staffId: z.string().uuid().or(z.literal(STAFF_ANY)).optional().nullable(),
  notes: z.string().trim().max(500).optional(),
  recurrence: recurrenceSchema.optional().nullable(),
  company_website: z.string().optional(), // honeypot
});

export async function submitBookingAction(
  slug: string,
  input: {
    name: string;
    phone: string;
    email?: string;
    service?: string;
    serviceId?: string | null;
    staffId?: string | null;
    date: string;
    time: string;
    notes?: string;
    recurrence?: "weekly" | "biweekly" | "every4weeks" | null;
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string; cancelToken?: string; occurrences?: number; skippedOccurrences?: number; staffName?: string | null }> {
  if (input.company_website) return { ok: true }; // bot — pretend success

  if (!(await checkRateLimit(`book:${slug}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const parsed = submitBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  const data = parsed.data;
  if (data.phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }

  // Link the booking to the signed-in storefront shopper, if any — best-effort.
  let customerUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    customerUserId = user?.id ?? null;
  } catch {
    // not signed in / no session — anonymous booking, unaffected
  }

  return createPublicBooking(slug, {
    name: data.name,
    phone: data.phone,
    email: data.email || null,
    service: data.service || null,
    serviceId: data.serviceId || null,
    staffId: data.staffId || null,
    date: data.date,
    time: data.time,
    notes: data.notes || null,
    recurrence: data.recurrence || null,
    customerUserId,
  });
}
