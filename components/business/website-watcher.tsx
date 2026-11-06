"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useJobWatcher } from "@/hooks/use-job-watcher";

const STEPS = [
  "כותב תוכן לדף הבית…",
  "בונה דף אודות…",
  "מפרט את השירותים…",
  "מכין שאלות נפוצות…",
  "מייעל את ה-SEO…",
];

export function WebsiteWatcher({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/website/status`, { cache: "no-store" });
      const data = await res.json();
      if (data.ready) router.refresh();
      else if (data.job?.status === "failed") {
        setFailed(data.job.error ?? "יצירת האתר נכשלה");
      }
    } catch { /* transient */ }
  }, [businessId, router]);

  const start = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/website/generate`, { method: "POST" });
      if (res.status >= 500) {
        const data = await res.json().catch(() => ({}));
        if (data?.status === "failed") { setFailed(data.error ?? "יצירת האתר נכשלה"); return; }
      }
    } catch { /* network hiccup */ }
    checkStatus();
  }, [businessId, checkStatus]);

  useJobWatcher({
    businessId,
    jobTypes: ["website"],
    onTerminal: (job) => {
      if (job.status === "succeeded") router.refresh();
      else setFailed(job.error ?? "יצירת האתר נכשלה");
    },
    fallbackPoll: checkStatus,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    const t = setInterval(() => setStepIndex((i) => (i + 1) % STEPS.length), 3000);
    return () => clearInterval(t);
  }, [start]);

  if (failed) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">יצירת האתר נכשלה</h3>
            <p className="max-w-md text-sm text-muted-foreground">{failed}</p>
          </div>
          <Button onClick={() => { setFailed(null); start(); }}>
            <RefreshCw className="size-4" /> נסו שוב
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
          <h3 className="font-semibold">ה-AI בונה את האתר שלכם</h3>
          <p className="text-sm text-muted-foreground">{STEPS[stepIndex]}</p>
        </div>
        <p className="text-xs text-muted-foreground">זה עשוי לקחת עד דקה.</p>
      </CardContent>
    </Card>
  );
}
