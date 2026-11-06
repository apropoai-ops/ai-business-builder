"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, ChevronDown, ClipboardList, Loader2, Phone, X, Banknote, FileText, Undo2, Truck, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setOrderStatusAction, markSupplierOrderedAction, loadMoreOrdersAction } from "@/lib/actions/orders";
import {
  markOrderPaidAction,
  issueInvoiceAction,
  refundOrderAction,
} from "@/lib/actions/store-payments";
import { setOrderTrackingAction } from "@/lib/actions/store-shipping";
import { markOrderShippedAction } from "@/lib/actions/store-order-fulfillment";
import { paymentMethodLabel } from "@/lib/payments";
import { usePaginatedList } from "@/components/business/crm/use-paginated-list";
import { StatusBadge, type StatusTone } from "@/components/business/crm/status-badge";
import type { Order, OrderItem, OrderRefund } from "@/types/database";

const ORDERS_PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  new: "חדשה",
  confirmed: "אושרה",
  shipped: "נשלחה",
  done: "הושלמה",
  cancelled: "בוטלה",
};

const PAY_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  refunded: "זוכה",
  partially_refunded: "זוכה חלקית",
  failed: "נכשל",
};

/** Payment-status tone — a dimension independent of fulfillment (STATUS_TONE below). */
const PAY_TONE: Record<string, StatusTone> = {
  pending: "warning",
  paid: "success",
  refunded: "neutral",
  partially_refunded: "info",
  failed: "danger",
};

/** Fulfillment-status tone — a dimension independent of payment (PAY_TONE above). */
const STATUS_TONE: Record<string, StatusTone> = {
  new: "warning",
  confirmed: "info",
  shipped: "progress",
  done: "success",
  cancelled: "neutral",
};

const FILTERS = ["all", "new", "confirmed", "shipped", "done", "cancelled"] as const;
type Filter = (typeof FILTERS)[number];

export function OrdersManager({
  businessId,
  orders: initialOrders,
  itemsByOrder = {},
  invoiceByOrder = {},
  refundsByOrder = {},
  externalInvoiceByOrder = {},
}: {
  businessId: string;
  orders: Order[];
  itemsByOrder?: Record<string, OrderItem[]>;
  invoiceByOrder?: Record<string, string>;
  refundsByOrder?: Record<string, OrderRefund[]>;
  /** External tax-invoice (Green Invoice / iCount) per order, when one was
   * issued via the invoicing integration — see getExternalInvoiceForOrder in
   * lib/services/invoicing. Passed in by the page that loads the orders. */
  externalInvoiceByOrder?: Record<string, { number: string; url: string | null; provider: string }>;
}) {
  const { items: orders, hasMore, loading: loadingMore, loadMore } = usePaginatedList(initialOrders, ORDERS_PAGE_SIZE);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [supplierOverride, setSupplierOverride] = useState<Record<string, string | null>>({});
  const [, startTransition] = useTransition();
  const router = useRouter();

  function togglePaid(o: Order) {
    setBusyId(o.id);
    startTransition(async () => {
      const res = await markOrderPaidAction(businessId, o.id, o.payment_status !== "paid");
      if (res.error) toast.error(res.error);
      else toast.success(o.payment_status !== "paid" ? "סומן כשולם ✓" : "סומן כממתין");
      setBusyId(null);
    });
  }

  function makeInvoice(o: Order) {
    const existing = invoiceByOrder[o.id];
    if (existing) {
      window.open(`/invoice/${existing}`, "_blank");
      return;
    }
    setBusyId(o.id);
    startTransition(async () => {
      const res = await issueInvoiceAction(businessId, o.id);
      if (!res.ok) toast.error(res.error ?? "הפקת אישור ההזמנה נכשלה");
      else if (res.invoiceId) {
        toast.success("אישור הזמנה הופק ✓");
        window.open(`/invoice/${res.invoiceId}`, "_blank");
      }
      setBusyId(null);
    });
  }

  function setTracking(o: Order) {
    const num = window.prompt("מספר מעקב למשלוח:", o.tracking_number ?? "");
    if (num == null) return;
    const carrier = window.prompt("חברת שילוח (אופציונלי):", o.tracking_carrier ?? "") ?? "";
    setBusyId(o.id);
    startTransition(async () => {
      const res = await setOrderTrackingAction(businessId, o.id, num, carrier);
      if (!res.ok) toast.error(res.error ?? "העדכון נכשל");
      else toast.success("מספר המעקב נשמר ✓");
      setBusyId(null);
    });
  }

  /** Marks the order shipped (status='shipped' + shipped_at) and, if a tracking
   * number is given, stamps it too. Also emails the customer, best-effort. */
  function setShipped(o: Order) {
    const num = window.prompt("מספר מעקב למשלוח (אופציונלי):", o.tracking_number ?? "");
    if (num == null) return; // cancelled the prompt
    setBusyId(o.id);
    startTransition(async () => {
      const res = await markOrderShippedAction(businessId, o.id, num.trim() || null);
      if (!res.ok) toast.error(res.error ?? "העדכון נכשל");
      else {
        toast.success("ההזמנה סומנה כנשלחה ✓");
        router.refresh();
      }
      setBusyId(null);
    });
  }

  function refund(o: Order) {
    const raw = window.prompt("סכום זיכוי בש״ח:", o.total != null ? String(o.total) : "");
    if (raw == null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("סכום לא תקין");
      return;
    }
    const reason = window.prompt("סיבת הזיכוי (אופציונלי):", "") ?? "";
    setBusyId(o.id);
    startTransition(async () => {
      const res = await refundOrderAction(businessId, o.id, amount, reason);
      if (!res.ok) toast.error(res.error ?? "הזיכוי נכשל");
      else toast.success("זיכוי נרשם ✓");
      setBusyId(null);
    });
  }

  /** Builds a clean plain-text supplier order sheet and copies it to the clipboard. */
  function copyForSupplier(o: Order) {
    const supplierItems = itemsByOrder[o.id];
    const lines: string[] = supplierItems?.length
      ? supplierItems.map((it) => {
          let line = `- ${it.product_name} × ${it.quantity}`;
          if (it.variant) line += ` · ${it.variant}`;
          if (it.engraving) line += ` · חריטה: "${it.engraving}"`;
          return line;
        })
      : [`- ${o.product_name} × ${o.quantity}${o.variant ? ` · ${o.variant}` : ""}`];

    const text = [
      `הזמנה #${o.id.slice(0, 8)} — ${new Date(o.created_at).toLocaleDateString("he-IL")}`,
      `לקוח: ${o.customer_name}`,
      `טלפון: ${o.customer_phone}`,
      `כתובת למשלוח: ${o.customer_address ?? "—"}`,
      `פריטים:`,
      ...lines,
      `הערות: ${o.notes ?? "—"}`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopiedId(o.id);
    toast.success("ההזמנה הועתקה ✓");
    setTimeout(() => setCopiedId((cur) => (cur === o.id ? null : cur)), 2000);
  }

  function toggleSupplierOrdered(o: Order) {
    const currentlyOrdered = supplierOverride[o.id] !== undefined ? supplierOverride[o.id] : o.supplier_ordered_at;
    const next = currentlyOrdered ? null : new Date().toISOString();
    setSupplierOverride((prev) => ({ ...prev, [o.id]: next }));
    setBusyId(o.id);
    startTransition(async () => {
      const res = await markSupplierOrderedAction(businessId, o.id, !currentlyOrdered);
      if (!res.ok) {
        toast.error(res.error ?? "העדכון נכשל");
        setSupplierOverride((prev) => ({ ...prev, [o.id]: currentlyOrdered ?? null }));
      } else {
        toast.success(next ? "סומן שהוזמן מהספק ✓" : "סומן כטרם הוזמן");
        router.refresh();
      }
      setBusyId(null);
    });
  }

  const counts = {
    new: orders.filter((o) => o.status === "new").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    done: orders.filter((o) => o.status === "done").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    total: orders.length,
  };

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function setStatus(id: string, status: "confirmed" | "done" | "cancelled") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setOrderStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          status === "confirmed"
            ? "ההזמנה אושרה ✓"
            : status === "done"
              ? "ההזמנה הושלמה ✓"
              : "ההזמנה בוטלה",
        );
      }
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "חדשות", value: counts.new, color: "text-amber-600" },
          { label: "בטיפול", value: counts.confirmed, color: "text-blue-600" },
          { label: "הושלמו", value: counts.done, color: "text-green-600" },
          { label: 'סה"כ', value: counts.total, color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-0.5 p-4">
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Orders list */}
      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {orders.length === 0
              ? "עדיין אין הזמנות — ברגע שלקוח יזמין מוצר באתר, ההזמנה תופיע כאן"
              : "אין הזמנות בסטטוס הזה"}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((o) => {
            const supplierOrderedAt = supplierOverride[o.id] !== undefined ? supplierOverride[o.id] : o.supplier_ordered_at;
            const needsSupplierOrder = o.status !== "cancelled" && o.payment_status === "paid" && !supplierOrderedAt;
            return (
            <Card
              key={o.id}
              className={
                o.status === "cancelled"
                  ? "opacity-60"
                  : needsSupplierOrder
                    ? "ring-1 ring-amber-400"
                    : ""
              }
            >
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {o.quantity}× {o.product_name}
                      {o.variant && (
                        <span className="ms-1 text-xs font-normal text-muted-foreground">({o.variant})</span>
                      )}
                    </span>
                    <StatusBadge tone={STATUS_TONE[o.status] ?? "neutral"} label={STATUS_LABEL[o.status] ?? o.status} />
                    <StatusBadge tone={PAY_TONE[o.payment_status] ?? "neutral"} label={PAY_LABEL[o.payment_status] ?? o.payment_status} />
                    {o.payment_method && (
                      <span className="text-[10px] text-muted-foreground">
                        {paymentMethodLabel(o.payment_method)}
                      </span>
                    )}
                    {needsSupplierOrder && <StatusBadge tone="warning" label="ממתין להזמנה מהספק" />}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                    <span>{o.customer_name}</span>
                    <a
                      href={`tel:${o.customer_phone}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      <Phone className="size-3" />
                      {o.customer_phone}
                    </a>
                    <span className="text-xs">
                      {new Date(o.created_at).toLocaleString("he-IL", {
                        timeZone: "Asia/Jerusalem",
                        day: "numeric",
                        month: "numeric",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {o.customer_address && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      📍 {o.customer_address}
                    </div>
                  )}
                  {(itemsByOrder[o.id]?.length ?? 0) > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {itemsByOrder[o.id].map((it) => (
                        <li key={it.id}>
                          • {it.quantity}× {it.product_name}
                          {it.variant ? ` (${it.variant})` : ""}
                          {it.unit_price != null
                            ? ` — ₪${(it.unit_price * it.quantity).toLocaleString("he-IL")}`
                            : ""}
                          {it.engraving && (
                            <span className="ms-1 font-medium text-violet-700">✒️ {it.engraving}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {o.total != null && (
                    <div className="mt-1 text-sm font-semibold">
                      סה״כ: ₪{o.total.toLocaleString("he-IL")}
                    </div>
                  )}
                  {(refundsByOrder[o.id]?.length ?? 0) > 0 && (
                    <div className="mt-0.5 text-xs text-orange-700">
                      זוכה: ₪
                      {refundsByOrder[o.id]
                        .reduce((s, r) => s + Number(r.amount), 0)
                        .toLocaleString("he-IL")}
                    </div>
                  )}
                  {o.shipping_method && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      🚚 {o.shipping_method}
                      {o.shipping_details ? ` · ${o.shipping_details}` : ""}
                      {o.shipping_price != null ? ` · ₪${Number(o.shipping_price).toLocaleString("he-IL")}` : ""}
                    </div>
                  )}
                  {o.tracking_number && (
                    <div className="mt-0.5 text-[11px] font-medium text-blue-700" dir="ltr">
                      📦 {o.tracking_carrier ? `${o.tracking_carrier}: ` : ""}{o.tracking_number}
                    </div>
                  )}
                  {o.shipped_at && (
                    <div className="mt-0.5 text-[11px] text-violet-700">
                      🚚 נשלחה בתאריך {new Date(o.shipped_at).toLocaleDateString("he-IL")}
                    </div>
                  )}
                  {o.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">📝 {o.notes}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {busyId === o.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    {o.status === "new" && (
                      <Button
                        size="sm"
                        className="gap-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => setStatus(o.id, "confirmed")}
                        disabled={busyId === o.id}
                      >
                        <Check className="size-3.5" /> אישור
                      </Button>
                    )}
                    {o.status === "confirmed" && (
                      <Button
                        size="sm"
                        className="gap-1 bg-violet-600 hover:bg-violet-700"
                        onClick={() => setShipped(o)}
                        disabled={busyId === o.id}
                      >
                        <Send className="size-3.5" /> נשלח
                      </Button>
                    )}
                    {(o.status === "confirmed" || o.status === "shipped") && (
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700"
                        onClick={() => setStatus(o.id, "done")}
                        disabled={busyId === o.id}
                      >
                        <CheckCheck className="size-3.5" /> הושלמה
                      </Button>
                    )}
                    {(o.status === "new" || o.status === "confirmed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-muted-foreground hover:text-destructive"
                        onClick={() => setStatus(o.id, "cancelled")}
                        disabled={busyId === o.id}
                      >
                        <X className="size-3.5" /> ביטול
                      </Button>
                    )}
                  </div>
                  {o.status !== "cancelled" && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => togglePaid(o)}
                        disabled={busyId === o.id}
                      >
                        <Banknote className="size-3.5" />
                        {o.payment_status === "paid" ? "בטל תשלום" : "סמן כשולם"}
                      </Button>
                      {o.total != null && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => makeInvoice(o)}
                          disabled={busyId === o.id}
                        >
                          <FileText className="size-3.5" />
                          {invoiceByOrder[o.id] ? "אישור הזמנה" : "הפק אישור הזמנה"}
                        </Button>
                      )}
                      {externalInvoiceByOrder[o.id] && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={() => window.open(externalInvoiceByOrder[o.id].url ?? undefined, "_blank")}
                          disabled={!externalInvoiceByOrder[o.id].url}
                        >
                          <FileText className="size-3.5" />
                          חשבונית מס {externalInvoiceByOrder[o.id].number}
                        </Button>
                      )}
                      {o.payment_status !== "pending" && o.total != null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-destructive"
                          onClick={() => refund(o)}
                          disabled={busyId === o.id}
                        >
                          <Undo2 className="size-3.5" /> זיכוי
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setTracking(o)}
                        disabled={busyId === o.id}
                      >
                        <Truck className="size-3.5" />
                        {o.tracking_number ? "מעקב" : "מספר מעקב"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => copyForSupplier(o)}
                      >
                        {copiedId === o.id ? <Check className="size-3.5 text-green-600" /> : <ClipboardList className="size-3.5" />}
                        {copiedId === o.id ? "הועתק ✓" : "📋 העתקת הזמנה לספק"}
                      </Button>
                      {supplierOrderedAt ? (
                        <StatusBadge
                          tone="success"
                          label={`✓ הוזמן מהספק ${new Date(supplierOrderedAt).toLocaleDateString("he-IL")}`}
                        />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
                          onClick={() => toggleSupplierOrdered(o)}
                          disabled={busyId === o.id}
                        >
                          סמן שהוזמן מהספק
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loadingMore}
            onClick={() => loadMore((page) => loadMoreOrdersAction(businessId, page))}
          >
            {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
            טען עוד
          </Button>
        </div>
      )}
    </div>
  );
}
