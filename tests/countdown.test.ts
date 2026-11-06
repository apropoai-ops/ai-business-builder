import { describe, expect, it } from "vitest";

import { countdownParts } from "@/lib/countdown";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("countdownParts", () => {
  it("splits a mixed duration correctly", () => {
    expect(countdownParts(3 * DAY + 7 * HOUR + 42 * MIN + 9 * SEC)).toEqual({
      days: 3,
      hours: 7,
      minutes: 42,
      seconds: 9,
    });
  });

  it("does not roll units over into each other", () => {
    expect(countdownParts(23 * HOUR + 59 * MIN + 59 * SEC)).toEqual({
      days: 0,
      hours: 23,
      minutes: 59,
      seconds: 59,
    });
    // One second later it must be exactly one day, not 24 hours.
    expect(countdownParts(DAY)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it("floors partial seconds instead of rounding up", () => {
    expect(countdownParts(1999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });

  it("clamps expired and invalid values to zero", () => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(countdownParts(0)).toEqual(zero);
    expect(countdownParts(-5000)).toEqual(zero);
    expect(countdownParts(Number.NaN)).toEqual(zero);
    expect(countdownParts(Number.POSITIVE_INFINITY)).toEqual(zero);
  });

  it("handles long campaigns (multi-week) without overflowing into hours", () => {
    const parts = countdownParts(45 * DAY + 5 * HOUR);
    expect(parts.days).toBe(45);
    expect(parts.hours).toBe(5);
  });
});
