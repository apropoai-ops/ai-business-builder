import { TrendingUp, ShoppingCart, Coins, Package, Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { StoreSalesStats } from "@/lib/services/store-analytics.service";

function ils(n: number): string {
  return `₪${(Number(n) || 0).toLocaleString("he-IL")}`;
}

/** Owner sales snapshot: revenue, AOV, units, profit + best sellers. */
export function StoreSalesCard({ stats }: { stats: StoreSalesStats }) {
  const tiles = [
    { label: "הכנסות", value: ils(stats.revenue), icon: Coins, color: "text-emerald-600" },
    { label: "שולם בפועל", value: ils(stats.paidRevenue), icon: TrendingUp, color: "text-green-600" },
    { label: "ממוצע הזמנה", value: ils(stats.aov), icon: ShoppingCart, color: "text-blue-600" },
    { label: "יחידות שנמכרו", value: String(stats.units), icon: Package, color: "text-zinc-700" },
    ...(stats.profit != null
      ? [{ label: "רווח גולמי", value: ils(stats.profit), icon: TrendingUp, color: "text-emerald-700" }]
      : []),
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="rounded-xl border p-3">
                <Icon className={`mb-1 size-4 ${t.color}`} />
                <div className="text-lg font-bold">{t.value}</div>
                <div className="text-xs text-muted-foreground">{t.label}</div>
              </div>
            );
          })}
        </div>

        {stats.bestSellers.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="size-4 text-amber-500" /> הנמכרים ביותר
            </div>
            <ul className="space-y-1">
              {stats.bestSellers.map((b, i) => (
                <li key={b.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                    {b.name}
                  </span>
                  <span className="text-muted-foreground">{b.qty} יח׳</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stats.profit == null && (
          <p className="text-xs text-muted-foreground">
            💡 הוסיפו מחיר עלות למוצרים (בכרטיס המוצר) כדי לראות רווח גולמי.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
