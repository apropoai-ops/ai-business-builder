import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import {
  getBusinessReport,
  getTopProductsAndServices,
  sumReport,
  type ReportBucket,
} from "@/lib/services/analytics.service";
import { ReportsView, type ReportRange } from "@/components/business/reports-view";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "דוחות" };

const RANGE_DAYS: Record<Exclude<ReportRange, "year">, number> = { "30": 30, "90": 90 };

function currentYearStart(): Date {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric" }).format(new Date()),
  );
  return new Date(Date.UTC(year, 0, 1));
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ range?: string; bucket?: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "reports");

  const sp = await searchParams;
  const range: ReportRange = sp.range === "90" || sp.range === "year" ? sp.range : "30";
  const bucket: ReportBucket = sp.bucket === "month" ? "month" : "week";

  const to = new Date();
  const from = range === "year" ? currentYearStart() : new Date(to.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const spanMs = to.getTime() - from.getTime();
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - spanMs);

  const [points, prevPoints, tops] = await Promise.all([
    getBusinessReport(businessId, from, to, bucket),
    getBusinessReport(businessId, prevFrom, prevTo, bucket),
    getTopProductsAndServices(businessId, from, to),
  ]);

  const curTotals = sumReport(points);
  const prevTotals = sumReport(prevPoints);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">דוחות</h1>
          <p className="text-sm text-muted-foreground">
            מגמות הכנסות, הזמנות, תורים, לידים וביקורים לאורך זמן, עם השוואה לתקופה הקודמת
          </p>
        </div>
      </div>

      <ReportsView
        businessId={businessId}
        range={range}
        bucket={bucket}
        points={points}
        curTotals={curTotals}
        prevTotals={prevTotals}
        topProducts={tops.products}
        topServices={tops.services}
        fromIso={from.toISOString()}
        toIso={to.toISOString()}
      />
    </div>
  );
}
