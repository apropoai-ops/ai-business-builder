import { describe, it, expect } from "vitest";

import { barcodeSvg } from "@/lib/barcode";

describe("barcodeSvg", () => {
  it("produces an SVG with bars for a valid value", () => {
    const svg = barcodeSvg("ABC123");
    expect(svg).toBeTruthy();
    expect(svg!.startsWith("<svg")).toBe(true);
    expect(svg!).toContain("<rect");
  });

  it("returns null when nothing is encodable", () => {
    expect(barcodeSvg("")).toBeNull();
  });

  it("respects module width / height options", () => {
    const svg = barcodeSvg("7290011", { module: 2, height: 60 });
    expect(svg!).toContain('height="60"');
  });
});
