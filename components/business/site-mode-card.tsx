import Link from "next/link";
import { ArrowUpRight, Building2, ShoppingBag, Target, type LucideIcon } from "lucide-react";

import { SITE_MODE_LIST, resolveSiteMode, siteModeDef, type SiteMode } from "@/lib/site-mode";
import { minPlanForSiteMode, planAllowsSiteMode } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MODE_ICONS: Record<SiteMode, LucideIcon> = {
  website: Building2,
  landing: Target,
  store: ShoppingBag,
};

/**
 * "החבילה שלך" — what the owner bought, and the way up from it.
 *
 * This replaced a free "מה בונים" switcher that let an owner flip a business
 * between landing / website / store from the dashboard. Two problems with
 * that: the mode IS the package, so a switcher let someone reach for a mode
 * their subscription doesn't include and be told no after the fact; and it
 * asked a question the customer had already answered — and paid for — at
 * checkout. Changing what you get now means changing what you pay, so the
 * only action here is an upgrade, and it goes through the pricing page.
 */
export function SiteModeCard({
  siteMode,
  planTier,
}: {
  siteMode: string | null;
  planTier: PlanTier;
}) {
  const current = resolveSiteMode(siteMode);
  const plan = PLANS[planTier];
  const Icon = MODE_ICONS[current];

  // Anything the current subscription doesn't cover is an upgrade, priced.
  const upgrades = SITE_MODE_LIST.filter(
    (m) => m.key !== current && !planAllowsSiteMode(planTier, m.key),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">החבילה שלכם</CardTitle>
        <CardDescription>
          החבילה קובעת מה ה-AI כותב, אילו עמודים קיימים באתר ומה מוצג בממשק הניהול.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              חבילת {plan.name}
              {plan.priceMonthly > 0 ? ` · ₪${plan.priceMonthly} לחודש` : ""}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {siteModeDef(current).tagline}
            </span>
          </span>
        </div>

        {upgrades.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              רוצים יותר? שדרוג חבילה משנה גם את סוג האתר ובונה אותו מחדש.
            </p>
            {upgrades.map((mode) => {
              const modePlan = minPlanForSiteMode(mode.key);
              return (
                <div
                  key={mode.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium">{mode.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      חבילת {modePlan.name} · ₪{modePlan.priceMonthly} לחודש
                    </span>
                  </span>
                  <Link href={`/pricing?upgrade=${modePlan.tier}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      שדרוג
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
