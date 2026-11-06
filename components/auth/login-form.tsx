"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import {
  signInAction,
  signInWithGoogleAction,
  type AuthActionState,
} from "@/lib/auth/actions";
import { ENABLED_OAUTH_PROVIDERS } from "@/lib/auth-providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: AuthActionState = {};

export function LoginForm({
  next,
  oauthError = false,
}: {
  next: string;
  oauthError?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState,
  );
  const showGoogle = ENABLED_OAUTH_PROVIDERS.includes("google");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-6" />
          </div>
          <CardTitle className="text-2xl">ברוכים השבים</CardTitle>
          <CardDescription>
            התחברו לחשבון כדי להמשיך לבנות את העסק שלכם
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {oauthError && (
            <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
              ההתחברות עם חשבון חיצוני נכשלה או שאינה זמינה כרגע — אפשר
              להתחבר עם אימייל וסיסמה
            </p>
          )}

          {showGoogle && (
            <>
              <form action={signInWithGoogleAction}>
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-background py-2.5 text-sm font-medium transition hover:bg-muted"
                >
                  <GoogleIcon />
                  המשך עם Google
                </button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                או באמצעות אימייל
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
        </CardContent>

        <form action={formAction}>
          <input type="hidden" name="next" value={next} />
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">סיסמה</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  שכחתם סיסמה?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </div>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              התחברות
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              אין לכם חשבון?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                הרשמה
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
