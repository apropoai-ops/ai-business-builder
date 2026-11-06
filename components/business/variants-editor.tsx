"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Check, Boxes } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeSvg } from "@/components/business/barcode-svg";
import { saveVariantsAction } from "@/lib/actions/store";
import type { ProductVariant } from "@/types/database";

type Row = { size: string; color: string; sku: string; barcode: string; stock_qty: string };

function toRow(v: ProductVariant): Row {
  return {
    size: v.size ?? "",
    color: v.color ?? "",
    sku: v.sku ?? "",
    barcode: v.barcode ?? "",
    stock_qty: String(v.stock_qty ?? 0),
  };
}

const EMPTY: Row = { size: "", color: "", sku: "", barcode: "", stock_qty: "0" };

/** Per-product variant + per-variant stock editor (Wave C inventory). */
export function VariantsEditor({
  businessId,
  productId,
  initial,
}: {
  businessId: string;
  productId: string;
  initial: ProductVariant[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(initial.length ? initial.map(toRow) : [{ ...EMPTY }]);
  const [isPending, startTransition] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { ...EMPTY }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function save() {
    const variants = rows
      .filter((r) => r.size.trim() || r.color.trim())
      .map((r) => ({
        size: r.size.trim() || null,
        color: r.color.trim() || null,
        sku: r.sku.trim() || null,
        barcode: r.barcode.trim() || null,
        stock_qty: Math.max(0, Math.floor(Number(r.stock_qty) || 0)),
      }));
    startTransition(async () => {
      const res = await saveVariantsAction(businessId, productId, variants);
      if (res.error) toast.error(res.error);
      else toast.success("הוריאציות והמלאי נשמרו ✓");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Boxes className="size-3.5" />
        ניהול וריאציות ומלאי{initial.length ? ` (${initial.length})` : ""}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-semibold text-muted-foreground">
        וריאציות ומלאי — כל שורה היא צירוף מידה/צבע עם מלאי, מק״ט וברקוד משלו.
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <Input className="h-8 w-20" placeholder="מידה" value={r.size} onChange={(e) => update(i, { size: e.target.value })} />
          <Input className="h-8 w-24" placeholder="צבע" value={r.color} onChange={(e) => update(i, { color: e.target.value })} />
          <Input className="h-8 w-28" dir="ltr" placeholder="מק״ט" value={r.sku} onChange={(e) => update(i, { sku: e.target.value })} />
          <Input className="h-8 w-32" dir="ltr" placeholder="ברקוד" value={r.barcode} onChange={(e) => update(i, { barcode: e.target.value })} />
          <Input className="h-8 w-20" type="number" min="0" placeholder="מלאי" value={r.stock_qty} onChange={(e) => update(i, { stock_qty: e.target.value })} />
          {r.barcode.trim() && <BarcodeSvg value={r.barcode.trim()} height={28} />}
          <button type="button" aria-label="מחיקה" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRow}>
          <Plus className="size-3.5" /> שורה
        </Button>
        <Button type="button" size="sm" className="gap-1" onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          שמירה
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">
          סגירה
        </button>
      </div>
    </div>
  );
}
