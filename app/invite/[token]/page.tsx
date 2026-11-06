import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

import { getUser } from "@/lib/auth/user";
import { acceptInvite } from "@/lib/services/members.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "הצטרפות לצוות" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Logged-out → send through login first, then come straight back here.
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const result = await acceptInvite(token, user.id, user.email);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        {result.ok ? (
          <>
            <CardHeader className="space-y-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <CheckCircle2 className="size-6" />
              </div>
              <CardTitle className="text-2xl">הצטרפת לצוות בהצלחה! 🎉</CardTitle>
              <CardDescription>
                יש לך עכשיו גישה לניהול העסק — אפשר להמשיך ללוח הבקרה
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                render={<Link href={`/businesses/${result.businessId}/overview`} />}
                className="w-full"
              >
                מעבר לעסק
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-2">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <XCircle className="size-6" />
              </div>
              <CardTitle className="text-2xl">ההזמנה לא תקפה</CardTitle>
              <CardDescription>
                {result.error ?? "לא ניתן היה לאמת את ההזמנה — ייתכן שהיא בוטלה או פגה"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/businesses" />} variant="outline" className="w-full">
                מעבר לעסקים שלי
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
