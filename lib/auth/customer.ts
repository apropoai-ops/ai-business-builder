import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Store shoppers authenticate through the same Supabase Auth as owners (one
 * shared auth.users table) — their identity is global, while the per-store
 * relationship is implicit via orders. These helpers are the storefront
 * equivalent of lib/auth/user.ts, but redirect to the *store-scoped* login.
 */

/** Returns the signed-in shopper, or null. Safe in Server Components. */
export async function getCustomerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the signed-in shopper, redirecting to the store's login page
 * (preserving where they were headed) if not signed in.
 */
export async function requireCustomerUser(slug: string, next?: string) {
  const user = await getCustomerUser();
  if (!user) {
    const target = next ?? `/s/${slug}/account`;
    redirect(`/s/${slug}/account/login?next=${encodeURIComponent(target)}`);
  }
  return user;
}
