"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { lastAuthMethod } from "@/lib/auth/amr";
import { safeNext } from "@/lib/auth/safe-next";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/lib/validation/auth";

export type AuthActionState = {
  error?: string;
  success?: string;
};

/**
 * The origin the user is actually browsing (production domain, the vercel.app
 * alias, or localhost). Auth-email links MUST redirect back to the SAME
 * origin — the PKCE code-verifier cookie lives there — so we never hardcode
 * a single domain here.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Sign in with email + password.
 */
export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "אימייל או סיסמה שגויים" };
  }

  revalidatePath("/", "layout");
  redirect(safeNext((formData.get("next") as string) ?? null));
}

/**
 * Owner-side Google sign-in — mirrors oauthSignInCustomerAction in
 * lib/actions/customer-auth.ts but for the platform dashboard. Gated on the
 * login page by NEXT_PUBLIC_AUTH_PROVIDERS.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = safeNext((formData.get("next") as string) ?? null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data?.url) {
    redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

/**
 * Register a new account with email + password.
 */
export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  // phone rides the metadata — the handle_new_user trigger copies it into
  // profiles, so it lands there even before the email is confirmed.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
    },
  });

  if (error) {
    return { error: "ההרשמה נכשלה. ייתכן שהאימייל כבר רשום." };
  }

  // Supabase obfuscates "email already registered" as a success with no
  // identities — surface it honestly so users aren't left waiting for a
  // confirmation email that will never arrive.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error:
        "האימייל הזה כבר רשום במערכת — נסו להתחבר, או לאפס סיסמה אם שכחתם אותה.",
    };
  }

  return {
    success:
      "נשלח אליך אימייל לאימות החשבון. אנא אשר אותו כדי להשלים את ההרשמה.",
  };
}

/**
 * Sends a password-reset email. Always reports success (no account enumeration).
 */
export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  if (!(await checkRateLimit(`pwreset:${parsed.data.email.toLowerCase()}`, 5, 3600))) {
    return { error: "יותר מדי בקשות — נסו שוב מאוחר יותר" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${await requestOrigin()}/auth/callback?next=/reset-password`,
    },
  );

  // Surface mail-rate-limit honestly (phrased so it doesn't confirm whether
  // the account exists) — otherwise users wait for an email that never comes.
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return {
      error:
        "נשלחו לאחרונה מספר קישורי איפוס. אם לא קיבלתם מייל — בדקו את תיקיית הספאם, המתינו כשעה ונסו שוב.",
    };
  }

  return {
    success: "אם האימייל רשום אצלנו — נשלח אליו קישור לאיפוס הסיסמה.",
  };
}

/**
 * Sets a new password for a user holding a recovery session
 * (arrived via the reset-password email link).
 */
export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();

  // Authoritative check (the page-level redirect is UX only): only a real
  // password-recovery session may go through this no-current-password path.
  // Any other authenticated session — a stolen/replayed cookie, an ordinary
  // signed-in user browsing here directly — must be rejected, exactly the
  // ambiguous-signal bug class the auth-callback recovery detection exists to
  // avoid on the other side of this same feature.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (lastAuthMethod(session?.access_token) !== "recovery") {
    return { error: "האיפוס נכשל — ייתכן שהקישור פג. בקשו קישור חדש." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "הסיסמה החדשה זהה לנוכחית — בחרו סיסמה אחרת"
          : "האיפוס נכשל — ייתכן שהקישור פג. בקשו קישור חדש.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/businesses");
}

/**
 * Changes the password for a signed-in user, after verifying the current one.
 */
export async function changePasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "יש להתחבר מחדש" };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return { error: "הסיסמה הנוכחית שגויה" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "הסיסמה החדשה זהה לנוכחית"
          : "שינוי הסיסמה נכשל — נסו שוב",
    };
  }

  return { success: "הסיסמה עודכנה בהצלחה" };
}

/**
 * Updates the signed-in user's display name (profiles.full_name).
 */
export async function updateProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 120);
  if (fullName.length < 2) return { error: "יש להזין שם מלא" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "יש להתחבר מחדש" };

  // Upsert (not update) — users created before the profiles trigger have no row.
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
  if (error) return { error: "השמירה נכשלה" };

  revalidatePath("/", "layout");
  return { success: "השם עודכן בהצלחה" };
}

/**
 * Sign out the current user.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * A store-customer account explicitly opting into the platform side —
 * clears the is_customer flag so the dashboard opens (used by the
 * CustomerAccountGate escape hatch).
 */
export async function continueAsOwnerAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.updateUser({ data: { is_customer: false } });
  }
  revalidatePath("/", "layout");
  redirect("/businesses");
}
