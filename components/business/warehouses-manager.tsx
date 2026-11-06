"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Warehouse as WarehouseIcon, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveWarehouseAction, deleteWarehouseAction } from "@/lib/actions/store-shipping";
import type { Warehouse } from "@/types/database";

/** Owner manager for warehouses / pickup locations (Wave C logistics). */
export function WarehousesManager({
  businessId,
  warehouses,
}: {
  businessId: string;
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", is_default: false });
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!form.name.trim()) return toast.error("נא להזין שם מחסן");
    startTransition(async () => {
      const res = await saveWarehouseAction(businessId, form);
      if (res.ok) {
        toast.success("המחסן נשמר ✓");
        setForm({ name: "", address: "", phone: "", is_default: false });
        setAdding(false);
        router.refresh();
      } else toast.error(res.error ?? "השמירה נכשלה");
    });
  }

  function remove(id: string) {
    if (!confirm("למחוק את המחסן?")) return;
    startTransition(async () => {
      const res = await deleteWarehouseAction(businessId, id);
      if (res.ok) { toast.success("נמחק"); router.refresh(); }
      else toast.error(res.error ?? "המחיקה נכשלה");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <WarehouseIcon className="size-4 text-primary" />
          מחסנים ונקודות איסוף
        </div>

        {warehouses.map((w) => (
          <div key={w.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <div className="flex items-center gap-2 font-medium">
                {w.name}
                {w.is_default && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    <Star className="size-3" /> ראשי
                  </span>
                )}
              </div>
              {w.address && <div className="text-xs text-muted-foreground">{w.address}</div>}
              {w.phone && <div className="text-xs text-muted-foreground" dir="ltr">{w.phone}</div>}
            </div>
            <button type="button" aria-label="מחיקה" onClick={() => remove(w.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="space-y-2 rounded-lg border p-3">
            <Input placeholder="שם המחסן *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="כתובת" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="טלפון" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="size-4" />
              מחסן ראשי
            </label>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="gap-1" onClick={save} disabled={isPending}>
                {isPending && <Loader2 className="size-3.5 animate-spin" />} שמירה
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>ביטול</Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="gap-1 self-start" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> מחסן
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
