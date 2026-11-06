/**
 * Splits a remaining-milliseconds value into whole days/hours/minutes/seconds.
 * Pure and separate from the timer component so the arithmetic (the part that
 * can silently be wrong for weeks) is unit-testable.
 *
 * Negative input clamps to all zeros — callers decide whether to hide an
 * expired timer.
 */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownParts(ms: number): CountdownParts {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
