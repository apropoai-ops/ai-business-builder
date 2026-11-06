"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveProcessStepAction,
  deleteProcessStepAction,
} from "@/lib/actions/process-steps";
import { ImageField } from "@/components/business/image-field";
import type { ProcessStep } from "@/types/database";

export function ProcessStepsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: ProcessStep[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function add(formData: FormData) {
    startTransition(async () => {
      const res = await saveProcessStepAction(businessId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("השלב נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteProcessStepAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ListOrdered className="size-4 text-primary" />
          איך זה עובד — שלבי התהליך
        </div>

        <form ref={formRef} action={add} className="space-y-2">
          <Input name="title" placeholder="כותרת השלב (למשל: יצירת קשר)" required />
          <Textarea
            name="description"
            placeholder="תיאור קצר של השלב (לא חובה)"
            rows={2}
          />
          <ImageField
            businessId={businessId}
            value={imageUrl}
            onChange={setImageUrl}
          />
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף שלב
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((step, i) => (
              <div
                key={step.id}
                className="flex items-start gap-3 rounded-lg border p-2.5 text-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                {step.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.image_url}
                    alt={step.title}
                    className="size-10 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{step.title}</div>
                  {step.description && (
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(step.id)}
                  disabled={busyId === step.id}
                >
                  {busyId === step.id ? (
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
