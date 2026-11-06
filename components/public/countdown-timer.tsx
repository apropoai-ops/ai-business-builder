"use client";

import { useEffect, useState } from "react";

import { countdownParts } from "@/lib/countdown";

const UNITS = [
  { key: "days", label: "ימים" },
  { key: "hours", label: "שעות" },
  { key: "minutes", label: "דקות" },
  { key: "seconds", label: "שניות" },
] as const;

/**
 * Urgency countdown for the landing page CTA.
 *
 * Renders a stable dash placeholder on the server and until the first tick, so
 * SSR and hydration always agree (the remaining time is by definition a
 * client-only value). The first update is scheduled via setTimeout rather than
 * called inline, because react-hooks/set-state-in-effect is an ERROR in this
 * repo — state may not be set synchronously in an effect body.
 *
 * Once the target passes the whole component disappears: an expired timer that
 * sits at 00:00:00 reads as a broken page, not as urgency.
 */
export function CountdownTimer({
  endsAt,
  label,
  accent,
  onLight = false,
}: {
  endsAt: string;
  label?: string | null;
  accent: string;
  onLight?: boolean;
}) {
  const target = Date.parse(endsAt);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const update = () => setRemaining(target - Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  if (!Number.isFinite(target)) return null;
  if (remaining !== null && remaining <= 0) return null;

  const parts = remaining === null ? null : countdownParts(remaining);

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p
          className={`text-sm font-medium ${onLight ? "text-zinc-600" : "text-white/80"}`}
        >
          {label}
        </p>
      )}
      <div className="flex gap-2" dir="ltr" role="timer" aria-live="off">
        {UNITS.map((unit) => (
          <div
            key={unit.key}
            className={`w-[4.5rem] rounded-xl px-3 py-2 text-center ${
              onLight ? "bg-white shadow-sm ring-1 ring-black/5" : "bg-white/15 backdrop-blur"
            }`}
          >
            <div
              className={`text-2xl font-bold tabular-nums ${onLight ? "" : "text-white"}`}
              style={onLight ? { color: accent } : undefined}
            >
              {parts ? String(parts[unit.key]).padStart(2, "0") : "--"}
            </div>
            <div
              className={`text-xs ${onLight ? "text-zinc-600" : "text-white/85"}`}
            >
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
