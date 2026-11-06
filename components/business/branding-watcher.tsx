"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useJobWatcher } from "@/hooks/use-job-watcher";

const STEPS = [
  "מגבש את אישיות המותג…",
  "בוחר פלטת צבעים מתאימה…",
  "מחפש פונטים ועיצוב…",
  "כותב סלוגן וקול מותג…",
  "מכין פרומפט ללוגו…",
];

export function BrandingWatcher({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/branding/status`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ready) router.refresh();
      else if (data.job?.status === "failed") {
        setFailed(data.job.error ?? "יצירת המיתוג נכשלה");
      }
    } catch { /* transient */ }
  }, [businessId, router]);

  const start = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/branding/generate`, {
        method: "POST",
      });
      if (res.status >= 500) {
        const data = await res.json().catch(() => ({}));
        if (data?.status === "failed") {
          setFailed(data.error ?? "יצירת המיתוג נכשלה");
          return;
        }
      }
    } catch { /* network hiccup */ }
    checkStatus();
  }, [businessId, checkStatus]);

  useJobWatcher({
    businessId,
    jobTypes: ["branding"],
    onTerminal: (job) => {
      if (job.status === "succeeded") router.refresh();
      else setFailed(job.error ?? "יצירת המיתוג נכשלה");
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
            <h3 className="font-semibold">יצירת המיתוג נכשלה</h3>
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
          <h3 className="font-semibold">ה-AI בונה את המותג שלכם</h3>
          <p className="text-sm text-muted-foreground">{STEPS[stepIndex]}</p>
        </div>
        <p className="text-xs text-muted-foreground">זה עשוי לקחת עד דקה.</p>
      </CardContent>
    </Card>
  );
}
