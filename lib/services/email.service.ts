import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildPlanWelcomeEmail, emailShell } from "@/lib/email-templates";
import type { PlanTier } from "@/types/database";

/**
 * Email notifications via Resend (free tier: 3,000/month, one API key).
 * DORMANT until RESEND_API_KEY is set — every send is a no-op until then, so
 * nothing breaks if it's unconfigured. Uses plain fetch (no SDK dependency).
 *
 * Every attempted send (sent/failed/skipped-no-key) is best-effort logged to
 * email_log for the "אימייל" integrations card — logging failures never
 * affect the send outcome returned to the caller.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM_ADDRESS = "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "AI Business Builder";

export function emailConfigured(): boolean {
  const k = process.env.RESEND_API_KEY ?? "";
  return k.length > 0 && !k.startsWith("placeholder");
}

/** Parses RESEND_FROM ("Name <addr>" or bare "addr") into { name, address }. */
function defaultFrom(): { name: string; address: string } {
  const raw = process.env.RESEND_FROM?.trim();
  if (!raw) return { name: DEFAULT_FROM_NAME, address: DEFAULT_FROM_ADDRESS };
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) {
    return { name: match[1].trim() || DEFAULT_FROM_NAME, address: match[2].trim() };
  }
  return { name: DEFAULT_FROM_NAME, address: raw };
}

/**
 * Resolves the display name + Reply-To for a business's outgoing email —
 * businesses.email_from_name overrides the display name (the address itself
 * always stays the verified RESEND_FROM domain), businesses.email_reply_to
 * becomes the Reply-To header. Falls back to platform defaults / undefined
 * when the business has no customization or businessId isn't given.
 */
async function resolveSenderForBusiness(
  businessId?: string,
): Promise<{ from: string; replyTo?: string }> {
  const base = defaultFrom();
  if (!businessId) return { from: `${base.name} <${base.address}>` };
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("businesses")
      .select("email_from_name, email_reply_to")
      .eq("id", businessId)
      .maybeSingle();
    const name = data?.email_from_name?.trim() || base.name;
    return {
      from: `${name} <${base.address}>`,
      replyTo: data?.email_reply_to?.trim() || undefined,
    };
  } catch {
    return { from: `${base.name} <${base.address}>` };
  }
}

/** Best-effort audit-log insert — never throws, never blocks the send path. */
async function logEmailAttempt(entry: {
  businessId?: string;
  to: string;
  subject: string;
  kind: string;
  status: "sent" | "failed" | "skipped-no-key";
  providerId?: string;
  error?: string;
}): Promise<void> {
  try {
    const s = createServiceRoleClient();
    await s.from("email_log").insert({
      business_id: entry.businessId ?? null,
      to_email: entry.to,
      subject: entry.subject,
      kind: entry.kind,
      status: entry.status,
      provider_id: entry.providerId ?? null,
      error: entry.error ?? null,
    });
  } catch {
    // swallow — logging must never break the email flow
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Per-business sender customization + email_log linkage. */
  businessId?: string;
  /** Classifies the send in email_log (e.g. "order_confirmation"). */
  kind?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const kind = opts.kind ?? "generic";
  if (!emailConfigured()) {
    await logEmailAttempt({
      businessId: opts.businessId,
      to: opts.to,
      subject: opts.subject,
      kind,
      status: "skipped-no-key",
    });
    return { ok: false, skipped: true };
  }

  const { from, replyTo } = await resolveSenderForBusiness(opts.businessId);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const error = data?.message ?? `Resend HTTP ${res.status}`;
      await logEmailAttempt({ businessId: opts.businessId, to: opts.to, subject: opts.subject, kind, status: "failed", error });
      return { ok: false, error };
    }
    const data = await res.json().catch(() => ({}));
    await logEmailAttempt({
      businessId: opts.businessId,
      to: opts.to,
      subject: opts.subject,
      kind,
      status: "sent",
      providerId: data?.id,
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "send failed";
    await logEmailAttempt({ businessId: opts.businessId, to: opts.to, subject: opts.subject, kind, status: "failed", error });
    return { ok: false, error };
  }
}

/** One row of the "אימייל" integrations card's send-log viewer. */
export type EmailLogEntry = {
  id: string;
  to_email: string;
  subject: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string;
};

/** Last N email_log rows for a business (owner-only via RLS), newest first. */
export async function getRecentEmailLogs(
  businessId: string,
  limit = 20,
): Promise<EmailLogEntry[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("email_log")
    .select("id, to_email, subject, kind, status, error, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** The owner's account email for a business (service-role lookup). */
export async function getOwnerEmail(businessId: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data: biz } = await s
    .from("businesses")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz?.owner_id) return null;
  const { data } = await s.auth.admin.getUserById(biz.owner_id);
  return data?.user?.email ?? null;
}

/**
 * Welcome / congratulations email on a successful subscription.
 * Best-effort — never throws (must not break the Stripe webhook). Sent once,
 * on checkout.session.completed, to the subscribing customer. The HTML is built
 * by the pure buildPlanWelcomeEmail template (lib/email-templates.ts).
 */
export async function sendPlanWelcomeEmail(to: string, tier: PlanTier): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const mail = buildPlanWelcomeEmail(tier);
    if (!mail) return;
    await sendEmail({ to, subject: mail.subject, html: mail.html, kind: "plan_welcome" });
  } catch {
    // swallow — welcome email is best-effort
  }
}

/**
 * Branded order-confirmation email to the CUSTOMER (best-effort, never throws).
 * Sent after a paid store order. Needs the buyer's email — for card orders we
 * take it from the Stripe Checkout session.
 */
export async function sendOrderConfirmationEmail(
  to: string,
  args: {
    businessName: string;
    itemsText: string;
    totalText: string;
    address?: string | null;
    shipping?: string | null;
    hasEngraving?: boolean;
    /** Optional — enables per-business sender name/reply-to + email_log linkage. */
    businessId?: string;
  },
): Promise<void> {
  try {
    if (!emailConfigured() || !to) return;
    const subject = `אישור הזמנה — ${args.businessName}`;
    const body = `
      <p style="font-size:16px">תודה על ההזמנה! 🎉 קיבלנו את התשלום וההזמנה שלך אצל <b>${args.businessName}</b> אושרה.</p>
      <p><b>פריטים:</b><br>${args.itemsText}</p>
      ${args.shipping ? `<p><b>משלוח:</b> ${args.shipping}</p>` : ""}
      ${args.address ? `<p><b>כתובת למשלוח:</b> ${args.address}</p>` : ""}
      <p style="font-size:18px"><b>סה"כ ששולם:</b> ${args.totalText}</p>
      ${args.hasEngraving ? `<p>✒️ שימו לב: המוצרים ייחרטו בדיוק לפי הטקסט שהזנתם.</p>` : ""}
      <p style="color:#71717a">נעדכן אותך כשההזמנה תישלח. תודה שקנית אצלנו!</p>`;
    await sendEmail({ to, subject, html: emailShell(subject, body), businessId: args.businessId, kind: "order_confirmation" });
  } catch {
    // swallow — confirmation email is best-effort
  }
}

/**
 * Branded reminder email to the CUSTOMER for tomorrow's booking (best-effort,
 * never throws). Sent by the booking-reminders cron when the booking has a
 * customer_email. Includes a prominent date/time block and a small link to
 * cancel/reschedule (cancelUrl — built by the caller from cancel_token).
 */
export async function sendBookingReminderEmail(
  to: string,
  args: {
    businessName: string;
    serviceName?: string | null;
    staffName?: string | null;
    dateText: string;
    timeText: string;
    durationMinutes?: number | null;
    cancelUrl: string;
    /** Optional — enables per-business sender name/reply-to + email_log linkage. */
    businessId?: string;
  },
): Promise<void> {
  try {
    if (!emailConfigured() || !to) return;
    const subject = `תזכורת: תור מחר ב-${args.timeText}`;
    const serviceLine = args.serviceName
      ? `<p style="margin:0 0 4px"><b>שירות:</b> ${args.serviceName}${args.durationMinutes ? ` (${args.durationMinutes} דק')` : ""}</p>`
      : args.durationMinutes
        ? `<p style="margin:0 0 4px"><b>משך:</b> ${args.durationMinutes} דק'</p>`
        : "";
    const staffLine = args.staffName
      ? `<p style="margin:0 0 4px"><b>אצל:</b> ${args.staffName}</p>`
      : "";
    const body = `
      <p style="font-size:16px">היי! זו תזכורת ידידותית מ<b>${args.businessName}</b> — יש לך תור מחר. 😊</p>
      <div style="margin:16px 0;padding:16px;background:#eef2ff;border-radius:12px;text-align:center">
        <div style="font-size:14px;color:#4f46e5;font-weight:600">${args.dateText}</div>
        <div style="font-size:28px;font-weight:700;color:#312e81;margin-top:4px">${args.timeText}</div>
      </div>
      ${serviceLine}
      ${staffLine}
      <p style="margin:16px 0 0">מחכים לראות אותך!</p>
      <p style="margin:16px 0 0;font-size:12px"><a href="${args.cancelUrl}" style="color:#71717a">לביטול או שינוי מועד</a></p>`;
    await sendEmail({ to, subject, html: emailShell(subject, body), businessId: args.businessId, kind: "booking_reminder" });
  } catch {
    // swallow — reminder email is best-effort (WhatsApp/CRM-task are the fallback channels)
  }
}

/**
 * Branded booking-confirmation email to the CUSTOMER (best-effort, never
 * throws). Intended to be sent right after a booking is created — see
 * lib/services/booking-notify.ts (notifyBookingCreated) for the wiring point.
 * When args.pending is true, the booking still needs owner approval, so the
 * copy reflects "request received" rather than "confirmed".
 */
export async function sendBookingConfirmedEmail(
  to: string,
  args: {
    businessName: string;
    serviceName?: string | null;
    staffName?: string | null;
    dateText: string;
    timeText: string;
    cancelUrl: string;
    pending?: boolean;
    /** Optional — enables per-business sender name/reply-to + email_log linkage. */
    businessId?: string;
  },
): Promise<void> {
  try {
    if (!emailConfigured() || !to) return;
    const subject = args.pending
      ? "בקשת התור התקבלה וממתינה לאישור"
      : "התור נקבע!";
    const intro = args.pending
      ? `קיבלנו את בקשת התור שלך אצל <b>${args.businessName}</b>. נעדכן אותך ברגע שהעסק יאשר.`
      : `התור שלך אצל <b>${args.businessName}</b> נקבע בהצלחה! מחכים לראות אותך.`;
    const serviceLine = args.serviceName
      ? `<p style="margin:0 0 4px"><b>שירות:</b> ${args.serviceName}</p>`
      : "";
    const staffLine = args.staffName
      ? `<p style="margin:0 0 4px"><b>אצל:</b> ${args.staffName}</p>`
      : "";
    const body = `
      <p style="font-size:16px">${intro}</p>
      <div style="margin:16px 0;padding:16px;background:#eef2ff;border-radius:12px;text-align:center">
        <div style="font-size:14px;color:#4f46e5;font-weight:600">${args.dateText}</div>
        <div style="font-size:28px;font-weight:700;color:#312e81;margin-top:4px">${args.timeText}</div>
      </div>
      ${serviceLine}
      ${staffLine}
      <p style="margin:16px 0 0;font-size:12px"><a href="${args.cancelUrl}" style="color:#71717a">לביטול או שינוי מועד</a></p>`;
    await sendEmail({ to, subject, html: emailShell(subject, body), businessId: args.businessId, kind: "booking_confirmed" });
  } catch {
    // swallow — confirmation email is best-effort
  }
}

/**
 * "Slot opened" email to a customer on the cancellation waitlist (best-effort,
 * never throws). Sent by notifyWaitlistForDate (lib/services/booking-waitlist.service.ts)
 * after an owner/token/self cancellation frees up a slot on that date.
 */
export async function sendWaitlistSlotOpenEmail(args: {
  to: string;
  businessName: string;
  dateStr: string;
  siteUrl: string;
  /** Optional — enables per-business sender name/reply-to + email_log linkage. */
  businessId?: string;
}): Promise<void> {
  try {
    if (!emailConfigured() || !args.to) return;
    const subject = `התפנה תור ב${args.businessName} — הזדרזו לקבוע`;
    const body = `
      <p style="font-size:16px">התפנה תור אצל <b>${args.businessName}</b> בתאריך <b>${args.dateStr}</b> — נרשמת/ה לרשימת ההמתנה, אז כדאי למהר!</p>
      <div style="margin:20px 0;text-align:center">
        <a href="${args.siteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;font-weight:700;text-decoration:none">קביעת תור עכשיו</a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#71717a">המקום מוצע גם לממתינים אחרים ברשימה — מי שקודם/ת תופס/ת.</p>`;
    await sendEmail({ to: args.to, subject, html: emailShell(subject, body), businessId: args.businessId, kind: "waitlist_slot_open" });
  } catch {
    // swallow — best-effort
  }
}

/** Best-effort owner notification — never throws (notifications must not break flows). */
export async function notifyOwner(
  businessId: string,
  subject: string,
  bodyHtml: string,
): Promise<void> {
  try {
    if (!emailConfigured()) return;
    const to = await getOwnerEmail(businessId);
    if (!to) return;
    await sendEmail({ to, subject, html: emailShell(subject, bodyHtml), businessId, kind: "owner_notify" });
  } catch {
    // swallow — owner notifications are best-effort
  }
}
