"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, Pencil, Trash2, X, Check, Download, Scissors } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listBookingServicesAction,
  createBookingServiceAction,
  updateBookingServiceAction,
  deleteBookingServiceAction,
  importLegacyServicesAction,
} from "@/lib/actions/booking-services";
import type { BookingService } from "@/types/database";

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

type Draft = { name: string; duration_minutes: number; price: string };
const EMPTY_DRAFT: Draft = { name: "", duration_minutes: 30, price: "" };

function parsePrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function BookingServicesManager({
  businessId,
  initialServices,
  hasLegacyServices,
}: {
  businessId: string;
  initialServices: BookingService[];
  hasLegacyServices: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [legacyAvailable, setLegacyAvailable] = useState(hasLegacyServices && initialServices.length === 0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);

  function submitAdd() {
    const name = draft.name.trim();
    if (name.length < 2) {
      toast.error("שם השירות חייב להיות באורך 2 תווים לפחות");
      return;
    }
    startTransition(async () => {
      const res = await createBookingServiceAction(businessId, {
        name,
        duration_minutes: draft.duration_minutes,
        price: parsePrice(draft.price),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("השירות נוסף");
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      setLegacyAvailable(false);
      const fresh = await listBookingServicesAction(businessId);
      if (fresh.services) setServices(fresh.services);
    });
  }

  function startEdit(s: BookingService) {
    setEditingId(s.id);
    setEditDraft({ name: s.name, duration_minutes: s.duration_minutes, price: s.price != null ? String(s.price) : "" });
  }

  function submitEdit(s: BookingService) {
    const name = editDraft.name.trim();
    if (name.length < 2) {
      toast.error("שם השירות חייב להיות באורך 2 תווים לפחות");
      return;
    }
    setBusyId(s.id);
    startTransition(async () => {
      const res = await updateBookingServiceAction(businessId, s.id, {
        name,
        duration_minutes: editDraft.duration_minutes,
        price: parsePrice(editDraft.price),
        active: s.active,
      });
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setServices((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, name, duration_minutes: editDraft.duration_minutes, price: parsePrice(editDraft.price) }
            : x,
        ),
      );
      setEditingId(null);
    });
  }

  function toggleActive(s: BookingService) {
    setBusyId(s.id);
    startTransition(async () => {
      const res = await updateBookingServiceAction(businessId, s.id, {
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
        active: !s.active,
      });
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
    });
  }

  function remove(s: BookingService) {
    if (!confirm(`למחוק את השירות "${s.name}"?`)) return;
    setBusyId(s.id);
    startTransition(async () => {
      const res = await deleteBookingServiceAction(businessId, s.id);
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setServices((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("השירות נמחק");
    });
  }

  function importLegacy() {
    setImporting(true);
    startTransition(async () => {
      const res = await importLegacyServicesAction(businessId);
      if (res.error) {
        toast.error(res.error);
        setImporting(false);
        return;
      }
      toast.success(`יובאו ${res.imported ?? 0} שירותים`);
      setLegacyAvailable(false);
      const fresh = await listBookingServicesAction(businessId);
      if (fresh.services) setServices(fresh.services);
      setImporting(false);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold">
            <Scissors className="size-4 text-primary" />
            השירותים שלי
          </div>
          {!adding && (
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              הוספת שירות
            </Button>
          )}
        </div>

        {legacyAvailable && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">
              נמצאה רשימת שירותים ישנה מההגדרות הקודמות — אפשר לייבא אותה כאן בלחיצה אחת.
            </span>
            <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={importLegacy} disabled={importing}>
              {importing ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              ייבוא השירותים הקיימים
            </Button>
          </div>
        )}

        {adding && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
            <div className="min-w-36 flex-1 space-y-1">
              <Label className="text-xs">שם השירות</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="תספורת גברים"
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">משך</Label>
              <Select
                value={String(draft.duration_minutes)}
                onValueChange={(v) => setDraft((d) => ({ ...d, duration_minutes: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>{m} דק&apos;</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">מחיר (₪)</Label>
              <Input
                type="number" min={0} inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="אופציונלי"
              />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-9 gap-1" onClick={submitAdd} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                שמירה
              </Button>
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {services.length === 0 && !adding ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            עדיין אין שירותים מוגדרים — הוסיפו שירות כדי שהלקוחות יוכלו לבחור אותו בעת קביעת תור
          </div>
        ) : (
          <div className="space-y-1.5">
            {services.map((s) =>
              editingId === s.id ? (
                <div key={s.id} className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-3">
                  <div className="min-w-36 flex-1 space-y-1">
                    <Label className="text-xs">שם השירות</Label>
                    <Input
                      value={editDraft.name}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={80}
                      autoFocus
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">משך</Label>
                    <Select
                      value={String(editDraft.duration_minutes)}
                      onValueChange={(v) => setEditDraft((d) => ({ ...d, duration_minutes: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATIONS.map((m) => (
                          <SelectItem key={m} value={String(m)}>{m} דק&apos;</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">מחיר (₪)</Label>
                    <Input
                      type="number" min={0} inputMode="decimal"
                      value={editDraft.price}
                      onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                      placeholder="אופציונלי"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-9 gap-1" onClick={() => submitEdit(s)} disabled={busyId === s.id}>
                      {busyId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      שמירה
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9" onClick={() => setEditingId(null)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${s.active ? "" : "opacity-50"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.duration_minutes} דק&apos;{s.price != null && ` · ₪${s.price}`}
                    </div>
                  </div>
                  <Switch
                    checked={s.active}
                    onCheckedChange={() => toggleActive(s)}
                    disabled={busyId === s.id}
                  />
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(s)} disabled={busyId === s.id}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(s)} disabled={busyId === s.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
