"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarDays,
  Eye,
  EyeOff,
  FileDown,
  Gift,
  GraduationCap,
  GripVertical,
  Handshake,
  HeartHandshake,
  HelpCircle,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  ListOrdered,
  Loader2,
  MapPin,
  Newspaper,
  Package,
  PackageSearch,
  Quote,
  RotateCcw,
  Send,
  Sparkles,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  MODULES,
  isCoreToggle,
  resolveModules,
  type ModuleConfig,
  type ModuleKey,
} from "@/lib/modules";
import { saveModuleConfigAction, suggestModulesAction } from "@/lib/actions/modules";
import { modulesForMode } from "@/lib/site-mode";

const ICONS: Record<string, LucideIcon> = {
  Quote, Image: ImageIcon, UtensilsCrossed, Package, Users, CalendarDays,
  Newspaper, HelpCircle, Briefcase, Gift, ListOrdered, BarChart3, Images,
  GraduationCap, BadgeCheck, FileDown, HeartHandshake, MapPin, Award, Handshake,
  Send, RotateCcw, PackageSearch,
};

const DEF = new Map(MODULES.map((m) => [m.key, m]));

type Row = { key: ModuleKey; enabled: boolean };

/**
 * Builds the config to persist. `hidden` are the modules this build mode
 * doesn't offer (e.g. returns/order tracking on a brochure site): they aren't
 * shown or reorderable, but their stored state is carried through every save
 * so switching back to 'store' restores the owner's setup exactly.
 */
function toConfig(rows: Row[], hidden: Row[]): ModuleConfig {
  const cfg: ModuleConfig = {};
  rows.forEach((r, i) => (cfg[r.key] = { enabled: r.enabled, sort: i }));
  hidden.forEach((r, i) => (cfg[r.key] = { enabled: r.enabled, sort: rows.length + i }));
  return cfg;
}

export function ModulesPicker({
  businessId,
  config,
  counts,
  siteMode,
}: {
  businessId: string;
  config: unknown;
  counts: Record<string, number>;
  siteMode?: string | null;
}) {
  const allowed = useMemo(() => new Set(modulesForMode(siteMode)), [siteMode]);
  const [rows, setRows] = useState<Row[]>(() =>
    resolveModules(config)
      .filter((m) => allowed.has(m.key))
      .map((m) => ({ key: m.key, enabled: m.enabled })),
  );
  const [hidden] = useState<Row[]>(() =>
    resolveModules(config)
      .filter((m) => !allowed.has(m.key))
      .map((m) => ({ key: m.key, enabled: m.enabled })),
  );
  const [saving, startSave] = useTransition();
  const [aiPending, startAi] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function save(next: Row[]) {
    const prev = rows;
    setRows(next);
    startSave(async () => {
      const res = await saveModuleConfigAction(businessId, toConfig(next, hidden));
      if (res.error) {
        toast.error(res.error);
        // Revert the optimistic update — otherwise the UI shows a state that
        // was never persisted. Only revert if no newer change came in since
        // (saves can queue when the user toggles quickly).
        setRows((cur) => (cur === next ? prev : cur));
      }
    });
  }

  function toggle(key: ModuleKey) {
    save(rows.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));
  }

  function onDragEnd(e: DragEndEvent) {
    // Ignore a reorder that lands while a previous save is still in flight —
    // two overlapping full-snapshot writes could otherwise commit out of order.
    if (saving || aiPending) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.key === active.id);
    const to = rows.findIndex((r) => r.key === over.id);
    if (from < 0 || to < 0) return;
    save(arrayMove(rows, from, to));
  }

  function aiPick() {
    startAi(async () => {
      const res = await suggestModulesAction(businessId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const on = new Set(res.enabled ?? []);
      setRows((prev) => prev.map((r) => ({ ...r, enabled: on.has(r.key) })));
      toast.success(res.reason ?? "המודולים הותאמו אוטומטית");
    });
  }

  const activeCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">בורר המודולים</h2>
            <p className="text-sm text-muted-foreground">
              גררו לסידור, הדליקו/כבו — {activeCount} מתוך {rows.length} מופעלים. מודול תוכן
              מופיע באתר רק אם הוא מופעל וגם מולא בתוכן; מודולי טופס (צור קשר, החזרות,
              מעקב הזמנות) מוצגים תמיד כשהם מופעלים.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={aiPick}
          disabled={aiPending || saving}
        >
          {aiPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          התאמה אוטומטית ב-AI
        </Button>
      </div>

      <div className="mt-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <ModuleRow
                  key={r.key}
                  row={r}
                  count={counts[r.key] ?? 0}
                  onToggle={() => toggle(r.key)}
                  disabled={aiPending || saving}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function ModuleRow({
  row,
  count,
  onToggle,
  disabled,
}: {
  row: Row;
  count: number;
  onToggle: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.key });
  const def = DEF.get(row.key)!;
  const Icon = ICONS[def.icon] ?? LayoutGrid;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        row.enabled ? "bg-background" : "bg-muted/40"
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="גרירה לסידור"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <Icon className={`size-5 ${row.enabled ? "text-primary" : "text-muted-foreground"}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${row.enabled ? "" : "text-muted-foreground"}`}>
            {def.label}
          </span>
          {isCoreToggle(row.key) ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              טופס מובנה
            </span>
          ) : count > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {count} פריטים
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              ריק
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{def.description}</p>
      </div>

      <Button
        type="button"
        variant={row.enabled ? "default" : "outline"}
        size="sm"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={row.enabled}
      >
        {row.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {row.enabled ? "מופעל" : "כבוי"}
      </Button>
    </li>
  );
}
