import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 "proxy" (formerly middleware). Refreshes the Supabase session
 * on every request and enforces auth for protected routes.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon and static assets
     * - public business websites under /s/ (served without auth)
     * - public price-quote pages under /q/ (served without auth)
     * - public hosted-payment pages under /pay/ (e.g. the demo gateway's fake
     *   checkout page — shoppers land here mid-checkout, never logged in)
     */
    "/((?!_next/static|_next/image|favicon.ico|s/|q/|pay/|staff-cal/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    /*
     * Storefront personal area: run the proxy here too so the shopper's
     * Supabase session cookie is refreshed. Public store pages stay excluded
     * above (kept fast / no auth round-trip). updateSession does not treat
     * these as owner-protected, so no redirect happens here.
     */
    "/s/:slug/account/:path*",
  ],
};
