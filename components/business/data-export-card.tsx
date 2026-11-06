import { Download, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * One data-domain export card for the /export page. A plain anchor to the
 * CSV route (not next/link) so the browser handles the file download/
 * attachment response directly, matching components/business/product-csv.tsx.
 */
export function DataExportCard({
  businessId,
  entity,
  title,
  description,
  icon: Icon,
}: {
  businessId: string;
  entity: "customers" | "orders" | "bookings";
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <a href={`/api/businesses/${businessId}/export/${entity}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" />
            הורדת CSV
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
