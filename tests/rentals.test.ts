import { describe, expect, it } from "vitest";

import {
  MAX_UNIT_IMAGES,
  isRangeAvailable,
  nightsBetween,
  normalizeUnitImages,
  rangesOverlap,
  rentalTotal,
} from "@/lib/rentals";

describe("rentals date math", () => {
  it("counts nights", () => {
    expect(nightsBetween("2026-07-01", "2026-07-04")).toBe(3);
    expect(nightsBetween("2026-07-01", "2026-07-01")).toBe(0);
    expect(nightsBetween("bad", "2026-07-04")).toBe(0);
  });

  it("detects overlap (half-open)", () => {
    expect(rangesOverlap("2026-07-01", "2026-07-05", "2026-07-04", "2026-07-08")).toBe(true);
    // back-to-back (checkout == next checkin) does NOT overlap
    expect(rangesOverlap("2026-07-01", "2026-07-04", "2026-07-04", "2026-07-06")).toBe(false);
    expect(rangesOverlap("2026-07-01", "2026-07-04", "2026-07-10", "2026-07-12")).toBe(false);
  });

  it("availability against booked ranges", () => {
    const booked = [{ check_in: "2026-07-10", check_out: "2026-07-14" }];
    expect(isRangeAvailable("2026-07-05", "2026-07-09", booked)).toBe(true);
    expect(isRangeAvailable("2026-07-14", "2026-07-16", booked)).toBe(true); // starts at checkout
    expect(isRangeAvailable("2026-07-12", "2026-07-15", booked)).toBe(false); // overlaps
    expect(isRangeAvailable("2026-07-09", "2026-07-09", booked)).toBe(false); // zero nights
  });

  it("computes total = nightly × nights", () => {
    expect(rentalTotal(450, 3)).toBe(1350);
    expect(rentalTotal(450, 0)).toBe(0);
    expect(rentalTotal(-5, 3)).toBe(0);
  });
});

describe("unit gallery normalisation", () => {
  it("keeps order — index 0 is the cover", () => {
    const urls = ["https://cdn/a.jpg", "https://cdn/b.jpg", "https://cdn/c.jpg"];
    expect(normalizeUnitImages(urls)).toEqual(urls);
  });

  it("drops empties, whitespace and non-http schemes", () => {
    expect(
      normalizeUnitImages([
        "  https://cdn/a.jpg  ",
        "",
        "   ",
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "ftp://cdn/b.jpg",
        "/relative/c.jpg",
        "http://cdn/d.jpg",
      ]),
    ).toEqual(["https://cdn/a.jpg", "http://cdn/d.jpg"]);
  });

  it("de-duplicates, keeping the first occurrence", () => {
    expect(
      normalizeUnitImages(["https://cdn/a.jpg", "https://cdn/b.jpg", "https://cdn/a.jpg"]),
    ).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"]);
  });

  it("caps at MAX_UNIT_IMAGES", () => {
    const many = Array.from({ length: MAX_UNIT_IMAGES + 5 }, (_, i) => `https://cdn/${i}.jpg`);
    const out = normalizeUnitImages(many);
    expect(out).toHaveLength(MAX_UNIT_IMAGES);
    expect(out[0]).toBe("https://cdn/0.jpg");
  });

  it("handles null/undefined as an empty gallery", () => {
    expect(normalizeUnitImages(null)).toEqual([]);
    expect(normalizeUnitImages(undefined)).toEqual([]);
    expect(normalizeUnitImages([])).toEqual([]);
  });
});
