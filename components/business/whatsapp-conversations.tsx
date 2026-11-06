"use client";

import { useState } from "react";
import { MessageCircle, User, ChevronDown, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WhatsappConversation, WhatsappMessage } from "@/types/database";

export function WhatsappConversations({
  conversations,
  messagesByConversation,
}: {
  conversations: WhatsappConversation[];
  messagesByConversation: Record<string, WhatsappMessage[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <MessageCircle className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            עדיין אין שיחות. לאחר חיבור וואטסאפ, הודעות מלקוחות יופיעו כאן.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {conversations.length} שיחות
        </span>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.refresh()}>
          <RefreshCw className="size-3.5" />
          רענן
        </Button>
      </div>

      {conversations.map((c) => {
        const msgs = messagesByConversation[c.id] ?? [];
        const isOpen = open === c.id;
        return (
          <Card key={c.id}>
            <button
              className="flex w-full items-center gap-3 p-4 text-start"
              onClick={() => setOpen(isOpen ? null : c.id)}
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-green-100 text-green-700">
                <User className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.contact_name || c.contact_phone}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">
                  {c.contact_phone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.last_message_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.last_message_at).toLocaleString("he-IL", {
                      day: "numeric",
                      month: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isOpen && msgs.length > 0 && (
              <CardContent className="space-y-2 border-t bg-muted/20 pt-3">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "inbound" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${
                        m.direction === "inbound"
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "bg-[#dcf8c6] text-zinc-900"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
