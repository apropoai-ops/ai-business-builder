"use client";

import { useMemo, useState, useTransition } from "react";
import {
  GripVertical, CalendarClock, MessageCircle, Sparkles, Copy,
  UserPlus, Trash2, Loader2, Plus, Pencil, Save, Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import {
  updateLeadStatusAction, updateLeadDetailsAction, convertLeadAction, deleteLeadAction,
  addCrmNoteAction, listCrmActivitiesAction, setLeadFollowUpAction, draftFollowupAction,
  logFollowupSentAction,
} from "@/lib/actions/crm";
import type { CrmLead, CrmActivity, LeadStatus } from "@/types/database";
import { buildWaMeUrl } from "@/lib/phone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type StatusTone } from "@/components/business/crm/status-badge";

export const SOURCE_LABEL: Record<string, string> = {
  whatsapp: "וואטסאפ",
  website: "מהאתר",
  booking: "תור",
};

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "חדש" },
  { value: "contacted", label: "נוצר קשר" },
  { value: "qualified", label: "רלוונטי" },
  { value: "lost", label: "לא רלוונטי" },
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = LEAD_STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<LeadStatus, string>,
);

export const LEAD_STATUS_TONE: Record<LeadStatus, StatusTone> = {
  new: "info",
  contacted: "progress",
  qualified: "success",
  lost: "neutral",
};

function daysSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/** A lead is "converted" once it carries a converted_customer_id — never inferred from note text. */
export function isLeadConverted(lead: CrmLead): boolean {
  return !!lead.converted_customer_id;
}

type FollowUpBadge = { text: string; urgent?: boolean; missing?: boolean };

function followUpBadge(lead: CrmLead): FollowUpBadge | null {
  if (lead.next_follow_up_at) {
    const due = new Date(lead.next_follow_up_at);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { text: due.toLocaleDateString("he-IL"), urgent: due.getTime() <= today.getTime() };
  }
  if (lead.status === "new" || lead.status === "contacted") {
    return { text: "אין צעד הבא", missing: true };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lost-reason capture — small dialog shown whenever a lead moves to "lost".
// Any close (save / escape / backdrop) confirms the move; the reason itself
// is optional, so a drag never gets stuck waiting on it.
// ─────────────────────────────────────────────────────────────────────────────
export function LostReasonDialog({ open, leadName, onOpenChange, onConfirm }: {
  open: boolean;
  leadName?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) {
      onConfirm(reason.trim());
      setReason("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>סיבת אובדן{leadName ? ` — ${leadName}` : ""}</DialogTitle>
          <DialogDescription>אופציונלי — עוזר להבין למה לידים לא נסגרים.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="לדוגמה: המחיר לא התאים..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleOpenChange(false); }}
          autoFocus
        />
        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────────────────────
export function LeadsBoard({ leads, businessId, onRefresh }: { leads: CrmLead[]; businessId: string; onRefresh: () => void }) {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, LeadStatus>>({});
  const [, startMove] = useTransition();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lostDialogState, setLostDialogState] = useState<{ leadId: string; leadName: string; previousStatus: LeadStatus } | null>(null);

  const boardLeads = useMemo(
    () => leads.map((l) => (statusOverrides[l.id] ? { ...l, status: statusOverrides[l.id] } : l)),
    [leads, statusOverrides],
  );

  // Require a small pointer movement before a drag starts, so clicks on the
  // card keep opening the detail dialog normally.
  // KeyboardSensor is not optional decoration: dnd-kit wires the drag handle to
  // instructions that tell the user to press space and use the arrow keys, so
  // without it the handle announces a capability it does not have.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function moveLead(leadId: string, previousStatus: LeadStatus, status: LeadStatus, lostReason?: string) {
    setStatusOverrides((prev) => ({ ...prev, [leadId]: status }));
    startMove(async () => {
      const res = await updateLeadStatusAction(businessId, leadId, status, lostReason);
      if (res.error) {
        toast.error(res.error);
        setStatusOverrides((prev) => ({ ...prev, [leadId]: previousStatus }));
      } else {
        onRefresh();
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    if (overId == null) return;
    const status = String(overId) as LeadStatus;
    if (!LEAD_STATUSES.some((s) => s.value === status)) return;

    const leadId = String(event.active.id);
    const lead = boardLeads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;

    const previousStatus = lead.status as LeadStatus;
    if (status === "lost") {
      setLostDialogState({ leadId, leadName: lead.name, previousStatus });
      return;
    }
    moveLead(leadId, previousStatus, status);
  }

  function openLead(lead: CrmLead) {
    setSelectedLeadId(lead.id);
    setDialogOpen(true);
  }

  const selectedLead = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null;

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 sm:grid-cols-4">
          {LEAD_STATUSES.map((status) => (
            <LeadColumn
              key={status.value}
              status={status}
              leads={boardLeads.filter((l) => l.status === status.value)}
              onOpen={openLead}
            />
          ))}
        </div>
      </DndContext>
      <LeadDetailDialog
        lead={selectedLead}
        businessId={businessId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRefresh={onRefresh}
      />
      <LostReasonDialog
        open={!!lostDialogState}
        leadName={lostDialogState?.leadName}
        onOpenChange={(open) => { if (!open) setLostDialogState(null); }}
        onConfirm={(reason) => {
          if (lostDialogState) moveLead(lostDialogState.leadId, lostDialogState.previousStatus, "lost", reason);
        }}
      />
    </>
  );
}

function LeadColumn({ status, leads, onOpen }: {
  status: { value: LeadStatus; label: string };
  leads: CrmLead[];
  onOpen: (lead: CrmLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 space-y-2 rounded-lg p-1.5 transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{status.label}</span>
        <span className="text-[10px]">{leads.length}</span>
      </div>
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
      ))}
      {leads.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-center text-[10px] text-muted-foreground">
          גרור ליד לכאן
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: CrmLead; onOpen: (lead: CrmLead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const badge = followUpBadge(lead);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-pointer space-y-1.5 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40 ${
        isDragging ? "relative z-50 opacity-80 ring-2 ring-primary shadow-lg" : ""
      }`}
      onClick={() => onOpen(lead)}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="-ms-1 mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          aria-label={`גרירת הליד ${lead.name} לשלב אחר`}
        >
          <GripVertical className="size-3.5" />
        </button>
        {/*
          A real button, not the card <div>'s onClick. This is the ONLY way a
          keyboard user reaches the lead dialog: the list view never opens it,
          and the global search links to /crm without a lead id. The card div
          keeps its own click so a mouse can still hit anywhere on it.
        */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(lead);
          }}
          className="min-w-0 flex-1 rounded-sm text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium leading-tight">{lead.name}</span>
            {lead.source && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {SOURCE_LABEL[lead.source] ?? lead.source}
              </Badge>
            )}
          </span>
          <span className="sr-only">— פתיחת כרטיס הליד</span>
          {lead.phone && <span className="block text-xs text-muted-foreground">{lead.phone}</span>}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] text-muted-foreground">{daysSince(lead.created_at)}</span>
        {badge && (
          <Badge
            variant={badge.missing ? "destructive" : badge.urgent ? "default" : "outline"}
            className={`gap-1 text-[10px] ${badge.urgent ? "bg-amber-500 text-white hover:bg-amber-500" : ""}`}
          >
            <CalendarClock className="size-3" />
            {badge.text}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail dialog — exported so the global search (Ctrl+K) can open it directly
// for a matched lead without going through the board/list view.
// ─────────────────────────────────────────────────────────────────────────────
export function LeadDetailDialog({ lead, businessId, open, onOpenChange, onRefresh }: {
  lead: CrmLead | null;
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const [isPending, start] = useTransition();
  const [followUp, setFollowUp] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [draftedText, setDraftedText] = useState("");
  const [draftedEmail, setDraftedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSource, setEditSource] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function loadActivities(leadId: string) {
    setActivitiesLoading(true);
    listCrmActivitiesAction(businessId, { leadId })
      .then((res) => {
        if (res.error) toast.error(res.error);
        setActivities(res.activities ?? []);
      })
      .finally(() => setActivitiesLoading(false));
  }

  // Fetch on the open transition itself (never in a useEffect) — mirrors the
  // established pattern in components/business/customer-card.tsx.
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next && lead && loadedForId !== lead.id) {
      setFollowUp(lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 10) : "");
      setDraftedText("");
      setDraftedEmail(null);
      setNoteText("");
      setEditing(false);
      setEditName(lead.name);
      setEditPhone(lead.phone ?? "");
      setEditEmail(lead.email ?? "");
      setEditSource(lead.source ?? "");
      setLoadedForId(lead.id);
      loadActivities(lead.id);
    }
  }

  if (!lead) return null;

  function saveFollowUp(value: string) {
    setFollowUp(value);
    setFollowUpSaving(true);
    setLeadFollowUpAction(businessId, lead!.id, value || null)
      .then((res) => {
        if (res.error) toast.error(res.error);
        else onRefresh();
      })
      .finally(() => setFollowUpSaving(false));
  }

  function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    addCrmNoteAction(businessId, { leadId: lead!.id }, noteText.trim())
      .then((res) => {
        if (res.error) toast.error(res.error);
        else { setNoteText(""); loadActivities(lead!.id); }
      })
      .finally(() => setAddingNote(false));
  }

  function saveEdit() {
    if (!editName.trim()) { toast.error("שם חובה"); return; }
    setSavingEdit(true);
    updateLeadDetailsAction(businessId, lead!.id, {
      name: editName.trim(),
      phone: editPhone.trim() || null,
      email: editEmail.trim() || null,
      source: editSource.trim() || null,
    })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else { toast.success("הפרטים נשמרו"); setEditing(false); onRefresh(); }
      })
      .finally(() => setSavingEdit(false));
  }

  function draftFollowup() {
    setDrafting(true);
    setDraftedEmail(null);
    draftFollowupAction(businessId, {
      name: lead!.name,
      context: `ליד ${LEAD_STATUS_LABEL[lead!.status]} ממקור ${lead!.source ? (SOURCE_LABEL[lead!.source] ?? lead!.source) : "לא ידוע"}`,
      email: lead!.email,
      leadId: lead!.id,
    })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else { setDraftedText(res.text ?? ""); setDraftedEmail(res.email ?? null); }
      })
      .finally(() => setDrafting(false));
  }

  function copyDraft() {
    if (!draftedText) return;
    navigator.clipboard.writeText(draftedText).then(() => toast.success("הועתק"));
    logFollowupSentAction(businessId, { leadId: lead!.id }, "copy");
  }

  function copyEmail() {
    if (!draftedEmail) return;
    navigator.clipboard.writeText(`${draftedEmail.subject}\n\n${draftedEmail.body}`).then(() => toast.success("הועתק"));
    logFollowupSentAction(businessId, { leadId: lead!.id }, "copy");
  }

  function logSent(channel: "whatsapp" | "email") {
    logFollowupSentAction(businessId, { leadId: lead!.id }, channel);
  }

  function convert() {
    start(async () => {
      const res = await convertLeadAction(businessId, {
        id: lead!.id, name: lead!.name, phone: lead!.phone, email: lead!.email,
      });
      if (res.error) toast.error(res.error);
      else { toast.success(`${lead!.name} נוסף ללקוחות 🎉`); onOpenChange(false); onRefresh(); }
    });
  }

  function remove() {
    start(async () => {
      await deleteLeadAction(businessId, lead!.id);
      onOpenChange(false);
      onRefresh();
    });
  }

  const converted = isLeadConverted(lead);
  const waHref = lead.phone ? buildWaMeUrl(lead.phone) : null;
  const waDraftHref = lead.phone && draftedText ? buildWaMeUrl(lead.phone, draftedText) : null;
  const mailtoHref = lead.email && draftedEmail
    ? `mailto:${lead.email}?subject=${encodeURIComponent(draftedEmail.subject)}&body=${encodeURIComponent(draftedEmail.body)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>
            {[lead.phone, lead.email].filter(Boolean).join(" · ") || "אין פרטי קשר"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.source && (
              <Badge variant="secondary" className="text-[10px]">{SOURCE_LABEL[lead.source] ?? lead.source}</Badge>
            )}
            <StatusBadge tone={LEAD_STATUS_TONE[lead.status]} label={LEAD_STATUS_LABEL[lead.status]} />
            {converted && <StatusBadge tone="success" label="לקוח ✓" />}
            <span className="text-[10px] text-muted-foreground">נוצר {daysSince(lead.created_at)}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-auto h-6 gap-1 px-1.5 text-[10px] text-muted-foreground"
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="size-3" />
              {editing ? "ביטול" : "עריכה"}
            </Button>
          </div>

          {lead.status === "lost" && lead.lost_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              סיבת אובדן: {lead.lost_reason}
            </div>
          )}

          {editing ? (
            <div className="space-y-2 rounded-lg border p-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-name">שם</Label>
                <Input id="lead-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-edit-phone">טלפון</Label>
                  <Input id="lead-edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-edit-email">אימייל</Label>
                  <Input id="lead-edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-edit-source">מקור</Label>
                <Input id="lead-edit-source" value={editSource} onChange={(e) => setEditSource(e.target.value)} />
              </div>
              <Button size="sm" className="w-full gap-1.5" onClick={saveEdit} disabled={savingEdit || !editName.trim()}>
                {savingEdit ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                שמירה
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="lead-followup" className="gap-1.5">
                <CalendarClock className="size-3.5" />
                צעד הבא
              </Label>
              <div className="flex gap-2">
                <Input
                  id="lead-followup"
                  type="date"
                  value={followUp}
                  onChange={(e) => saveFollowUp(e.target.value)}
                  disabled={followUpSaving}
                  className="text-sm"
                />
                {followUp && (
                  <Button variant="outline" size="sm" onClick={() => saveFollowUp("")} disabled={followUpSaving}>
                    נקה
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <MessageCircle className="size-3.5" />
                וואטסאפ
              </a>
            )}
            <Button variant="outline" size="sm" onClick={draftFollowup} disabled={drafting} className="gap-1.5">
              {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              נסח הודעת מעקב
            </Button>
            {!converted && (
              <Button variant="outline" size="sm" onClick={convert} disabled={isPending} className="gap-1.5">
                <UserPlus className="size-3.5" />
                המר ללקוח
              </Button>
            )}
          </div>

          {draftedText && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageCircle className="size-3.5" />
                טיוטת וואטסאפ
              </div>
              <Textarea value={draftedText} onChange={(e) => setDraftedText(e.target.value)} rows={3} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyDraft} className="gap-1.5">
                  <Copy className="size-3.5" />
                  העתק
                </Button>
                {waDraftHref && (
                  <a
                    href={waDraftHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => logSent("whatsapp")}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    <MessageCircle className="size-3.5" />
                    שליחה בוואטסאפ
                  </a>
                )}
              </div>
            </div>
          )}

          {draftedEmail && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Mail className="size-3.5" />
                טיוטת אימייל
              </div>
              <Input value={draftedEmail.subject} onChange={(e) => setDraftedEmail({ ...draftedEmail, subject: e.target.value })} className="text-sm" />
              <Textarea value={draftedEmail.body} onChange={(e) => setDraftedEmail({ ...draftedEmail, body: e.target.value })} rows={4} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyEmail} className="gap-1.5">
                  <Copy className="size-3.5" />
                  העתק
                </Button>
                {mailtoHref && (
                  <a
                    href={mailtoHref}
                    onClick={() => logSent("email")}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    <Mail className="size-3.5" />
                    שליחה באימייל
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>הערות ופעילות</Label>
            {activitiesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="py-2 text-center text-xs text-muted-foreground">אין עדיין הערות</div>
            ) : (
              <div className="space-y-1.5">
                {activities.map((a) => (
                  <div key={a.id} className="rounded-lg border p-2 text-xs">
                    <div>{a.content}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("he-IL")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="הוסף הערה..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                className="text-sm"
              />
              <Button size="icon" onClick={addNote} disabled={addingNote || !noteText.trim()}>
                {addingNote ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={remove} disabled={isPending}>
            <Trash2 className="size-3.5" />
            מחק ליד
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
