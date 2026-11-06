"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { inkOn } from "@/lib/storefront-brand";

const STORAGE_KEY = "mode-annc-dismissed";

export function AnnouncementBar({
  text,
  brand,
}: {
  text: string | null;
  brand: string;
}) {
  // Start hidden to avoid a hydration mismatch; reveal after reading
  // localStorage on the client.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) return;
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY);
    } catch {
      dismissed = null;
    }
    // Show again whenever the announcement text changes.
    if (dismissed !== text) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, [text]);

  if (!text || !visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, text ?? "");
    } catch {
      // Ignore storage failures (e.g. private mode).
    }
    setVisible(false);
  }

  return (
    <div
      className="relative flex w-full items-center justify-center px-10 py-2.5 text-center text-sm font-medium text-white"
      style={{ backgroundColor: brand, color: inkOn(brand) }}
    >
      <span className="text-balance">{text}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגירת ההודעה"
        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
