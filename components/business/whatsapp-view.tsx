"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Save,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { WhatsappWatcher } from "@/components/business/whatsapp-watcher";
import { WhatsappPlayground } from "@/components/business/whatsapp-playground";
import { saveWhatsappConfigAction } from "@/lib/actions/whatsapp";
import {
  whatsappGoalValues,
  whatsappGoalLabels,
  type WhatsappGoal,
  type FaqItem,
} from "@/lib/ai/schemas/whatsapp";
import type { WhatsappConfig } from "@/types/database";

function asGoals(v: unknown): WhatsappGoal[] {
  return Array.isArray(v) ? (v as WhatsappGoal[]) : [];
}
function asFaq(v: unknown): FaqItem[] {
  return Array.isArray(v) ? (v as FaqItem[]) : [];
}

export function WhatsappView({
  businessId,
  config,
  isGenerating,
}: {
  businessId: string;
  config: WhatsappConfig | null;
  isGenerating: boolean;
}) {
  const [greeting, setGreeting] = useState(config?.greeting ?? "");
  const [tone, setTone] = useState(config?.tone ?? "חם וידידותי");
  const [goals, setGoals] = useState<WhatsappGoal[]>(asGoals(config?.goals));
  const [faq, setFaq] = useState<FaqItem[]>(asFaq(config?.faq));
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    startTransition(async () => {
      const res = await fetch(`/api/businesses/${businessId}/whatsapp/setup`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("הסוכן נבנה מחדש ✓");
        // The job runs synchronously inside the request — refresh directly so
        // the regenerated greeting/goals/FAQ show without a manual reload.
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "שגיאה בהפעלת הייצור — נסה שוב");
      }
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveWhatsappConfigAction(businessId, {
        greeting,
        tone,
        goals,
        faq,
        enabled,
      });
      if (res.error) toast.error(res.error);
      else toast.success("ההגדרות נשמרו");
    });
  }

  function toggleGoal(g: WhatsappGoal) {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  const generating = isGenerating || (isPending && !config);
  const hasConfig = Boolean(config);

  // First-time empty state
  if (!hasConfig && !generating) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Sparkles className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">עדיין אין סוכן וואטסאפ</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              ה-AI יגדיר עבורך סוכן מלא — הודעת פתיחה, טון, מטרות ושאלות נפוצות —
              על בסיס פרטי העסק.
            </p>
          </div>
          <Button onClick={generate} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            הגדר סוכן עם AI
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generating) return <WhatsappWatcher businessId={businessId} />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Config editor ─────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">הגדרות הסוכן</h2>
          <div className="flex gap-2">
            <Button
              variant={enabled ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setEnabled((e) => !e)}
            >
              {enabled ? <Power className="size-3.5" /> : <PowerOff className="size-3.5" />}
              {enabled ? "פעיל" : "כבוי"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={generate} disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              חדש מ-AI
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">הודעת פתיחה</label>
              <Textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                rows={2}
                placeholder="היי! 👋 איך אפשר לעזור?"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">טון דיבור</label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">מטרות הסוכן</label>
              <div className="flex flex-wrap gap-2">
                {whatsappGoalValues.map((g) => (
                  <button key={g} onClick={() => toggleGoal(g)} type="button">
                    <Badge
                      variant={goals.includes(g) ? "default" : "outline"}
                      className="cursor-pointer"
                    >
                      {whatsappGoalLabels[g]}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ editor */}
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">שאלות נפוצות ({faq.length})</label>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setFaq((p) => [...p, { question: "", answer: "" }])}
              >
                <Plus className="size-3.5" />
                הוסף
              </Button>
            </div>
            <div className="space-y-3">
              {faq.map((item, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border p-2.5">
                  <div className="flex gap-2">
                    <Input
                      value={item.question}
                      onChange={(e) =>
                        setFaq((p) => p.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)))
                      }
                      placeholder="שאלה"
                      className="text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setFaq((p) => p.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={item.answer}
                    onChange={(e) =>
                      setFaq((p) => p.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)))
                    }
                    placeholder="תשובה"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ))}
              {faq.length === 0 && (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  אין שאלות עדיין — הוסף ידנית או צור מחדש מ-AI
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={isPending} className="gap-2">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          שמור הגדרות
        </Button>
      </div>

      {/* ── Playground ────────────────────────────────── */}
      <WhatsappPlayground businessId={businessId} greeting={config?.greeting ?? null} />
    </div>
  );
}
