"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { signUpAction, type AuthActionState } from "@/lib/auth/actions";
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

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-6" />
          </div>
          <CardTitle className="text-2xl">בניית העסק מתחילה כאן</CardTitle>
          <CardDescription>
            צרו חשבון חינמי והפכו רעיון לעסק פעיל
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-4">
            {state.success ? (
              <p className="rounded-md bg-primary/10 p-3 text-sm text-primary">
                {state.success}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">שם מלא</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="ישראל ישראלי"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">טלפון נייד</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    placeholder="050-0000000"
                    autoComplete="tel"
                    minLength={9}
                    required
                  />
                </div>
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
                  <Label htmlFor="password">סיסמה</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    לפחות 8 תווים
                  </p>
                </div>
                {state.error && (
                  <p className="text-sm text-destructive">{state.error}</p>
                )}
              </>
            )}
          </CardContent>
          {!state.success && (
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                יצירת חשבון
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                כבר יש לכם חשבון?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  התחברות
                </Link>
              </p>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  );
}
