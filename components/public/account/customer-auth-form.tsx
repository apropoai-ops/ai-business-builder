"use client";

import { useState, useActionState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";

import {
  signInCustomerAction,
  signUpCustomerAction,
  oauthSignInCustomerAction,
  type CustomerAuthState,
} from "@/lib/actions/customer-auth";
import { ENABLED_OAUTH_PROVIDERS } from "@/lib/auth-providers";
import { TurnstileField } from "@/components/public/turnstile-field";
import { inkOn } from "@/lib/storefront-brand";

const PROVIDER_LABEL = {
  google: "המשך עם Google",
  facebook: "המשך עם Facebook",
  apple: "המשך עם Apple",
} as const;

const initial: CustomerAuthState = {};

/**
 * Storefront login/registration. Two modes (login / signup) plus social login.
 * Brand-themed to match the store. `slug` + `next` travel as hidden fields so
 * the server actions know which store to scope to and where to return.
 */
export function CustomerAuthForm({
  slug,
  brand,
  next,
}: {
  slug: string;
  brand: string;
  next: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    signInCustomerAction,
    initial,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signUpCustomerAction,
    initial,
  );

  const isLogin = mode === "login";
  const state = isLogin ? loginState : signupState;
  const pending = isLogin ? loginPending : signupPending;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{isLogin ? "התחברות" : "הרשמה"}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {isLogin
            ? "התחברו כדי לראות הזמנות, כתובות ואמצעי תשלום"
            : "פתחו חשבון כדי לעקוב אחרי ההזמנות ולשמור פרטים לקנייה מהירה"}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === m ? "bg-white shadow-sm" : "text-zinc-500"
            }`}
            style={mode === m ? { color: brand } : undefined}
          >
            {m === "login" ? "התחברות" : "הרשמה"}
          </button>
        ))}
      </div>

      {/* Social login — only providers actually configured in Supabase Auth */}
      {ENABLED_OAUTH_PROVIDERS.length > 0 && (
        <>
          <div className="space-y-2">
            {ENABLED_OAUTH_PROVIDERS.map((p) => (
              <SocialButton key={p} slug={slug} next={next} provider={p} label={PROVIDER_LABEL[p]} />
            ))}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            או באמצעות אימייל
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      )}

      {/* Email/password form */}
      <form
        action={isLogin ? loginAction : signupAction}
        className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="next" value={next} />

        {!isLogin && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">שם מלא</label>
              <input
                name="fullName"
                required
                minLength={2}
                autoComplete="name"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                placeholder="ישראל ישראלי"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">טלפון נייד</label>
              <input
                name="phone"
                type="tel"
                dir="ltr"
                required
                minLength={9}
                autoComplete="tel"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
                placeholder="050-0000000"
              />
              <p className="mt-1 text-xs text-zinc-400">
                כדי שקביעת תור תהיה בלחיצה אחת — בלי למלא פרטים כל פעם
              </p>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">אימייל</label>
          <input
            name="email"
            type="email"
            dir="ltr"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">סיסמה</label>
          <input
            name="password"
            type="password"
            dir="ltr"
            required
            minLength={isLogin ? 6 : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
            placeholder="••••••••"
          />
        </div>

        {!isLogin && <TurnstileField />}

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: brand, color: inkOn(brand) }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLogin ? (
            <LogIn className="size-4" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {isLogin ? "התחברות" : "יצירת חשבון"}
        </button>
      </form>
    </div>
  );
}

function SocialButton({
  slug,
  next,
  provider,
  label,
}: {
  slug: string;
  next: string;
  provider: "google" | "facebook" | "apple";
  label: string;
}) {
  return (
    <form action={oauthSignInCustomerAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="provider" value={provider} />
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        <ProviderIcon provider={provider} />
        {label}
      </button>
    </form>
  );
}

function ProviderIcon({ provider }: { provider: "google" | "facebook" | "apple" }) {
  if (provider === "google") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    );
  }
  if (provider === "facebook") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
      </svg>
    );
  }
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#000" d="M16.37 1.43c0 1.14-.42 2.27-1.25 3.1-.83.85-2.18 1.5-3.3 1.41-.13-1.12.42-2.3 1.2-3.04.86-.85 2.32-1.46 3.35-1.47zM20.6 17.1c-.6 1.4-.9 2.02-1.67 3.26-1.08 1.73-2.6 3.88-4.48 3.9-1.67.02-2.1-1.09-4.37-1.08-2.27.01-2.74 1.1-4.41 1.08-1.88-.02-3.32-1.96-4.4-3.69C-1.7 16.16-2 9.77 1.06 6.84a6.07 6.07 0 0 1 4.4-1.99c1.6 0 2.6 1.09 3.92 1.09 1.28 0 2.06-1.09 3.92-1.09 1.4 0 2.88.76 3.94 2.07-3.46 1.9-2.9 6.84.36 8.18z" />
    </svg>
  );
}
