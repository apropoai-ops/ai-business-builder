import { ShoppingCart, MessageCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { buildWaMeUrl } from "@/lib/phone";
import type { AbandonedCart } from "@/types/database";

type CartItem = { name: string; quantity: number };

/** Owner list of abandoned carts with a one-tap WhatsApp follow-up. */
export function AbandonedCarts({
  businessId,
  carts,
}: {
  businessId: string;
  carts: AbandonedCart[];
}) {
  void businessId;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="size-4 text-amber-600" />
          עגלות נטושות ({carts.length})
        </div>
        <p className="text-xs text-muted-foreground">
          לקוחות שהתחילו תשלום ולא סיימו — שלחו תזכורת בוואטסאפ כדי לסגור את המכירה.
        </p>

        <div className="flex flex-col gap-2">
          {carts.map((c) => {
            const items = (Array.isArray(c.items) ? c.items : []) as CartItem[];
            const summary = items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
            const waText = `היי${c.customer_name ? ` ${c.customer_name}` : ""}! ראינו שהתחלתם הזמנה אצלנו${summary ? ` (${summary})` : ""} ונשמח לעזור להשלים אותה 🙂`;
            const wa = c.customer_phone ? buildWaMeUrl(c.customer_phone, waText) : null;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {c.customer_name || "לקוח"}{" "}
                    {c.customer_phone && <span className="text-xs text-muted-foreground" dir="ltr">{c.customer_phone}</span>}
                  </div>
                  {summary && <div className="truncate text-xs text-muted-foreground">{summary}</div>}
                  {c.total != null && <div className="text-xs font-semibold">₪{Number(c.total).toLocaleString("he-IL")}</div>}
                </div>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <MessageCircle className="size-3.5" /> תזכורת
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
