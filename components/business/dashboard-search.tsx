"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Users,
  UserCheck,
  CalendarClock,
  PackageCheck,
  ShoppingBag,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

import { searchDashboardAction } from "@/lib/actions/dashboard-search";
import type { DashboardSearchGroup, DashboardSearchRow } from "@/lib/services/dashboard-search.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GROUP_ICON: Record<DashboardSearchGroup["kind"], LucideIcon> = {
  leads: Users,
  customers: UserCheck,
  bookings: CalendarClock,
  orders: PackageCheck,
  products: ShoppingBag,
  quotes: ReceiptText,
};

/**
 * Dashboard-wide command palette (Ctrl/Cmd+K) — searches leads, customers,
 * bookings, orders, products and quotes for the current business and jumps
 * straight to the relevant page. Mounted once in the business layout so the
 * shortcut works from any dashboard page.
 */
export function DashboardSearch({ businessId }: { businessId: string }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DashboardSearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every dispatched search; a response only gets applied if it's
  // still the latest one requested. The debounce timer only guards against a
  // second keystroke firing a second REQUEST — it does nothing once both
  // requests are already in flight, and a short query (2 chars) routinely
  // scans more tables than a longer, narrower one, so an earlier request
  // resolving after a later one is the common case, not an edge case.
  const requestIdRef = useRef(0);

  // Ctrl+K / Cmd+K opens the palette from anywhere on the dashboard.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset transient state whenever the dialog closes, so reopening starts
  // fresh — done in the open-change handler (not an effect) to avoid a
  // synchronous setState-in-effect.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setGroups([]);
      setActiveIndex(0);
    }
  }

  // Debounced server search whenever the query changes while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q.length < 2) {
        requestIdRef.current += 1; // orphan any request still in flight
        setGroups([]);
        return;
      }
      const requestId = (requestIdRef.current += 1);
      setLoading(true);
      searchDashboardAction(businessId, q)
        .then((res) => {
          // A newer request was dispatched while this one was in flight — its
          // results are for a query the input no longer shows, so drop them
          // rather than let them flash in over whatever the newer request set.
          if (requestIdRef.current !== requestId) return;
          setGroups(res.groups);
          setActiveIndex(0);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) setLoading(false);
        });
    }, q.length < 2 ? 0 : 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, businessId]);

  const flatRows = useMemo(
    () => groups.flatMap((g) => g.rows.map((row) => ({ row, kind: g.kind }))),
    [groups],
  );

  function pick(row: DashboardSearchRow) {
    setOpen(false);
    router.push(row.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flatRows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatRows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatRows.length) % flatRows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = flatRows[activeIndex];
      if (active) pick(active.row);
    }
  }

  const q = query.trim();
  // Global row index of the first row in each group, so we never mutate a
  // counter during render (react-compiler-safe). groups + flatRows share order.
  const groupStartIndex = new Map<string, number>();
  {
    let acc = 0;
    for (const g of groups) {
      groupStartIndex.set(g.kind, acc);
      acc += g.rows.length;
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Search className="size-3.5" />
        חיפוש
        <kbd className="ms-1 hidden rounded border bg-muted px-1 text-[10px] text-muted-foreground sm:inline">Ctrl+K</kbd>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>חיפוש בדשבורד</DialogTitle>
            <DialogDescription>חפשו לידים, לקוחות, תורים, הזמנות, מוצרים והצעות מחיר</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="הקלידו לחיפוש..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                className="pe-9"
              />
            </div>

            {q.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">הקלידו לפחות 2 תווים לחיפוש</div>
            ) : loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : flatRows.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">אין תוצאות</div>
            ) : (
              <div className="max-h-[50vh] space-y-4 overflow-y-auto">
                {groups.map((group) => {
                  const Icon = GROUP_ICON[group.kind];
                  return (
                    <div key={group.kind} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5" />
                        {group.title}
                      </div>
                      <div className="space-y-1">
                        {group.rows.map((row, i) => {
                          const globalIndex = (groupStartIndex.get(group.kind) ?? 0) + i;
                          const isActive = globalIndex === activeIndex;
                          return (
                            <button
                              key={row.id}
                              type="button"
                              onClick={() => pick(row)}
                              onMouseEnter={() => setActiveIndex(globalIndex)}
                              className={`flex w-full flex-col rounded-lg border p-2 text-start text-sm transition-colors ${
                                isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                              }`}
                            >
                              <span className="truncate font-medium">{row.label}</span>
                              {row.sublabel && (
                                <span className="truncate text-xs text-muted-foreground">{row.sublabel}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
