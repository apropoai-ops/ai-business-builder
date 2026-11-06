import { describe, it, expect } from "vitest";

import { zonedToUtc, weekdayOf, DEFAULT_HOURS } from "@/lib/booking-shared";

describe("zonedToUtc — Israel timezone math", () => {
  it("converts winter time (IST, UTC+2)", () => {
    expect(zonedToUtc("2026-01-15", "10:00").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
  });

  it("converts summer time (IDT, UTC+3)", () => {
    expect(zonedToUtc("2026-07-15", "10:00").toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  it("handles the day DST starts (last Friday of March 2026)", () => {
    // 2026-03-27: clocks jump 02:00→03:00, so 10:00 local is already IDT.
    expect(zonedToUtc("2026-03-27", "10:00").toISOString()).toBe(
      "2026-03-27T07:00:00.000Z",
    );
    // The day before is still IST.
    expect(zonedToUtc("2026-03-26", "10:00").toISOString()).toBe(
      "2026-03-26T08:00:00.000Z",
    );
  });

  it("handles the day DST ends (last Sunday of October 2026)", () => {
    // 2026-10-25: clocks fall back, 10:00 local is IST again.
    expect(zonedToUtc("2026-10-25", "10:00").toISOString()).toBe(
      "2026-10-25T08:00:00.000Z",
    );
    expect(zonedToUtc("2026-10-24", "10:00").toISOString()).toBe(
      "2026-10-24T07:00:00.000Z",
    );
  });

  it("keeps midnight and late-evening on the right calendar day", () => {
    expect(zonedToUtc("2026-06-15", "00:00").toISOString()).toBe(
      "2026-06-14T21:00:00.000Z",
    );
    expect(zonedToUtc("2026-06-15", "23:30").toISOString()).toBe(
      "2026-06-15T20:30:00.000Z",
    );
  });
});

describe("weekdayOf", () => {
  it("maps dates to JS weekday strings", () => {
    expect(weekdayOf("2026-06-14")).toBe("0"); // Sunday
    expect(weekdayOf("2026-06-15")).toBe("1"); // Monday
    expect(weekdayOf("2026-06-20")).toBe("6"); // Saturday
  });
});

describe("DEFAULT_HOURS", () => {
  it("is open Sunday-Thursday and closed Friday-Saturday", () => {
    for (const d of ["0", "1", "2", "3", "4"]) {
      expect(DEFAULT_HOURS[d]).toEqual({ open: "09:00", close: "18:00" });
    }
    expect(DEFAULT_HOURS["5"]).toBeNull();
    expect(DEFAULT_HOURS["6"]).toBeNull();
  });
});
