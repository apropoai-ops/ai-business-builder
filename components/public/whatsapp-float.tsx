"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";

import { buildWaMeUrl } from "@/lib/phone";

/**
 * Floating WhatsApp button for storefronts — a top converter for Israeli
 * businesses. Portaled to <body> so no transformed/backdrop-filter ancestor
 * traps the fixed position. Renders nothing without a configured number.
 */
export function WhatsAppFloat({ phone, text }: { phone: string | null; text?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Mount guard so the body portal only renders client-side (no SSR mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const href = phone ? buildWaMeUrl(phone, text) : null;
  if (!mounted || !href || typeof document === "undefined") return null;

  return createPortal(
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="צ'אט בוואטסאפ"
      className="fixed bottom-5 left-5 z-[90] flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
      style={{ backgroundColor: "#25D366" }}
    >
      <MessageCircle className="size-7" fill="white" stroke="#25D366" strokeWidth={1.5} />
    </a>,
    document.body,
  );
}
