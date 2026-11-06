"use client";

import { useState, useTransition } from "react";
import {
  Bot,
  RefreshCw,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Info,
  Target,
  History,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { refreshDailyBriefAction } from "@/lib/actions/daily-brief";
import type { DailyBriefContent } from "@/lib/ai/schemas/daily-brief";

const KIND_ICON = {
  win: TrendingUp,
  risk: AlertTriangle,
  info: Info,
} as const;

const KIND_COLOR = {
  win: "text-green-600",
  risk: "text-amber-600",
  info: "text-sky-600",
} as const;

const PRIORITY_LABEL = { high: "גבוהה", medium: "בינונית", low: "נמוכה" } as const;
const PRIORITY_VARIANT = { high: "default", medium: "secondary", low: "outline" } as const;

export type PastBrief = {
  briefDate: string;
  content: DailyBriefContent;
};

function formatBriefDate(date: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

export function DailyBriefCard({
  businessId,
  brief,
  briefDate,
  recentBriefs = [],
}: {
  businessId: string;
  brief: DailyBriefContent | null;
  briefDate: string | null;
  recentBriefs?: PastBrief[];
}) {
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await refreshDailyBriefAction(businessId);
      if (res.error) toast.error(res.error);
      else toast.success("התדריך עודכן");
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="font-semibold">התדריך היומי מה-AI CEO</div>
              {briefDate && (
                <div className="text-xs text-muted-foreground">
                  {new Date(briefDate).toLocaleDateString("he-IL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh} disabled={isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {brief ? "רענן" : "צור תדריך"}
          </Button>
        </div>

        {!brief && !isPending && (
          <p className="text-sm text-muted-foreground">
            ה-AI CEO ינתח את הלידים, העסקאות, המשימות והתוכן שלך ויפיק תוכנית פעולה
            ליום — אוטומטית כל בוקר, או עכשיו בלחיצה.
          </p>
        )}
        {isPending && !brief && (
          <p className="text-sm text-muted-foreground">מנתח את העסק ומכין תדריך...</p>
        )}

        {brief && <BriefContent brief={brief} />}

        {recentBriefs.length > 0 && <PastBriefsSection briefs={recentBriefs} />}
      </CardContent>
    </Card>
  );
}

/** Renders a brief's content (shared between today's brief and past briefs). */
function BriefContent({ brief }: { brief: DailyBriefContent }) {
  return (
    <>
      <p className="text-sm leading-relaxed">{brief.summary}</p>

      {brief.highlights?.length > 0 && (
        <div className="space-y-1.5">
          {brief.highlights.map((h, i) => {
            const Icon = KIND_ICON[h.kind] ?? Info;
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${KIND_COLOR[h.kind] ?? ""}`} />
                <span className="text-foreground/90">{h.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {brief.actions?.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">המשימות של היום:</div>
          {brief.actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border bg-background p-2.5">
              <Badge
                variant={PRIORITY_VARIANT[a.priority] as "default" | "secondary" | "outline"}
                className="mt-0.5 shrink-0 text-[10px]"
              >
                {PRIORITY_LABEL[a.priority]}
              </Badge>
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.why}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
        <Target className="size-4 shrink-0" />
        {brief.focus}
      </div>
    </>
  );
}

/** Collapsible list of past briefs; collapsed by default, each item expandable. */
function PastBriefsSection({ briefs }: { briefs: PastBrief[] }) {
  const [open, setOpen] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <div className="border-t border-primary/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <History className="size-4" />
          תדריכים קודמים ({briefs.length})
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {briefs.map((b) => {
            const expanded = expandedDate === b.briefDate;
            return (
              <div key={b.briefDate} className="rounded-lg border bg-background">
                <button
                  type="button"
                  onClick={() => setExpandedDate(expanded ? null : b.briefDate)}
                  className="flex w-full items-center justify-between p-2.5 text-sm"
                  aria-expanded={expanded}
                >
                  <span className="font-medium">{formatBriefDate(b.briefDate)}</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
                {expanded && (
                  <div className="space-y-4 border-t p-3">
                    <BriefContent brief={b.content} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
