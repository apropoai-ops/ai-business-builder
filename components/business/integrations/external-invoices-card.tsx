import { FileText, ExternalLink, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { ExternalInvoice } from "@/types/database";

const PROVIDER_LABEL: Record<string, string> = {
  "green-invoice": "חשבונית ירוקה",
  icount: "iCount",
};

/**
 * Owner-facing list of the last ~10 tax documents (חשבונית מס/קבלה) issued
 * automatically by the connected invoicing integration (lib/services/invoicing)
 * whenever a store order gets paid. Self-contained: fetches its own data from
 * the RLS-scoped client, so it can be dropped into any dashboard page with
 * just the businessId.
 */
export async function ExternalInvoicesCard({ businessId }: { businessId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("external_invoices")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(10);
  const invoices = (data ?? []) as ExternalInvoice[];

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          חשבוניות שהופקו
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              עדיין לא הופקו חשבוניות
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              לאחר חיבור ספק חשבוניות (חשבונית ירוקה / iCount), חשבונית מס/קבלה
              תופק אוטומטית עבור כל הזמנה ששולמה — ותופיע כאן.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {inv.status === "failed" ? (
                      <AlertTriangle className="size-3.5 text-destructive" />
                    ) : null}
                    <span dir="ltr">{inv.number ?? "—"}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {PROVIDER_LABEL[inv.provider] ?? inv.provider}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString("he-IL", {
                      timeZone: "Asia/Jerusalem",
                      day: "numeric",
                      month: "numeric",
                      year: "2-digit",
                    })}
                    {inv.status === "failed" && inv.error ? ` · ${inv.error}` : ""}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={inv.status === "issued" ? "secondary" : "destructive"}>
                    {inv.status === "issued" ? "הופקה" : "נכשלה"}
                  </Badge>
                  {inv.url && (
                    <a
                      href={inv.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                      צפייה
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
