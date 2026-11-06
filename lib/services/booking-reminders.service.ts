import { createServiceRoleClient } from "@/lib/supabase/server";
import { openWhatsappSecret } from "@/lib/whatsapp-secrets";
import { sendWhatsappText } from "@/lib/services/whatsapp-api";
import { normalizePhoneForWhatsapp } from "@/lib/phone";
import { sendBookingReminderEmail, sendEmail } from "@/lib/services/email.service";
import { sendBusinessSms } from "@/lib/services/sms";
import { emailShell } from "@/lib/email-templates";

const TZ = "Asia/Jerusalem";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric" });

export type ReminderRunResult = {
  scanned: number;
  /** Bookings reminded by email (new channel — highest priority). */
  emailsSent: number;
  whatsappSent: number;
  /** Bookings reminded by SMS (sent alongside other channels when connected). */
  smsSent: number;
  tasksCreated: number;
  errors: string[];
};

/**
 * Sends reminders for tomorrow's confirmed bookings (Israel time).
 * Per booking, channels are tried in priority order until one succeeds
 * (reminder_sent_at guards against double-sends across runs):
 *  1. Email → when the booking has customer_email.
 *  2. WhatsApp → when the business has a connected WhatsApp config.
 *  3. CRM task (fallback) → only when neither channel above succeeded, so the
 *     owner is told to remind the customer manually.
 * Bookings marked no_show are skipped defensively (shouldn't normally have
 * reminder_sent_at null a day out, but a reminder is pointless either way).
 */
export async function sendBookingReminders(): Promise<ReminderRunResult> {
  const s = createServiceRoleClient();
  const result: ReminderRunResult = {
    scanned: 0,
    emailsSent: 0,
    whatsappSent: 0,
    smsSent: 0,
    tasksCreated: 0,
    errors: [],
  };

  const tomorrowStr = dateFmt.format(new Date(Date.now() + 86400_000));

  // Tomorrow (IL) spans at most 02:00Z windows around the calendar day —
  // fetch a generous UTC range and filter precisely by IL calendar date.
  const { data: bookings, error } = await s
    .from("bookings")
    .select(
      "id,business_id,customer_name,customer_phone,customer_email,service,service_id,staff_id,duration_minutes,starts_at,cancel_token,no_show",
    )
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", new Date(Date.now() + 6 * 3600_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 54 * 3600_000).toISOString())
    .limit(200);
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const tomorrows = (bookings ?? []).filter(
    (b) => !b.no_show && dateFmt.format(new Date(b.starts_at)) === tomorrowStr,
  );
  result.scanned = tomorrows.length;
  if (tomorrows.length === 0) return result;

  // Load business names + WhatsApp connections for the involved businesses.
  const bizIds = [...new Set(tomorrows.map((b) => b.business_id))];
  const [{ data: businesses }, { data: configs }, { data: smsIntegrations }] = await Promise.all([
    s.from("businesses").select("id,name").in("id", bizIds),
    s.from("whatsapp_config")
      .select("business_id,phone_number_id,access_token,connected")
      .in("business_id", bizIds).eq("connected", true),
    s.from("business_integrations")
      .select("business_id")
      .in("business_id", bizIds).eq("category", "sms").eq("status", "connected"),
  ]);
  const nameOf = new Map((businesses ?? []).map((b) => [b.id, b.name ?? "העסק"]));
  const waOf = new Map((configs ?? []).map((c) => [c.business_id, c]));
  const smsBizIds = new Set((smsIntegrations ?? []).map((r) => r.business_id));

  // Batch-resolve staff names for bookings that have a staff_id assigned.
  const staffIds = [...new Set(tomorrows.map((b) => b.staff_id).filter((id): id is string => Boolean(id)))];
  const { data: staffRows } =
    staffIds.length > 0
      ? await s.from("booking_staff").select("id,name").in("id", staffIds)
      : { data: [] as { id: string; name: string }[] };
  const staffNameOf = new Map((staffRows ?? []).map((r) => [r.id, r.name]));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  for (const booking of tomorrows) {
    const when = new Date(booking.starts_at);
    const timeStr = timeFmt.format(when);
    const dayStr = dayFmt.format(when);
    const bizName = nameOf.get(booking.business_id) ?? "העסק";
    const staffName = booking.staff_id ? staffNameOf.get(booking.staff_id) ?? null : null;
    const cancelUrl = appUrl ? `${appUrl}/cancel/${booking.cancel_token}` : "";
    const cancelLine = cancelUrl ? `\nלביטול או שינוי מועד: ${cancelUrl}` : "";

    let sent = false;

    // (a) Email — highest priority when we have an address.
    if (booking.customer_email) {
      try {
        await sendBookingReminderEmail(booking.customer_email, {
          businessName: bizName,
          serviceName: booking.service,
          staffName,
          dateText: dayStr,
          timeText: timeStr,
          durationMinutes: booking.duration_minutes,
          cancelUrl,
          businessId: booking.business_id,
        });
        sent = true;
        result.emailsSent++;
      } catch (e) {
        result.errors.push(`email ${booking.id}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    // (b) WhatsApp — when connected (independent of email outcome: a booking
    // can legitimately get both an email and a WhatsApp reminder).
    const wa = waOf.get(booking.business_id);
    const to = wa ? normalizePhoneForWhatsapp(booking.customer_phone) : null;

    if (wa?.phone_number_id && wa.access_token && to) {
      const res = await sendWhatsappText({
        phoneNumberId: wa.phone_number_id,
        accessToken: openWhatsappSecret(wa.access_token) ?? "",
        to,
        body: `היי ${booking.customer_name}, תזכורת מ${bizName}: יש לך תור מחר (${dayStr}) בשעה ${timeStr}${booking.service ? ` ל${booking.service}` : ""}${staffName ? ` אצל ${staffName}` : ""}. נתראה!${cancelLine}`,
      });
      if (res.ok) {
        sent = true;
        result.whatsappSent++;
      } else {
        result.errors.push(`wa ${booking.id}: ${res.error}`);
      }
    }

    // (c) SMS — when the business has a connected SMS integration. Independent
    // of the other channels (a booking can legitimately get email + WhatsApp +
    // SMS all at once); the reminder_sent_at guard (set once below) is what
    // prevents any channel from double-texting across cron runs. Best-effort —
    // a failure here never blocks email/WhatsApp/task delivery.
    if (smsBizIds.has(booking.business_id)) {
      try {
        await sendBusinessSms(
          booking.business_id,
          booking.customer_phone,
          `היי ${booking.customer_name}, תזכורת מ${bizName}: יש לך תור מחר (${dayStr}) בשעה ${timeStr}${booking.service ? ` ל${booking.service}` : ""}${staffName ? ` אצל ${staffName}` : ""}. נתראה!`,
        );
        result.smsSent++;
      } catch (e) {
        // sendBusinessSms never throws by contract — kept defensive.
        result.errors.push(`sms ${booking.id}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    // (d) CRM task — fallback only when neither channel above succeeded.
    if (!sent) {
      const { error: taskErr } = await s.from("crm_tasks").insert({
        business_id: booking.business_id,
        title: `להזכיר: תור של ${booking.customer_name} מחר ב-${timeStr} (${booking.customer_phone})`,
        priority: "high",
        due_date: tomorrowStr,
      });
      if (taskErr) {
        result.errors.push(`task ${booking.id}: ${taskErr.message}`);
        continue; // don't mark — retry on next run
      }
      result.tasksCreated++;
      sent = true;
    }

    if (sent) {
      await s.from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
    }
  }

  return result;
}

/**
 * Sends "in about an hour" reminders for confirmed bookings starting in the
 * next ~45–75 minutes (Israel time). Independent of sendBookingReminders
 * above — guarded by its own reminder_1h_sent_at column, so a 15-minute cron
 * cadence reliably catches every booking exactly once, roughly an hour out.
 * Same channel priority as the day-before reminder: email → WhatsApp → SMS →
 * CRM task fallback.
 */
export async function send1HourReminders(): Promise<ReminderRunResult> {
  const s = createServiceRoleClient();
  const result: ReminderRunResult = {
    scanned: 0,
    emailsSent: 0,
    whatsappSent: 0,
    smsSent: 0,
    tasksCreated: 0,
    errors: [],
  };

  const { data: bookings, error } = await s
    .from("bookings")
    .select(
      "id,business_id,customer_name,customer_phone,customer_email,service,service_id,staff_id,duration_minutes,starts_at,cancel_token,no_show",
    )
    .eq("status", "confirmed")
    .is("reminder_1h_sent_at", null)
    .gte("starts_at", new Date(Date.now() + 45 * 60_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 75 * 60_000).toISOString())
    .limit(200);
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const upcoming = (bookings ?? []).filter((b) => !b.no_show);
  result.scanned = upcoming.length;
  if (upcoming.length === 0) return result;

  const bizIds = [...new Set(upcoming.map((b) => b.business_id))];
  const [{ data: businesses }, { data: configs }, { data: smsIntegrations }] = await Promise.all([
    s.from("businesses").select("id,name").in("id", bizIds),
    s.from("whatsapp_config")
      .select("business_id,phone_number_id,access_token,connected")
      .in("business_id", bizIds).eq("connected", true),
    s.from("business_integrations")
      .select("business_id")
      .in("business_id", bizIds).eq("category", "sms").eq("status", "connected"),
  ]);
  const nameOf = new Map((businesses ?? []).map((b) => [b.id, b.name ?? "העסק"]));
  const waOf = new Map((configs ?? []).map((c) => [c.business_id, c]));
  const smsBizIds = new Set((smsIntegrations ?? []).map((r) => r.business_id));

  const staffIds = [...new Set(upcoming.map((b) => b.staff_id).filter((id): id is string => Boolean(id)))];
  const { data: staffRows } =
    staffIds.length > 0
      ? await s.from("booking_staff").select("id,name").in("id", staffIds)
      : { data: [] as { id: string; name: string }[] };
  const staffNameOf = new Map((staffRows ?? []).map((r) => [r.id, r.name]));

  for (const booking of upcoming) {
    const when = new Date(booking.starts_at);
    const timeStr = timeFmt.format(when);
    const bizName = nameOf.get(booking.business_id) ?? "העסק";
    const staffName = booking.staff_id ? staffNameOf.get(booking.staff_id) ?? null : null;
    const serviceSuffix = booking.service ? ` ל${booking.service}` : "";
    const staffSuffix = staffName ? ` אצל ${staffName}` : "";

    let sent = false;

    // (a) Email — highest priority when we have an address.
    if (booking.customer_email) {
      try {
        const subject = `תזכורת: התור שלך בעוד כשעה (${timeStr})`;
        await sendEmail({
          to: booking.customer_email,
          subject,
          html: emailShell(
            subject,
            `<p style="font-size:16px">היי ${booking.customer_name}, תזכורת מ<b>${bizName}</b>: יש לך תור בעוד כשעה!</p>
             <div style="margin:16px 0;padding:16px;background:#eef2ff;border-radius:12px;text-align:center">
               <div style="font-size:28px;font-weight:700;color:#312e81">${timeStr}</div>
             </div>
             ${booking.service ? `<p style="margin:0 0 4px"><b>שירות:</b> ${booking.service}</p>` : ""}
             ${staffName ? `<p style="margin:0 0 4px"><b>אצל:</b> ${staffName}</p>` : ""}
             <p style="margin:16px 0 0">מחכים לראות אותך בקרוב!</p>`,
          ),
          businessId: booking.business_id,
          kind: "booking_reminder_1h",
        });
        sent = true;
        result.emailsSent++;
      } catch (e) {
        result.errors.push(`email1h ${booking.id}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    // (b) WhatsApp — when connected (independent of email outcome).
    const wa = waOf.get(booking.business_id);
    const to = wa ? normalizePhoneForWhatsapp(booking.customer_phone) : null;

    if (wa?.phone_number_id && wa.access_token && to) {
      const res = await sendWhatsappText({
        phoneNumberId: wa.phone_number_id,
        accessToken: openWhatsappSecret(wa.access_token) ?? "",
        to,
        body: `היי ${booking.customer_name}, תזכורת מ${bizName}: יש לך תור בעוד כשעה — ${timeStr}${serviceSuffix}${staffSuffix}. נתראה בקרוב!`,
      });
      if (res.ok) {
        sent = true;
        result.whatsappSent++;
      } else {
        result.errors.push(`wa1h ${booking.id}: ${res.error}`);
      }
    }

    // (c) SMS — when the business has a connected SMS integration.
    if (smsBizIds.has(booking.business_id)) {
      try {
        await sendBusinessSms(
          booking.business_id,
          booking.customer_phone,
          `היי ${booking.customer_name}, תזכורת: יש לך תור בעוד כשעה${serviceSuffix} ב-${timeStr}${staffSuffix}.`,
        );
        result.smsSent++;
      } catch (e) {
        // sendBusinessSms never throws by contract — kept defensive.
        result.errors.push(`sms1h ${booking.id}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }

    // (d) CRM task — fallback only when neither channel above succeeded.
    if (!sent) {
      const { error: taskErr } = await s.from("crm_tasks").insert({
        business_id: booking.business_id,
        title: `להזכיר: תור של ${booking.customer_name} בעוד כשעה ב-${timeStr} (${booking.customer_phone})`,
        priority: "high",
        due_date: dateFmt.format(when),
      });
      if (taskErr) {
        result.errors.push(`task1h ${booking.id}: ${taskErr.message}`);
        continue; // don't mark — retry on next run
      }
      result.tasksCreated++;
      sent = true;
    }

    if (sent) {
      await s.from("bookings")
        .update({ reminder_1h_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
    }
  }

  return result;
}
