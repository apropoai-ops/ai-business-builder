import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPushToBusinessOwner } from "@/lib/services/push.service";
import { sendEmail, notifyOwner } from "@/lib/services/email.service";
import { sendBusinessSms } from "@/lib/services/sms";
import { emailShell, escapeHtml } from "@/lib/email-templates";

/**
 * Instant "new booking" alerts — fired once from booking creation (both the
 * customer self-serve flow and the owner's manual/walk-in flow) so the owner
 * (and, when one is assigned, the staff member) hear about a new booking the
 * moment it happens, instead of relying on dashboard polling. Every channel
 * is independently best-effort (own try/catch) and this function itself
 * NEVER throws — always call it fire-and-forget (`void notifyNewBooking(...)`).
 */

const TZ = "Asia/Jerusalem";
const dayFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric" });
const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export type NewBookingNotifyInput = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceName?: string | null;
  startsAt: string;
  staffId?: string | null;
};

export async function notifyNewBooking(
  businessId: string,
  booking: NewBookingNotifyInput,
): Promise<void> {
  try {
    const when = new Date(booking.startsAt);
    const timeText = isNaN(when.getTime()) ? "" : `${dayFmt.format(when)} בשעה ${timeFmt.format(when)}`;
    const serviceSuffix = booking.serviceName ? ` — ${booking.serviceName}` : "";

    const s = createServiceRoleClient();
    const [{ data: business }, { data: staff }] = await Promise.all([
      s.from("businesses").select("name").eq("id", businessId).maybeSingle(),
      booking.staffId
        ? s.from("booking_staff").select("name,email,phone").eq("id", booking.staffId).maybeSingle()
        : Promise.resolve({ data: null as { name: string; email: string | null; phone: string | null } | null }),
    ]);
    const bizName = business?.name ?? "העסק";
    const staffSuffix = staff?.name ? ` אצל ${staff.name}` : "";

    // (a) Owner push — never throws (push.service contract).
    void sendPushToBusinessOwner(businessId, {
      title: "תור חדש נקבע",
      body: `${booking.customerName}${serviceSuffix}${staffSuffix} · ${timeText}`,
      url: `/businesses/${businessId}/bookings`,
    });

    // (b) Owner email — best-effort (email.service no-ops silently when unconfigured).
    try {
      await notifyOwner(
        businessId,
        `תור חדש נקבע: ${booking.customerName}`,
        `<p style="font-size:16px">נקבע תור חדש${serviceSuffix ? ` ל<b>${escapeHtml(String(booking.serviceName ?? ""))}</b>` : ""} אצל <b>${escapeHtml(bizName)}</b>.</p>
         <p style="margin:12px 0 4px"><b>לקוח/ה:</b> ${escapeHtml(String(booking.customerName ?? ""))} (${escapeHtml(String(booking.customerPhone ?? ""))})</p>
         ${staff?.name ? `<p style="margin:0 0 4px"><b>איש צוות:</b> ${escapeHtml(staff.name)}</p>` : ""}
         <p style="margin:0"><b>מועד:</b> ${timeText}</p>`,
      );
    } catch {
      // best-effort
    }

    // (c) Assigned staff contact — SMS and/or email, only when on file.
    if (staff?.phone) {
      try {
        await sendBusinessSms(
          businessId,
          staff.phone,
          `נקבע לך תור חדש: ${booking.customerName}${serviceSuffix} ב-${timeText}`,
        );
      } catch {
        // sendBusinessSms never throws by contract — kept defensive
      }
    }
    if (staff?.email) {
      try {
        const subject = `נקבע לך תור חדש — ${booking.customerName}`;
        await sendEmail({
          to: staff.email,
          subject,
          html: emailShell(
            subject,
            `<p style="font-size:16px">נקבע לך תור חדש${serviceSuffix ? ` ל<b>${booking.serviceName}</b>` : ""}.</p>
             <p style="margin:12px 0 4px"><b>לקוח/ה:</b> ${booking.customerName} (${booking.customerPhone})</p>
             <p style="margin:0"><b>מועד:</b> ${timeText}</p>`,
          ),
          businessId,
          kind: "staff_new_booking",
        });
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort — must never break booking creation
  }
}
