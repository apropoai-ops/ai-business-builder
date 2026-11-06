"use client";

import { useState, useTransition } from "react";
import { Truck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setShippingSettingsAction } from "@/lib/actions/store";

export function ShippingCard({
  businessId,
  shippingFee,
  freeThreshold,
}: {
  businessId: string;
  shippingFee: number | null;
  freeThreshold: number | null;
}) {
  const [fee, setFee] = useState(shippingFee != null ? String(shippingFee) : "");
  const [threshold, setThreshold] = useState(freeThreshold != null ? String(freeThreshold) : "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await setShippingSettingsAction(businessId, {
        shippingFee: fee,
        freeThreshold: threshold,
      });
      if (res.error) toast.error(res.error);
      else toast.success("הגדרות המשלוח נשמרו ✓");
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="size-4 text-primary" />
          משלוח
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">דמי משלוח (₪)</label>
            <Input type="number" min="0" step="0.01" value={fee} placeholder="למשל 30"
              onChange={(e) => setFee(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">משלוח חינם מעל (₪)</label>
            <Input type="number" min="0" step="0.01" value={threshold} placeholder="למשל 199"
              onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          השאירו ריק כדי לא להציג משלוח. בעגלה הלקוח יראה את דמי המשלוח, וכמה חסר למשלוח חינם.
        </p>
        <Button onClick={save} disabled={isPending} size="sm" className="gap-1.5">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          שמירה
        </Button>
      </CardContent>
    </Card>
  );
}
