"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  getRescheduleContext,
  rescheduleBookingByToken,
  listMyAppointments,
  cancelMyAppointment,
  type RescheduleContext,
  type MyAppointment,
} from "@/lib/services/booking-self.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tokenSchema = z.string().regex(UUID_RE, "הקישור אינו תקף");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "שעה לא תקינה");

// ── Reschedule (public, by cancel token) ────────────────────────────────────

/** Loads the booking + business context the reschedule picker needs. */
export async function getRescheduleContextAction(
  token: string,
): Promise<{ context?: RescheduleContext; error?: string }> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const context = await getRescheduleContext(parsed.data);
  if (!context) return { error: "הקישור אינו תקף" };
  return { context };
}

/** Public self-service reschedule (anonymous visitor with a cancel/reschedule link). */
export async function rescheduleBookingByTokenAction(
  token: string,
  date: string,
  time: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = z
    .object({ token: tokenSchema, date: dateSchema, time: timeSchema })
    .safeParse({ token, date, time });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  if (!(await checkRateLimit(`reschedule:${parsed.data.token}`, 10, 3600))) {
    return { ok: false, error: "יותר מדי ניסיונות כרגע — נסו שוב מאוחר יותר" };
  }

  return rescheduleBookingByToken(parsed.data.token, parsed.data.date, parsed.data.time);
}

// ── "התורים שלי" (signed-in storefront customer) ───────────────────────────

const slugSchema = z.string().min(1, "החנות אינה זמינה");

/** The signed-in shopper's appointments (upcoming + past) for one storefront. */
export async function listMyAppointmentsAction(
  slug: string,
): Promise<{ upcoming?: MyAppointment[]; past?: MyAppointment[]; error?: string }> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר" };

  const { upcoming, past } = await listMyAppointments(
    parsed.data,
    user.id,
    user.email,
  );
  return { upcoming, past };
}

/** Cancels one of the signed-in shopper's own appointments. */
export async function cancelMyAppointmentAction(
  slug: string,
  bookingId: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = z
    .object({ slug: slugSchema, bookingId: z.string().regex(UUID_RE, "תור לא תקין") })
    .safeParse({ slug, bookingId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "יש להתחבר" };

  if (!(await checkRateLimit(`myappts-cancel:${user.id}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי ניסיונות כרגע — נסו שוב מאוחר יותר" };
  }

  const res = await cancelMyAppointment(
    user.id,
    parsed.data.bookingId,
    user.email,
  );
  if (res.ok) revalidatePath(`/s/${parsed.data.slug}/account/appointments`);
  return res;
}
