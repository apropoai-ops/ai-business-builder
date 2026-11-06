"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Loader2, MessageCircle, User, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureWhatsappLeadAction } from "@/lib/actions/whatsapp";

type Message = { role: "user" | "assistant"; content: string };

export function WhatsappPlayground({
  businessId,
  greeting,
}: {
  businessId: string;
  greeting: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>(
    greeting ? [{ role: "assistant", content: greeting }] : [],
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [savingLead, startSave] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const newMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/businesses/${businessId}/whatsapp/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: newMessages.slice(-10) }),
      });
      if (!res.ok || !res.body) throw new Error("error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        received += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { role: "assistant", content: (last?.content ?? "") + chunk },
          ];
        });
      }
      // Empty stream = provider failure (SDK drops error chunks) — surface it.
      if (!received.trim()) throw new Error("empty");
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "מצטער, אירעה שגיאה. נסה שוב." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  function saveLead() {
    if (!leadName.trim()) return;
    startSave(async () => {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "לקוח" : "סוכן"}: ${m.content}`)
        .join("\n");
      const res = await captureWhatsappLeadAction(businessId, {
        name: leadName.trim(),
        phone: leadPhone.trim() || undefined,
        notes: `נוצר משיחת וואטסאפ:\n${transcript}`.slice(0, 1000),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הליד נשמר ב-CRM");
        setLeadName("");
        setLeadPhone("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="size-4 text-green-600" />
        סימולטור שיחה — נסה את הסוכן כלקוח
      </div>

      {/* Chat window styled like WhatsApp */}
      <div className="flex h-[420px] flex-col rounded-xl border bg-[#e5ddd5] dark:bg-zinc-800">
        <div className="flex items-center gap-2 rounded-t-xl bg-[#075e54] px-4 py-2.5 text-white">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
            <MessageCircle className="size-4" />
          </div>
          <div className="text-sm font-medium">סוכן וואטסאפ</div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              שלח הודעה כדי להתחיל שיחה לדוגמה
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm shadow-sm ${
                  m.role === "user"
                    ? "bg-white text-zinc-900"
                    : "bg-[#dcf8c6] text-zinc-900"
                }`}
              >
                {m.content || (
                  <span className="flex gap-1 text-zinc-400">
                    <span className="animate-bounce [animation-delay:0ms]">·</span>
                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 rounded-b-xl bg-[#f0f0f0] p-2 dark:bg-zinc-900">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="כתוב הודעה כלקוח..."
            disabled={isStreaming}
            className="bg-white"
          />
          <Button onClick={() => send(input)} disabled={!input.trim() || isStreaming} size="icon">
            {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Lead capture */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <UserPlus className="size-4 text-primary" />
          שמור כליד ב-CRM
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
            placeholder="שם הלקוח *"
          />
          <Input
            value={leadPhone}
            onChange={(e) => setLeadPhone(e.target.value)}
            placeholder="טלפון"
          />
          <Button onClick={saveLead} disabled={savingLead || !leadName.trim()} className="gap-2">
            {savingLead ? <Loader2 className="size-4 animate-spin" /> : <User className="size-4" />}
            שמור ליד
          </Button>
        </div>
      </div>
    </div>
  );
}
