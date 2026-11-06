"use client";

import { useState, useTransition } from "react";
import { Check, CheckCheck, ChevronDown, Loader2, Phone, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setReturnStatusAction, loadMoreReturnsAction } from "@/lib/actions/returns";
import { usePaginatedList } from "@/components/business/crm/use-paginated-list";
import { StatusBadge, type StatusTone } from "@/components/business/crm/status-badge";
import type { Return } from "@/types/database";

const RETURNS_PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  new: "חדשה",
  approved: "אושרה",
  rejected: "נדחתה",
  done: "טופלה",
};

const STATUS_TONE: Record<string, StatusTone> = {
  new: "warning",
  approved: "info",
  rejected: "neutral",
  done: "success",
};

const KIND_LABEL: Record<string, string> = {
  return: "החזרה",
  exchange: "החלפה",
};

const KIND_TONE: Record<string, StatusTone> = {
  return: "progress",
  exchange: "info",
};

const FILTERS = ["all", "new", "approved", "rejected", "done"] as const;
type Filter = (typeof FILTERS)[number];

export function ReturnsManager({
  businessId,
  returns: initialReturns,
}: {
  businessId: string;
  returns: Return[];
}) {
  const { items: returns, hasMore, loading: loadingMore, loadMore } = usePaginatedList(initialReturns, RETURNS_PAGE_SIZE);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = {
    new: returns.filter((r) => r.status === "new").length,
    approved: returns.filter((r) => r.status === "approved").length,
    rejected: returns.filter((r) => r.status === "rejected").length,
    done: returns.filter((r) => r.status === "done").length,
    total: returns.length,
  };

  const visible = filter === "all" ? returns : returns.filter((r) => r.status === filter);

  function setStatus(id: string, status: "approved" | "rejected" | "done") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setReturnStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          status === "approved"
            ? "הבקשה אושרה ✓"
            : status === "done"
              ? "הבקשה טופלה ✓"
              : "הבקשה נדחתה",
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
          { label: "אושרו", value: counts.approved, color: "text-blue-600" },
          { label: "טופלו", value: counts.done, color: "text-green-600" },
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

      {/* Returns list */}
      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {returns.length === 0
              ? "עדיין אין בקשות — ברגע שלקוח יבקש החזרה או החלפה באתר, הבקשה תופיע כאן"
              : "אין בקשות בסטטוס הזה"}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((r) => (
            <Card key={r.id} className={r.status === "rejected" ? "opacity-60" : ""}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.item || "פריט לא צוין"}</span>
                    <StatusBadge tone={KIND_TONE[r.kind] ?? "neutral"} label={KIND_LABEL[r.kind] ?? r.kind} />
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"} label={STATUS_LABEL[r.status] ?? r.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                    <span>{r.customer_name}</span>
                    <a
                      href={`tel:${r.customer_phone}`}
                      dir="ltr"
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      <Phone className="size-3" />
                      {r.customer_phone}
                    </a>
                    <span className="text-xs">
                      {new Date(r.created_at).toLocaleString("he-IL", {
                        timeZone: "Asia/Jerusalem",
                        day: "numeric",
                        month: "numeric",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {r.reason && (
                    <p className="mt-1 text-xs text-muted-foreground">📝 {r.reason}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {busyId === r.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  {r.status === "new" && (
                    <Button
                      size="sm"
                      className="gap-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => setStatus(r.id, "approved")}
                      disabled={busyId === r.id}
                    >
                      <Check className="size-3.5" /> אשר
                    </Button>
                  )}
                  {(r.status === "new" || r.status === "approved") && (
                    <Button
                      size="sm"
                      className="gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => setStatus(r.id, "done")}
                      disabled={busyId === r.id}
                    >
                      <CheckCheck className="size-3.5" /> טופל
                    </Button>
                  )}
                  {(r.status === "new" || r.status === "approved") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground hover:text-destructive"
                      onClick={() => setStatus(r.id, "rejected")}
                      disabled={busyId === r.id}
                    >
                      <X className="size-3.5" /> דחה
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loadingMore}
            onClick={() => loadMore((page) => loadMoreReturnsAction(businessId, page))}
          >
            {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
            טען עוד
          </Button>
        </div>
      )}
    </div>
  );
}
