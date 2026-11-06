"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  savePricingPlanAction,
  deletePricingPlanAction,
} from "@/lib/actions/pricing";
import { ImageField } from "@/components/business/image-field";
import type { PricingPlan } from "@/types/database";

export function PricingManager({
  businessId,
  items,
}: {
  businessId: string;
  items: PricingPlan[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [highlight, setHighlight] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await savePricingPlanAction(businessId, {
        name: String(formData.get("name") ?? ""),
        price: String(formData.get("price") ?? ""),
        period: String(formData.get("period") ?? ""),
        features: String(formData.get("features") ?? "").split("\n"),
        highlight,
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("החבילה נוספה ✓");
        formRef.current?.reset();
        setHighlight(false);
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deletePricingPlanAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Package className="size-4 text-primary" />
          חבילות ומחירים
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="שם החבילה (למשל בסיסי)" required />
          <div className="flex gap-2">
            <Input
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="מחיר ₪ (לא חובה)"
            />
            <Input name="period" placeholder="תקופה (למשל לחודש)" />
          </div>
          <Textarea
            name="features"
            placeholder="מה כלול בחבילה — שורה לכל פריט"
            rows={4}
            className="sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
              className="size-4"
            />
            סמן כחבילה מומלצת
          </label>
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 sm:col-span-2 sm:w-fit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            הוסף חבילה
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className="font-bold">{p.name}</span>
                {p.price != null && (
                  <span className="text-muted-foreground">
                    ₪{Number(p.price).toLocaleString("he-IL")}
                    {p.period ? ` ${p.period}` : ""}
                  </span>
                )}
                {p.highlight && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Star className="size-3" />
                    מומלץ
                  </span>
                )}
                {Array.isArray(p.features) && p.features.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {p.features.length} פריטים
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(p.id)}
                    disabled={busyId === p.id}
                  >
                    {busyId === p.id ? (
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
