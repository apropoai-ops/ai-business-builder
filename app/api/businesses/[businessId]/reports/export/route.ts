import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import {
  bucketLabel,
  getBusinessReport,
  getTopProductsAndServices,
  type ReportBucket,
} from "@/lib/services/analytics.service";

/** UTF-8 BOM so Excel detects the encoding and renders Hebrew correctly. */
const BOM = "﻿";

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Neutralize CSV/DDE formula injection: Excel/Sheets treat a leading
  // =, +, -, @, tab, or CR as the start of a formula. Prefix with a
  // single quote so the cell is treated as plain text (OWASP guidance).
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

const METRIC_LABELS: Record<string, string> = {
  revenue: "הכנסות",
  orders: "הזמנות ששולמו",
  bookings: "תורים והזמנות שנקבעו",
  leads: "לידים חדשים",
  visits: "ביקורים באתר",
};

/**
 * GET /api/businesses/:businessId/reports/export
 *   ?metric=revenue|orders|bookings|leads|visits|top-products|top-services
 *   &from=ISO&to=ISO&bucket=day|week|month
 *
 * Owner-only (RLS + the get_business_report RPC's explicit is_business_owner
 * guard both enforce this — non-owners get an empty/error result).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const sp = request.nextUrl.searchParams;
  const metric = sp.get("metric") ?? "revenue";
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  const bucket: ReportBucket = sp.get("bucket") === "month" ? "month" : sp.get("bucket") === "day" ? "day" : "week";

  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toStr ? new Date(toStr) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "טווח תאריכים לא תקין" }, { status: 400 });
  }

  try {
    if (metric === "top-products" || metric === "top-services") {
      const { products, services } = await getTopProductsAndServices(businessId, from, to);
      const rows = metric === "top-products" ? products : services;
      const rowLabel = metric === "top-products" ? "מוצר" : "שירות";
      const csv = toCsv([
        [rowLabel, "כמות", "הכנסה"],
        ...rows.map((r) => [r.name, r.count, r.value]),
      ]);
      return csvResponse(csv, `${metric}.csv`);
    }

    if (!(metric in METRIC_LABELS)) {
      return NextResponse.json({ error: "מדד לא מוכר" }, { status: 400 });
    }

    const points = await getBusinessReport(businessId, from, to, bucket);
    const valueOf: Record<string, (p: (typeof points)[number]) => number> = {
      revenue: (p) => p.revenue,
      orders: (p) => p.ordersCount,
      bookings: (p) => p.bookingsCount,
      leads: (p) => p.leadsCount,
      visits: (p) => p.visitsCount,
    };
    const rows = toCsv([
      ["תאריך", METRIC_LABELS[metric]],
      ...points.map((p) => [bucketLabel(p.bucketStart, bucket), valueOf[metric](p)]),
    ]);
    return csvResponse(rows, `${metric}.csv`);
  } catch {
    return NextResponse.json({ error: "שגיאה בטעינת הדוח" }, { status: 500 });
  }
}
