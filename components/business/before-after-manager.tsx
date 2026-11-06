"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Images, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  saveBeforeAfterAction,
  deleteBeforeAfterAction,
} from "@/lib/actions/before-after";
import { ImageField } from "@/components/business/image-field";
import type { BeforeAfter } from "@/types/database";

export function BeforeAfterManager({
  businessId,
  items,
}: {
  businessId: string;
  items: BeforeAfter[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    if (!beforeUrl || !afterUrl) {
      toast.error("נא להעלות תמונת ׳לפני׳ ותמונת ׳אחרי׳");
      return;
    }
    startTransition(async () => {
      const res = await saveBeforeAfterAction(businessId, {
        title: String(formData.get("title") ?? ""),
        beforeUrl,
        afterUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("נוסף בהצלחה ✓");
        formRef.current?.reset();
        setBeforeUrl(null);
        setAfterUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteBeforeAfterAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Images className="size-4 text-primary" />
          לפני ואחרי
        </div>

        <form ref={formRef} action={create} className="grid gap-2">
          <Textarea
            name="title"
            rows={2}
            placeholder="כותרת / תיאור (לא חובה)"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <ImageField
              businessId={businessId}
              value={beforeUrl}
              onChange={setBeforeUrl}
              label="תמונת ׳לפני׳ (חובה)"
            />
            <ImageField
              businessId={businessId}
              value={afterUrl}
              onChange={setAfterUrl}
              label="תמונת ׳אחרי׳ (חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border p-2.5 text-sm"
              >
                <div className="flex shrink-0 gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.before_url}
                    alt="לפני"
                    loading="lazy"
                    className="size-12 rounded-md object-cover"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.after_url}
                    alt="אחרי"
                    loading="lazy"
                    className="size-12 rounded-md object-cover"
                  />
                </div>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {item.title || "ללא כותרת"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(item.id)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
