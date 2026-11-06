"use client";

import { useActionState } from "react";
import { Loader2, LockKeyhole, UserRound } from "lucide-react";

import {
  changePasswordAction,
  updateProfileAction,
  type AuthActionState,
} from "@/lib/auth/actions";
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

function FormStatus({ state }: { state: AuthActionState }) {
  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (state.success) return <p className="text-sm text-green-600">{state.success}</p>;
  return null;
}

export function AccountSettings({ fullName }: { fullName: string }) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [pwState, pwAction, pwPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" />
            פרטים אישיים
          </CardTitle>
          <CardDescription>השם שמוצג בחשבון שלכם</CardDescription>
        </CardHeader>
        <form action={profileAction}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">שם מלא</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={fullName}
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <FormStatus state={profileState} />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={profilePending}>
              {profilePending && <Loader2 className="size-4 animate-spin" />}
              שמירה
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="size-4 text-primary" />
            שינוי סיסמה
          </CardTitle>
          <CardDescription>
            לאבטחת החשבון, נדרשת הסיסמה הנוכחית כדי לבחור חדשה
          </CardDescription>
        </CardHeader>
        <form action={pwAction}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">סיסמה נוכחית</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">סיסמה חדשה</Label>
              <Input
                id="newPassword"
                name="password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה חדשה</Label>
              <Input
                id="confirmPassword"
                name="confirm"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <FormStatus state={pwState} />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pwPending}>
              {pwPending && <Loader2 className="size-4 animate-spin" />}
              עדכון סיסמה
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
