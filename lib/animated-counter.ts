/**
 * Which "by the numbers" values are allowed to count up, and to what.
 *
 * Lives in lib/ rather than inside components/public/site-polish.tsx because it
 * is a PRODUCT rule about an owner's own copy, not an animation detail — the
 * two numbers it refuses are refused for reasons that deserve a test, and a
 * regression here silently rewrites text a business wrote about itself.
 *
 * Pure & dependency-free.
 */

/** A value that should animate, already parsed. `null` = leave it alone. */
export interface CounterTarget {
  /** The number to count to. */
  value: number;
  /** Whether the owner wrote it with thousands separators ("1,200"). */
  grouped: boolean;
}

/** Only a value whose ENTIRE text is a number is a candidate. */
const NUM = /^\s*([\d,]+(?:\.\d+)?)\s*$/;

/**
 * Decides whether a stat's text should animate, and to what.
 *
 * Refused, and why:
 *
 * · Anything that isn't purely numeric — "24/7", "09:00–00:00", "מעל 500",
 *   "4.9★". A counter that overwrites a business's own phrasing is a bug, not
 *   an effect.
 * · Anything under 10. Counting 0→2 across a second is a flicker, not an
 *   animation, and it makes a real statistic look like a loading state.
 * · A bare four-digit number in [1900, 2100]. That is a FOUNDING YEAR far more
 *   often than a quantity — "מאז 1993" is live on a site right now — and a
 *   year spinning up from zero reads as broken. The cost is that a genuine
 *   "2000 לקוחות" written without a separator also sits still; the
 *   wrong-looking half of that trade is the one worth avoiding, and an owner
 *   who writes "2,000" gets the animation back.
 */
export function counterTarget(text: string | null | undefined): CounterTarget | null {
  const m = NUM.exec(text ?? "");
  if (!m) return null;

  const grouped = m[1].includes(",");
  const value = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;

  if (value < 10) return null;
  if (!grouped && Number.isInteger(value) && value >= 1900 && value <= 2100) return null;

  return { value, grouped };
}

/** Renders an in-flight counter value the way the final one is written. */
export function formatCounter(n: number, grouped: boolean): string {
  return grouped ? Math.round(n).toLocaleString("he-IL") : String(Math.round(n));
}
