"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export type CustomerAuthState = { error?: string; success?: string };

/**
 * The origin the shopper is actually browsing. Auth-email links must return
 * to the SAME origin (the PKCE code-verifier cookie lives there) — never a
 * hardcoded domain.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Where the storefront login lives for a given store. */
function accountPath(slug: string) {
  return `/s/${slug}/account`;
}

/** Validates the optional post-login redirect — only same-origin storefront paths. */
function safeNext(slug: string, next: string | null): string {
  if (next && next.startsWith(`/s/${slug}/`)) return next;
  return accountPath(slug);
}

const credsSchema = z.object({
  email: z.string().email("אימייל לא תקין"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

// New accounts need 8+ characters (matches the owner signup and the Supabase
// Auth minimum). Login stays at 6 so shoppers who registered earlier can still
// sign in.
const signupSchema = credsSchema.extend({
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
  fullName: z.string().trim().min(2, "נא להזין שם מלא"),
  phone: z.string().trim().min(9, "נא למלא טלפון תקין").max(40),
});

/** Shopper registration (email + password) on the storefront. */
export async function signUpCustomerAction(
  _prev: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "החנות אינה זמינה" };

  if (!(await checkRateLimit(`cust-auth:${slug}`, 20, 3600))) {
    return { error: "יותר מדי ניסיונות — נסו שוב מאוחר יותר" };
  }

  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const next = safeNext(slug, (formData.get("next") as string) ?? null);
  const captchaToken = (formData.get("captchaToken") as string) || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // phone rides the auth metadata too, so booking prefill works even
      // before the profile row exists (e.g. the email-confirmation flow).
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone, is_customer: true },
      emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      // Supabase Auth's native captcha — harmless no-op if the dashboard
      // toggle is off; only enforced when a Turnstile secret is configured
      // there AND the client sent a token (see turnstile-field.tsx).
      captchaToken,
    },
  });
  if (error) {
    return { error: "ההרשמה נכשלה. ייתכן שהאימייל כבר רשום." };
  }

  // Supabase obfuscates "email already registered" as a success with no
  // identities — surface it honestly so shoppers aren't left waiting for a
  // confirmation email that will never arrive.
  if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
    return {
      error: "האימייל הזה כבר רשום — נסו להתחבר, או לאפס סיסמה אם שכחתם אותה.",
    };
  }

  // If email confirmation is off, a session is returned immediately → go in.
  if (data.session) {
    // Persist name+phone to the profile now so booking is one-tap from the
    // very first visit (best-effort — metadata fallback covers failures).
    await supabase.from("customer_profiles").upsert(
      {
        id: data.session.user.id,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    revalidatePath(accountPath(slug), "layout");
    redirect(next);
  }

  return {
    success: "שלחנו אליכם אימייל לאישור החשבון. אשרו אותו ואז התחברו.",
  };
}

/** Shopper login (email + password). */
export async function signInCustomerAction(
  _prev: CustomerAuthState,
  formData: FormData,
): Promise<CustomerAuthState> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return { error: "החנות אינה זמינה" };

  if (!(await checkRateLimit(`cust-auth:${slug}`, 20, 3600))) {
    return { error: "יותר מדי ניסיונות — נסו שוב מאוחר יותר" };
  }

  const parsed = credsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const next = safeNext(slug, (formData.get("next") as string) ?? null);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "אימייל או סיסמה שגויים" };

  revalidatePath(accountPath(slug), "layout");
  redirect(next);
}

/**
 * Social login. Supabase returns the provider's authorize URL; we redirect the
 * shopper there, and the provider sends them back to /auth/callback which
 * exchanges the code and forwards to `next`.
 *
 * NOTE: each provider must be enabled with its client id/secret in the Supabase
 * dashboard. Google & Facebook are free; Apple needs a paid Apple Developer
 * account (deferred — see docs/wave-a-customer-accounts.md).
 */
export async function oauthSignInCustomerAction(
  formData: FormData,
): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const provider = String(formData.get("provider") ?? "") as
    | "google"
    | "facebook"
    | "apple";
  if (!slug || !["google", "facebook", "apple"].includes(provider)) {
    redirect(`/s/${slug}/account/login?error=provider`);
  }

  const next = safeNext(slug, (formData.get("next") as string) ?? null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data?.url) {
    redirect(`/s/${slug}/account/login?error=oauth`);
  }
  redirect(data.url);
}

/** Sign the shopper out and return them to the storefront. */
export async function signOutCustomerAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(`/s/${slug}`, "layout");
  redirect(`/s/${slug}`);
}
