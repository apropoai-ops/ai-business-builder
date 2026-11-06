"use client";

import { useState } from "react";
import {
  MessageSquareText, ArrowLeftRight, CheckSquare, Sparkles,
  CalendarDays, Package, Loader2, Send, Pencil, Trash2, Save, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { listCrmActivitiesAction, addCrmNoteAction, updateCrmNoteAction, deleteCrmNoteAction } from "@/lib/actions/crm";
import type { CrmActivity } from "@/types/database";
import type { CustomerInsights } from "@/lib/services/customer-insights.service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACTIVITY_ICON: Record<string, typeof MessageSquareText> = {
  note: MessageSquareText,
  status: ArrowLeftRight,
  task: CheckSquare,
  system: Sparkles,
};

const CRM_PAGE_SIZE = 50;

/** Hebrew relative time (falls back to a short absolute Asia/Jerusalem date past 30 days). */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const rtf = new Intl.RelativeTimeFormat("he-IL", { numeric: "auto" });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  return date.toLocaleDateString("he-IL", { dateStyle: "short", timeZone: "Asia/Jerusalem" });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { dateStyle: "short", timeZone: "Asia/Jerusalem" });
}

type TimelineItem = {
  id: string;
  icon: typeof MessageSquareText;
  text: string;
  timestamp: string;
  /** Present only for editable/deletable "note" activities — carries the raw activity for the edit form. */
  activity?: CrmActivity;
};

/**
 * Unified customer timeline — merges CRM activities (notes/status/task/system)
 * with booking + order history into one chronological feed, newest first.
 * Notes (only) can be edited/deleted inline. "טען עוד" loads further pages of
 * activities past the first CRM_PAGE_SIZE.
 *
 * Activities are loaded on first render (and whenever `customerId` changes)
 * via a render-phase guard, not a `useEffect` — this mirrors the
 * `loadedForId` fetch-on-open pattern already used in customer-card.tsx.
 */
export function CustomerTimeline({
  businessId,
  customerId,
  insights,
}: {
  businessId: string;
  customerId: string;
  insights: CustomerInsights | null;
}) {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loadedForId !== customerId) {
    setLoadedForId(customerId);
    setLoading(true);
    setActivities([]);
    setPage(1);
    setHasMore(false);
    listCrmActivitiesAction(businessId, { customerId })
      .then((res) => {
        if (res.error) toast.error(res.error);
        setActivities(res.activities ?? []);
        setHasMore((res.activities ?? []).length >= CRM_PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }

  function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    listCrmActivitiesAction(businessId, { customerId }, nextPage)
      .then((res) => {
        if (res.error) { toast.error(res.error); return; }
        setActivities((prev) => [...prev, ...(res.activities ?? [])]);
        setPage(nextPage);
        setHasMore((res.activities ?? []).length >= CRM_PAGE_SIZE);
      })
      .finally(() => setLoadingMore(false));
  }

  function submitNote() {
    const content = noteText.trim();
    if (!content || posting) return;
    setPosting(true);
    addCrmNoteAction(businessId, { customerId }, content)
      .then((res) => {
        if (res.error) { toast.error(res.error); return; }
        const optimistic: CrmActivity = {
          id: `local-${Date.now()}`,
          business_id: businessId,
          lead_id: null,
          customer_id: customerId,
          kind: "note",
          content,
          created_at: new Date().toISOString(),
        };
        setActivities((prev) => [optimistic, ...prev]);
        setNoteText("");
      })
      .finally(() => setPosting(false));
  }

  function startEdit(activity: CrmActivity) {
    setEditingId(activity.id);
    setEditText(activity.content);
  }

  function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;
    setSavingEdit(true);
    updateCrmNoteAction(businessId, id, content)
      .then((res) => {
        if (res.error) { toast.error(res.error); return; }
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, content } : a)));
        setEditingId(null);
      })
      .finally(() => setSavingEdit(false));
  }

  function removeNote(id: string) {
    setDeletingId(id);
    deleteCrmNoteAction(businessId, id)
      .then((res) => {
        if (res.error) { toast.error(res.error); return; }
        setActivities((prev) => prev.filter((a) => a.id !== id));
      })
      .finally(() => setDeletingId(null));
  }

  const items: TimelineItem[] = [
    ...activities.map((a) => ({
      id: `activity-${a.id}`,
      icon: ACTIVITY_ICON[a.kind] ?? Sparkles,
      text: a.content,
      timestamp: a.created_at,
      activity: a.kind === "note" ? a : undefined,
    })),
    ...(insights?.recentBookings ?? []).map((b) => ({
      id: `booking-${b.id}`,
      icon: CalendarDays,
      text: `תור: ${b.service ?? "—"} — ${formatShortDate(b.starts_at)}`,
      timestamp: b.starts_at,
    })),
    ...(insights?.recentOrders ?? []).map((o) => ({
      id: `order-${o.id}`,
      icon: Package,
      text: `הזמנה בסך ₪${o.total.toLocaleString()}`,
      timestamp: o.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-2.5">
        <Textarea
          placeholder="הוספת הערה על הלקוח..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={!noteText.trim() || posting}
          onClick={submitNote}
        >
          {posting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          הוספת הערה
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          עדיין אין פעילות — הוסיפו הערה ראשונה
        </div>
      ) : (
        <>
          <ol className="space-y-0">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const isLast = idx === items.length - 1;
              const isEditing = item.activity && editingId === item.activity.id;
              return (
                <li key={item.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
                      <Icon className="size-3 text-muted-foreground" />
                    </span>
                    {!isLast && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className={`min-w-0 flex-1 rounded-lg border bg-muted/30 p-2 text-sm ${isLast ? "mb-0" : "mb-3"}`}>
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="text-sm" />
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={() => saveEdit(item.activity!.id)} disabled={savingEdit || !editText.trim()}>
                            {savingEdit ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                            שמירה
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setEditingId(null)}>
                            <X className="size-3" />
                            ביטול
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 break-words">{item.text}</p>
                          {item.activity && (
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                onClick={() => startEdit(item.activity!)}
                                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                                title="עריכת הערה"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeNote(item.activity!.id)}
                                disabled={deletingId === item.activity.id}
                                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                                title="מחיקת הערה"
                              >
                                {deletingId === item.activity.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatRelative(item.timestamp)}</p>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                טען עוד
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
