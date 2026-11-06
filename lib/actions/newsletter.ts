"use server";

import { checkRateLimit } from "@/lib/rate-limit";
import { subscribeNewsletter } from "@/lib/services/newsletter.service";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Public newsletter signup from a published business site (/s/[slug]).
 * Anonymous visitors submit their email; it lands in the owning business's
 * newsletter list. Honeypot + per-site rate limit guard against spam.
 */
export async function subscribeNewsletterAction(
  slug: string,
  email: string,
  honeypot?: string,
): Promise<{ ok: boolean; error?: string }> {
  // Honeypot tripped → pretend success, write nothing.
  if (honeypot) return { ok: true };

  // Anti-spam: cap subscriptions per site per hour.
  if (!(await checkRateLimit(`newsletter:${slug}`, 20, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const clean = email?.trim().slice(0, 160).toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) {
    return { ok: false, error: "נא להזין כתובת אימייל תקינה" };
  }

  return subscribeNewsletter(slug, clean);
}
