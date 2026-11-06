"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useJobWatcher } from "@/hooks/use-job-watcher";

const STEPS = [
  "מנתח את הרעיון העסקי…",
  "מגבש מודל עסקי והצעת ערך…",
  "מזהה פלחי לקוחות ומקורות הכנסה…",
  "בונה אסטרטגיית תמחור ותוכנית השקה…",
];

/**
 * Kicks off (idempotently) and watches business-plan generation.
 * Realtime job updates + slow fallback poll; refreshes the page when ready.
 */
export function GenerationWatcher({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/status`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.status === "ready") router.refresh();
      else if (data.job?.status === "failed") {
        setFailed(data.job.error ?? "ייצור התוכנית נכשל");
      }
    } catch {
      // transient network error — next tick will retry
    }
  }, [businessId, router]);

  const start = useCallback(async () => {
    // Trigger generation (safe to call repeatedly).
    try {
      const res = await fetch(`/api/businesses/${businessId}/generate`, {
        method: "POST",
      });
      if (res.status >= 500) {
        const data = await res.json().catch(() => ({}));
        if (data?.status === "failed") {
          setFailed(data.error ?? "ייצור התוכנית נכשל");
          return;
        }
      }
    } catch {
      // network hiccup — realtime/fallback will pick the result up
    }
    checkStatus();
  }, [businessId, checkStatus]);

  useJobWatcher({
    businessId,
    jobTypes: ["business_plan"],
    onTerminal: (job) => {
      if (job.status === "succeeded") router.refresh();
      else setFailed(job.error ?? "ייצור התוכנית נכשל");
    },
    fallbackPoll: checkStatus,
  });

  useEffect(() => {
    // Kicks off generation on mount. setState only happens inside async
    // callbacks (network responses), not synchronously during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    const stepTimer = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 3000);
    return () => clearInterval(stepTimer);
  }, [start]);

  if (failed) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">ייצור התוכנית נכשל</h3>
            <p className="max-w-md text-sm text-muted-foreground">{failed}</p>
            <p className="text-xs text-muted-foreground">
              ודאו שמפתחות ה-AI מוגדרים, ונסו שוב.
            </p>
          </div>
          <Button
            onClick={() => {
              setFailed(null);
              start();
            }}
          >
            <RefreshCw className="size-4" />
            נסו שוב
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="space-y-1">
          <h3 className="font-semibold">ה-AI בונה את התוכנית העסקית שלכם</h3>
          <p className="text-sm text-muted-foreground">{STEPS[stepIndex]}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          זה עשוי לקחת עד דקה. אפשר להישאר בעמוד.
        </p>
      </CardContent>
    </Card>
  );
}
