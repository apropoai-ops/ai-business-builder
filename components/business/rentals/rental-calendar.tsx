"use client";

import { useMemo } from "react";
import { ChevronRight, ChevronLeft, CalendarDays, Ban } from "lucide-react";

import {
  RENTAL_STATUS_META,
  addDays,
  buildOccupancy,
  cellAt,
  dateRange,
  layoutBars,
  monthBounds,
  startOfWeek,
  todayIL,
  weekdayOf,
  type CellState,
} from "@/lib/rentals";
import type { PmsBooking, PmsUnit } from "@/lib/services/rentals-pms.service";

export type CalendarView = "month" | "week" | "day";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const HE_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** Column width per view — a month has to fit 31 of them, a day only one. */
const COL_MIN: Record<CalendarView, number> = { month: 44, week: 96, day: 240 };

/**
 * The availability board.
 *
 * One row per unit, one column per NIGHT, and every stay drawn as a single
 * continuous bar across the nights it occupies — the shape every hotel/צימר
 * manager already reads, rather than a grid of disconnected coloured cells.
 *
 * Two things it deliberately does NOT do:
 *   · it never constructs a local `Date` — every column is a "YYYY-MM-DD"
 *     string produced by lib/rentals, so a stay can't render a day early for
 *     anyone west of Greenwich;
 *   · it never decides availability. The cell colours and the bars are both
 *     derived from the same rows the server sent, and booking still asks the
 *     database. This is a VIEW of the truth, not a second copy of it.
 *
 * The board inherits the page's RTL direction, so the earliest night sits on
 * the right — the way a Hebrew calendar reads. Grid placement is logical
 * (`grid-column`), so the bars follow without any mirroring math.
 */
export function RentalCalendar({
  units,
  bookings,
  matchedIds,
  anchor,
  view,
  onAnchorChange,
  onViewChange,
  onSelectBooking,
  onSelectCell,
}: {
  units: PmsUnit[];
  /** Always the full unit-scoped list — occupancy must never be computed from a search-filtered subset. */
  bookings: PmsBooking[];
  /** Active search results, for dimming non-matching bars — null means no search is active. */
  matchedIds?: Set<string> | null;
  /** Any date inside the visible period. */
  anchor: string;
  view: CalendarView;
  onAnchorChange: (date: string) => void;
  onViewChange: (view: CalendarView) => void;
  onSelectBooking: (booking: PmsBooking) => void;
  /** Clicking an empty night — the fastest path into a new booking (§21). */
  onSelectCell: (unit: PmsUnit, date: string) => void;
}) {
  const today = todayIL();

  const { from, to, title } = useMemo(() => {
    const [y, m] = anchor.split("-").map(Number);
    if (view === "month") {
      const b = monthBounds(y, m);
      return { ...b, title: `${HE_MONTHS[m - 1]} ${y}` };
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      const end = addDays(start, 6);
      return { from: start, to: end, title: `שבוע ${start.slice(8)}–${end.slice(8)} ב${HE_MONTHS[m - 1]}` };
    }
    return { from: anchor, to: anchor, title: `${anchor.slice(8)} ב${HE_MONTHS[m - 1]} ${y}` };
  }, [anchor, view]);

  const days = useMemo(() => dateRange(from, to), [from, to]);

  const occupancy = useMemo(
    () =>
      buildOccupancy(
        bookings.map((b) => ({
          unit_id: b.unit_id, check_in: b.check_in, check_out: b.check_out,
          status: b.status, kind: b.kind,
        })),
        from,
        to,
      ),
    [bookings, from, to],
  );

  const barsByUnit = useMemo(() => {
    const live = bookings.filter((b) => b.status !== "cancelled");
    const map = new Map<string, ReturnType<typeof layoutBars<PmsBooking>>>();
    for (const unit of units) {
      map.set(unit.id, layoutBars(live.filter((b) => b.unit_id === unit.id), days));
    }
    return map;
  }, [bookings, units, days]);

  /** Units grouped by type, so a 40-unit property reads as sections (§2). */
  const groups = useMemo(() => {
    const byType = new Map<string, { label: string; units: PmsUnit[] }>();
    for (const u of units) {
      const key = u.type_name ?? "";
      const g = byType.get(key) ?? { label: u.type_name ?? "", units: [] };
      g.units.push(u);
      byType.set(key, g);
    }
    return [...byType.values()];
  }, [units]);

  function step(direction: 1 | -1) {
    if (view === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const nm = m + direction;
      const year = nm === 0 ? y - 1 : nm === 13 ? y + 1 : y;
      const month = nm === 0 ? 12 : nm === 13 ? 1 : nm;
      onAnchorChange(`${year}-${String(month).padStart(2, "0")}-01`);
      return;
    }
    onAnchorChange(addDays(anchor, direction * (view === "week" ? 7 : 1)));
  }

  const gridCols = `minmax(132px, 168px) repeat(${days.length}, minmax(${COL_MIN[view]}px, 1fr))`;

  return (
    <div className="rounded-xl border bg-card">
      {/* Toolbar (§14) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-1">
          {/* In RTL the "previous" affordance points right. */}
          <button
            type="button" onClick={() => step(-1)} aria-label="הקודם"
            className="flex size-8 items-center justify-center rounded-lg border transition hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button" onClick={() => step(1)} aria-label="הבא"
            className="flex size-8 items-center justify-center rounded-lg border transition hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button" onClick={() => onAnchorChange(today)}
            className="ms-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            היום
          </button>
          <span className="ms-2 text-sm font-semibold">{title}</span>
        </div>

        <div className="inline-flex overflow-hidden rounded-lg border">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {v === "month" ? "חודש" : v === "week" ? "שבוע" : "יום"}
            </button>
          ))}
        </div>
      </div>

      {units.length === 0 ? (
        <EmptyBoard />
      ) : (
        // Horizontal scroll rather than a squeezed grid (§16): 31 legible
        // columns beat 31 unreadable ones on a phone.
        <div className="overflow-x-auto">
          <div style={{ minWidth: "fit-content" }}>
            {/* Day header */}
            <div
              className="sticky top-0 z-20 grid border-b bg-card"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="sticky inset-inline-start-0 z-30 border-e bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                יחידה
              </div>
              {days.map((d) => {
                const wd = weekdayOf(d);
                const weekend = wd === 5 || wd === 6; // Fri/Sat
                return (
                  <div
                    key={d}
                    className={`border-e px-1 py-2 text-center ${weekend ? "bg-muted/40" : ""} ${
                      d === today ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="text-[10px] text-muted-foreground">{HE_DAYS[wd]}</div>
                    <div className={`text-xs font-medium ${d === today ? "text-primary" : ""}`}>
                      {Number(d.slice(8))}
                    </div>
                  </div>
                );
              })}
            </div>

            {groups.map((group, gi) => (
              <div key={group.label || `g${gi}`}>
                {group.label && (
                  <div className="sticky inset-inline-start-0 border-b bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {group.label}
                  </div>
                )}
                {group.units.map((unit) => (
                  <UnitRow
                    key={unit.id}
                    unit={unit}
                    days={days}
                    today={today}
                    gridCols={gridCols}
                    bars={barsByUnit.get(unit.id) ?? []}
                    matchedIds={matchedIds}
                    stateAt={(d) => cellAt(occupancy, unit.id, d)}
                    onSelectBooking={onSelectBooking}
                    onSelectCell={onSelectCell}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <Legend />
    </div>
  );
}

function UnitRow({
  unit, days, today, gridCols, bars, matchedIds, stateAt, onSelectBooking, onSelectCell,
}: {
  unit: PmsUnit;
  days: string[];
  today: string;
  gridCols: string;
  bars: ReturnType<typeof layoutBars<PmsBooking>>;
  matchedIds?: Set<string> | null;
  stateAt: (date: string) => CellState;
  onSelectBooking: (b: PmsBooking) => void;
  onSelectCell: (u: PmsUnit, d: string) => void;
}) {
  return (
    <div className="relative grid border-b last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
      <div className="sticky inset-inline-start-0 z-10 flex min-h-12 flex-col justify-center border-e bg-card px-3 py-1.5">
        <span className="truncate text-xs font-medium" title={unit.name}>
          {unit.name}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {[unit.code, `עד ${unit.max_guests} אורחים`].filter(Boolean).join(" · ")}
        </span>
      </div>

      {/* The empty grid: one clickable cell per night. */}
      {days.map((d) => {
        const state = stateAt(d);
        const free = state === "free";
        return (
          <button
            key={d}
            type="button"
            disabled={!free}
            onClick={() => free && onSelectCell(unit, d)}
            aria-label={`${unit.name} · ${d} · ${RENTAL_STATUS_META[state].label}`}
            className={`min-h-12 border-e transition ${
              d === today ? "bg-primary/5" : ""
            } ${free ? "cursor-pointer hover:bg-primary/10" : "cursor-default"}`}
            style={free ? undefined : { background: RENTAL_STATUS_META[state].fill }}
          />
        );
      })}

      {/* The stay bars, laid over the grid on the same column track so they
          span continuously instead of breaking at every cell border. */}
      {bars.map(({ booking, startIndex, span, clippedStart, clippedEnd }) => {
        const isBlock = booking.kind === "block";
        const state: CellState = isBlock ? "blocked" : booking.status === "pending" ? "pending" : "booked";
        const meta = RENTAL_STATUS_META[state];
        const dimmed = !!matchedIds && !matchedIds.has(booking.id);
        return (
          <button
            key={booking.id}
            type="button"
            onClick={() => onSelectBooking(booking)}
            title={`${booking.guest_name ?? meta.label} · ${booking.check_in} → ${booking.check_out}`}
            className={`pointer-events-auto z-[5] m-1 flex items-center gap-1 overflow-hidden px-2 text-start text-[11px] font-medium transition hover:brightness-95 ${
              dimmed ? "opacity-30" : ""
            }`}
            style={{
              // +2 because the unit column is track 1 and grid lines are 1-based.
              gridColumn: `${startIndex + 2} / span ${span}`,
              gridRow: 1,
              background: meta.dot,
              color: "#fff",
              borderStartStartRadius: clippedStart ? 0 : 8,
              borderEndStartRadius: clippedStart ? 0 : 8,
              borderStartEndRadius: clippedEnd ? 0 : 8,
              borderEndEndRadius: clippedEnd ? 0 : 8,
            }}
          >
            {isBlock && <Ban className="size-3 shrink-0" />}
            <span className="truncate">
              {isBlock ? (booking.block_reason || "חסום") : (booking.guest_name || "אורח")}
            </span>
            {span > 3 && !isBlock && (
              <span className="shrink-0 opacity-80">· {booking.nights} לילות</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  const items: CellState[] = ["free", "pending", "booked", "blocked"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2">
      {items.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ background: RENTAL_STATUS_META[k].dot }} />
          {RENTAL_STATUS_META[k].label}
        </span>
      ))}
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <CalendarDays className="size-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">אין עדיין יחידות להשכרה</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        הוסיפו צימר, חדר או דירה בלשונית &quot;יחידות&quot; — הלוח יתמלא אוטומטית
        ברגע שתהיה יחידה אחת.
      </p>
    </div>
  );
}
