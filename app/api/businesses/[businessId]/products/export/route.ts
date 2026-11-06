import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

/** UTF-8 BOM so Excel detects the encoding and renders Hebrew correctly. */
const BOM = "﻿";

/**
 * Escapes a single CSV field and neutralizes CSV/formula injection: values
 * starting with a formula-trigger character (=, +, -, @, tab, CR) are
 * prefixed with an apostrophe before quoting (OWASP CSV injection guidance).
 */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((r) => r.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** Header row — also the exact columns the import accepts (see import action). */
export const PRODUCT_CSV_HEADERS = [
  "name",
  "category",
  "subcategory",
  "brand",
  "sku",
  "barcode",
  "price",
  "sale_price",
  "stock_qty",
  "sizes",
  "status",
  "description",
];

/**
 * GET /api/businesses/:businessId/products/export → products as CSV (UTF-8 BOM).
 * RLS client, so non-owners get an empty file. The column set round-trips with
 * the CSV import.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("name, category, subcategory, brand, sku, barcode, price, sale_price, stock_qty, sizes, status, description")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "שגיאה בטעינת המוצרים" }, { status: 500 });

  const rows: (string | number | null | undefined)[][] = [
    PRODUCT_CSV_HEADERS,
    ...(products ?? []).map((p) => [
      p.name,
      p.category,
      p.subcategory,
      p.brand,
      p.sku,
      p.barcode,
      p.price,
      p.sale_price,
      p.stock_qty,
      ((p.sizes as string[] | null) ?? []).join("|"),
      p.status,
      p.description,
    ]),
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
