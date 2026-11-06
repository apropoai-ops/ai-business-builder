"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { startCheckoutAction } from "@/lib/actions/billing";
import { PLANS, PACKAGE_ORDER } from "@/lib/plans";
import { siteModeDef } from "@/lib/site-mode";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import type { PlanTier } from "@/types/database";

export function PlanCards({
  currentPlan,
  isLoggedIn,
}: {
  currentPlan: PlanTier | null;
  isLoggedIn: boolean;
}) {
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [, startTransition] = useTransition();

  function checkout(tier: Exclude<PlanTier, "free">) {
    setBusyTier(tier);
    startTransition(async () => {
      const res = await startCheckoutAction(tier);
      if (res?.error) toast.error(res.error);
      setBusyTier(null);
    });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {PACKAGE_ORDER.map((tier) => {
        const plan = PLANS[tier];
        const isCurrent = currentPlan === tier;
        return (
          <div
            key={tier}
            className={`relative flex flex-col rounded-xl border bg-card p-6 ${
              plan.highlight ? "border-primary shadow-lg ring-2 ring-primary/40" : ""
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                <Star className="size-3.5 fill-current" />
                מומלץ
              </div>
            )}
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">₪{plan.priceMonthly}</span>
              <span className="text-sm text-muted-foreground">/ חודש</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              כולל מע״מ · בונה{" "}
              {plan.siteModes
                .map((m) => siteModeDef(m).label)
                .reverse()
                .join(" · ")}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {isCurrent ? (
                <Button className="w-full" variant="outline" disabled>
                  החבילה הנוכחית שלכם
                </Button>
              ) : isLoggedIn ? (
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  disabled={busyTier !== null}
                  onClick={() => checkout(tier)}
                >
                  {busyTier === tier && <Loader2 className="size-4 animate-spin" />}
                  בחירת {plan.name}
                </Button>
              ) : (
                <ButtonLink
                  href="/signup"
                  variant={plan.highlight ? "default" : "outline"}
                  className="w-full"
                >
                  התחילו עכשיו
                </ButtonLink>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
