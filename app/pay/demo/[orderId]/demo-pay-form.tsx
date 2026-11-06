"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The fake card-entry form for the demo hosted-payment-page. The card fields
 * below are purely cosmetic — they're never validated, never stored, and
 * never sent anywhere (not even to our own server). Only the order id /
 * amount / signature that the driver embedded in the page URL are sent
 * onward, to our own callback route, so the order can be marked paid.
 */
export function DemoPayForm({
  orderId,
  amount,
  sig,
  callbackUrl,
  successUrl,
  cancelUrl,
}: {
  orderId: string;
  amount: string;
  sig: string;
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [pending, setPending] = useState<"success" | "cancel" | null>(null);

  function notifyCallback(result: "success" | "cancel") {
    const url = new URL(callbackUrl, window.location.origin);
    url.searchParams.set("orderId", orderId);
    url.searchParams.set("amount", amount);
    url.searchParams.set("sig", sig);
    url.searchParams.set("result", result);
    return fetch(url.toString(), { method: "GET" });
  }

  async function handleApprove() {
    setPending("success");
    try {
      const res = await notifyCallback("success");
      if (!res.ok) {
        toast.error("אישור התשלום נכשל — נסו שוב");
        setPending(null);
        return;
      }
      window.location.href = successUrl;
    } catch {
      toast.error("לא ניתן היה להתחבר לשרת — נסו שוב");
      setPending(null);
    }
  }

  async function handleCancel() {
    setPending("cancel");
    try {
      await notifyCallback("cancel");
    } catch {
      // best-effort — cancelling shouldn't get the shopper stuck
    } finally {
      window.location.href = cancelUrl;
    }
  }

  const busy = pending !== null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleApprove();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="demo-card-number">מספר כרטיס</Label>
        <div className="relative">
          <CreditCard className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="demo-card-number"
            dir="ltr"
            className="ps-8"
            placeholder="4580-XXXX-XXXX-XXXX"
            autoComplete="off"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demo-card-expiry">תוקף</Label>
          <Input
            id="demo-card-expiry"
            dir="ltr"
            placeholder="MM/YY"
            autoComplete="off"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demo-card-cvv">CVV</Label>
          <Input
            id="demo-card-cvv"
            dir="ltr"
            placeholder="123"
            autoComplete="off"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        זהו טופס הדגמה — פרטי הכרטיס אינם נבדקים, אינם נשמרים ואינם נשלחים לשום מקום.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="flex-1 gap-1.5" disabled={busy}>
          {pending === "success" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          אישור תשלום ✓
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-1.5"
          disabled={busy}
          onClick={handleCancel}
        >
          {pending === "cancel" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          ביטול
        </Button>
      </div>
    </form>
  );
}
