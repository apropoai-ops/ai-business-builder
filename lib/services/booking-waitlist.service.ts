import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { openWhatsappSecret } from "@/lib/whatsapp-secrets";
import type { BookingWaitlistEntry } from "@/types/database";
import { STAFF_ANY } from "@/lib/booking-shared";
import { sendWaitlistSlotOpenEmail } from "@/lib/services/email.service";
import { sendWhatsappText } from "@/lib/services/whatsapp-api";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

const TZ = "Asia/Jerusalem";

/** Max number of 'waiting' entries allowed per business+date. */
const MAX_WAITING_PER_DAY = 50;

/** Max entries notified per cancellation event (oldest-first). */
const NOTIFY_BATCH_SIZE = 3;

// ── Public (service role, scoped to published + booking-enabled sites) ─────

/** Resolves a published site's business_id, requiring booking to be enabled — mirrors booking.service.ts's publicCtx. */
async function resolvePublicBusinessId(slug: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites").select("business_id")
    .eq("slug", slug).eq("published", true).maybeSingle();
  if (!website) return null;
  const { data: settings } = await s
    .from("booking_settings").select("business_id")
    .eq("business_id", website.business_id).eq("enabled", true).maybeSingle();
  if (!settings) return null;
  return website.business_id;
}

export type JoinWaitlistInput = {
  date: string;
  serviceId?: string | null;
  staffId?: string | null;
  name: string;
  phone: string;
  email?: string | null;
};

/**
 * Registers a customer on the cancellation waitlist for a full day.
 * One 'waiting' entry per phone+date; capped at MAX_WAITING_PER_DAY per
 * business+date so a single popular day can't grow unbounded.
 */
export async function joinWaitlist(
  slug: string,
  input: JoinWaitlistInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "תאריך לא תקין" };

  const businessId = await resolvePublicBusinessId(slug);
  if (!businessId) return { ok: false, error: "קביעת תורים אינה זמינה" };

  const s = createServiceRoleClient();

  const { data: dup } = await s
    .from("booking_waitlist")
    .select("id")
    .eq("business_id", businessId)
    .eq("date", input.date)
    .eq("customer_phone", input.phone)
    .eq("status", "waiting")
    .maybeSingle();
  if (dup) return { ok: false, error: "כבר נרשמתם לרשימת ההמתנה ליום הזה" };

  const { count } = await s
    .from("booking_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("date", input.date)
    .eq("status", "waiting");
  if ((count ?? 0) >= MAX_WAITING_PER_DAY) {
    return { ok: false, error: "רשימת ההמתנה ליום זה מלאה — נסו יום אחר" };
  }

  const staffId = input.staffId && input.staffId !== STAFF_ANY ? input.staffId : null;

  const { error } = await s.from("booking_waitlist").insert({
    business_id: businessId,
    service_id: input.serviceId || null,
    staff_id: staffId,
    date: input.date,
    customer_name: input.name,
    customer_phone: input.phone,
    customer_email: input.email || null,
    status: "waiting",
  });
  if (error) return { ok: false, error: "ההרשמה נכשלה — נסו שוב" };
  return { ok: true };
}

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

/** Owner: upcoming waiting/notified waitlist entries, oldest date first. */
export async function listWaitlist(businessId: string): Promise<BookingWaitlistEntry[]> {
  const supabase = await createClient();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const { data, error } = await supabase
    .from("booking_waitlist")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["waiting", "notified"])
    .gte("date", todayStr)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Owner: removes a waitlist entry (e.g. once the customer booked elsewhere). */
export async function removeWaitlistEntry(businessId: string, entryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_waitlist")
    .delete()
    .eq("id", entryId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

// ── Cancellation hook (service role) ────────────────────────────────────────

/**
 * Notifies the oldest waiting-list entries for a business+date after a slot
 * frees up (owner/token cancellation or customer self-cancel/reschedule).
 * Entries with an email get a "התפנה תור" email; entries without one fall
 * back to WhatsApp when the business has a connected config. Every notified
 * entry is marked 'notified' regardless of send outcome, so the same
 * cancellation doesn't re-notify on a later call. Best-effort — NEVER throws.
 */
export async function notifyWaitlistForDate(businessId: string, dateStr: string): Promise<void> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const s = createServiceRoleClient();

    const { data: entries } = await s
      .from("booking_waitlist")
      .select("id,customer_name,customer_phone,customer_email")
      .eq("business_id", businessId)
      .eq("date", dateStr)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(NOTIFY_BATCH_SIZE);
    if (!entries || entries.length === 0) return;

    const [{ data: website }, { data: business }, { data: waConfig }] = await Promise.all([
      s.from("websites").select("slug").eq("business_id", businessId).eq("published", true).maybeSingle(),
      s.from("businesses").select("name").eq("id", businessId).maybeSingle(),
      s.from("whatsapp_config")
        .select("phone_number_id,access_token,connected")
        .eq("business_id", businessId).eq("connected", true).maybeSingle(),
    ]);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const siteUrl = website?.slug ? `${appUrl}/s/${website.slug}#booking` : appUrl;
    const businessName = business?.name ?? "העסק";
    const dateFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
    const dateText = dateFmt.format(new Date(`${dateStr}T12:00:00Z`));

    for (const entry of entries) {
      try {
        if (entry.customer_email) {
          await sendWaitlistSlotOpenEmail({
            to: entry.customer_email,
            businessName,
            dateStr: dateText,
            siteUrl,
          });
        } else if (waConfig?.phone_number_id && waConfig.access_token) {
          const to = normalizePhoneForWhatsapp(entry.customer_phone);
          if (to) {
            await sendWhatsappText({
              phoneNumberId: waConfig.phone_number_id,
              accessToken: openWhatsappSecret(waConfig.access_token) ?? "",
              to,
              body: `היי ${entry.customer_name}, התפנה תור ב${businessName} בתאריך ${dateText}! אפשר לקבוע כאן: ${siteUrl}`,
            });
          }
        }
      } catch {
        // per-entry send failure — still mark 'notified' below to avoid retry storms
      }

      await s.from("booking_waitlist")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", entry.id);
    }
  } catch {
    // best-effort — must never throw (called from cancellation flows)
  }
}
