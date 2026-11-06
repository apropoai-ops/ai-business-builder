import { ArrowDown, ArrowUp, Minus, Download } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/quote-totals";
import { bucketLabel, type ReportPoint, type TopRow } from "@/lib/services/analytics.service";

/** Percentage change from `prev` to `cur`, or null when undefined (prev = 0). */
export function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}

export function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const delta = pctDelta(cur, prev);
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
        חדש
      </span>
    );
  }
  const up = delta > 0.5;
  const down = delta < -0.5;
  const cls = up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground";
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${cls}`}>
      <Icon className="size-3" />
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

/**
 * A time-series bar chart in the analytics-view idiom (plain divs, no chart
 * lib), with a period-vs-previous-period delta badge in the header.
 */
export function ReportCard({
  title,
  icon: Icon,
  points,
  bucket,
  value,
  format,
  cur,
  prev,
  exportHref,
}: {
  title: string;
  icon: React.ElementType;
  points: ReportPoint[];
  bucket: "week" | "month";
  value: (p: ReportPoint) => number;
  format?: (n: number) => string;
  cur: number;
  prev: number;
  exportHref: string;
}) {
  const fmt = format ?? ((n: number) => n.toLocaleString("he-IL"));
  const values = points.map(value);
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-primary" />
            {title}
          </div>
          <div className="flex items-center gap-2">
            <DeltaBadge cur={cur} prev={prev} />
            <a
              href={exportHref}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="ייצוא ל-CSV"
            >
              <Download className="size-3.5" />
            </a>
          </div>
        </div>
        <div className="text-xl font-bold tabular-nums">{fmt(total)}</div>

        {total === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">אין עדיין נתונים בטווח שנבחר</p>
        ) : (
          <div dir="ltr" className="flex h-24 items-stretch gap-1">
            {points.map((p, i) => (
              <div key={p.bucketStart} className="flex flex-1 flex-col gap-1" title={`${bucketLabel(p.bucketStart, bucket)} · ${fmt(values[i])}`}>
                <div className="flex flex-1 items-end">
                  <div
                    className={`w-full rounded-sm ${values[i] > 0 ? "bg-primary/70" : "bg-muted"}`}
                    style={{ height: values[i] > 0 ? `${Math.max((values[i] / max) * 100, 6)}%` : "4px" }}
                  />
                </div>
                <div className="text-center text-[9px] tabular-nums text-muted-foreground">
                  {bucketLabel(p.bucketStart, bucket)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopTable({
  title,
  icon: Icon,
  rows,
  valueLabel,
  showValue = true,
}: {
  title: string;
  icon: React.ElementType;
  rows: TopRow[];
  valueLabel: string;
  showValue?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </div>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">אין עדיין נתונים בטווח שנבחר</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 text-start font-medium">שם</th>
                  <th className="py-1.5 text-start font-medium">כמות</th>
                  {showValue && <th className="py-1.5 text-start font-medium">{valueLabel}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="max-w-[160px] truncate py-1.5">{r.name}</td>
                    <td className="py-1.5 tabular-nums">{r.count}</td>
                    {showValue && <td className="py-1.5 tabular-nums">{r.value > 0 ? formatILS(r.value) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
