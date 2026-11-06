import { createServiceRoleClient } from "@/lib/supabase/server";

const TZ = "Asia/Jerusalem";
const DAYS_AHEAD = 14;

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
};

export type StaffCalendarItem = {
  start: string; // HH:mm, Asia/Jerusalem
  end: string; // HH:mm, Asia/Jerusalem
  title: string;
  customer?: string;
  status: string;
};

export type StaffCalendarDay = {
  date: string; // YYYY-MM-DD, Asia/Jerusalem
  items: StaffCalendarItem[];
};

export type StaffCalendarResult = {
  ok: boolean;
  businessName?: string;
  staffName?: string;
  days?: StaffCalendarDay[];
};

/**
 * Public, token-authenticated read-only agenda for a single staff member —
 * the in-app alternative to an ICS subscription (no Google/Outlook account
 * needed). This is what powers /staff-cal/[token]?staff=<id>.
 *
 * NOTE on signature: the public route only carries a `token` (see
 * app/staff-cal/[token]/page.tsx) — there is no businessId segment in that
 * URL. The businessId is therefore resolved *from* the token itself (a
 * lookup on booking_settings.ics_feed_token), not passed in by the caller.
 * This mirrors verifyIcsFeedToken/getFeedBookings in booking.service.ts,
 * which use the service-role client because there is no user session on a
 * public page — the token in the URL is the credential.
 *
 * Never leaks other staff: when `staffId` is supplied it is verified to
 * belong to the resolved business before anything is returned, and every
 * bookings/events query is filtered by that staff id.
 */
export async function getStaffCalendar(
  token: string,
  staffId: string | null,
): Promise<StaffCalendarResult> {
  if (!token) return { ok: false };
  const s = createServiceRoleClient();

  const { data: settingsRows } = await s
    .from("booking_settings")
    .select("business_id")
    .eq("ics_feed_token", token)
    .limit(1);
  const businessId = settingsRows?.[0]?.business_id;
  if (!businessId) return { ok: false };

  const [{ data: business }, { data: staffRow }] = await Promise.all([
    s.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    staffId
      ? s.from("booking_staff").select("id,name").eq("business_id", businessId).eq("id", staffId).maybeSingle()
      : Promise.resolve({ data: null as { id: string; name: string } | null }),
  ]);

  // A staff id was requested but doesn't belong to this business — refuse
  // rather than silently falling back to the full calendar.
  if (staffId && !staffRow) return { ok: false };

  const rangeStart = new Date(Date.now() - 3600_000).toISOString(); // small backward buffer for in-progress appts
  const rangeEnd = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString();

  let bookingsQuery = s
    .from("bookings")
    .select("id,customer_name,service,staff_id,starts_at,ends_at,duration_minutes,status")
    .eq("business_id", businessId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd)
    .order("starts_at", { ascending: true })
    .limit(400);
  if (staffId) bookingsQuery = bookingsQuery.eq("staff_id", staffId);

  let eventsQuery = s
    .from("business_events")
    .select("id,title,staff_id,starts_at,ends_at,notes")
    .eq("business_id", businessId)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd)
    .order("starts_at", { ascending: true })
    .limit(300);
  if (staffId) eventsQuery = eventsQuery.eq("staff_id", staffId);

  const [{ data: bookings }, { data: events }] = await Promise.all([bookingsQuery, eventsQuery]);

  const dayMap = new Map<string, StaffCalendarItem[]>();
  function pushItem(dateKey: string, item: StaffCalendarItem) {
    const arr = dayMap.get(dateKey);
    if (arr) arr.push(item);
    else dayMap.set(dateKey, [item]);
  }

  for (const b of bookings ?? []) {
    const start = new Date(b.starts_at);
    const end = b.ends_at
      ? new Date(b.ends_at)
      : new Date(start.getTime() + (b.duration_minutes ?? 60) * 60_000);
    pushItem(dateFmt.format(start), {
      start: hmFmt.format(start),
      end: hmFmt.format(end),
      title: b.service ?? "תור",
      customer: b.customer_name,
      status: STATUS_LABEL[b.status] ?? b.status,
    });
  }

  for (const ev of events ?? []) {
    const start = new Date(ev.starts_at);
    const end = new Date(ev.ends_at);
    pushItem(dateFmt.format(start), {
      start: hmFmt.format(start),
      end: hmFmt.format(end),
      title: ev.title,
      status: "אירוע פנימי",
    });
  }

  const days: StaffCalendarDay[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
    }));

  return {
    ok: true,
    businessName: business?.name ?? "העסק",
    staffName: staffRow?.name,
    days,
  };
}
