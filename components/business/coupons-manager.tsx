"use client";

import { useRef, useState, useTransition } from "react";
import { Ticket, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCouponAction,
  deleteCouponAction,
  toggleCouponAction,
} from "@/lib/actions/coupon";
import type { Coupon } from "@/types/database";

export function CouponsManager({
  businessId,
  coupons,
}: {
  businessId: string;
  coupons: Coupon[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await createCouponAction(businessId, {
        code: String(formData.get("code") ?? ""),
        type,
        value: String(formData.get("value") ?? ""),
        minOrder: String(formData.get("minOrder") ?? ""),
        expiresAt: String(formData.get("expiresAt") ?? ""),
        maxUses: String(formData.get("maxUses") ?? ""),
        customerPhone: String(formData.get("customerPhone") ?? ""),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הקופון נוצר ✓");
        formRef.current?.reset();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteCouponAction(businessId, id);
      if (res.error) toast.error(res.error);
      setBusyId(null);
    });
  }

  function toggle(c: Coupon) {
    setBusyId(c.id);
    startTransition(async () => {
      await toggleCouponAction(businessId, c.id, !c.active);
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="size-4 text-primary" />
          קופונים והנחות
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="code" placeholder="קוד (למשל SALE10)" required className="uppercase" />
          <div className="flex gap-2">
            <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">אחוז %</SelectItem>
                <SelectItem value="fixed">₪ קבוע</SelectItem>
              </SelectContent>
            </Select>
            <Input name="value" type="number" min="0" step="0.01" placeholder={type === "percent" ? "%" : "₪"} required />
          </div>
          <Input name="minOrder" type="number" min="0" step="0.01" placeholder="מינ' הזמנה ₪ (לא חובה)" />
          <Input name="expiresAt" type="date" placeholder="תוקף" />
          <Input name="maxUses" type="number" min="1" step="1" placeholder="מגבלת שימושים (לא חובה)" />
          <Input name="customerPhone" type="tel" dir="ltr" placeholder="טלפון לקוח — קופון אישי (לא חובה)" />
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            צור קופון
          </Button>
        </form>

        {coupons.length > 0 && (
          <div className="space-y-2">
            {coupons.map((c) => (
              <div key={c.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${c.active ? "" : "opacity-55"}`}>
                <span className="font-mono font-bold">{c.code}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {c.type === "percent" ? `${c.value}% הנחה` : `₪${c.value} הנחה`}
                </Badge>
                {c.min_order != null && (
                  <span className="text-xs text-muted-foreground">מעל ₪{c.min_order}</span>
                )}
                {c.expires_at && (
                  <span className="text-xs text-muted-foreground">עד {c.expires_at}</span>
                )}
                <span className="text-xs text-muted-foreground">· נוצל {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}×</span>
                {c.max_uses != null && c.used_count >= c.max_uses && (
                  <Badge variant="secondary" className="text-[10px]">מוצה</Badge>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => toggle(c)} disabled={busyId === c.id}>
                    {c.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c.id)} disabled={busyId === c.id}>
                    {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
