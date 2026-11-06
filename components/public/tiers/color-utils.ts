/**
 * Small shared helpers for the design-tier component kit
 * (components/public/tiers/**). Not part of the locked cross-agent contract —
 * an internal utility the tier components use to stay safe and DRY.
 */

/**
 * Normalizes an arbitrary "brand"/"accent" color string to a value that's
 * safe to interpolate directly into raw CSS text or canvas fill styles.
 * Business brand colors are trusted data, but they still flow untyped from
 * the DB into template-literal CSS here, so we validate the shape before
 * trusting it rather than risking malformed/unexpected CSS output.
 */
export function safeHexColor(input: string | null | undefined, fallback = "#2563eb"): string {
  if (typeof input !== "string") return fallback;
  const v = input.trim();
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/.test(v) ? v : fallback;
}

/** Parses a hex color (#rgb / #rrggbb / #rrggbbaa) into 0-255 RGB channels. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n) || h.length < 6) return [37, 99, 235]; // #2563eb fallback
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
