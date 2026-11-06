"use client";

import { useState, useTransition } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { openBillingPortalAction } from "@/lib/actions/billing";
import { formatLimit } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UsageRow = { label: string; used: number; limit: number; prefix?: string };

function fmt(n: number, prefix?: string): string {
  const val = prefix
    ? n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : n.toLocaleString("he-IL");
  return `${prefix ?? ""}${val}`;
}

function UsageBar({ row }: { row: UsageRow }) {
  const unlimited = !Number.isFinite(row.limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((row.used / row.limit) * 100));
  const danger = !unlimited && pct >= 90;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{row.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmt(row.used, row.prefix)} / {row.prefix && Number.isFinite(row.limit)
            ? fmt(row.limit, row.prefix)
            : formatLimit(row.limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            unlimited ? "w-full bg-primary/20" : danger ? "bg-destructive" : "bg-primary"
          }`}
          style={unlimited ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SubscriptionCard({
  planName,
  isPaid,
  hasStripeCustomer,
  usage,
}: {
  planName: string;
  isPaid: boolean;
  hasStripeCustomer: boolean;
  usage: UsageRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function openPortal() {
    setBusy(true);
    startTransition(async () => {
      const res = await openBillingPortalAction();
      if (res?.error) toast.error(res.error);
      setBusy(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" />
          חבילה ושימוש
        </CardTitle>
        <CardDescription>
          החבילה הנוכחית: <span className="font-medium text-foreground">{planName}</span>
          {" · "}המכסות מתאפסות בתחילת כל חודש
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage.map((row) => (
          <UsageBar key={row.label} row={row} />
        ))}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <ButtonLink href="/pricing" variant={isPaid ? "outline" : "default"}>
          {isPaid ? "השוואת חבילות" : "שדרוג החבילה"}
          <ExternalLink className="size-3.5" />
        </ButtonLink>
        {isPaid && hasStripeCustomer && (
          <Button variant="outline" onClick={openPortal} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            ניהול מנוי וחיובים
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
