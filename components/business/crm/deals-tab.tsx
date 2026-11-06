"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Loader2, GripVertical, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { createDealAction, updateDealStageAction, deleteDealAction, loadMoreDealsAction } from "@/lib/actions/crm";
import type { CrmDeal, DealStage } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/business/crm-dashboard";
import { usePaginatedList } from "@/components/business/crm/use-paginated-list";

const CRM_PAGE_SIZE = 50;

const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "ליד" },
  { value: "proposal", label: "הצעה" },
  { value: "negotiation", label: "משא ומתן" },
  { value: "won", label: "נסגר ✓" },
  { value: "lost", label: "אבד" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Deals Tab — Kanban Pipeline
// ─────────────────────────────────────────────────────────────────────────────
export function DealsTab({ businessId, deals, onRefresh }: { businessId: string; deals: CrmDeal[]; onRefresh: () => void }) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contact, setContact] = useState("");
  const [isPending, start] = useTransition();
  const [, startMove] = useTransition();

  const { items: allDeals, hasMore, loading: loadingMore, loadMore } = usePaginatedList(deals, CRM_PAGE_SIZE);

  // Optimistic stage overrides applied while a drag-move persists on the server.
  const [stageOverrides, setStageOverrides] = useState<Record<string, DealStage>>({});
  const boardDeals = useMemo(
    () => allDeals.map((d) => (stageOverrides[d.id] ? { ...d, stage: stageOverrides[d.id] } : d)),
    [allDeals, stageOverrides],
  );

  // Require a small pointer movement before a drag starts, so clicks on the
  // card's buttons keep working normally. KeyboardSensor gives keyboard users
  // the same full stage-to-stage move the mouse drag has — without it the
  // handle's screen-reader instructions describe a capability it lacks (see
  // the same fix in leads-board.tsx).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (overId == null) return;
    // Column drop targets are identified by stage id — direction-agnostic (RTL safe).
    const stage = String(overId) as DealStage;
    if (!DEAL_STAGES.some((s) => s.value === stage)) return;

    const dealId = String(event.active.id);
    const deal = boardDeals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;

    const previousStage = deal.stage as DealStage;
    setStageOverrides((prev) => ({ ...prev, [dealId]: stage }));
    startMove(async () => {
      const res = await updateDealStageAction(businessId, dealId, stage);
      if (res.error) {
        toast.error(res.error);
        setStageOverrides((prev) => ({ ...prev, [dealId]: previousStage }));
      } else {
        onRefresh();
      }
    });
  }

  function add() {
    if (!title.trim()) return;
    start(async () => {
      const res = await createDealAction(businessId, {
        title,
        value: value ? Number(value) : undefined,
        contact_name: contact || undefined,
      });
      if (res.error) toast.error(res.error);
      else { setTitle(""); setValue(""); setContact(""); onRefresh(); }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input placeholder="שם העסקה *" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Input placeholder="שווי (₪)" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="איש קשר" value={contact} onChange={(e) => setContact(e.target.value)} />
            <Button onClick={add} disabled={isPending || !title.trim()} size="icon">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>

        {allDeals.length === 0 ? (
          <EmptyState text="עדיין אין עסקאות" />
        ) : (
          <>
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid gap-3 sm:grid-cols-5">
                {DEAL_STAGES.map((stage) => (
                  <StageColumn
                    key={stage.value}
                    stage={stage}
                    deals={boardDeals.filter((d) => d.stage === stage.value)}
                    businessId={businessId}
                    onRefresh={onRefresh}
                  />
                ))}
              </div>
            </DndContext>
            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={loadingMore}
                  onClick={() => loadMore((page) => loadMoreDealsAction(businessId, page))}
                >
                  {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                  טען עוד
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StageColumn({ stage, deals, businessId, onRefresh }: {
  stage: { value: DealStage; label: string };
  deals: CrmDeal[];
  businessId: string;
  onRefresh: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 space-y-2 rounded-lg p-1.5 transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="text-xs font-medium text-muted-foreground">{stage.label}</div>
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} businessId={businessId} onRefresh={onRefresh} />
      ))}
      {deals.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-center text-[10px] text-muted-foreground">
          גרור עסקה לכאן
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, businessId, onRefresh }: { deal: CrmDeal; businessId: string; onRefresh: () => void }) {
  const [isPending, start] = useTransition();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  function advance() {
    const stages: DealStage[] = ["lead", "proposal", "negotiation", "won"];
    const idx = stages.indexOf(deal.stage as DealStage);
    if (idx < stages.length - 1) {
      start(async () => { await updateDealStageAction(businessId, deal.id, stages[idx + 1]); onRefresh(); });
    }
  }

  function remove() {
    start(async () => { await deleteDealAction(businessId, deal.id); onRefresh(); });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-lg border bg-card p-3 shadow-sm space-y-1 ${
        isDragging ? "relative z-50 opacity-80 ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="-ms-1 mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          aria-label={`גרירת העסקה ${deal.title} לשלב אחר`}
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1 font-medium text-sm leading-tight">{deal.title}</div>
      </div>
      {deal.contact_name && <div className="text-xs text-muted-foreground">{deal.contact_name}</div>}
      {deal.value && <div className="text-xs font-medium text-primary">₪{deal.value.toLocaleString()}</div>}
      <div className="flex justify-between pt-1">
        {deal.stage !== "won" && deal.stage !== "lost" ? (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={advance} disabled={isPending}>
            הקדם ←
          </Button>
        ) : <span />}
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={remove} disabled={isPending}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
