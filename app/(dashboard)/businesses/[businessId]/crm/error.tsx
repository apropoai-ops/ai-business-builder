"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

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
 * Scoped to the CRM segment so a failing query here (leads/customers/deals/
 * orders/returns/WhatsApp all load in one server component — see crm/page.tsx)
 * blanks only this screen, not the dashboard sidebar/nav around it like the
 * root app/error.tsx would.
 */
export default function CrmError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
      }),
    }).catch(() => {});
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle className="text-2xl">לא הצלחנו לטעון את מסך הלקוחות</CardTitle>
          <CardDescription>
            אירעה שגיאה לא צפויה בטעינת הלידים, הלקוחות או ההזמנות. אפשר לנסות
            שוב — שאר המערכת ממשיכה לעבוד כרגיל.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              קוד שגיאה:{" "}
              <span dir="ltr" className="font-mono">
                {error.digest}
              </span>
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => retry()}>
            <RotateCcw className="size-4" />
            נסו שוב
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
