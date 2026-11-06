import { describe, it, expect } from "vitest";

import {
  sanitizeSvg,
  buildHeroSvg,
  buildMonogramLogo,
} from "@/lib/services/svg-design";

const SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>`;

describe("sanitizeSvg", () => {
  it("passes a plain vector through, trimming surrounding prose", () => {
    expect(sanitizeSvg(`Here is your logo:\n${SAFE_SVG}\nEnjoy!`)).toBe(SAFE_SVG);
  });

  it("rejects scripts, event handlers and external references", () => {
    expect(sanitizeSvg(`<svg><script>alert(1)</script></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg onload="x()"><rect/></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg><a href="http://evil"><rect/></a></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg><image xlink:href="http://evil/x.png"/></svg>`)).toBeNull();
    expect(sanitizeSvg(`<svg><foreignObject></foreignObject></svg>`)).toBeNull();
  });

  it("rejects non-SVG and oversized payloads", () => {
    expect(sanitizeSvg("not svg at all")).toBeNull();
    expect(sanitizeSvg(`<svg>${"x".repeat(61000)}</svg>`)).toBeNull();
  });
});

describe("generated assets", () => {
  it("hero SVG is deterministic per seed and varies between seeds", () => {
    const a1 = buildHeroSvg("#3366aa", "business-a");
    const a2 = buildHeroSvg("#3366aa", "business-a");
    const b = buildHeroSvg("#3366aa", "business-b");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toContain("<svg");
  });

  it("monogram logo embeds the initial and brand color", () => {
    const svg = buildMonogramLogo("ת", "#aabbcc");
    expect(svg).toContain(">ת</text>");
    expect(svg).toContain("#aabbcc");
    expect(sanitizeSvg(svg)).not.toBeNull();
  });
});
