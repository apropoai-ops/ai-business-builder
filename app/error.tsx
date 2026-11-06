"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
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
    // Client crashes never reach the server logs — beacon them so they can
    // be diagnosed remotely (see app/api/client-error/route.ts).
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

  // Per the Next.js 16 docs, unstable_retry re-fetches the segment and is
  // preferred over reset(); fall back to reset() if it's unavailable.
  const retry = unstable_retry ?? reset;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle className="text-2xl">משהו השתבש</CardTitle>
          <CardDescription>
            אירעה שגיאה לא צפויה. אפשר לנסות שוב, ואם הבעיה נמשכת — חזרו לדף
            הבית.
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
        <CardFooter className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => retry()}>
            <RotateCcw className="size-4" />
            נסו שוב
          </Button>
          <ButtonLink href="/" variant="outline">
            לדף הבית
          </ButtonLink>
        </CardFooter>
      </Card>
    </div>
  );
}
