/**
 * Normalizes a phone number to WhatsApp international format (digits only).
 * Israeli local numbers ("050-1234567", "03 1234567") become 972-prefixed;
 * numbers already carrying a country code pass through unchanged.
 * Returns null when there aren't enough digits to be a real number.
 */
export function normalizePhoneForWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  // Already international (no leading zero, not IL) — trust as-is.
  return digits;
}

/**
 * Builds a free wa.me click-to-chat URL (no Meta API needed) with an optional
 * pre-filled message. Returns null when the phone can't be normalized.
 */
export function buildWaMeUrl(rawPhone: string, text?: string): string | null {
  const digits = normalizePhoneForWhatsapp(rawPhone);
  if (!digits) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}
