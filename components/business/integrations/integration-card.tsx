import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Shared visual shell for every card on the integrations hub — icon chip,
 * title/subtitle, an optional status badge, and a body slot. Kept dumb on
 * purpose so both the simple status-only cards and the richer connect forms
 * (invoicing/SMS) can reuse the same header treatment.
 */
export function IntegrationCard({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  status,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
                iconClassName,
              )}
            >
              <Icon className="size-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {status}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: "connected" | "not-connected" | "builtin" }) {
  if (status === "connected") {
    return (
      <Badge className="shrink-0 gap-1 bg-green-600 text-[10px]">מחובר</Badge>
    );
  }
  if (status === "builtin") {
    return (
      <Badge variant="secondary" className="shrink-0 text-[10px]">
        מובנה
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
      לא מחובר
    </Badge>
  );
}
