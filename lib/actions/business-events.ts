"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  listBusinessEventsRange,
  listBusinessEventsForMonth,
  createBusinessEvent,
  updateBusinessEvent,
  deleteBusinessEvent,
} from "@/lib/services/business-events.service";
import { rescheduleBooking, regenerateIcsFeedToken } from "@/lib/services/booking.service";
import { zonedToUtc } from "@/lib/booking-shared";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { BusinessEvent, TablesUpdate } from "@/types/database";

function rev(businessId: string) {
  revalidatePath(`/businesses/${businessId}/bookings`);
}

async function gate(businessId: string): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "אין גישה" };
  }
}

export async function listBusinessEventsAction(
  businessId: string,
): Promise<{ events?: BusinessEvent[]; error?: string }> {
  await requireUser();
  try {
    const events = await listBusinessEventsRange(businessId);
    return { events };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת האירועים נכשלה" };
  }
}

export async function getMonthBusinessEventsAction(
  businessId: string,
  year: number,
  month: number,
): Promise<{ events?: BusinessEvent[]; error?: string }> {
  await requireUser();
  try {
    const events = await listBusinessEventsForMonth(businessId, year, month);
    return { events };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "טעינת האירועים נכשלה" };
  }
}

const eventSchema = z.object({
  title: z.string().trim().min(1, "נא למלא כותרת").max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "שעה לא תקינה"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "שעה לא תקינה"),
  staffId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function createBusinessEventAction(
  businessId: string,
  input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    staffId?: string | null;
    notes?: string | null;
  },
): Promise<{ error?: string }> {
  const g = await gate(businessId);
  if (g.error) return g;
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const startsAt = zonedToUtc(parsed.data.date, parsed.data.startTime);
  const endsAt = zonedToUtc(parsed.data.date, parsed.data.endTime);
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { error: "טווח שעות לא תקין" };
  }

  try {
    await createBusinessEvent(businessId, {
      title: parsed.data.title,
      staff_id: parsed.data.staffId || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      notes: parsed.data.notes?.trim().slice(0, 500) || null,
    });
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שמירת האירוע נכשלה" };
  }
}

export async function updateBusinessEventAction(
  businessId: string,
  eventId: string,
  input: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    staffId?: string | null;
    notes?: string | null;
  },
): Promise<{ error?: string }> {
  const g = await gate(businessId);
  if (g.error) return g;

  const fields: TablesUpdate<"business_events"> = {};
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 160);
    if (!title) return { error: "נא למלא כותרת" };
    fields.title = title;
  }
  if (input.staffId !== undefined) fields.staff_id = input.staffId || null;
  if (input.notes !== undefined) fields.notes = input.notes?.trim().slice(0, 500) || null;
  if (input.date && input.startTime) {
    const startsAt = zonedToUtc(input.date, input.startTime);
    if (isNaN(startsAt.getTime())) return { error: "מועד לא תקין" };
    fields.starts_at = startsAt.toISOString();
  }
  if (input.date && input.endTime) {
    const endsAt = zonedToUtc(input.date, input.endTime);
    if (isNaN(endsAt.getTime())) return { error: "מועד לא תקין" };
    fields.ends_at = endsAt.toISOString();
  }
  // Guard the range whenever both ends of the edited event are known (the
  // dialog always submits date+startTime+endTime together) — createBusinessEvent
  // enforces this too; updateBusinessEvent must not let end land before start.
  if (fields.starts_at && fields.ends_at && fields.ends_at <= fields.starts_at) {
    return { error: "טווח שעות לא תקין" };
  }

  try {
    await updateBusinessEvent(businessId, eventId, fields);
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

export async function deleteBusinessEventAction(
  businessId: string,
  eventId: string,
): Promise<{ error?: string }> {
  const g = await gate(businessId);
  if (g.error) return g;
  try {
    await deleteBusinessEvent(businessId, eventId);
    rev(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

/** Owner: drags a booking to a new slot on the week view. */
export async function rescheduleBookingAction(
  businessId: string,
  bookingId: string,
  date: string,
  time: string,
): Promise<{ ok: boolean; error?: string }> {
  const g = await gate(businessId);
  if (g.error) return { ok: false, error: g.error };
  try {
    const res = await rescheduleBooking(businessId, bookingId, date, time);
    if (res.ok) rev(businessId);
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}

/** Owner: rotates the business's live-calendar feed token (invalidates old subscription links). */
export async function regenerateIcsFeedTokenAction(
  businessId: string,
): Promise<{ token?: string; error?: string }> {
  const g = await gate(businessId);
  if (g.error) return { error: g.error };
  try {
    const token = await regenerateIcsFeedToken(businessId);
    rev(businessId);
    return { token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "יצירת קישור חדש נכשלה" };
  }
}
