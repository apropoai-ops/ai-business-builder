"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

import { forgotPasswordAction, type AuthActionState } from "@/lib/auth/actions";
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

type Props = {
  /** True when the user arrived from an expired/used reset link. */
  expiredLink?: boolean;
};

export function ForgotPasswordForm({ expiredLink = false }: Props) {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </div>
          <CardTitle className="text-2xl">שכחתם סיסמה?</CardTitle>
          <CardDescription>
            הזינו את האימייל שלכם ונשלח לכם קישור לאיפוס הסיסמה
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-4">
            {expiredLink && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p>
                  קישור האיפוס פג או שכבר נעשה בו שימוש. שלחו קישור חדש —
                  ופתחו אותו באותו דפדפן ומכשיר שבו ביקשתם אותו.
                </p>
              </div>
            )}
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
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm text-green-600">{state.success}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              שליחת קישור איפוס
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              נזכרתם בסיסמה?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                התחברות
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
