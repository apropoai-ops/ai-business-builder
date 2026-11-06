"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { cancelBookingByToken } from "@/lib/services/booking.service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public self-service cancellation (anonymous visitor with a cancel link).
 * Server-side rules mirror the /cancel/[token] page:
 * unknown token, already cancelled, or under 2 hours notice → error.
 */
export async function cancelBookingByTokenAction(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!token || !UUID_RE.test(token)) {
    return { ok: false, error: "הקישור אינו תקף" };
  }

  if (!(await checkRateLimit(`cancel:${token}`, 5, 3600))) {
    return { ok: false, error: "יותר מדי ניסיונות כרגע — נסו שוב מאוחר יותר" };
  }

  return cancelBookingByToken(token);
}
