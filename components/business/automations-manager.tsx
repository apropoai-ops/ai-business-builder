"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  UserPlus,
  ShoppingBag,
  CalendarCheck,
  ShoppingCart,
  Bell,
  Mail,
  MessageCircle,
  ListTodo,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  History,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createAutomationAction,
  updateAutomationAction,
  toggleAutomationAction,
  deleteAutomationAction,
  type AutomationInput,
} from "@/lib/actions/automations";
import type { Automation, AutomationRun } from "@/types/database";

type Trigger = "new_lead" | "order_paid" | "booking_created" | "abandoned_cart";
type Action = "notify_owner" | "email_customer" | "whatsapp_customer" | "create_task";

const TRIGGER_META: Record<Trigger, { label: string; hint: string; icon: React.ElementType }> = {
  new_lead: { label: "ליד חדש", hint: "כשמתקבל ליד חדש מהאתר, וואטסאפ או טופס", icon: UserPlus },
  order_paid: { label: "הזמנה שולמה", hint: "כשלקוח משלים תשלום על הזמנה בחנות", icon: ShoppingBag },
  booking_created: { label: "תור נקבע", hint: "כשנקבע תור חדש ביומן", icon: CalendarCheck },
  abandoned_cart: { label: "עגלה ננטשה", hint: "כשלקוח משאיר פריטים בעגלה בלי להשלים רכישה", icon: ShoppingCart },
};

const ACTION_META: Record<Action, { label: string; hint: string; icon: React.ElementType }> = {
  notify_owner: { label: "התראה לבעל העסק", hint: "התראה בדוא\"ל ובדפדפן אליכם", icon: Bell },
  email_customer: { label: "מייל ללקוח", hint: "שליחת מייל אוטומטי ללקוח", icon: Mail },
  whatsapp_customer: { label: "הודעת וואטסאפ", hint: "שליחת וואטסאפ ללקוח (דורש חיבור וואטסאפ)", icon: MessageCircle },
  create_task: { label: "יצירת משימה", hint: "יצירת משימת מעקב ב-CRM", icon: ListTodo },
};

const TRIGGER_ORDER: Trigger[] = ["new_lead", "order_paid", "booking_created", "abandoned_cart"];
const ACTION_ORDER: Action[] = ["notify_owner", "email_customer", "whatsapp_customer", "create_task"];

const EMPTY_FORM: AutomationInput = {
  name: "",
  trigger: "new_lead",
  action: "notify_owner",
  conditions: {},
  actionConfig: {},
};

type Template = {
  label: string;
  input: AutomationInput;
};

const TEMPLATES: Template[] = [
  {
    label: "כשמתקבל ליד חדש → שלח לי התראה",
    input: {
      name: "התראה על ליד חדש",
      trigger: "new_lead",
      action: "notify_owner",
      conditions: {},
      actionConfig: { message: "התקבל ליד חדש: {{customerName}}" },
    },
  },
  {
    label: "הזמנה שולמה → מייל תודה ללקוח",
    input: {
      name: "מייל תודה על הזמנה",
      trigger: "order_paid",
      action: "email_customer",
      conditions: {},
      actionConfig: {
        subject: "תודה על ההזמנה!",
        body: "תודה שקנית אצלנו, {{customerName}}! ההזמנה שלך בסך {{total}} התקבלה ואנחנו כבר מטפלים בה.",
      },
    },
  },
  {
    label: "עגלה ננטשה → הודעת ווטסאפ",
    input: {
      name: "תזכורת עגלה נטושה",
      trigger: "abandoned_cart",
      action: "whatsapp_customer",
      conditions: {},
      actionConfig: {
        message: "היי {{customerName}}! שמנו לב שהשארת פריטים בעגלה בסך {{total}}. נשמח לעזור להשלים את ההזמנה 😊",
      },
    },
  },
  {
    label: "נקבע תור → צור משימת הכנה",
    input: {
      name: "הכנה לתור חדש",
      trigger: "booking_created",
      action: "create_task",
      conditions: {},
      actionConfig: { title: "להתכונן לתור של {{customerName}}" },
    },
  },
];

function conditionSummary(trigger: Trigger, conditions: unknown): string | null {
  const c = (conditions ?? {}) as Record<string, unknown>;
  if (trigger === "order_paid" && c.min_total != null) {
    const ils = Number(c.min_total) / 100;
    return `רק מעל ₪${ils.toLocaleString("he-IL")}`;
  }
  if (trigger === "new_lead" && c.source) {
    return `רק אם המקור הוא "${String(c.source)}"`;
  }
  return null;
}

function automationToInput(a: Automation): AutomationInput {
  const conditions = (a.conditions ?? {}) as Record<string, unknown>;
  const actionConfig = (a.action_config ?? {}) as Record<string, unknown>;
  return {
    name: a.name,
    trigger: a.trigger,
    action: a.action,
    conditions: {
      minTotal: conditions.min_total != null ? String(Number(conditions.min_total) / 100) : "",
      source: typeof conditions.source === "string" ? conditions.source : "",
    },
    actionConfig: {
      message: typeof actionConfig.message === "string" ? actionConfig.message : "",
      subject: typeof actionConfig.subject === "string" ? actionConfig.subject : "",
      body: typeof actionConfig.body === "string" ? actionConfig.body : "",
      title: typeof actionConfig.title === "string" ? actionConfig.title : "",
    },
  };
}

export function AutomationsManager({
  businessId,
  automations,
  runs,
}: {
  businessId: string;
  automations: Automation[];
  runs: AutomationRun[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AutomationInput>(EMPTY_FORM);

  const automationsByName = useMemo(
    () => new Map(automations.map((a) => [a.id, a.name])),
    [automations],
  );

  function openCreate(prefill?: AutomationInput) {
    setEditingId(null);
    setForm(prefill ?? EMPTY_FORM);
    setStep(1);
    setDialogOpen(true);
  }

  function openEdit(a: Automation) {
    setEditingId(a.id);
    setForm(automationToInput(a));
    setStep(1);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setStep(1);
  }

  function save() {
    if (!form.name.trim()) {
      toast.error("יש להזין שם לאוטומציה");
      return;
    }
    startTransition(async () => {
      const res = editingId
        ? await updateAutomationAction(businessId, editingId, form)
        : await createAutomationAction(businessId, form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editingId ? "האוטומציה עודכנה ✓" : "האוטומציה נוצרה ✓");
      closeDialog();
      router.refresh();
    });
  }

  function toggle(a: Automation) {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await toggleAutomationAction(businessId, a.id, !a.enabled);
      if (res.error) toast.error(res.error);
      setBusyId(null);
      router.refresh();
    });
  }

  function remove(a: Automation) {
    if (!confirm(`למחוק את האוטומציה "${a.name}"?`)) return;
    setBusyId(a.id);
    startTransition(async () => {
      const res = await deleteAutomationAction(businessId, a.id);
      if (res.error) toast.error(res.error);
      setBusyId(null);
      router.refresh();
    });
  }

  const trigger = form.trigger as Trigger;
  const action = form.action as Action;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="size-4 text-primary" />
            אוטומציות
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => openCreate()}>
            <Plus className="size-4" />
            אוטומציה חדשה
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            תבניות מוכנות — לחיצה תמלא עבורכם את הכלל
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => openCreate(t.input)}
                className="rounded-full border border-input px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:border-primary hover:text-primary"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">כללים</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="size-3.5" />
              היסטוריית הרצות
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-3">
            {automations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
                <Zap className="size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">אין עדיין אוטומציות</p>
                <p className="text-xs text-muted-foreground">
                  צרו כלל חדש או בחרו אחת מהתבניות למעלה כדי להתחיל
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {automations.map((a) => {
                  const tMeta = TRIGGER_META[a.trigger as Trigger];
                  const aMeta = ACTION_META[a.action as Action];
                  const TIcon = tMeta?.icon ?? Zap;
                  const AIcon = aMeta?.icon ?? Zap;
                  const summary = conditionSummary(a.trigger as Trigger, a.conditions);
                  const busy = busyId === a.id && isPending;

                  return (
                    <div
                      key={a.id}
                      className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${a.enabled ? "" : "opacity-55"}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{a.name}</span>
                          {!a.enabled && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              מושבת
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <TIcon className="size-3.5" />
                          {tMeta?.label ?? a.trigger}
                          <ChevronLeft className="size-3 rtl:rotate-180" />
                          <AIcon className="size-3.5" />
                          {aMeta?.label ?? a.action}
                          {summary && <span>· {summary}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.enabled}
                          disabled={busy}
                          onCheckedChange={() => toggle(a)}
                        />
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(a)} disabled={busy}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(a)}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {runs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
                <History className="size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">אין עדיין הרצות</p>
                <p className="text-xs text-muted-foreground">כשאוטומציה תופעל, ההרצה תופיע כאן</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {runs.map((r) => {
                  const tMeta = TRIGGER_META[r.trigger as Trigger];
                  const ok = r.status === "ok";
                  return (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-xs">
                      {ok ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="size-3.5 shrink-0 text-destructive" />
                      )}
                      <span className="font-medium">
                        {automationsByName.get(r.automation_id) ?? tMeta?.label ?? r.trigger}
                      </span>
                      <Badge variant={ok ? "secondary" : "destructive"} className="text-[10px]">
                        {ok ? "בוצע" : "נכשל"}
                      </Badge>
                      {r.detail && <span className="text-muted-foreground">{r.detail}</span>}
                      <span className="ms-auto shrink-0 text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("he-IL")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת אוטומציה" : "אוטומציה חדשה"}</DialogTitle>
            <DialogDescription>
              שלב {step} מתוך 3 —{" "}
              {step === 1 ? "בחרו טריגר" : step === 2 ? "תנאי אופציונלי" : "בחרו פעולה"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">שם הכלל</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="למשל: התראה על ליד חדש"
              />
            </label>

            {step === 1 && (
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_ORDER.map((key) => {
                  const meta = TRIGGER_META[key];
                  const Icon = meta.icon;
                  const active = trigger === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, trigger: key }))}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition ${active ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40"}`}
                    >
                      <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span className="text-[10px] leading-tight text-muted-foreground">{meta.hint}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-3">
                {trigger === "order_paid" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">רק אם סכום ההזמנה מעל (₪, לא חובה)</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      dir="ltr"
                      value={form.conditions.minTotal ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, conditions: { ...f.conditions, minTotal: e.target.value } }))
                      }
                      placeholder="למשל 200"
                    />
                  </label>
                )}
                {trigger === "new_lead" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">רק אם המקור הוא (לא חובה)</span>
                    <Input
                      value={form.conditions.source ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, conditions: { ...f.conditions, source: e.target.value } }))
                      }
                      placeholder="למשל whatsapp או website"
                    />
                  </label>
                )}
                {trigger !== "order_paid" && trigger !== "new_lead" && (
                  <p className="text-xs text-muted-foreground">
                    אין תנאים זמינים לטריגר הזה — הפעולה תרוץ בכל פעם שהוא מתרחש
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {ACTION_ORDER.map((key) => {
                    const meta = ACTION_META[key];
                    const Icon = meta.icon;
                    const active = action === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, action: key }))}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-right transition ${active ? "border-primary ring-1 ring-primary" : "border-input hover:border-muted-foreground/40"}`}
                      >
                        <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-medium">{meta.label}</span>
                        <span className="text-[10px] leading-tight text-muted-foreground">{meta.hint}</span>
                      </button>
                    );
                  })}
                </div>

                {(action === "notify_owner" || action === "whatsapp_customer") && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">תוכן ההודעה (לא חובה — יש ברירת מחדל)</span>
                    <Textarea
                      value={form.actionConfig.message ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, message: e.target.value } }))
                      }
                      placeholder="למשל: התקבל ליד חדש: {{customerName}}"
                      rows={3}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      אפשר להשתמש ב-{"{{customerName}}"} ו-{"{{total}}"} — יוחלפו אוטומטית
                    </span>
                  </label>
                )}

                {action === "email_customer" && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">נושא המייל</span>
                      <Input
                        value={form.actionConfig.subject ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, subject: e.target.value } }))
                        }
                        placeholder="תודה על ההזמנה!"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">תוכן המייל</span>
                      <Textarea
                        value={form.actionConfig.body ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, body: e.target.value } }))
                        }
                        placeholder="תודה שקנית אצלנו, {{customerName}}!"
                        rows={3}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        אפשר להשתמש ב-{"{{customerName}}"} ו-{"{{total}}"} — יוחלפו אוטומטית
                      </span>
                    </label>
                  </>
                )}

                {action === "create_task" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">כותרת המשימה (לא חובה — יש ברירת מחדל)</span>
                    <Input
                      value={form.actionConfig.title ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, actionConfig: { ...f.actionConfig, title: e.target.value } }))
                      }
                      placeholder="להתכונן לתור של {{customerName}}"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              ביטול
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" className="gap-1.5" onClick={() => setStep((s) => (s - 1) as 1 | 2)} disabled={isPending}>
                  <ChevronRight className="size-4 rtl:rotate-180" />
                  חזרה
                </Button>
              )}
              {step < 3 ? (
                <Button className="gap-1.5" onClick={() => setStep((s) => (s + 1) as 2 | 3)} disabled={isPending}>
                  המשך
                  <ChevronLeft className="size-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button className="gap-1.5" onClick={save} disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {editingId ? "שמירה" : "יצירה"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
