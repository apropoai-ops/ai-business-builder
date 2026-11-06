"use client";

import * as React from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const THEME_ORDER = ["light", "dark", "system"] as const;
type ThemeValue = (typeof THEME_ORDER)[number];

const THEME_META: Record<ThemeValue, { label: string; icon: LucideIcon }> = {
  light: { label: "בהיר", icon: Sun },
  dark: { label: "כהה", icon: Moon },
  system: { label: "אוטומטי", icon: Monitor },
};

// Hydration detector: returns false on the server (and during hydration) and
// true on the client, without effects or extra state.
const emptySubscribe = () => () => {};
function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Cycles light → dark → system. Until the component mounts we can't know the
 * persisted theme (it lives in localStorage), so we report "system" — the
 * server-rendered markup and the first client render therefore always match.
 */
export function useThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current: ThemeValue =
    mounted && THEME_ORDER.includes(theme as ThemeValue)
      ? (theme as ThemeValue)
      : "system";

  const cycle = () => {
    const nextIndex = (THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]);
  };

  return {
    mounted,
    theme: current,
    label: THEME_META[current].label,
    Icon: THEME_META[current].icon,
    cycle,
  };
}

/** Standalone icon button that cycles light / dark / system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { label, Icon, cycle } = useThemeToggle();
  const title = `ערכת נושא: ${label}`;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={cycle}
      title={title}
      aria-label={title}
    >
      <Icon className="size-4" />
      <span className="sr-only">{title}</span>
    </Button>
  );
}
