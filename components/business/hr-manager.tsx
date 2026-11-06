"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Trash2,
  Briefcase,
  ListChecks,
  ClipboardCheck,
  MessagesSquare,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteHrRoleAction } from "@/lib/actions/hr";
import type { HrRole } from "@/types/database";
import type { HrRoleContent } from "@/lib/ai/schemas/hr";

function Section({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      <ul className="space-y-1 text-sm text-foreground/85">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary">•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleCard({
  businessId,
  role,
  onDeleted,
}: {
  businessId: string;
  role: HrRole;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const c = role.content as unknown as HrRoleContent;

  function remove() {
    if (!confirm(`למחוק את חבילת הגיוס "${role.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteHrRoleAction(businessId, role.id);
      if (res.error) toast.error(res.error);
      else onDeleted();
    });
  }

  function copyAll() {
    const text = [
      `תפקיד: ${role.title}`,
      "",
      c.jobDescription,
      "",
      "תחומי אחריות:",
      ...(c.responsibilities ?? []).map((r) => `• ${r}`),
      "",
      "דרישות:",
      ...(c.requirements ?? []).map((r) => `• ${r}`),
      "",
      "קריטריונים לסינון:",
      ...(c.screeningCriteria ?? []).map((r) => `• ${r}`),
      "",
      "שאלות ראיון:",
      ...(c.interviewQuestions ?? []).map((r) => `• ${r}`),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("הועתק ✓");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
            <Briefcase className="size-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{role.title}</span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={copyAll}>
              {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
              העתק הכל
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
              onClick={remove} disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-4 border-t pt-3">
            {c.jobDescription && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{c.jobDescription}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Section icon={ListChecks} title="תחומי אחריות" items={c.responsibilities} />
              <Section icon={ClipboardCheck} title="דרישות" items={c.requirements} />
              <Section icon={ClipboardCheck} title="קריטריונים לסינון" items={c.screeningCriteria} />
              <Section icon={MessagesSquare} title="שאלות ראיון" items={c.interviewQuestions} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HrManager({
  businessId,
  roles,
}: {
  businessId: string;
  roles: HrRole[];
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [details, setDetails] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (role.trim().length < 2) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/hr/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("חבילת הגיוס מוכנה ✓");
      setRole("");
      setDetails("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירה נכשלה");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <Input
            placeholder="שם התפקיד לגיוס (למשל: מנהל/ת מכירות)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <Textarea
            placeholder="פרטים נוספים (לא חובה): היקף משרה, ניסיון נדרש, דגשים מיוחדים…"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
          />
          <Button onClick={generate} disabled={generating || role.trim().length < 2} className="gap-2 self-start">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "בונה חבילת גיוס..." : "צור חבילת גיוס"}
          </Button>
        </CardContent>
      </Card>

      {roles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            עדיין אין משרות — הזינו תפקיד למעלה וה-AI יכין חבילת גיוס מלאה
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {roles.map((r) => (
            <RoleCard key={r.id} businessId={businessId} role={r} onDeleted={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}
