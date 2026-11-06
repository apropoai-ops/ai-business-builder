/**
 * Write-side rules for `websites.landing_settings` — the owner-controlled knobs
 * of a landing page (countdown, video link, gallery images).
 *
 * `parseLandingSettings` in lib/ai/schemas/landing.ts is the READ side: it is
 * forgiving by design, because whatever is already in the column has to render.
 * This module is the WRITE side and is deliberately strict: a video link that
 * can't be embedded, or a gallery URL that isn't an http(s) image, must be
 * refused at save time rather than silently swallowed and mysteriously missing
 * from the page later.
 *
 * Pure & dependency-light (only zonedToUtc + toVideoEmbedUrl) so the manager
 * form, the server action and the unit tests all share one definition of valid.
 *
 * TIMEZONE: an `<input type="datetime-local">` yields a naked "YYYY-MM-DDTHH:mm"
 * with no offset. Reading that on the server would interpret it in the SERVER's
 * zone (UTC on Vercel) and silently shift an Israeli owner's deadline by 2-3
 * hours, so naked values are always resolved through Asia/Jerusalem — the same
 * rule the booking engine uses.
 */

import { zonedToUtc } from "@/lib/booking-shared";
import { toVideoEmbedUrl } from "@/lib/video-embed";
import type { LandingSettings } from "@/lib/ai/schemas/landing";

const TZ = "Asia/Jerusalem";

/** The gallery renders as a 3-column grid; more than 3 rows stops being a teaser. */
export const MAX_GALLERY_IMAGES = 9;
/** The label sits above the timer on one line. */
export const MAX_COUNTDOWN_LABEL = 60;

/** "YYYY-MM-DDTHH:mm" (optionally with seconds) and NO timezone designator. */
const NAKED_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/;

export interface LandingSettingsInput {
  countdownEnabled?: unknown;
  countdownEndsAt?: unknown;
  countdownLabel?: unknown;
  videoUrl?: unknown;
  galleryUrls?: unknown;
}

export type NormalizeResult =
  | { ok: true; settings: LandingSettings }
  | { ok: false; error: string };

/**
 * datetime-local value (Israel wall-clock) → UTC ISO string.
 * Values that already carry a zone ("…Z", "…+03:00") are passed through as-is,
 * so re-saving a row written by the seed script doesn't drift.
 */
export function countdownIsoFromLocal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const naked = NAKED_LOCAL.exec(raw);
  if (naked) {
    const date = zonedToUtc(naked[1], naked[2]);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Stored ISO → the "YYYY-MM-DDTHH:mm" an `<input type="datetime-local">` wants,
 * expressed in Israel time regardless of the device the owner is editing from.
 * Returns "" for missing/invalid input so it can drive an empty field.
 */
export function countdownLocalFromIso(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // Intl renders midnight as "24" in some ICU versions — normalize it.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** An image the storefront can actually load: absolute http(s), nothing else. */
function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validates and canonicalizes one save of the landing settings form.
 * Returns a Hebrew error instead of a partially-applied object — a half-saved
 * countdown (enabled, no date) is worse than a rejected save.
 */
export function normalizeLandingSettings(input: LandingSettingsInput): NormalizeResult {
  const countdownEnabled = input.countdownEnabled === true;
  const countdownEndsAt = countdownIsoFromLocal(input.countdownEndsAt);

  if (typeof input.countdownEndsAt === "string" && input.countdownEndsAt.trim() && !countdownEndsAt) {
    return { ok: false, error: "תאריך הסיום של הטיימר לא תקין" };
  }
  if (countdownEnabled && !countdownEndsAt) {
    return { ok: false, error: "כדי להפעיל טיימר צריך לבחור תאריך ושעת סיום" };
  }

  const labelRaw = typeof input.countdownLabel === "string" ? input.countdownLabel.trim() : "";
  if (labelRaw.length > MAX_COUNTDOWN_LABEL) {
    return { ok: false, error: `תווית הטיימר ארוכה מדי (עד ${MAX_COUNTDOWN_LABEL} תווים)` };
  }

  const videoRaw = typeof input.videoUrl === "string" ? input.videoUrl.trim() : "";
  if (videoRaw && !toVideoEmbedUrl(videoRaw)) {
    return {
      ok: false,
      error: "קישור הווידאו לא נתמך — הדביקו קישור YouTube או Vimeo",
    };
  }

  const galleryUrls: string[] = [];
  if (Array.isArray(input.galleryUrls)) {
    for (const entry of input.galleryUrls) {
      if (typeof entry !== "string") continue;
      const url = entry.trim();
      if (!url || !isSafeImageUrl(url) || galleryUrls.includes(url)) continue;
      galleryUrls.push(url);
    }
  }
  if (galleryUrls.length > MAX_GALLERY_IMAGES) {
    return { ok: false, error: `אפשר עד ${MAX_GALLERY_IMAGES} תמונות בגלריה` };
  }

  return {
    ok: true,
    settings: {
      countdownEnabled,
      countdownEndsAt,
      countdownLabel: labelRaw || null,
      videoUrl: videoRaw || null,
      galleryUrls,
    },
  };
}

/**
 * True when an ENABLED countdown already ran out. The public timer hides itself
 * once it hits zero, so this is the difference between "no timer" and "a timer
 * the owner forgot to move" — the manager warns instead of failing the save.
 */
export function isCountdownExpired(
  settings: Pick<LandingSettings, "countdownEnabled" | "countdownEndsAt">,
  now: number = Date.now(),
): boolean {
  if (settings.countdownEnabled !== true) return false;
  const ms = settings.countdownEndsAt ? Date.parse(settings.countdownEndsAt) : NaN;
  return Number.isFinite(ms) && ms <= now;
}
