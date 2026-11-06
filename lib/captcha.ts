/**
 * Cloudflare Turnstile verification (server-side).
 * DORMANT until TURNSTILE_SECRET_KEY is set — verification always passes, so
 * public forms keep working before the widget is configured. Uses plain
 * fetch (no SDK dependency).
 */

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

/**
 * Verifies a Turnstile response token. Returns true (pass-through) when
 * TURNSTILE_SECRET_KEY is unset, so nothing breaks before configuration.
 * Fails closed once configured: a missing/invalid token is rejected.
 */
export async function verifyTurnstileToken(
  token: string | null,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Network/provider failure — fail closed so spam can't slip through
    // just because Cloudflare had a hiccup.
    return false;
  }
}
