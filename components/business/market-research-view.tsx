"use client";

import { useTransition } from "react";
import {
  Search,
  ShieldCheck,
  TrendingUp,
  Crosshair,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

import { regenerateMarketResearchAction } from "@/lib/actions/market-research";
import type { MarketResearchData } from "@/lib/ai/schemas/market-research";
import type { MarketResearch } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = { businessId: string; research: MarketResearch };

const PRIORITY_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  גבוהה: "default",
  בינונית: "secondary",
  נמוכה: "outline",
};

export function MarketResearchView({ businessId, research }: Props) {
  const [isRegen, startRegen] = useTransition();

  const competitors =
    (research.competitors as MarketResearchData["competitors"] | null) ?? [];
  const swot = research.swot as MarketResearchData["swot"] | null;
  const opportunities =
    (research.opportunities as MarketResearchData["opportunities"] | null) ?? [];

  function regenerate() {
    startRegen(async () => {
      const res = await regenerateMarketResearchAction(businessId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={regenerate} disabled={isRegen}>
          {isRegen ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          ייצור מחדש
        </Button>
      </div>

      {/* Competitors */}
      {competitors.length > 0 && (
        <Section icon={Search} title="ניתוח מתחרים">
          <div className="space-y-4">
            {competitors.map((c, i) => (
              <div key={i} className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">{c.name}</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniList
                    icon={<CheckCircle2 className="size-3.5 text-green-500" />}
                    title="חוזקות"
                    items={c.strengths}
                  />
                  <MiniList
                    icon={<XCircle className="size-3.5 text-destructive" />}
                    title="חולשות"
                    items={c.weaknesses}
                  />
                  <MiniList
                    icon={<Lightbulb className="size-3.5 text-amber-500" />}
                    title="הזדמנויות"
                    items={c.opportunities}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SWOT */}
      {swot && (
        <Section icon={ShieldCheck} title="ניתוח SWOT">
          <div className="grid gap-3 sm:grid-cols-2">
            <SwotBlock
              title="חוזקות"
              color="green"
              items={swot.strengths}
            />
            <SwotBlock
              title="חולשות"
              color="red"
              items={swot.weaknesses}
            />
            <SwotBlock
              title="הזדמנויות"
              color="blue"
              items={swot.opportunities}
            />
            <SwotBlock
              title="איומים"
              color="amber"
              items={swot.threats}
            />
          </div>
        </Section>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <Section icon={TrendingUp} title="הזדמנויות שוק">
          <div className="grid gap-3 sm:grid-cols-2">
            {opportunities.map((o, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium">{o.title}</span>
                  <Badge variant={PRIORITY_VARIANT[o.priority] ?? "outline"}>
                    {o.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{o.description}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Positioning */}
      {research.positioning && (
        <Section icon={Crosshair} title="מיצוב מומלץ">
          <p className="whitespace-pre-wrap leading-relaxed">
            {research.positioning}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Search;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function MiniList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-sm font-medium">
        {icon}
        {title}
      </div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const COLOR_MAP = {
  green: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
  red: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
  blue: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
  amber: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
};

function SwotBlock({
  title,
  color,
  items,
}: {
  title: string;
  color: keyof typeof COLOR_MAP;
  items: string[];
}) {
  return (
    <div className={`rounded-lg border p-4 ${COLOR_MAP[color]}`}>
      <div className="mb-2 font-medium">{title}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 opacity-60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
