"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Plus, Loader2, Power, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  issueGiftCardAction,
  deactivateGiftCardAction,
} from "@/lib/actions/gift-cards";
import type { GiftCard } from "@/types/database";

export function GiftCardsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: GiftCard[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  function issue(formData: FormData) {
    startTransition(async () => {
      const res = await issueGiftCardAction(businessId, {
        amount: String(formData.get("amount") ?? ""),
        recipientName: String(formData.get("recipientName") ?? ""),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        setLastCode(res.card?.code ?? null);
        toast.success("השובר הונפק ✓");
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function deactivate(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deactivateGiftCardAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    toast.success("הקוד הועתק ✓");
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="size-4 text-primary" />
          גיפט קארד
        </div>

        <form ref={formRef} action={issue} className="grid gap-2 sm:grid-cols-2">
          <Input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            placeholder="סכום השובר ₪"
            required
          />
          <Input name="recipientName" placeholder="שם המקבל (לא חובה)" />
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 sm:col-span-2 sm:w-fit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            הנפק שובר
          </Button>
        </form>

        {lastCode && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-2.5 text-sm">
            <span className="text-muted-foreground">הקוד שנוצר:</span>
            <span className="font-mono font-bold">{lastCode}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => copyCode(lastCode)}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((g) => {
              const active = g.status === "active";
              return (
                <div
                  key={g.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${
                    active ? "" : "opacity-55"
                  }`}
                >
                  <span className="font-mono font-bold">{g.code}</span>
                  <span className="text-xs text-muted-foreground">
                    ערך ₪{g.initial_amount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · יתרה ₪{g.balance}
                  </span>
                  {g.recipient_name && (
                    <span className="text-xs text-muted-foreground">
                      · עבור {g.recipient_name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    · {active ? "פעיל" : "מושבת"}
                  </span>
                  <div className="ms-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => copyCode(g.code)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    {active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deactivate(g.id)}
                        disabled={busyId === g.id}
                        title="השבת שובר"
                      >
                        {busyId === g.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Power className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
