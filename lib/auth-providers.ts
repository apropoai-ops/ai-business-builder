/** Client-safe list of social-login providers enabled for this deployment. */

export type OAuthProvider = "google" | "facebook" | "apple";

const KNOWN: OAuthProvider[] = ["google", "facebook", "apple"];

/**
 * Providers are opt-in via NEXT_PUBLIC_AUTH_PROVIDERS (comma-separated, e.g.
 * "google,facebook") so the storefront never shows a login button for a
 * provider that isn't actually configured in Supabase Auth — an unconfigured
 * provider hard-fails with "provider is not enabled" mid-redirect.
 */
export const ENABLED_OAUTH_PROVIDERS: OAuthProvider[] = (
  (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean) as OAuthProvider[]
).filter((p) => KNOWN.includes(p));
