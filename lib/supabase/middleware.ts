import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase auth session on every request and enforces auth
 * for protected routes. Must run in the root middleware so Server Components
 * always receive a valid session cookie.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Auth-code safety net: when Supabase rejects a redirect_to that is not in
  // the dashboard allowlist, it falls back to the Site URL — the PKCE code
  // then lands on the home page and the user is stranded. Forward it to the
  // auth callback so the sign-in still completes.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) {
      // A rescued code is nearly always an ordinary sign-in (Google, email
      // confirmation), so it goes to the dashboard. Recovery links are told
      // apart from the session itself in /auth/callback — assuming recovery
      // here sent every Google login through "choose a new password".
      url.searchParams.set("next", "/businesses");
    }
    return NextResponse.redirect(url);
  }

  const isProtected =
    pathname.startsWith("/businesses") || pathname.startsWith("/settings");
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Redirect unauthenticated users away from protected areas.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/businesses";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
