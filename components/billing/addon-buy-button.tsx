"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { startAddonCheckoutAction } from "@/lib/actions/addons";
import { Button } from "@/components/ui/button";

/** Buys one paid add-on (lib/plans.ts ADDONS) via Stripe Checkout (subscription mode). */
export function AddonBuyButton({
  addonKey,
  isLoggedIn,
}: {
  addonKey: string;
  isLoggedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function buy() {
    if (!isLoggedIn) {
      window.location.href = "/signup";
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const res = await startAddonCheckoutAction(addonKey);
      if (res.error) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setBusy(false);
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={buy}>
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      רכישה
    </Button>
  );
}
