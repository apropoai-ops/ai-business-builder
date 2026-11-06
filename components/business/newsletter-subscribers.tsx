"use client";

import { useState } from "react";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsletterSubscriber } from "@/types/database";

export function NewsletterSubscribers({
  subscribers,
}: {
  subscribers: NewsletterSubscriber[];
}) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const emails = subscribers.map((s) => s.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      toast.success("כל המיילים הועתקו ✓");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  if (subscribers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          עדיין אין נרשמים — ברגע שמבקר יירשם לרשימת התפוצה באתר, הוא יופיע כאן
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4" />
          <span>
            <span className="font-semibold text-foreground">{subscribers.length}</span> נרשמים
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={copyAll}>
          <Copy className="size-3.5" />
          {copied ? "הועתק ✓" : "העתק את כל המיילים"}
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {subscribers.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span dir="ltr" className="text-sm font-medium">
                {s.email}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleDateString("he-IL", {
                  timeZone: "Asia/Jerusalem",
                  day: "numeric",
                  month: "numeric",
                  year: "2-digit",
                })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
