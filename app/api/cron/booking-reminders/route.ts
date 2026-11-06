import { NextRequest, NextResponse } from "next/server";

import { sendBookingReminders, send1HourReminders } from "@/lib/services/booking-reminders.service";

export const maxDuration = 120;

/**
 * GET /api/cron/booking-reminders — Vercel Cron (vercel.json, every 15 min).
 * Runs both reminder passes each tick:
 *  - Day-before (sendBookingReminders): idempotent via reminder_sent_at, so
 *    running it every 15 minutes instead of once a day is harmless — it just
 *    catches tomorrow's bookings sooner and retries failed sends.
 *  - ~1-hour-before (send1HourReminders): idempotent via reminder_1h_sent_at,
 *    needs the 15-minute cadence to reliably land close to the 1h mark.
 * Both: email when possible, otherwise WhatsApp/SMS when connected,
 * otherwise a high-priority CRM task for the owner.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [dayBefore, oneHour] = await Promise.all([
    sendBookingReminders(),
    send1HourReminders(),
  ]);
  return NextResponse.json({ dayBefore, oneHour });
}
