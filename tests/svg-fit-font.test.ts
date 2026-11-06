import { describe, expect, it } from "vitest";
import { fitFontSize } from "@/lib/services/svg-design";

describe("fitFontSize", () => {
  it("keeps the ideal size when the name has room", () => {
    expect(fitFontSize("GRAVÉ", 470, 64)).toBe(64);
  });

  // Regression: "GOLDEN MEMORY" at 60px + 4 tracking rendered ~610 units wide
  // in a 512 viewBox, cropping the header logo to "OLDEN MEMOR".
  it("accounts for Latin capitals and letter-spacing", () => {
    const text = "GOLDEN MEMORY";
    const size = fitFontSize(text, 470, 64, 24, 4);
    const em = [...text].reduce((s, ch) => s + (/[A-Z]/.test(ch) ? 0.72 : 0.6), 0);
    const width = em * size + (text.length - 1) * 4;
    expect(width).toBeLessThanOrEqual(470);
    expect(size).toBeLessThan(50);
  });

  it("never goes below the minimum", () => {
    expect(fitFontSize("א".repeat(200), 470, 64, 24)).toBe(24);
  });
});
