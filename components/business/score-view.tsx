"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, DollarSign, Filter, History } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { refreshInsightsAction } from "@/lib/actions/insights";
import {
  scoreBand,
  weakestMetricHint,
  type BusinessScore,
  type ScoreMetrics,
  type ScoreHistoryPoint,
} from "@/lib/business-score";
import type { StoredInsights } from "@/lib/services/insights.service";
import { getScoreHistoryAction, getScoreMetricsAction } from "@/lib/actions/score";

function scoreColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function Gauge({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color = scoreColor(value);
  return (
    <div className="relative flex size-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
        <span className="text-xs text-muted-foreground">{scoreBand(value)}</span>
      </div>
    </div>
  );
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: "גבוהה", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  medium: { label: "בינונית", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  low: { label: "נמוכה", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

function AnalysisBlock({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-foreground/85">{text}</p>
    </div>
  );
}

function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
  });
}

function Sparkline({ points }: { points: ScoreHistoryPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="py-3 text-center text-xs text-muted-foreground">
        עוד אין מספיק נתונים למגמה — חוזרים כל כמה ימים כדי לראות שינוי
      </p>
    );
  }
  const w = 260;
  const h = 56;
  const max = Math.max(100, ...points.map((p) => p.total));
  const min = Math.min(0, ...points.map((p) => p.total));
  const range = Math.max(1, max - min);
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - ((p.total - min) / range) * h;
    return { x, y, total: p.total };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <div dir="ltr" className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full max-w-[280px]">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" />
        <circle cx={last.x} cy={last.y} r={3} className="fill-primary" />
      </svg>
    </div>
  );
}

export function ScoreView({
  businessId,
  score,
  insights,
}: {
  businessId: string;
  score: BusinessScore;
  insights: StoredInsights | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<ScoreHistoryPoint[] | null>(null);
  const [metrics, setMetrics] = useState<ScoreMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, m] = await Promise.all([
          getScoreHistoryAction(businessId),
          getScoreMetricsAction(businessId),
        ]);
        if (!cancelled) {
          setHistory(h);
          setMetrics(m);
        }
      } catch {
        // Non-critical — the score gauge above already rendered.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  function generate() {
    startTransition(async () => {
      const res = await refreshInsightsAction(businessId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("התובנות עודכנו ✓");
        router.refresh();
      }
    });
  }

  const c = insights?.content;

  return (
    <div className="flex flex-col gap-6">
      {/* Score */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-6 sm:flex-row sm:items-center">
          <Gauge value={score.overall} />
          <div className="flex-1 space-y-3 self-stretch">
            {score.dimensions.map((d) => (
              <div key={d.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.label}</span>
                  <span className="tabular-nums text-muted-foreground">{d.score}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.score}%`, backgroundColor: scoreColor(d.score) }}
                  />
                </div>
                {metrics && (
                  <p className="text-[11px] text-muted-foreground">
                    מה מוריד את הציון: {weakestMetricHint(d.key, metrics)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score history */}
      {history && history.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">מגמת הציון</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {history.map((h) => (
                    <span key={h.date} className="tabular-nums">
                      {formatSnapshotDate(h.date)}: {h.total}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Sparkline points={history} />
          </CardContent>
        </Card>
      )}

      {/* AI insights */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">תובנות AI</div>
            <Button onClick={generate} disabled={isPending} size="sm" className="gap-1.5">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {isPending ? "מנתח..." : insights ? "רענן תובנות" : "צור תובנות AI"}
            </Button>
          </div>

          {!c ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              עדיין אין תובנות — לחצו על &quot;צור תובנות AI&quot; לניתוח חכם של העסק עם המלצות לפעולה.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {c.headline && (
                <p className="rounded-xl bg-primary/5 p-3 text-sm font-medium">{c.headline}</p>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <AnalysisBlock icon={TrendingUp} title="צמיחה" text={c.growth} />
                <AnalysisBlock icon={AlertTriangle} title="סיכוני נטישה" text={c.churnRisk} />
                <AnalysisBlock icon={DollarSign} title="הכנסות" text={c.revenue} />
                <AnalysisBlock icon={Filter} title="המרת לידים" text={c.conversion} />
              </div>

              {c.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">המלצות לפעולה</div>
                  {c.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border p-3">
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${PRIORITY[rec.priority]?.cls ?? ""}`}>
                        {PRIORITY[rec.priority]?.label ?? rec.priority}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{rec.title}</p>
                        <p className="text-sm text-muted-foreground">{rec.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {insights && (
                <p className="text-[11px] text-muted-foreground">
                  עודכן: {new Date(insights.generatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
