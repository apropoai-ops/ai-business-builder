import { Wallet, ShoppingCart, CalendarCheck, UserPlus, Eye, Package, Wrench, Download } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { formatILS } from "@/lib/quote-totals";
import type { ReportBucket, ReportPoint, TopRow } from "@/lib/services/analytics.service";
import { ReportCard, TopTable } from "@/components/business/report-charts";

export type ReportRange = "30" | "90" | "year";

const RANGE_LABELS: Record<ReportRange, string> = {
  "30": "30 ימים",
  "90": "90 ימים",
  year: "השנה",
};

const BUCKET_LABELS: Record<ReportBucket, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
};

type Totals = {
  revenue: number;
  ordersCount: number;
  bookingsCount: number;
  leadsCount: number;
  visitsCount: number;
};

function baseExportUrl(businessId: string, fromIso: string, toIso: string, bucket: ReportBucket) {
  return `/api/businesses/${businessId}/reports/export?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&bucket=${bucket}`;
}

export function ReportsView({
  businessId,
  range,
  bucket,
  points,
  curTotals,
  prevTotals,
  topProducts,
  topServices,
  fromIso,
  toIso,
}: {
  businessId: string;
  range: ReportRange;
  bucket: "week" | "month";
  points: ReportPoint[];
  curTotals: Totals;
  prevTotals: Totals;
  topProducts: TopRow[];
  topServices: TopRow[];
  fromIso: string;
  toIso: string;
}) {
  const exportBase = baseExportUrl(businessId, fromIso, toIso, bucket);
  const toggleHref = (r: ReportRange, b: "week" | "month") =>
    `/businesses/${businessId}/reports?range=${r}&bucket=${b}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RANGE_LABELS) as ReportRange[]).map((r) => (
            <ButtonLink
              key={r}
              href={toggleHref(r, bucket)}
              variant={r === range ? "default" : "outline"}
              size="sm"
            >
              {RANGE_LABELS[r]}
            </ButtonLink>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["week", "month"] as const).map((b) => (
            <ButtonLink
              key={b}
              href={toggleHref(range, b)}
              variant={b === bucket ? "default" : "outline"}
              size="sm"
            >
              לפי {BUCKET_LABELS[b]}
            </ButtonLink>
          ))}
        </div>
      </div>

      {/* Time-series cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="הכנסות"
          icon={Wallet}
          points={points}
          bucket={bucket}
          value={(p) => p.revenue}
          format={formatILS}
          cur={curTotals.revenue}
          prev={prevTotals.revenue}
          exportHref={`${exportBase}&metric=revenue`}
        />
        <ReportCard
          title="הזמנות ששולמו"
          icon={ShoppingCart}
          points={points}
          bucket={bucket}
          value={(p) => p.ordersCount}
          cur={curTotals.ordersCount}
          prev={prevTotals.ordersCount}
          exportHref={`${exportBase}&metric=orders`}
        />
        <ReportCard
          title="תורים והזמנות שנקבעו"
          icon={CalendarCheck}
          points={points}
          bucket={bucket}
          value={(p) => p.bookingsCount}
          cur={curTotals.bookingsCount}
          prev={prevTotals.bookingsCount}
          exportHref={`${exportBase}&metric=bookings`}
        />
        <ReportCard
          title="לידים חדשים"
          icon={UserPlus}
          points={points}
          bucket={bucket}
          value={(p) => p.leadsCount}
          cur={curTotals.leadsCount}
          prev={prevTotals.leadsCount}
          exportHref={`${exportBase}&metric=leads`}
        />
        <ReportCard
          title="ביקורים באתר"
          icon={Eye}
          points={points}
          bucket={bucket}
          value={(p) => p.visitsCount}
          cur={curTotals.visitsCount}
          prev={prevTotals.visitsCount}
          exportHref={`${exportBase}&metric=visits`}
        />
      </div>

      {/* Top products / services */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <TopTable title="מוצרים מובילים" icon={Package} rows={topProducts} valueLabel="הכנסה" />
          <a
            href={`${exportBase}&metric=top-products`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="size-3.5" /> ייצוא מוצרים ל-CSV
          </a>
        </div>
        <div className="space-y-2">
          <TopTable title="שירותים מובילים" icon={Wrench} rows={topServices} valueLabel="הכנסה" showValue={false} />
          <a
            href={`${exportBase}&metric=top-services`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Download className="size-3.5" /> ייצוא שירותים ל-CSV
          </a>
        </div>
      </div>
    </div>
  );
}
