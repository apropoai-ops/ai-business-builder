import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

/** UTF-8 BOM so Excel detects the encoding and renders Hebrew correctly. */
const BOM = "﻿";

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מתאים",
  lost: "אבוד",
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "וואטסאפ",
  website: "מהאתר",
  booking: "תור",
};

/**
 * Escapes a single CSV field: wraps in double quotes when the value contains
 * a comma, quote, or newline, and doubles any internal quotes. Values that
 * start with a formula-trigger character (=, +, -, @, tab, CR) are prefixed
 * with an apostrophe to neutralize CSV/formula injection in spreadsheet apps
 * (OWASP CSV injection guidance) — relevant here since several exported
 * fields (e.g. lead name/notes) originate from unauthenticated public forms.
 */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
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

/**
 * GET /api/businesses/:businessId/crm/export?type=leads|customers
 * Exports CRM leads or customers as a CSV file (Hebrew headers, UTF-8 BOM).
 * Uses the RLS client, so non-owners receive an empty export.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient();

  if (type === "leads") {
    const { data: leads, error } = await supabase
      .from("crm_leads")
      .select("name, phone, email, status, source, notes, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: "שגיאה בטעינת הלידים" }, { status: 500 });
    }

    const rows: (string | number | null | undefined)[][] = [
      ["שם", "טלפון", "אימייל", "סטטוס", "מקור", "הערות", "נוצר"],
      ...(leads ?? []).map((lead) => [
        lead.name,
        lead.phone,
        lead.email,
        LEAD_STATUS_LABEL[lead.status] ?? lead.status,
        lead.source ? SOURCE_LABEL[lead.source] ?? lead.source : "",
        lead.notes,
        formatDate(lead.created_at),
      ]),
    ];
    return csvResponse(toCsv(rows), "leads.csv");
  }

  if (type === "customers") {
    const [{ data: customers, error }, { data: deals }] = await Promise.all([
      supabase
        .from("crm_customers")
        .select("name, phone, email, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_deals")
        .select("contact_name, value")
        .eq("business_id", businessId)
        .eq("stage", "won"),
    ]);
    if (error) {
      return NextResponse.json({ error: "שגיאה בטעינת הלקוחות" }, { status: 500 });
    }

    // Total value per customer = sum of won deals whose contact name matches.
    const valueByContact = new Map<string, number>();
    for (const deal of deals ?? []) {
      if (!deal.contact_name || !deal.value) continue;
      valueByContact.set(
        deal.contact_name,
        (valueByContact.get(deal.contact_name) ?? 0) + deal.value,
      );
    }

    const rows: (string | number | null | undefined)[][] = [
      ["שם", "טלפון", "אימייל", "שווי כולל", "נוצר"],
      ...(customers ?? []).map((customer) => [
        customer.name,
        customer.phone,
        customer.email,
        valueByContact.get(customer.name) ?? "",
        formatDate(customer.created_at),
      ]),
    ];
    return csvResponse(toCsv(rows), "customers.csv");
  }

  return NextResponse.json(
    { error: "סוג ייצוא לא מוכר — יש להשתמש ב-type=leads או type=customers" },
    { status: 400 },
  );
}
