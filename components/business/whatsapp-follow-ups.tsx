"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Clock, Loader2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markWhatsappHandledAction } from "@/lib/actions/whatsapp";
import type { WhatsappConversation, WhatsappMessage } from "@/types/database";

/** "לפני 3 שעות" — how long this customer has actually been waiting. */
function waitedFor(since: string | null): string {
  if (!since) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

/**
 * The queue of WhatsApp conversations waiting on a human.
 *
 * Deliberately separate from the full inbox: the inbox is a log of everything
 * the agent ever said, which is exactly the wrong thing to look at when you
 * have four customers waiting. This shows only what is open, oldest first, and
 * the only actions are "answer" and "done".
 */
export function WhatsappFollowUps({
  businessId,
  conversations,
  messagesByConversation,
}: {
  businessId: string;
  conversations: WhatsappConversation[];
  messagesByConversation: Record<string, WhatsappMessage[]>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Longest wait first — the customer closest to giving up is the urgent one.
  const open = conversations
    .filter((c) => c.needs_reply)
    .sort((a, b) => (a.needs_reply_since ?? "").localeCompare(b.needs_reply_since ?? ""));

  function markHandled(conversationId: string) {
    setPending(conversationId);
    startTransition(async () => {
      const res = await markWhatsappHandledAction(businessId, conversationId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("סומן כטופל ✓");
        router.refresh();
      }
      setPending(null);
    });
  }

  if (open.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCheck className="size-8 text-green-600/60" />
          <p className="font-medium">אין לקוחות שממתינים</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            כשלקוח יכתוב לסוכן בוואטסאפ, השיחה תופיע כאן ותקבלו התראה — כדי שלא תפספסו
            אף אחד.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {open.length} לקוחות ממתינים לתשובה שלכם
        </p>
        <Link
          href={`/businesses/${businessId}/whatsapp`}
          className="text-xs font-medium text-primary hover:underline"
        >
          כל השיחות והסוכן
        </Link>
      </div>

      {open.map((c) => {
        const messages = messagesByConversation[c.id] ?? [];
        const last = messages[messages.length - 1];
        const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
        const phone = c.contact_phone.replace(/[^\d]/g, "");

        return (
          <Card key={c.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.contact_name || c.contact_phone}</span>
                    {/* Server and client evaluate Date.now() moments apart, so
                        this can land on either side of a minute boundary. */}
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] font-normal"
                      suppressHydrationWarning
                    >
                      <Clock className="size-3" />
                      {waitedFor(c.needs_reply_since)}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {c.contact_phone}
                  </span>
                </div>
              </div>

              {lastInbound && (
                <p className="rounded-lg bg-muted/50 p-2.5 text-sm leading-relaxed">
                  <span className="text-xs font-medium text-muted-foreground">הלקוח כתב: </span>
                  {lastInbound.content.slice(0, 220)}
                </p>
              )}
              {last && last.direction === "outbound" && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium">הסוכן ענה: </span>
                  {last.content.slice(0, 160)}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button size="sm" className="gap-1.5">
                    <MessageCircle className="size-3.5" />
                    ענו בוואטסאפ
                  </Button>
                </a>
                <a href={`tel:${c.contact_phone}`} className="inline-flex">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Phone className="size-3.5" />
                    חיוג
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  disabled={pending === c.id}
                  onClick={() => markHandled(c.id)}
                >
                  {pending === c.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="size-3.5" />
                  )}
                  סמנו כטופל
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
