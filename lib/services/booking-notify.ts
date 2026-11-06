import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendBookingConfirmedEmail } from "@/lib/services/email.service";

/**
 * HANDOFF POINT — not wired up yet.
 *
 * This module exists so the booking-creation flow (lib/services/booking.service.ts
 * → createPublicBooking) can fire a booking-confirmation email without this
 * agent touching booking.service.ts directly (that file is owned by another
 * agent working in parallel on the same task).
 *
 * TODO for whoever wires this in: inside createPublicBooking, after the booking
 * row is inserted (and CRM side-effects run), call:
 *
 *   import { notifyBookingCreated } from "@/lib/services/booking-notify";
 *   void notifyBookingCreated({
 *     email: booking.customer_email,
 *     businessName,
 *     serviceName: booking.service,
 *     dateText, // e.g. he-IL long date, Asia/Jerusalem
 *     timeText, // e.g. HH:mm, Asia/Jerusalem
 *     cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${booking.cancel_token}`,
 *     pending: booking.status !== "confirmed", // e.g. "pending" approval bookings
 *     staffId: booking.staff_id, // optional — resolved to a name internally
 *   });
 *
 * Fire-and-forget (no await needed) — notifyBookingCreated never throws.
 */

/**
 * Sends the booking-confirmation email when an email address is present.
 * When `staffId` is passed, resolves the staff member's name itself (a single
 * service-role query on booking_staff) so callers don't need to look it up.
 * Best-effort — never throws.
 */
export async function notifyBookingCreated(args: {
  email?: string | null;
  businessName: string;
  serviceName?: string | null;
  dateText: string;
  timeText: string;
  cancelUrl: string;
  pending?: boolean;
  staffId?: string | null;
}): Promise<void> {
  try {
    if (!args.email) return;

    let staffName: string | null = null;
    if (args.staffId) {
      try {
        const s = createServiceRoleClient();
        const { data } = await s
          .from("booking_staff")
          .select("name")
          .eq("id", args.staffId)
          .maybeSingle();
        staffName = data?.name ?? null;
      } catch {
        // best-effort — proceed without the staff name
      }
    }

    await sendBookingConfirmedEmail(args.email, {
      businessName: args.businessName,
      serviceName: args.serviceName,
      staffName,
      dateText: args.dateText,
      timeText: args.timeText,
      cancelUrl: args.cancelUrl,
      pending: args.pending,
    });
  } catch {
    // swallow — notification is best-effort and must never break booking creation
  }
}
