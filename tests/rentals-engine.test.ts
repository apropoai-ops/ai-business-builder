import { describe, expect, it } from "vitest";

import {
  addDays,
  buildOccupancy,
  cellAt,
  cellStateOf,
  dateRange,
  findAvailableUnits,
  layoutBars,
  monthBounds,
  nightsOf,
  startOfWeek,
  weekdayOf,
  type OccupyingRow,
} from "@/lib/rentals";

/**
 * The availability engine decides what every cell on the board says and which
 * units a guest is offered. A bug here either sells the same night twice or
 * hides a night the owner could have sold, so the rules are pinned rather than
 * trusted: check-out is exclusive, only `cancelled` frees dates, and a date is
 * a string from end to end.
 */

const unit = (id: string, over: Partial<{ max_guests: number; active: boolean; nightly_price: number }> = {}) => ({
  id,
  max_guests: 4,
  active: true,
  nightly_price: 500,
  ...over,
});

const row = (
  unit_id: string,
  check_in: string,
  check_out: string,
  status = "confirmed",
  kind = "booking",
): OccupyingRow => ({ unit_id, check_in, check_out, status, kind });

describe("date arithmetic never touches local time", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("crosses a leap day correctly", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("returns an inclusive range", () => {
    expect(dateRange("2026-08-09", "2026-08-12")).toEqual([
      "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
    ]);
    expect(dateRange("2026-08-12", "2026-08-09")).toEqual([]);
  });

  it("finds month bounds including February in a leap year", () => {
    expect(monthBounds(2026, 8)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(monthBounds(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("computes weekday and the Sunday-based week start", () => {
    expect(weekdayOf("2026-08-09")).toBe(0); // Sunday
    expect(startOfWeek("2026-08-12")).toBe("2026-08-09");
    expect(startOfWeek("2026-08-09")).toBe("2026-08-09");
  });

  it("keeps the date the user typed — the classic off-by-one", () => {
    // If any helper ever routed through a local Date, this is what would slip
    // to the 9th for every user west of Greenwich.
    expect(dateRange("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
    expect(addDays("2026-08-10", 0)).toBe("2026-08-10");
  });
});

describe("nightsOf — check-out is exclusive (§19)", () => {
  it("10→13 is three nights and the 13th is free", () => {
    expect(nightsOf("2026-08-10", "2026-08-13")).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12",
    ]);
  });

  it("is empty for a zero- or negative-length stay", () => {
    expect(nightsOf("2026-08-10", "2026-08-10")).toEqual([]);
    expect(nightsOf("2026-08-13", "2026-08-10")).toEqual([]);
  });
});

describe("cellStateOf — which statuses hold the room", () => {
  it("frees the dates only for cancelled", () => {
    expect(cellStateOf({ status: "cancelled", kind: "booking" })).toBeNull();
    expect(cellStateOf({ status: "cancelled", kind: "block" })).toBeNull();
  });

  it("treats no_show and completed as occupied, not free", () => {
    // The room was assigned and could not be resold — mirrors the database's
    // exclusion constraint, which also only exempts 'cancelled'.
    expect(cellStateOf({ status: "no_show", kind: "booking" })).toBe("booked");
    expect(cellStateOf({ status: "completed", kind: "booking" })).toBe("booked");
    expect(cellStateOf({ status: "confirmed", kind: "booking" })).toBe("booked");
  });

  it("separates a pending request from a confirmed stay", () => {
    expect(cellStateOf({ status: "pending", kind: "booking" })).toBe("pending");
  });

  it("reads a block as blocked whichever way it is flagged", () => {
    expect(cellStateOf({ status: "blocked", kind: "block" })).toBe("blocked");
    expect(cellStateOf({ status: "blocked", kind: null })).toBe("blocked");
  });
});

describe("buildOccupancy", () => {
  const rows = [
    row("u1", "2026-08-10", "2026-08-13"),
    row("u1", "2026-08-20", "2026-08-22", "pending"),
    row("u2", "2026-08-11", "2026-08-14", "blocked", "block"),
    row("u2", "2026-08-01", "2026-08-05", "cancelled"),
  ];
  const occ = buildOccupancy(rows, "2026-08-01", "2026-08-31");

  it("marks exactly the nights of a stay", () => {
    expect(cellAt(occ, "u1", "2026-08-09")).toBe("free");
    expect(cellAt(occ, "u1", "2026-08-10")).toBe("booked");
    expect(cellAt(occ, "u1", "2026-08-12")).toBe("booked");
    expect(cellAt(occ, "u1", "2026-08-13")).toBe("free"); // checkout day
  });

  it("distinguishes pending and blocked", () => {
    expect(cellAt(occ, "u1", "2026-08-20")).toBe("pending");
    expect(cellAt(occ, "u2", "2026-08-11")).toBe("blocked");
  });

  it("ignores cancelled rows entirely", () => {
    expect(cellAt(occ, "u2", "2026-08-02")).toBe("free");
  });

  it("never under-reports when two rows claim one night", () => {
    // Only reachable when one of them is cancelled, but the board must still
    // show the committed one rather than whichever was iterated last.
    const clash = buildOccupancy(
      [row("u9", "2026-08-10", "2026-08-12", "pending"), row("u9", "2026-08-10", "2026-08-12")],
      "2026-08-01",
      "2026-08-31",
    );
    expect(cellAt(clash, "u9", "2026-08-10")).toBe("booked");
  });

  it("clips to the requested window", () => {
    const july = buildOccupancy(rows, "2026-07-01", "2026-07-31");
    expect(cellAt(july, "u1", "2026-08-10")).toBe("free");
  });
});

describe("findAvailableUnits (§7)", () => {
  const units = [unit("u1"), unit("u2"), unit("u3", { max_guests: 2 }), unit("u4", { active: false })];
  const occupying = [
    row("u1", "2026-08-22", "2026-08-24"), // blocks the 22nd
    row("u2", "2026-08-01", "2026-08-03"),
  ];

  it("excludes a unit occupied on ANY night of the range", () => {
    // 20→23 needs nights 20, 21, 22 — u1 is taken on the 22nd.
    const found = findAvailableUnits(units, occupying, "2026-08-20", "2026-08-23", 2);
    expect(found.map((f) => f.unit.id)).toEqual(["u2", "u3"]);
  });

  it("excludes units too small for the party and inactive ones", () => {
    const found = findAvailableUnits(units, occupying, "2026-08-20", "2026-08-23", 4);
    expect(found.map((f) => f.unit.id)).toEqual(["u2"]);
    expect(found.every((f) => f.unit.id !== "u4")).toBe(true);
  });

  it("allows a stay that starts on another's check-out day", () => {
    const found = findAvailableUnits([unit("u1")], occupying, "2026-08-24", "2026-08-26", 2);
    expect(found.map((f) => f.unit.id)).toEqual(["u1"]);
  });

  it("prices the stay from the nightly rate", () => {
    const [match] = findAvailableUnits([unit("u1", { nightly_price: 450 })], [], "2026-08-01", "2026-08-04");
    expect(match.nights).toBe(3);
    expect(match.total).toBe(1350);
  });

  it("returns nothing for an invalid or zero-night range", () => {
    expect(findAvailableUnits(units, [], "2026-08-10", "2026-08-10")).toEqual([]);
    expect(findAvailableUnits(units, [], "nope", "2026-08-10")).toEqual([]);
  });

  it("a maintenance block hides the unit from search", () => {
    const blocked = [row("u1", "2026-08-20", "2026-08-25", "blocked", "block")];
    const found = findAvailableUnits([unit("u1")], blocked, "2026-08-21", "2026-08-23");
    expect(found).toEqual([]);
  });
});

describe("layoutBars — the continuous stay bar (§4)", () => {
  const days = dateRange("2026-08-09", "2026-08-15");

  it("spans exactly the booked nights", () => {
    const [bar] = layoutBars([{ check_in: "2026-08-12", check_out: "2026-08-15", status: "confirmed" }], days);
    expect(days[bar.startIndex]).toBe("2026-08-12");
    expect(bar.span).toBe(3); // nights 12, 13, 14
    expect(bar.clippedStart).toBe(false);
    expect(bar.clippedEnd).toBe(false);
  });

  it("clips a stay that starts before the view and flags it", () => {
    const [bar] = layoutBars([{ check_in: "2026-08-05", check_out: "2026-08-11", status: "confirmed" }], days);
    expect(bar.startIndex).toBe(0);
    expect(bar.span).toBe(2); // 9th and 10th are visible
    expect(bar.clippedStart).toBe(true);
    expect(bar.clippedEnd).toBe(false);
  });

  it("clips a stay that runs past the view", () => {
    const [bar] = layoutBars([{ check_in: "2026-08-14", check_out: "2026-08-20", status: "confirmed" }], days);
    expect(bar.span).toBe(2); // 14th and 15th
    expect(bar.clippedEnd).toBe(true);
  });

  it("drops stays entirely outside the view", () => {
    expect(layoutBars([{ check_in: "2026-09-01", check_out: "2026-09-04", status: "confirmed" }], days)).toEqual([]);
    expect(layoutBars([{ check_in: "2026-07-01", check_out: "2026-07-04", status: "confirmed" }], days)).toEqual([]);
  });

  it("survives an empty window", () => {
    expect(layoutBars([{ check_in: "2026-08-12", check_out: "2026-08-15", status: "confirmed" }], [])).toEqual([]);
  });
});
