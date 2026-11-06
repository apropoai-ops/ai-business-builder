"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, User, Trash2, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { toast } from "sonner";

import type { CeoMessage } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { clearCeoChatAction } from "@/lib/actions/ceo-chat";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "מה כדאי לי לעשות השבוע?",
  "מה ההזדמנות הגדולה ביותר שלי עכשיו?",
  "איך אני יכול להגדיל את ההכנסות?",
  "מה הסיכונים העיקריים שאני צריך להכיר?",
  "איך כדאי לי לשווק את העסק?",
  "תנתח לי את הצנרת העסקאות שלי",
];

export function CeoChat({
  businessId,
  initialMessages,
}: {
  businessId: string;
  initialMessages: CeoMessage[];
}) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ role: m.role as Message["role"], content: m.content })),
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Placeholder for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/businesses/${businessId}/ceo-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: newMessages.slice(-10), // last 10 messages for context
        }),
      });

      if (!res.ok || !res.body) throw new Error("שגיאה בתשובה");

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

      // The stream can close with an empty body when the AI provider fails
      // (free-tier quota / safety filter) — the SDK drops error chunks, so a
      // "200 with nothing" would otherwise leave a blank bubble forever.
      if (!received.trim()) {
        throw new Error("empty");
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "מצטער, לא הצלחתי לענות כרגע. נסו שוב בעוד רגע." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function clearChat() {
    const previous = messages;
    setMessages([]); // optimistic — rolled back below if the delete fails
    void clearCeoChatAction(businessId).then((res) => {
      if (res.error) {
        toast.error(res.error);
        setMessages(previous);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <div>
            <div className="font-semibold">AI CEO</div>
            <div className="text-xs text-muted-foreground">
              מכיר את העסק שלך לעומק
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={clearChat}
          >
            <Trash2 className="size-4" />
            נקה שיחה
          </Button>
        )}
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 py-8">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-8" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">שאל את ה-AI CEO</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    מכיר את העסק, השוק, המיתוג וה-CRM שלך
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 w-full max-w-lg">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-start hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          rows={1}
          placeholder="שאל את ה-AI CEO..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={isStreaming}
          className="resize-none min-h-[42px] max-h-32"
        />
        <Button
          onClick={() => send(input)}
          disabled={!input.trim() || isStreaming}
          size="icon"
          className="shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Enter לשליחה · Shift+Enter לשורה חדשה
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        dir="rtl"
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-right text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted rounded-tl-sm"
        }`}
      >
        {message.content ? (
          isUser ? (
            message.content
          ) : (
            // Assistant answers arrive as markdown (headings, bullets, bold) —
            // render them structured + RTL. whitespace-normal cancels the
            // pre-wrap above so markdown controls spacing.
            <div className="ceo-md whitespace-normal [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-[13px] [&_h3]:font-bold [&_h3:first-child]:mt-0 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:mr-4 [&_ul]:list-disc [&_ol]:my-1.5 [&_ol]:mr-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-bold [&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-right [&_td]:border [&_td]:px-2 [&_td]:py-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )
        ) : (
          <span className="flex gap-1 text-muted-foreground">
            <span className="animate-bounce [animation-delay:0ms]">·</span>
            <span className="animate-bounce [animation-delay:150ms]">·</span>
            <span className="animate-bounce [animation-delay:300ms]">·</span>
          </span>
        )}
      </div>
    </div>
  );
}
