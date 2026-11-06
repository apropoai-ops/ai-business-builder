import Link from "next/link";
import { Store, LogOut, Briefcase } from "lucide-react";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { signOutAction, continueAsOwnerAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shown instead of the platform dashboard when a STORE CUSTOMER account
 * (signed up through a business's storefront to book/shop) lands on
 * apropo.business — customers have no subscription here and should be
 * routed back to the store they belong to.
 */
export async function CustomerAccountGate({ userId }: { userId: string }) {
  // Best-effort: find the storefront this customer belongs to (via their
  // latest booking or order) so we can send them straight back.
  const s = createServiceRoleClient();
  let storeSlug: string | null = null;
  let storeName: string | null = null;
  const { data: booking } = await s
    .from("bookings")
    .select("business_id")
    .eq("customer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const businessId =
    booking?.business_id ??
    (
      await s
        .from("orders")
        .select("business_id")
        .eq("customer_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data?.business_id ??
    null;
  if (businessId) {
    const [{ data: site }, { data: business }] = await Promise.all([
      s.from("websites").select("slug").eq("business_id", businessId).eq("published", true).maybeSingle(),
      s.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    ]);
    storeSlug = site?.slug ?? null;
    storeName = business?.name ?? null;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="size-6" />
          </div>
          <CardTitle className="text-2xl">זהו חשבון לקוח</CardTitle>
          <CardDescription>
            החשבון הזה נוצר דרך אתר של עסק — הוא משמש לקביעת תורים ולקניות
            באתרי העסקים, ולא לניהול עסק בפלטפורמה.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {storeSlug && (
            <Button render={<Link href={`/s/${storeSlug}`} />} className="w-full">
              <Store className="size-4" />
              חזרה ל{storeName ?? "חנות"}
            </Button>
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              <LogOut className="size-4" />
              התנתקות והתחברות עם חשבון אחר
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <form action={continueAsOwnerAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              <Briefcase className="size-3.5" />
              רוצים דווקא לפתוח עסק בפלטפורמה? המשיכו כבעלי עסק
            </button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
