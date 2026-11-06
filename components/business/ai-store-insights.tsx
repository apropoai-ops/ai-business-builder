"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Forecast = {
  summary: string;
  nextPeriodRevenue: number;
  nextPeriodUnits: number;
  trend: "up" | "down" | "stable";
  recommendations: string[];
};
type RestockItem = { product: string; action: "restock" | "reduce" | "ok"; suggestedQty: number; reason: string };

const ACTION_LABEL: Record<string, string> = { restock: "לחדש", reduce: "להפחית", ok: "תקין" };
const ACTION_STYLE: Record<string, string> = {
  restock: "bg-amber-100 text-amber-800",
  reduce: "bg-blue-100 text-blue-800",
  ok: "bg-green-100 text-green-700",
};

/** Owner AI tools: sales forecast + recommended restock (Wave F). */
export function AiStoreInsights({ businessId }: { businessId: string }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [restock, setRestock] = useState<RestockItem[] | null>(null);
  const [busy, setBusy] = useState<"forecast" | "restock" | null>(null);

  async function run(kind: "forecast" | "restock") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/businesses/${businessId}/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "הפעולה נכשלה");
      } else if (kind === "forecast") {
        setForecast(data.forecast);
      } else {
        setRestock(data.items ?? []);
      }
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setBusy(null);
    }
  }

  const TrendIcon = forecast?.trend === "up" ? TrendingUp : forecast?.trend === "down" ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" /> תובנות AI לחנות
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run("forecast")} disabled={busy !== null}>
            {busy === "forecast" ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
            תחזית מכירות
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run("restock")} disabled={busy !== null}>
            {busy === "restock" ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
            המלצות חידוש מלאי
          </Button>
        </div>

        {forecast && (
          <div className="rounded-xl border p-3">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <TrendIcon className="size-4 text-primary" /> תחזית 30 יום
            </div>
            <p className="text-sm text-muted-foreground">{forecast.summary}</p>
            <div className="mt-2 flex gap-4 text-sm">
              <span>הכנסה צפויה: <b>₪{Math.round(forecast.nextPeriodRevenue).toLocaleString("he-IL")}</b></span>
              <span>יחידות: <b>{Math.round(forecast.nextPeriodUnits).toLocaleString("he-IL")}</b></span>
            </div>
            {forecast.recommendations.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pe-5 text-sm text-muted-foreground">
                {forecast.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        )}

        {restock && (
          <div className="rounded-xl border p-3">
            <div className="mb-2 font-semibold">המלצות מלאי</div>
            {restock.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין המלצות כרגע.</p>
            ) : (
              <ul className="space-y-1.5">
                {restock.map((it, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{it.product}</span>
                      <span className="block text-xs text-muted-foreground">{it.reason}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {it.action === "restock" && it.suggestedQty > 0 && (
                        <span className="text-xs font-bold">+{it.suggestedQty}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[it.action] ?? ""}`}>
                        {ACTION_LABEL[it.action] ?? it.action}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
