"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setPaymentLinkAction } from "@/lib/actions/store";

export function PaymentLinkCard({
  businessId,
  initialLink,
}: {
  businessId: string;
  initialLink: string | null;
}) {
  const [link, setLink] = useState(initialLink ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await setPaymentLinkAction(businessId, link);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(link.trim() ? "לינק התשלום נשמר ✓" : "לינק התשלום הוסר");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-primary" />
          לינק תשלום
        </div>
        <p className="text-xs text-muted-foreground">
          הדביקו לינק תשלום משלכם (Stripe Payment Link, PayPal, Bit, PayBox וכדומה) — לקוחות
          יראו כפתור תשלום כשהם מאשרים הצעת מחיר. חינם, בלי הגדרות מורכבות.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            dir="ltr"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://buy.stripe.com/..."
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
