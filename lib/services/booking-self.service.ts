import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPublicSlots } from "@/lib/services/booking.service";
import { notifyWaitlistForDate } from "@/lib/services/booking-waitlist.service";
import { zonedToUtc } from "@/lib/booking-shared";
import type { Booking } from "@/types/database";

const TZ = "Asia/Jerusalem";

/** Israel-time YYYY-MM-DD for a booking's starts_at — used to notify the waitlist for the freed day. */
function dateStrIL(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

const DEFAULT_CANCEL_NOTICE_HOURS = 2;
const DEFAULT_DURATION_MINUTES = 30;

/**
 * Self-service booking management for signed-in customers and cancel-token
 * visitors: rescheduling from the /cancel/[token] link, and the storefront
 * "התורים שלי" page (list + cancel by customer_user_id).
 *
 * Mirrors the patterns in booking.service.ts's cancel-token section — service
 * role client, same notice-window rules, same Israel-time construction.
 */

// ── Reschedule (by cancel token) ────────────────────────────────────────────

export type RescheduleContext = {
  booking: {
    id: string;
    business_id: string;
    customer_name: string;
    service: string | null;
    service_id: string | null;
    staff_id: string | null;
    duration_minutes: number | null;
    starts_at: string;
    status: string;
    recurrence: string | null;
  };
  businessName: string;
  slug: string;
  cancelNoticeHours: number;
};

/** Looks up everything the reschedule UI needs, keyed by cancel token. */
export async function getRescheduleContext(
  token: string,
): Promise<RescheduleContext | null> {
  const s = createServiceRoleClient();
  const { data: booking } = await s
    .from("bookings")
    .select(
      "id,business_id,customer_name,service,service_id,staff_id,duration_minutes,starts_at,status,recurrence",
    )
    .eq("cancel_token", token)
    .neq("status", "blocked")
    .maybeSingle();
  if (!booking) return null;

  const [{ data: business }, { data: website }, { data: settings }] =
    await Promise.all([
      s.from("businesses").select("name").eq("id", booking.business_id).maybeSingle(),
      s
        .from("websites")
        .select("slug")
        .eq("business_id", booking.business_id)
        .eq("published", true)
        .maybeSingle(),
      s
        .from("booking_settings")
        .select("cancel_notice_hours")
        .eq("business_id", booking.business_id)
        .maybeSingle(),
    ]);

  if (!website?.slug) return null; // no published site — can't offer self-service reschedule

  return {
    booking,
    businessName: business?.name ?? "העסק",
    slug: website.slug,
    cancelNoticeHours: settings?.cancel_notice_hours ?? DEFAULT_CANCEL_NOTICE_HOURS,
  };
}

/**
 * Reschedules a booking by its cancel token. Rules mirror cancellation:
 *  - unknown token / cancelled / already started → error
 *  - inside the cancel-notice window (from the CURRENT start time) → error
 *  - target time must be currently free per getPublicSlots (single source of
 *    truth for availability, service-aware) → error otherwise
 */
export async function rescheduleBookingByToken(
  token: string,
  dateStr: string,
  timeHHMM: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeHHMM)) {
    return { ok: false, error: "מועד לא תקין" };
  }

  const ctx = await getRescheduleContext(token);
  if (!ctx) return { ok: false, error: "הקישור אינו תקף" };
  const { booking } = ctx;

  if (booking.status === "cancelled") {
    return { ok: false, error: "התור כבר בוטל" };
  }
  const noticeMs = ctx.cancelNoticeHours * 3600_000;
  if (new Date(booking.starts_at).getTime() - Date.now() < noticeMs) {
    return {
      ok: false,
      error: `לא ניתן לשנות מועד פחות מ-${ctx.cancelNoticeHours} שעות לפני התור — צרו קשר עם העסק`,
    };
  }

  // Single source of truth for availability — service- AND staff-aware slot
  // search, so the customer only lands on times the SAME staff member (if
  // any) is actually free for.
  const slots = await getPublicSlots(ctx.slug, dateStr, booking.service_id, booking.staff_id);
  if (!slots || !slots.includes(timeHHMM)) {
    return { ok: false, error: "השעה שבחרתם כבר לא פנויה — נסו שעה אחרת" };
  }

  const startsAt = zonedToUtc(dateStr, timeHHMM);
  if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
    return { ok: false, error: "מועד לא תקין" };
  }
  const durationMin = booking.duration_minutes ?? DEFAULT_DURATION_MINUTES;
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const oldDateStr = dateStrIL(booking.starts_at);

  const s = createServiceRoleClient();
  const { error } = await s
    .from("bookings")
    // staff_id is intentionally untouched — the booking keeps the SAME staff
    // member across the reschedule.
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reminder_sent_at: null,
    })
    .eq("id", booking.id)
    .eq("cancel_token", token);
  if (error) return { ok: false, error: "שינוי המועד נכשל — נסו שוב" };

  try {
    await notifyWaitlistForDate(booking.business_id, oldDateStr);
  } catch {
    // best-effort — never block the customer-facing reschedule flow
  }
  return { ok: true };
}

// ── "התורים שלי" (signed-in customer) ───────────────────────────────────────

export type MyAppointment = Booking & { staffName: string | null };

/** Resolves a published storefront slug to its business id (public info). */
async function businessIdForSlug(slug: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return data?.business_id ?? null;
}

/**
 * The signed-in customer's appointments for one business, split into
 * upcoming (asc) and past (desc, capped at 20).
 *
 * Uses the SERVICE-ROLE client with auth-derived filters: bookings RLS is
 * owner-only, so a signed-in CUSTOMER can never read their rows through the
 * RLS client. `userId` comes from auth.getUser() and email matching uses the
 * VERIFIED auth email only — both trusted, never caller-supplied.
 */
export async function listMyAppointments(
  slug: string,
  userId: string,
  userEmail?: string | null,
): Promise<{ upcoming: MyAppointment[]; past: MyAppointment[] }> {
  const businessId = await businessIdForSlug(slug);
  if (!businessId) return { upcoming: [], past: [] };

  const s = createServiceRoleClient();
  const email = userEmail?.trim().toLowerCase() ?? "";
  const yearAgo = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();

  const base = () =>
    s
      .from("bookings")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "blocked")
      .gte("starts_at", yearAgo)
      .order("starts_at", { ascending: false })
      .limit(200);

  const [byUser, byEmail] = await Promise.all([
    base().eq("customer_user_id", userId),
    // Escape LIKE wildcards so the verified email is matched literally.
    email
      ? base().ilike("customer_email", email.replace(/[%_]/g, "\\$&"))
      : Promise.resolve({ data: [] as Booking[] }),
  ]);

  const seen = new Set<string>();
  const all = [...(byUser.data ?? []), ...(byEmail.data ?? [])].filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  // Resolve staff names in a single extra query, keyed by the distinct
  // staff_id values actually present on these bookings.
  const staffIds = Array.from(
    new Set(all.map((b) => b.staff_id).filter((id): id is string => !!id)),
  );
  let staffNameById: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: staffRows } = await s
      .from("booking_staff")
      .select("id,name")
      .in("id", staffIds);
    staffNameById = Object.fromEntries((staffRows ?? []).map((r) => [r.id, r.name]));
  }
  const withStaffName = (b: Booking): MyAppointment => ({
    ...b,
    staffName: b.staff_id ? (staffNameById[b.staff_id] ?? null) : null,
  });

  const nowMs = Date.now();
  const upcoming = all
    .filter((b) => new Date(b.starts_at).getTime() >= nowMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(withStaffName);
  const past = all
    .filter((b) => new Date(b.starts_at).getTime() < nowMs)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 20)
    .map(withStaffName);

  return { upcoming, past };
}

/**
 * Owner heads-up when a CUSTOMER cancels — shows up as a high-priority task
 * in the CRM (the bookings list reflects the cancelled status itself).
 */
async function notifyOwnerOfCustomerCancel(booking: {
  business_id: string;
  customer_name: string;
  service: string | null;
  starts_at: string;
}): Promise<void> {
  const when = new Date(booking.starts_at);
  const label = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(when);
  const dueDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);

  const s = createServiceRoleClient();
  await s.from("crm_tasks").insert({
    business_id: booking.business_id,
    title: `הלקוח ביטל תור: ${booking.customer_name} — ${label}${booking.service ? ` (${booking.service})` : ""}`,
    priority: "high",
    due_date: dueDate,
  });
}

/**
 * Cancels one of the signed-in customer's own bookings. Rules mirror the
 * cancel-token flow: must be in the future and outside the cancel-notice
 * window, verified against that business's booking_settings.
 */
export async function cancelMyAppointment(
  userId: string,
  bookingId: string,
  userEmail?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  // Service-role + auth-derived ownership check (bookings RLS is owner-only;
  // see listMyAppointments). A booking is the customer's when it's linked to
  // their user id OR was made with their VERIFIED auth email.
  const s = createServiceRoleClient();
  const { data: booking } = await s
    .from("bookings")
    .select(
      "id,business_id,customer_user_id,customer_email,customer_name,service,starts_at,status",
    )
    .eq("id", bookingId)
    .neq("status", "blocked")
    .maybeSingle();

  const email = userEmail?.trim().toLowerCase() ?? "";
  const owns =
    booking != null &&
    (booking.customer_user_id === userId ||
      (email !== "" && booking.customer_email?.trim().toLowerCase() === email));
  if (!booking || !owns) return { ok: false, error: "התור לא נמצא" };
  if (booking.status === "cancelled") return { ok: false, error: "התור כבר בוטל" };

  const { data: settings } = await s
    .from("booking_settings")
    .select("cancel_notice_hours")
    .eq("business_id", booking.business_id)
    .maybeSingle();
  const noticeHours = settings?.cancel_notice_hours ?? DEFAULT_CANCEL_NOTICE_HOURS;

  if (new Date(booking.starts_at).getTime() - Date.now() < noticeHours * 3600_000) {
    return {
      ok: false,
      error: `לא ניתן לבטל פחות מ-${noticeHours} שעות לפני התור — צרו קשר עם העסק`,
    };
  }

  const { error } = await s
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);
  if (error) return { ok: false, error: "הביטול נכשל — נסו שוב" };

  await notifyOwnerOfCustomerCancel(booking).catch(() => {});
  try {
    await notifyWaitlistForDate(booking.business_id, dateStrIL(booking.starts_at));
  } catch {
    // best-effort — never block the customer-facing cancel flow
  }
  return { ok: true };
}

export { TZ as BOOKING_SELF_TZ };
