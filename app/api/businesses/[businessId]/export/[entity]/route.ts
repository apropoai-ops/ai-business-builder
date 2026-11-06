import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";

/** UTF-8 BOM so Excel detects the encoding and renders Hebrew correctly. */
const BOM = "﻿";

/**
 * Escapes a single CSV field and neutralizes CSV/formula injection: values
 * starting with a formula-trigger character (=, +, -, @, tab, CR) are
 * prefixed with an apostrophe before quoting (OWASP CSV injection guidance),
 * since several exported fields originate from unauthenticated public forms.
 */
function csvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
}

const ENTITIES = ["customers", "orders", "bookings"] as const;
type Entity = (typeof ENTITIES)[number];

function isEntity(v: string): v is Entity {
  return (ENTITIES as readonly string[]).includes(v);
}

/**
 * GET /api/businesses/:businessId/export/:entity → CSV backup of one data
 * domain (customers | orders | bookings). Owner-only (getBusiness + RLS
 * client — a non-owner gets a 404 before any query runs).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; entity: string }> },
) {
  const { businessId, entity } = await params;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getBusiness(businessId).catch(() => null);
  if (!business) {
    return NextResponse.json({ error: "העסק לא נמצא" }, { status: 404 });
  }
  if (!isEntity(entity)) {
    return NextResponse.json(
      { error: "סוג ייצוא לא מוכר — customers, orders או bookings" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (entity === "customers") {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("name, phone, email, notes, tags, birthday, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: "שגיאה בטעינת הלקוחות" }, { status: 500 });
    }
    const rows: (string | number | boolean | null | undefined)[][] = [
      ["שם", "טלפון", "אימייל", "הערות", "תגיות", "יום הולדת", "נוצר"],
      ...(data ?? []).map((c) => [
        c.name,
        c.phone,
        c.email,
        c.notes,
        (c.tags ?? []).join(" | "),
        formatDate(c.birthday),
        formatDate(c.created_at),
      ]),
    ];
    return csvResponse(toCsv(rows), "customers.csv");
  }

  if (entity === "orders") {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "product_name, quantity, variant, total, customer_name, customer_phone, customer_address, status, payment_method, payment_status, tracking_number, created_at",
      )
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: "שגיאה בטעינת ההזמנות" }, { status: 500 });
    }
    const rows: (string | number | boolean | null | undefined)[][] = [
      [
        "מוצר",
        "כמות",
        "וריאציה",
        "סה\"כ",
        "לקוח",
        "טלפון",
        "כתובת",
        "סטטוס",
        "אמצעי תשלום",
        "סטטוס תשלום",
        "מספר מעקב",
        "נוצר",
      ],
      ...(data ?? []).map((o) => [
        o.product_name,
        o.quantity,
        o.variant,
        o.total,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.status,
        o.payment_method,
        o.payment_status,
        o.tracking_number,
        formatDate(o.created_at),
      ]),
    ];
    return csvResponse(toCsv(rows), "orders.csv");
  }

  // bookings
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "customer_name, customer_phone, customer_email, service, starts_at, ends_at, status, notes, no_show, created_at",
    )
    .eq("business_id", businessId)
    .order("starts_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "שגיאה בטעינת התורים" }, { status: 500 });
  }
  const rows: (string | number | boolean | null | undefined)[][] = [
    ["לקוח", "טלפון", "אימייל", "שירות", "התחלה", "סיום", "סטטוס", "הערות", "לא הגיע/ה", "נוצר"],
    ...(data ?? []).map((b) => [
      b.customer_name,
      b.customer_phone,
      b.customer_email,
      b.service,
      formatDateTime(b.starts_at),
      formatDateTime(b.ends_at),
      b.status,
      b.notes,
      b.no_show ? "כן" : "לא",
      formatDate(b.created_at),
    ]),
  ];
  return csvResponse(toCsv(rows), "bookings.csv");
}
