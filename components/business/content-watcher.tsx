"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useJobWatcher } from "@/hooks/use-job-watcher";

export function ContentWatcher({ businessId }: { businessId: string }) {
  const router = useRouter();

  useJobWatcher({
    businessId,
    jobTypes: ["content"],
    onTerminal: () => router.refresh(),
    fallbackPoll: async () => {
      const res = await fetch(`/api/businesses/${businessId}/content/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.job?.status === "succeeded" || data.job?.status === "failed") {
        router.refresh();
      }
    },
  });

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
      <Loader2 className="size-7 animate-spin text-primary" />
      <p className="text-sm">מייצר תוכן... זה יכול לקחת כחצי דקה</p>
    </div>
  );
}
