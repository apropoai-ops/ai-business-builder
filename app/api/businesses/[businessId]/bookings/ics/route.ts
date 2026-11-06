import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

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
 * GET /api/businesses/:businessId/bookings/ics
 * Exports upcoming bookings (pending/confirmed) as an iCalendar (.ics) file.
 * Uses the RLS client, so non-owners receive an empty calendar.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;
  const supabase = await createClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: bookings, error }, { data: settings }, { data: staffRows }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, customer_name, customer_phone, service, staff_id, starts_at, ends_at, duration_minutes, status",
      )
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", since)
      .order("starts_at", { ascending: true })
      .limit(200),
    supabase
      .from("booking_settings")
      .select("slot_minutes")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("booking_staff")
      .select("id, name")
      .eq("business_id", businessId),
  ]);

  if (error) {
    return NextResponse.json({ error: "שגיאה בטעינת התורים" }, { status: 500 });
  }

  const staffNameOf = new Map((staffRows ?? []).map((r) => [r.id, r.name]));
  const slotMinutes = settings?.slot_minutes ?? 60;
  const dtstamp = toIcsUtc(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//AI Business Builder//Bookings//HE",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("תורים")}`,
  ];

  for (const booking of bookings ?? []) {
    const start = new Date(booking.starts_at);
    // Per-booking duration (service-aware); legacy rows fall back to the
    // business-wide slot length.
    const end = booking.ends_at
      ? new Date(booking.ends_at)
      : new Date(
          start.getTime() +
            (booking.duration_minutes ?? slotMinutes) * 60_000,
        );
    const staffName = booking.staff_id ? staffNameOf.get(booking.staff_id) : undefined;
    const summary = `תור: ${booking.customer_name}${
      booking.service ? ` — ${booking.service}` : ""
    }${staffName ? ` (אצל ${staffName})` : ""}`;
    const description = `טלפון: ${booking.customer_phone}\nסטטוס: ${
      STATUS_LABEL[booking.status] ?? booking.status
    }`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${booking.id}@ai-business-builder`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `STATUS:${booking.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bookings.ics"',
      "Cache-Control": "no-store",
    },
  });
}
