"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ChatMsg = { role: "user" | "assistant"; content: string };

/**
 * Floating storefront AI chat bubble (bottom-right, RTL). Self-contained:
 * fetches its own enabled/branding config on mount via GET /api/store-chat
 * and renders nothing when the business hasn't turned it on.
 *
 * Mount once on the public site page:
 * ```tsx
 * <StoreChatWidget businessId={business.id} slug={slug} businessName={business.name} accent={brand} />
 * ```
 */
export default function StoreChatWidget({
  businessId,
  slug,
  businessName,
  accent,
}: {
  businessId: string;
  slug: string;
  businessName: string;
  accent?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState(businessName);
  const [color, setColor] = useState(accent || "#2563EB");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const storageKey = `store-chat-session:${slug}`;

  // Bootstrap: config fetch (authoritative "enabled") + restore any saved session.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    let cancelled = false;

    fetch(`/api/store-chat?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data: { enabled?: boolean; businessName?: string; accent?: string }) => {
        if (cancelled) return;
        setEnabled(!!data.enabled);
        if (data.businessName) setName(data.businessName);
        if (data.accent) setColor(data.accent);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });

    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) setSessionId(saved);
    } catch {
      // sessionStorage unavailable (privacy mode) — chat still works, just no continuity.
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/store-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sessionId, message: text }),
      });
      const data = (await res.json()) as { sessionId?: string; reply?: string; error?: string };
      if (!res.ok || data.error || !data.reply) {
        throw new Error(data.error || "שליחת ההודעה נכשלה");
      }

      setMessages((m) => [...m, { role: "assistant", content: data.reply as string }]);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        try {
          window.sessionStorage.setItem(storageKey, data.sessionId);
        } catch {
          // best-effort continuity only
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשליחת ההודעה, נסו שוב");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted || !enabled || typeof document === "undefined") return null;

  return createPortal(
    <div dir="rtl" className="fixed bottom-5 right-5 z-[95] flex flex-col items-end gap-3" data-business-id={businessId}>
      {open && (
        <div
          className="flex w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
          style={{ maxHeight: "min(70vh, 560px)" }}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: color }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              <p className="text-xs opacity-90">שאל אותנו הכל על העסק</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירת הצ'אט"
              className="shrink-0 rounded-lg p-1 hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ minHeight: 200 }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-zinc-400">
                <MessageSquareText className="size-8" />
                <p className="text-sm">שאלו אותנו כל שאלה על {name} ונשמח לעזור</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-zinc-100 text-zinc-900" : "text-white"
                  }`}
                  style={m.role === "assistant" ? { backgroundColor: color } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1 rounded-2xl px-3 py-2.5" style={{ backgroundColor: color }}>
                  <span className="size-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-white" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-zinc-100 p-2"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתבו הודעה…"
              maxLength={2000}
              disabled={loading}
              className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none transition-shadow focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="שליחה"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "סגירת הצ'אט" : "פתיחת צ'אט"}
        className="flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: color }}
      >
        {open ? <X className="size-6" /> : <MessageSquareText className="size-6" />}
      </button>
    </div>,
    document.body,
  );
}
