import { describe, it, expect } from "vitest";
import sharp from "sharp";

import { whiteToAlpha } from "@/lib/services/image-gen";

/**
 * The logo keyer used to threshold EVERY near-white pixel in the frame, which
 * punched holes through the artwork itself — white lettering inside a dark
 * medallion vanished, and ivory tones came out ~44% transparent. It now
 * flood-fills only from the edges, then trims the transparent margin.
 */

/** 200×200 white canvas · dark 100×100 square in the middle · white 20×20 hole inside it. */
async function fixture(): Promise<Buffer> {
  const dark = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 20, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
  const hole = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: dark, left: 50, top: 50 },
      { input: hole, left: 90, top: 90 },
    ])
    .png()
    .toBuffer();
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3], info };
}

describe("whiteToAlpha", () => {
  it("keys out the edge-connected background", async () => {
    const out = await whiteToAlpha(await fixture());
    // After trim+pad the canvas is the 100×100 mark plus 24px of padding.
    const { info } = await pixel(out, 0, 0);
    expect(info.width).toBe(148);
    expect(info.height).toBe(148);
    expect((await pixel(out, 1, 1)).a).toBe(0);
  });

  it("keeps white that is enclosed by the design", async () => {
    const out = await whiteToAlpha(await fixture());
    // Centre of the mark = the white hole; it must stay fully opaque.
    const centre = await pixel(out, 74, 74);
    expect(centre.a).toBe(255);
    expect(centre.r).toBe(255);
  });

  it("keeps the artwork itself opaque", async () => {
    const out = await whiteToAlpha(await fixture());
    expect((await pixel(out, 30, 30)).a).toBe(255);
  });
});
