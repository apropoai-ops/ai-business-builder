"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import { STAFF_ANY } from "@/lib/booking-shared";
import {
  joinWaitlist,
  listWaitlist,
  removeWaitlistEntry,
} from "@/lib/services/booking-waitlist.service";
import type { BookingWaitlistEntry } from "@/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Public action (anonymous visitors on /s/[slug]) ────────────────────────

const joinWaitlistSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  serviceId: z.string().regex(UUID_RE).optional().nullable(),
  staffId: z.string().max(60).optional().nullable(),
  name: z.string().trim().min(2, "נא למלא שם").max(120),
  phone: z.string().trim().max(40),
  email: z.string().trim().email("אימייל לא תקין").max(160).optional().or(z.literal("")),
});

/** Public: joins the cancellation waitlist for a full day. Honeypot + rate-limited. */
export async function joinWaitlistAction(input: {
  slug: string;
  date: string;
  serviceId?: string | null;
  staffId?: string | null;
  name: string;
  phone: string;
  email?: string;
  website?: string; // honeypot
}): Promise<{ ok: boolean; error?: string }> {
  if (input.website) return { ok: true }; // bot — pretend success

  if (!(await checkRateLimit(`waitlist:${input.slug}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const parsed = joinWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }
  const data = parsed.data;
  if (data.phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }
  if (data.staffId && data.staffId !== STAFF_ANY && !UUID_RE.test(data.staffId)) {
    return { ok: false, error: "איש צוות לא תקין" };
  }

  return joinWaitlist(input.slug, {
    date: data.date,
    serviceId: data.serviceId || null,
    staffId: data.staffId || null,
    name: data.name,
    phone: data.phone,
    email: data.email || null,
  });
}

// ── Owner actions ────────────────────────────────────────────────────────

/** Owner: upcoming waitlist entries for the bookings screen. */
export async function listWaitlistAction(
  businessId: string,
): Promise<{ entries: BookingWaitlistEntry[]; error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    const entries = await listWaitlist(businessId);
    return { entries };
  } catch (e) {
    return { entries: [], error: e instanceof Error ? e.message : "טעינת רשימת ההמתנה נכשלה" };
  }
}

/** Owner: removes a waitlist entry (e.g. the customer already booked elsewhere). */
export async function removeWaitlistEntryAction(
  businessId: string,
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "bookings");
    await removeWaitlistEntry(businessId, entryId);
    revalidatePath(`/businesses/${businessId}/bookings`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
