import { NextResponse, type NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyIcsFeedToken, getFeedBookings } from "@/lib/services/booking.service";
import { getFeedEvents } from "@/lib/services/business-events.service";

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
};

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Formats a Date as UTC basic format: YYYYMMDDTHHMMSSZ. */
function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Folds a content line to at most 75 octets per line (RFC 5545 §3.1).
 * Continuation lines are prefixed with a single space. Splits on character
 * boundaries so multi-byte UTF-8 sequences (Hebrew) are never broken.
 */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;

  const folded: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (currentBytes + chBytes > 75) {
      folded.push(current);
      current = " ";
      currentBytes = 1;
    }
    current += ch;
    currentBytes += chBytes;
  }
  folded.push(current);
  return folded.join("\r\n");
}

/**
 * GET /api/businesses/:businessId/bookings/feed/:token[?staff=<staffId>]
 * Public, token-authenticated live calendar feed (subscribable via
 * webcal://) combining upcoming bookings + internal business_events.
 * No user session required — the feed token in the URL is the credential.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; token: string }> },
) {
  const { businessId, token } = await params;

  const valid = await verifyIcsFeedToken(businessId, token);
  if (!valid) {
    return NextResponse.json({ error: "קישור לא תקף" }, { status: 404 });
  }

  const staffId = request.nextUrl.searchParams.get("staff");

  const s = createServiceRoleClient();
  const [{ data: business }, { data: staffRows }, bookings, events] = await Promise.all([
    s.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    s.from("booking_staff").select("id,name").eq("business_id", businessId),
    getFeedBookings(businessId, staffId),
    getFeedEvents(businessId, staffId),
  ]);

  const staffNameOf = new Map((staffRows ?? []).map((r) => [r.id, r.name]));
  const calName = staffId
    ? `${business?.name ?? "העסק"} — ${staffNameOf.get(staffId) ?? "צוות"}`
    : business?.name ?? "היומן שלי";
  const dtstamp = toIcsUtc(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//AI Business Builder//Live Feed//HE",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
  ];

  for (const booking of bookings) {
    const start = new Date(booking.starts_at);
    const end = booking.ends_at
      ? new Date(booking.ends_at)
      : new Date(start.getTime() + (booking.duration_minutes ?? 60) * 60_000);
    const staffName = booking.staff_id ? staffNameOf.get(booking.staff_id) : undefined;
    const summary = `תור: ${booking.customer_name}${booking.service ? ` — ${booking.service}` : ""}${
      staffName ? ` (אצל ${staffName})` : ""
    }`;
    const description = `סטטוס: ${STATUS_LABEL[booking.status] ?? booking.status}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${booking.id}@ai-business-builder`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `STATUS:${booking.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    );
  }

  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const end = new Date(ev.ends_at);
    const staffName = ev.staff_id ? staffNameOf.get(ev.staff_id) : undefined;
    const summary = `${ev.title}${staffName ? ` (${staffName})` : ""}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${ev.id}@ai-business-builder`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      ...(ev.notes ? [`DESCRIPTION:${escapeIcsText(ev.notes)}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendar.ics"',
      "Cache-Control": "no-store",
    },
  });
}
