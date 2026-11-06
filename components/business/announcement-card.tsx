"use client";

import { useState, useTransition } from "react";
import { Megaphone, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setAnnouncementAction } from "@/lib/actions/announcement";

export function AnnouncementCard({
  businessId,
  initialText,
}: {
  businessId: string;
  initialText: string | null;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await setAnnouncementAction(businessId, text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(text.trim() ? "פס ההודעה נשמר ✓" : "פס ההודעה הוסר");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="size-4 text-primary" />
          פס הודעה באתר
        </div>
        <p className="text-xs text-muted-foreground">
          מוצג כפס עליון בולט באתר הציבורי (מבצעים, הודעות). השאירו ריק כדי להסתיר.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={160}
            placeholder="לדוגמה: 20% הנחה על כל החנות עד סוף החודש!"
            className="min-w-[200px] flex-1"
          />
          <Button onClick={save} disabled={isPending} className="gap-1.5">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4" />
            ) : null}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
