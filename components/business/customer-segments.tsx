import { Crown, Repeat, UserPlus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { buildWaMeUrl } from "@/lib/phone";
import type { CustomerSegment } from "@/lib/services/store-analytics.service";

const TIER: Record<string, { label: string; cls: string; icon: typeof Crown }> = {
  vip: { label: "VIP", cls: "bg-amber-100 text-amber-800", icon: Crown },
  returning: { label: "חוזר", cls: "bg-blue-100 text-blue-800", icon: Repeat },
  new: { label: "חדש", cls: "bg-zinc-100 text-zinc-600", icon: UserPlus },
};

/** Owner VIP / customer-segmentation view (top spenders, by phone). */
export function CustomerSegments({ customers }: { customers: CustomerSegment[] }) {
  if (customers.length === 0) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Crown className="size-4 text-amber-500" /> לקוחות מובילים (VIP)
        </div>
        <div className="flex flex-col gap-1.5">
          {customers.map((c) => {
            const t = TIER[c.tier] ?? TIER.new;
            const Icon = t.icon;
            const wa = buildWaMeUrl(c.phone);
            return (
              <div key={c.phone} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name || "לקוח"}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>
                      <Icon className="size-3" /> {t.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{c.phone}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-end text-xs text-muted-foreground">
                    {c.orders} הזמנות
                    <span className="block font-bold text-foreground">₪{c.spent.toLocaleString("he-IL")}</span>
                  </span>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[#25d366] hover:underline">
                      וואטסאפ
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
