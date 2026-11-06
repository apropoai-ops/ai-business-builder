import { ShieldAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { lastAuthMethod } from "@/lib/auth/amr";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "איפוס סיסמה" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Require an actual recovery session, not just "someone is signed in" — any
  // authenticated visitor (stolen cookie, shared computer) hitting this URL
  // directly must NOT be able to silently set a new password with no
  // knowledge of the current one. See resetPasswordAction for the same check
  // enforced server-side on the actual mutation.
  const isRecovery = user && lastAuthMethod(session?.access_token) === "recovery";

  // No recovery session — the email link expired, was already used, or this
  // is a signed-in user who is not mid-recovery.
  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-2xl">הקישור אינו תקף</CardTitle>
            <CardDescription>
              קישור האיפוס פג או שכבר נעשה בו שימוש. בקשו קישור חדש.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonLink href="/forgot-password" className="w-full">
              בקשת קישור חדש
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
