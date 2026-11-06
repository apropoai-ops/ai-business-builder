import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { lastAuthMethod } from "@/lib/auth/amr";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Handles the auth code exchange after email confirmation / OAuth redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Every other post-auth redirect in the app validates `next` through
  // safeNext() before using it; this route used to trust the raw query param,
  // which — concatenated as `${origin}${next}` rather than parsed via
  // `new URL()` — is an open-redirect shape (e.g. `next=@evil.com` resolving
  // as userinfo on `evil.com`).
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Arrivals from a storefront (/s/...) are STORE CUSTOMERS — flag them so
      // the platform dashboard can tell them apart from business owners. The
      // flag is additive-only here; the dashboard gate ignores it for anyone
      // who actually owns businesses.
      if (next.startsWith("/s/")) {
        const { data: current } = await supabase.auth.getUser();
        if (
          current.user &&
          current.user.user_metadata?.is_customer === undefined
        ) {
          await supabase.auth
            .updateUser({ data: { is_customer: true } })
            .catch(() => {});
        }
      }
      // A recovery link must still end at the new-password screen even when
      // Supabase stripped our `next` (rejected redirect_to → Site URL
      // fallback). Storefront arrivals are left alone — that flow has no
      // password screen of its own.
      if (
        !next.startsWith("/s/") &&
        lastAuthMethod(data.session?.access_token) === "recovery"
      ) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // A failed recovery exchange (expired/used link, or a link opened in a
  // different browser than the one that requested it) gets a clear retry path.
  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
