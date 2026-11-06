"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ClipboardList,
  Clock,
  Zap,
  Cake,
  Circle,
  CheckCircle2,
  Phone,
  MessageCircle,
  Sparkles,
  Copy,
  Check,
  Loader2,
  CalendarClock,
  ChevronDown,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toggleTaskAction, setLeadFollowUpAction, draftFollowupAction, rescheduleTaskAction, logFollowupSentAction } from "@/lib/actions/crm";
import { buildWaMeUrl } from "@/lib/phone";
import { LeadDetailDialog } from "@/components/business/crm/leads-board";
import type { CrmTask, CrmLead, Booking, TaskPriority } from "@/types/database";
import type { CrmFocus, BirthdayCustomer } from "@/lib/services/crm.service";

type Props = {
  businessId: string;
  focus: CrmFocus;
};

const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "נמוכה", medium: "בינונית", high: "גבוהה" };
const PRIORITY_COLOR: Record<TaskPriority, "default" | "secondary" | "outline"> = {
  low: "outline", medium: "secondary", high: "default",
};

const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "וואטסאפ",
  website: "מהאתר",
  booking: "תור",
};

const VISIBLE_COUNT = 8;

/**
 * The owner's morning cockpit — the first thing they see on the CRM tab.
 * Surfaces everything that needs attention today in one glance: overdue
 * work, today's tasks and bookings, leads gone cold, and birthdays coming up.
 */
export function TodayView({ businessId, focus }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();

  const {
    overdueTasks, todayTasks, staleLeads, todayBookings, upcomingBirthdays,
  } = focus;

  const [overdueVisible, setOverdueVisible] = useState(VISIBLE_COUNT);
  const [staleVisible, setStaleVisible] = useState(VISIBLE_COUNT);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const allEmpty =
    overdueTasks.length === 0 &&
    todayTasks.length === 0 &&
    staleLeads.length === 0 &&
    todayBookings.length === 0 &&
    upcomingBirthdays.length === 0;

  if (allEmpty) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <div className="text-lg font-medium">הכל נקי — אין משימות דחופות להיום 🎉</div>
        </CardContent>
      </Card>
    );
  }

  const openLead = openLeadId ? staleLeads.find((l) => l.id === openLeadId) ?? null : null;

  return (
    <div className="space-y-4">
      {overdueTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="size-4" />
              משימות באיחור
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {overdueTasks.slice(0, overdueVisible).map((task) => (
              <TaskRow key={task.id} task={task} businessId={businessId} onRefresh={refresh} overdue />
            ))}
            {overdueTasks.length > overdueVisible && (
              <ShowMoreButton onClick={() => setOverdueVisible((v) => v + VISIBLE_COUNT)} />
            )}
          </CardContent>
        </Card>
      )}

      {todayTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              משימות להיום
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {todayTasks.map((task) => (
              <TaskRow key={task.id} task={task} businessId={businessId} onRefresh={refresh} />
            ))}
          </CardContent>
        </Card>
      )}

      {todayBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              תורים היום
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayBookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
            <Link
              href={`/businesses/${businessId}/bookings`}
              className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline"
            >
              <CalendarClock className="size-3.5" />
              ליומן המלא
            </Link>
          </CardContent>
        </Card>
      )}

      {staleLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-4" />
              לידים שמחכים למעקב
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staleLeads.slice(0, staleVisible).map((lead) => (
              <StaleLeadRow key={lead.id} lead={lead} businessId={businessId} onRefresh={refresh} onOpenFull={() => setOpenLeadId(lead.id)} />
            ))}
            {staleLeads.length > staleVisible && (
              <ShowMoreButton onClick={() => setStaleVisible((v) => v + VISIBLE_COUNT)} />
            )}
          </CardContent>
        </Card>
      )}

      {upcomingBirthdays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="size-4" />
              ימי הולדת השבוע
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingBirthdays.map((customer) => (
              <BirthdayRow key={customer.id} customer={customer} />
            ))}
          </CardContent>
        </Card>
      )}

      <LeadDetailDialog
        lead={openLead}
        businessId={businessId}
        open={!!openLead}
        onOpenChange={(next) => { if (!next) setOpenLeadId(null); }}
        onRefresh={refresh}
      />
    </div>
  );
}

function ShowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center pt-1">
      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={onClick}>
        <ChevronDown className="size-3.5" />
        הצג עוד
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({
  task, businessId, onRefresh, overdue,
}: {
  task: CrmTask;
  businessId: string;
  onRefresh: () => void;
  overdue?: boolean;
}) {
  const [isPending, start] = useTransition();
  // Optimistic strike-through while the toggle persists on the server.
  const [doneOverride, setDoneOverride] = useState<boolean | null>(null);
  const done = doneOverride ?? task.done;
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [reschedulePending, startReschedule] = useTransition();

  function toggle() {
    const next = !done;
    setDoneOverride(next);
    start(async () => {
      const res = await toggleTaskAction(businessId, task.id, next);
      if (res.error) {
        toast.error(res.error);
        setDoneOverride(null);
      } else {
        onRefresh();
      }
    });
  }

  function reschedule(value: string) {
    setDueDate(value);
    startReschedule(async () => {
      const res = await rescheduleTaskAction(businessId, task.id, value || null);
      if (res.error) toast.error(res.error);
      else onRefresh();
    });
  }

  function snoozeOneDay() {
    const base = task.due_date ? new Date(task.due_date) : new Date();
    base.setDate(base.getDate() + 1);
    reschedule(base.toISOString().slice(0, 10));
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${done ? "opacity-50" : ""}`}>
      <button onClick={toggle} disabled={isPending} className="text-muted-foreground hover:text-primary">
        {done ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <span className={`text-sm font-medium ${done ? "line-through" : ""}`}>{task.title}</span>
      </div>
      <Badge variant={PRIORITY_COLOR[task.priority]} className="text-xs">
        {PRIORITY_LABEL[task.priority]}
      </Badge>
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => reschedule(e.target.value)}
          disabled={reschedulePending}
          className={`h-7 w-32 text-xs ${overdue ? "border-red-400 text-red-600 dark:text-red-400" : ""}`}
          title="דחיית משימה"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground"
          onClick={snoozeOneDay}
          disabled={reschedulePending}
          title="דחייה ביום אחד"
        >
          {reschedulePending ? <Loader2 className="size-3 animate-spin" /> : "+1 יום"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────────────────────────────────────────
function BookingRow({ booking }: { booking: Booking }) {
  const time = new Date(booking.starts_at).toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="text-sm font-semibold tabular-nums">{time}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{booking.customer_name}</div>
        {booking.service && <div className="text-xs text-muted-foreground">{booking.service}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale leads
// ─────────────────────────────────────────────────────────────────────────────
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function StaleLeadRow({
  lead, businessId, onRefresh, onOpenFull,
}: {
  lead: CrmLead;
  businessId: string;
  onRefresh: () => void;
  onOpenFull: () => void;
}) {
  const [isPending, start] = useTransition();
  const [nextDate, setNextDate] = useState(lead.next_follow_up_at?.slice(0, 10) ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftEmail, setDraftEmail] = useState<{ subject: string; body: string } | null>(null);

  function saveFollowUp(value: string) {
    setNextDate(value);
    start(async () => {
      const res = await setLeadFollowUpAction(businessId, lead.id, value || null);
      if (res.error) toast.error(res.error);
      else onRefresh();
    });
  }

  function draft() {
    setDialogOpen(true);
    setDrafting(true);
    setDraftText("");
    setDraftEmail(null);
    start(async () => {
      const res = await draftFollowupAction(businessId, {
        name: lead.name,
        context: `ליד ${lead.source ? `שהגיע מ${SOURCE_LABEL[lead.source] ?? lead.source}` : ""} לפני ${daysSince(lead.created_at)} ימים, סטטוס: ${lead.status}${lead.notes ? `, הערות: ${lead.notes}` : ""}`,
        email: lead.email,
        leadId: lead.id,
      });
      setDrafting(false);
      if (res.error || !res.text) toast.error(res.error ?? "הניסוח נכשל");
      else { setDraftText(res.text); setDraftEmail(res.email ?? null); }
    });
  }

  function logSent(channel: "whatsapp" | "email" | "copy") {
    logFollowupSentAction(businessId, { leadId: lead.id }, channel);
  }

  const waUrl = lead.phone ? buildWaMeUrl(lead.phone, draftText || undefined) : null;
  const mailtoUrl = lead.email && draftEmail
    ? `mailto:${lead.email}?subject=${encodeURIComponent(draftEmail.subject)}&body=${encodeURIComponent(draftEmail.body)}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <button type="button" className="min-w-0 flex-1 text-start" onClick={onOpenFull} title="פתיחת כרטיס ליד מלא">
        <div className="flex items-center gap-2">
          <span className="font-medium hover:underline">{lead.name}</span>
          {lead.source && (
            <Badge variant="secondary" className="text-[10px]">
              {SOURCE_LABEL[lead.source] ?? lead.source}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {daysSince(lead.created_at)} ימים ללא מעקב
        </div>
      </button>

      {lead.phone && (
        <div className="flex items-center gap-1">
          <a
            href={buildWaMeUrl(lead.phone) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
            title="וואטסאפ"
          >
            <MessageCircle className="size-3.5" />
          </a>
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
            title="התקשר"
          >
            <Phone className="size-3.5" />
          </a>
        </div>
      )}

      <Input
        type="date"
        value={nextDate}
        onChange={(e) => saveFollowUp(e.target.value)}
        disabled={isPending}
        className="h-8 w-36 text-xs"
        title="קבע צעד הבא"
      />

      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={draft} disabled={isPending}>
        <Sparkles className="size-3.5" />
        נסח מעקב
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הודעת מעקב ל{lead.name}</DialogTitle>
            <DialogDescription>נוסח ע&quot;י AI — אפשר לערוך לפני שליחה.</DialogDescription>
          </DialogHeader>

          {drafting ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              מנסח...
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {draftEmail && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Mail className="size-3.5" />
                    טיוטת אימייל
                  </div>
                  <Input value={draftEmail.subject} onChange={(e) => setDraftEmail({ ...draftEmail, subject: e.target.value })} className="text-sm" />
                  <textarea
                    value={draftEmail.body}
                    onChange={(e) => setDraftEmail({ ...draftEmail, body: e.target.value })}
                    rows={4}
                    className="w-full resize-none rounded-lg border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex flex-wrap gap-2">
                    <CopyBtn text={`${draftEmail.subject}\n\n${draftEmail.body}`} onCopied={() => logSent("copy")} />
                    {mailtoUrl && (
                      <a href={mailtoUrl} onClick={() => logSent("email")} className="inline-flex">
                        <Button size="sm" className="gap-1.5">
                          <Mail className="size-3.5" />
                          שליחה באימייל
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <CopyBtn text={draftText} onCopied={() => logSent("copy")} />
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={() => logSent("whatsapp")} className="inline-flex">
                <Button size="sm" className="gap-1.5" disabled={!draftText}>
                  <MessageCircle className="size-3.5" />
                  שליחה בוואטסאפ
                </Button>
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBtn({ text, onCopied }: { text: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={!text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      העתק
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Birthdays
// ─────────────────────────────────────────────────────────────────────────────
function formatBirthday(birthday: string): string {
  const parts = birthday.split("-");
  if (parts.length !== 3) return birthday;
  const [, month, day] = parts;
  return `${day}/${month}`;
}

function BirthdayRow({ customer }: { customer: BirthdayCustomer }) {
  const message = `מזל טוב ${customer.name}! 🎉 כל השנה נאחל לך רק דברים טובים.`;
  const waUrl = customer.phone ? buildWaMeUrl(customer.phone, message) : null;
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{customer.name}</div>
        {customer.birthday && (
          <div className="text-xs text-muted-foreground">{formatBirthday(customer.birthday)}</div>
        )}
      </div>
      {waUrl && (
        <a href={waUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Cake className="size-3.5" />
            מזל טוב
          </Button>
        </a>
      )}
    </div>
  );
}
