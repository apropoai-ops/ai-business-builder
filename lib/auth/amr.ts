/**
 * The most recent authentication method recorded on a Supabase session — the
 * access token's `amr` claim, whose entries are ordered newest-first.
 *
 * Only a real password-recovery link reports "recovery". That is the one
 * reliable way to tell a reset apart from an ordinary sign-in: when Supabase
 * rejects a redirect_to it falls back to the Site URL and our own `next`
 * marker is gone, so the URL alone can't be trusted.
 *
 * Returns null for anything unreadable — the caller then treats the arrival as
 * a normal sign-in, which is the safe default (no password prompt).
 */
export function lastAuthMethod(accessToken: string | undefined | null): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    const amr = (claims as { amr?: unknown })?.amr;
    if (!Array.isArray(amr)) return null;
    const method = (amr[0] as { method?: unknown } | undefined)?.method;
    return typeof method === "string" ? method : null;
  } catch {
    return null;
  }
}
