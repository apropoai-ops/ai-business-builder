"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveStatAction, deleteStatAction } from "@/lib/actions/stats";
import { ImageField } from "@/components/business/image-field";
import type { StatItem } from "@/types/database";

export function StatsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: StatItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function add(formData: FormData) {
    startTransition(async () => {
      const res = await saveStatAction(businessId, {
        label: String(formData.get("label") ?? ""),
        value: String(formData.get("value") ?? ""),
        suffix: String(formData.get("suffix") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הנתון נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteStatAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" />
          במספרים
        </div>

        <form ref={formRef} action={add} className="grid gap-2 sm:grid-cols-2">
          <Input name="label" placeholder="כותרת (למשל לקוחות מרוצים)" required />
          <div className="flex gap-2">
            <Input name="value" placeholder="ערך (למשל 2700)" required />
            <Input name="suffix" dir="ltr" placeholder="סיומת (למשל +)" className="w-24" />
          </div>
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף נתון
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {s.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image_url}
                    alt={s.label}
                    className="size-10 rounded-full object-cover"
                  />
                )}
                <span className="font-bold">
                  {s.value}
                  {s.suffix ?? ""}
                </span>
                <span className="text-muted-foreground">{s.label}</span>
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(s.id)}
                    disabled={busyId === s.id}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
