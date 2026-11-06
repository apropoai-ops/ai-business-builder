"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Truck, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SHIPPING_TYPES, methodRegions, methodPoints } from "@/lib/shipping";
import { saveShippingMethodsAction } from "@/lib/actions/store-shipping";
import type { ShippingMethod } from "@/types/database";

type Row = {
  name: string;
  type: ShippingMethod["type"];
  price: string;
  eta: string;
  free_over: string;
  active: boolean;
  lines: string; // regions "אזור,מחיר" or points "שם,כתובת" — one per line
};

function toRow(m: ShippingMethod): Row {
  const lines =
    m.type === "by_region"
      ? methodRegions(m).map((r) => `${r.name},${r.price}`).join("\n")
      : m.type === "pickup_point"
        ? methodPoints(m).map((p) => `${p.name},${p.address ?? ""}`).join("\n")
        : "";
  return {
    name: m.name,
    type: m.type,
    price: String(m.price ?? 0),
    eta: m.eta ?? "",
    free_over: m.free_over != null ? String(m.free_over) : "",
    active: m.active,
    lines,
  };
}

const EMPTY: Row = { name: "", type: "delivery", price: "0", eta: "", free_over: "", active: true, lines: "" };

/** Build the details jsonb from the textarea lines, based on method type. */
function buildDetails(r: Row) {
  if (r.type === "by_region") {
    const regions = r.lines
      .split("\n")
      .map((l) => l.split(","))
      .filter((p) => p[0]?.trim())
      .map((p) => ({ name: p[0].trim(), price: Number(p[1]) || 0 }));
    return { regions };
  }
  if (r.type === "pickup_point") {
    const points = r.lines
      .split("\n")
      .map((l) => l.split(","))
      .filter((p) => p[0]?.trim())
      .map((p) => ({ name: p[0].trim(), address: (p[1] ?? "").trim() }));
    return { points };
  }
  return null;
}

/** Owner manager for storefront shipping methods (Wave C logistics). */
export function ShippingMethodsManager({
  businessId,
  methods,
}: {
  businessId: string;
  methods: ShippingMethod[];
}) {
  const [rows, setRows] = useState<Row[]>(methods.length ? methods.map(toRow) : []);
  const [isPending, startTransition] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function save() {
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        type: r.type,
        price: Number(r.price) || 0,
        eta: r.eta.trim() || null,
        free_over: r.free_over.trim() ? Number(r.free_over) : null,
        details: buildDetails(r),
        active: r.active,
      }));
    startTransition(async () => {
      const res = await saveShippingMethodsAction(businessId, payload);
      if (res.ok) toast.success("שיטות המשלוח נשמרו ✓");
      else toast.error(res.error ?? "השמירה נכשלה");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="size-4 text-primary" />
          שיטות משלוח
        </div>
        <p className="text-xs text-muted-foreground">
          הגדירו שיטות שיוצגו ללקוח בקופה. לפי-אזור / נקודות-איסוף: שורה לכל פריט
          (אזור,מחיר או שם,כתובת). אם לא תגדירו — תקפים דמי המשלוח הקבועים.
        </p>

        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input className="h-8 w-40" placeholder="שם השיטה" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={r.type}
                onChange={(e) => update(i, { type: e.target.value as ShippingMethod["type"] })}
              >
                {SHIPPING_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <Input className="h-8 w-24" type="number" min="0" placeholder="מחיר" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
              <Input className="h-8 w-28" placeholder="זמן אספקה" value={r.eta} onChange={(e) => update(i, { eta: e.target.value })} />
              <Input className="h-8 w-28" type="number" min="0" placeholder="חינם מעל" value={r.free_over} onChange={(e) => update(i, { free_over: e.target.value })} />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={r.active} onChange={(e) => update(i, { active: e.target.checked })} className="size-4" />
                פעיל
              </label>
              <button type="button" aria-label="מחיקה" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
            {(r.type === "by_region" || r.type === "pickup_point") && (
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs"
                rows={3}
                dir="rtl"
                placeholder={r.type === "by_region" ? "מרכז,20\nצפון,40\nדרום,40" : "סניף דיזנגוף,דיזנגוף 50\nסניף חיפה,הרצל 10"}
                value={r.lines}
                onChange={(e) => update(i, { lines: e.target.value })}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setRows((rs) => [...rs, { ...EMPTY }])}>
            <Plus className="size-3.5" /> שיטה
          </Button>
          <Button type="button" size="sm" className="gap-1" onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
