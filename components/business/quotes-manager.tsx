"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Send,
  Link as LinkIcon,
  Undo2,
  X,
  FileText,
  Check,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { QuotePdfButton, type QuoteBrand } from "@/components/business/quote-pdf-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createQuoteAction,
  updateQuoteAction,
  deleteQuoteAction,
  setQuoteStatusAction,
  type QuoteInput,
} from "@/lib/actions/quotes";
import { computeQuoteTotals, formatILS } from "@/lib/quote-totals";
import type { Quote, QuoteItem } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  accepted: "אושרה",
  declined: "נדחתה",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-rose-100 text-rose-700 border-rose-200",
};

const FILTERS = ["all", "draft", "sent", "accepted", "declined"] as const;
type Filter = (typeof FILTERS)[number];

type FormState = {
  title: string;
  customerName: string;
  customerPhone: string;
  items: QuoteItem[];
  discount: string;
  taxRate: string;
  validUntil: string;
  notes: string;
};

const emptyForm: FormState = {
  title: "",
  customerName: "",
  customerPhone: "",
  items: [{ description: "", quantity: 1, unit_price: 0 }],
  discount: "0",
  taxRate: "18",
  validUntil: "",
  notes: "",
};

function quoteToForm(q: Quote): FormState {
  return {
    title: q.title,
    customerName: q.customer_name,
    customerPhone: q.customer_phone ?? "",
    items: q.items.length ? q.items : [{ description: "", quantity: 1, unit_price: 0 }],
    discount: String(q.discount ?? 0),
    taxRate: String(q.tax_rate ?? 18),
    validUntil: q.valid_until ?? "",
    notes: q.notes ?? "",
  };
}

export function QuotesManager({
  businessId,
  quotes,
  brand,
}: {
  businessId: string;
  quotes: Quote[];
  brand: QuoteBrand;
}) {
  // Prefill from CRM "create quote" deep link (/quotes?name=…&phone=…).
  const searchParams = useSearchParams();
  const prefillName = searchParams.get("name");
  const prefillPhone = searchParams.get("phone");

  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(!!prefillName);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(
    prefillName
      ? { ...emptyForm, customerName: prefillName, customerPhone: prefillPhone ?? "" }
      : emptyForm,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = {
    draft: quotes.filter((q) => q.status === "draft").length,
    sent: quotes.filter((q) => q.status === "sent").length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
    declined: quotes.filter((q) => q.status === "declined").length,
    total: quotes.length,
  };
  const acceptedValue = quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + computeQuoteTotals(q.items, q.discount, q.tax_rate).total, 0);

  const visible = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  const liveTotals = computeQuoteTotals(
    form.items,
    Number(form.discount) || 0,
    Number(form.taxRate) || 0,
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(q: Quote) {
    setEditingId(q.id);
    setForm(quoteToForm(q));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function setItem(i: number, patch: Partial<QuoteItem>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unit_price: 0 }] }));
  }
  function removeItem(i: number) {
    setForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items,
    }));
  }

  function buildInput(status: "draft" | "sent"): QuoteInput {
    return {
      title: form.title,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      items: form.items,
      notes: form.notes,
      discount: Number(form.discount) || 0,
      taxRate: Number(form.taxRate) || 0,
      validUntil: form.validUntil || null,
      status,
    };
  }

  function save(status: "draft" | "sent") {
    startTransition(async () => {
      const input = buildInput(status);
      const res = editingId
        ? await updateQuoteAction(businessId, editingId, input)
        : await createQuoteAction(businessId, input);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        status === "sent" ? "ההצעה נשמרה ומוכנה לשליחה ✓" : "ההצעה נשמרה כטיוטה ✓",
      );
      closeForm();
    });
  }

  function copyLink(q: Quote) {
    const url = `${window.location.origin}/q/${q.public_token}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("הקישור הועתק — שלחו אותו ללקוח"))
      .catch(() => toast.error("ההעתקה נכשלה"));
  }

  function changeStatus(q: Quote, status: "draft" | "sent") {
    setBusyId(q.id);
    startTransition(async () => {
      const res = await setQuoteStatusAction(businessId, q.id, status);
      if (res.error) toast.error(res.error);
      else toast.success(status === "sent" ? "ההצעה סומנה כנשלחה ✓" : "ההצעה הוחזרה לטיוטה");
      setBusyId(null);
    });
  }

  function remove(q: Quote) {
    if (!confirm(`למחוק את ההצעה "${q.title}"?`)) return;
    setBusyId(q.id);
    startTransition(async () => {
      const res = await deleteQuoteAction(businessId, q.id);
      if (res.error) toast.error(res.error);
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "טיוטות", value: String(counts.draft), color: "text-zinc-600" },
          { label: "נשלחו", value: String(counts.sent), color: "text-blue-600" },
          { label: "אושרו", value: String(counts.accepted), color: "text-green-600" },
          { label: "סכום שאושר", value: formatILS(acceptedValue), color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-0.5 p-4">
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top bar: filters + new */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:border-zinc-400"
            }`}
          >
            {f === "all" ? `הכל (${counts.total})` : `${STATUS_LABEL[f]} (${counts[f]})`}
          </button>
        ))}
        {!showForm && (
          <Button size="sm" className="ms-auto gap-1.5" onClick={openCreate}>
            <Plus className="size-4" /> הצעה חדשה
          </Button>
        )}
      </div>

      {/* Create / edit form */}
      {showForm && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {editingId ? "עריכת הצעת מחיר" : "הצעת מחיר חדשה"}
              </h2>
              <Button variant="ghost" size="sm" onClick={closeForm} className="gap-1">
                <X className="size-4" /> סגירה
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-title">כותרת ההצעה</Label>
                <Input
                  id="q-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="לדוגמה: חבילת מיתוג מלאה"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-customer">שם הלקוח</Label>
                <Input
                  id="q-customer"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="שם פרטי ומשפחה / שם החברה"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-phone">טלפון הלקוח (לא חובה)</Label>
                <Input
                  id="q-phone"
                  dir="ltr"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="050-0000000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-valid">בתוקף עד (לא חובה)</Label>
                <Input
                  id="q-valid"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>

            {/* Line items */}
            <div className="flex flex-col gap-2">
              <Label>פריטים</Label>
              <div className="flex flex-col gap-2">
                {form.items.map((it, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      className="min-w-[160px] flex-1"
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      placeholder="תיאור הפריט / השירות"
                    />
                    <Input
                      className="w-20"
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                      placeholder="כמות"
                    />
                    <Input
                      className="w-28"
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })}
                      placeholder="מחיר ליח׳"
                    />
                    <span className="w-24 shrink-0 text-sm text-muted-foreground">
                      {formatILS((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(i)}
                      disabled={form.items.length <= 1}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={addItem} type="button">
                <Plus className="size-4" /> הוספת שורה
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-discount">הנחה (₪)</Label>
                <Input
                  id="q-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-tax">מע״מ (%)</Label>
                <Input
                  id="q-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-notes">הערות / תנאים (לא חובה)</Label>
              <Textarea
                id="q-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="תנאי תשלום, מועד אספקה, הערות נוספות…"
                rows={3}
              />
            </div>

            {/* Live totals */}
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">סכום ביניים</span>
                <span>{formatILS(liveTotals.subtotal)}</span>
              </div>
              {liveTotals.discount > 0 && (
                <div className="flex justify-between py-0.5 text-rose-600">
                  <span>הנחה</span>
                  <span>−{formatILS(liveTotals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">לפני מע״מ</span>
                <span>{formatILS(liveTotals.netAmount)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">מתוכו מע״מ ({liveTotals.taxRate}%)</span>
                <span>{formatILS(liveTotals.taxAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1.5 font-semibold">
                <span>סה״כ לתשלום (כולל מע״מ)</span>
                <span>{formatILS(liveTotals.total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save("sent")} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                שמירה ומוכנה לשליחה
              </Button>
              <Button variant="outline" onClick={() => save("draft")} disabled={isPending} className="gap-1.5">
                <FileText className="size-4" /> שמירה כטיוטה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quotes list */}
      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {quotes.length === 0
              ? "עדיין אין הצעות מחיר — צרו הצעה ושלחו ללקוח קישור לצפייה ואישור"
              : "אין הצעות בסטטוס הזה"}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((q) => {
            const totals = computeQuoteTotals(q.items, q.discount, q.tax_rate);
            return (
              <Card key={q.id} className={q.status === "declined" ? "opacity-70" : ""}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{q.title}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[q.status] ?? ""}`}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      <span>{q.customer_name}</span>
                      <span className="font-semibold text-foreground">{formatILS(totals.total)}</span>
                      <span className="text-xs">
                        {q.items.length} פריטים
                      </span>
                      {q.valid_until && (
                        <span className="text-xs">
                          בתוקף עד {new Date(q.valid_until).toLocaleDateString("he-IL")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {busyId === q.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    {/* Available on drafts too — owners often want the file
                        before the quote is formally "sent". */}
                    <QuotePdfButton quote={q} brand={brand} />
                    {(q.status === "sent" || q.status === "accepted" || q.status === "declined") && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => copyLink(q)}>
                        <LinkIcon className="size-3.5" /> קישור
                      </Button>
                    )}
                    {q.status === "draft" && (
                      <Button
                        size="sm"
                        className="gap-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => changeStatus(q, "sent")}
                        disabled={busyId === q.id}
                      >
                        <Send className="size-3.5" /> שליחה
                      </Button>
                    )}
                    {q.status === "sent" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground"
                        onClick={() => changeStatus(q, "draft")}
                        disabled={busyId === q.id}
                      >
                        <Undo2 className="size-3.5" /> לטיוטה
                      </Button>
                    )}
                    {q.status === "accepted" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Check className="size-3.5" /> הלקוח אישר
                      </span>
                    )}
                    {q.status === "declined" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                        <Ban className="size-3.5" /> הלקוח דחה
                      </span>
                    )}
                    {q.status !== "accepted" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(q)}
                        disabled={busyId === q.id}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(q)}
                      disabled={busyId === q.id}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
