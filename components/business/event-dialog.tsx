"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createBusinessEventAction,
  updateBusinessEventAction,
  deleteBusinessEventAction,
} from "@/lib/actions/business-events";
import type { BookingStaff, BusinessEvent } from "@/types/database";

const TZ = "Asia/Jerusalem";
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** Open state for <EventDialog>: null = closed, editing = existing event, otherwise a prefilled "new event" form. */
export type EventDialogState =
  | { editing: BusinessEvent; date?: undefined; startTime?: undefined }
  | { editing: null; date: string; startTime?: string }
  | null;

/**
 * Shared create/edit/delete dialog for internal calendar events
 * (business_events), used from both the week and month booking views.
 */
export function EventDialog({
  businessId,
  staff,
  state,
  onClose,
  onSaved,
}: {
  businessId: string;
  staff: BookingStaff[];
  state: EventDialogState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [staffId, setStaffId] = useState("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  // Re-seed the form whenever the dialog is (re)opened for a different
  // event/slot — state adjustment during render (the React-sanctioned
  // alternative to a sync setState inside an effect).
  const [seededFor, setSeededFor] = useState<EventDialogState>(null);
  if (state !== seededFor) {
    setSeededFor(state);
    if (state) {
      if (state.editing) {
        const ev = state.editing;
        setTitle(ev.title);
        setDate(dateFmt.format(new Date(ev.starts_at)));
        setStartTime(hmFmt.format(new Date(ev.starts_at)));
        setEndTime(hmFmt.format(new Date(ev.ends_at)));
        setStaffId(ev.staff_id ?? "none");
        setNotes(ev.notes ?? "");
      } else {
        setTitle("");
        setDate(state.date);
        setStartTime(state.startTime ?? "09:00");
        setEndTime("10:00");
        setStaffId("none");
        setNotes("");
      }
    }
  }

  function submit() {
    if (!title.trim() || !date) {
      toast.error("נא למלא כותרת ותאריך");
      return;
    }
    setSaving(true);
    startTransition(async () => {
      const input = {
        title: title.trim(),
        date,
        startTime,
        endTime,
        staffId: staffId === "none" ? null : staffId,
        notes: notes.trim() || null,
      };
      const res = state?.editing
        ? await updateBusinessEventAction(businessId, state.editing.id, input)
        : await createBusinessEventAction(businessId, input);
      setSaving(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(state?.editing ? "האירוע עודכן ✓" : "האירוע נוסף ✓");
      onSaved();
    });
  }

  function remove() {
    if (!state?.editing) return;
    const eventId = state.editing.id;
    setSaving(true);
    startTransition(async () => {
      const res = await deleteBusinessEventAction(businessId, eventId);
      setSaving(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("האירוע נמחק");
      onSaved();
    });
  }

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {state && (
          <>
            <DialogHeader>
              <DialogTitle>{state.editing ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">כותרת</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="פגישה אישית, חופשה..." />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">תאריך</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">משעה</Label>
                  <Input type="time" dir="ltr" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">עד שעה</Label>
                  <Input type="time" dir="ltr" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              {staff.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">איש/אשת צוות (אופציונלי)</Label>
                  <Select value={staffId} onValueChange={(v) => setStaffId(v ?? "none")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">כללי (לא משויך)</SelectItem>
                      {staff.filter((s) => s.active).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">הערות (אופציונלי)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              {state.editing ? (
                <Button variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={remove} disabled={saving}>
                  <Trash2 className="size-3.5" /> מחיקה
                </Button>
              ) : <span />}
              <Button onClick={submit} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                שמירה
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
