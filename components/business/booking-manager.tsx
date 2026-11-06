"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Save, Loader2, CalendarCheck, CalendarPlus, Check, X, Phone, Repeat,
  UserX, Plus, Mail, Clock3, Trash2, Link2, RefreshCw, Copy, Smartphone, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  saveBookingSettingsAction,
  setBookingStatusAction,
  setNoShowAction,
  cancelSeriesAction,
  createOwnerBookingAction,
  getOwnerAvailableSlotsAction,
} from "@/lib/actions/booking";
import { listBookingStaffAction } from "@/lib/actions/booking-staff";
import { listWaitlistAction, removeWaitlistEntryAction } from "@/lib/actions/booking-waitlist";
import { regenerateIcsFeedTokenAction } from "@/lib/actions/business-events";
import { BookingServicesManager } from "@/components/business/booking-services-manager";
import { DEFAULT_HOURS, type WeeklyHours } from "@/lib/booking-shared";
import type {
  Booking, BookingSettings, BookingService, BookingStaff, BookingWaitlistEntry,
} from "@/types/database";

const WAITLIST_STATUS_LABEL: Record<string, string> = {
  waiting: "ממתין", notified: "נשלחה הודעה", booked: "נקבע תור", cancelled: "בוטל",
};

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לאישור", confirmed: "מאושר", cancelled: "בוטל",
};
const STATUS_FILTERS = [
  { key: "all", label: "הכל" },
  { key: "pending", label: "ממתין" },
  { key: "confirmed", label: "מאושר" },
  { key: "cancelled", label: "בוטל" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

export function BookingManager({
  businessId,
  settings,
  bookings,
  services,
  hasLegacyServices,
}: {
  businessId: string;
  settings: BookingSettings | null;
  bookings: Booking[];
  services: BookingService[];
  hasLegacyServices: boolean;
}) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [autoConfirm, setAutoConfirm] = useState(settings?.auto_confirm ?? false);
  const [slotMinutes, setSlotMinutes] = useState(settings?.slot_minutes ?? 60);
  const [daysAhead, setDaysAhead] = useState(settings?.days_ahead ?? 14);
  const [hours, setHours] = useState<WeeklyHours>(
    (settings?.hours as WeeklyHours | null) ?? DEFAULT_HOURS,
  );
  const [bufferMinutes, setBufferMinutes] = useState(settings?.buffer_minutes ?? 0);
  const [minNoticeHours, setMinNoticeHours] = useState(settings?.min_notice_hours ?? 0);
  const [cancelNoticeHours, setCancelNoticeHours] = useState(settings?.cancel_notice_hours ?? 2);
  // Lifted here because StaffPersonalLinksCard and CalendarFeedCard both show
  // the SAME token: each used to keep its own `useState(initialToken)`, so
  // regenerating from one card left the other showing the stale value with no
  // "existing links will stop working" warning (its local `token` was still
  // null) — clicking it there silently invalidated the first card's links.
  const [icsToken, setIcsToken] = useState(settings?.ics_feed_token ?? null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showManualForm, setShowManualForm] = useState(false);
  // Captured once on mount (lazy initializer) — keeps render pure.
  const [todayStr] = useState(() => dateFmt.format(new Date()));
  const [nowMs] = useState(() => Date.now());

  function save(nextEnabled = enabled) {
    startTransition(async () => {
      const res = await saveBookingSettingsAction(businessId, {
        enabled: nextEnabled,
        auto_confirm: autoConfirm,
        slot_minutes: slotMinutes,
        days_ahead: daysAhead,
        hours,
        services: [], // legacy JSON list — real services live in booking_services now
        buffer_minutes: bufferMinutes,
        min_notice_hours: minNoticeHours,
        cancel_notice_hours: cancelNoticeHours,
      });
      if (res.error) toast.error(res.error);
      else {
        setEnabled(nextEnabled);
        toast.success(nextEnabled ? "קביעת תורים פעילה באתר ✓" : "ההגדרות נשמרו");
      }
    });
  }

  function setStatus(id: string, status: "confirmed" | "cancelled") {
    setBusyId(id);
    startTransition(async () => {
      const res = await setBookingStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      setBusyId(null);
    });
  }

  function toggleNoShow(b: Booking) {
    setBusyId(b.id);
    startTransition(async () => {
      const res = await setNoShowAction(businessId, b.id, !b.no_show);
      if (res.error) toast.error(res.error);
      setBusyId(null);
    });
  }

  function cancelSeries(recurrenceGroup: string) {
    if (!confirm("לבטל את כל התורים העתידיים בסדרה הזו?")) return;
    setBusyId(recurrenceGroup);
    startTransition(async () => {
      const res = await cancelSeriesAction(businessId, recurrenceGroup);
      if (res.error) toast.error(res.error);
      else toast.success(`בוטלו ${res.cancelled ?? 0} תורים בסדרה`);
      setBusyId(null);
    });
  }

  const filteredBookings = bookings.filter(
    (b) => statusFilter === "all" || b.status === statusFilter,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Settings */}
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">הגדרות יומן</div>
              <Badge className={enabled ? "bg-green-600" : ""} variant={enabled ? "default" : "outline"}>
                {enabled ? "פעיל באתר" : "כבוי"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">אורך תור ברירת מחדל</label>
                <Select value={String(slotMinutes)} onValueChange={(v) => setSlotMinutes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 90, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} דקות</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ימים קדימה</label>
                <Input type="number" min={1} max={60} value={daysAhead}
                  onChange={(e) => setDaysAhead(Number(e.target.value) || 14)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">זמן חיץ בין תורים</label>
                <Select value={String(bufferMinutes)} onValueChange={(v) => setBufferMinutes(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m === 0 ? "ללא" : `${m} דק'`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">הודעה מוקדמת מינ&apos;</label>
                <Select value={String(minNoticeHours)} onValueChange={(v) => setMinNoticeHours(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 4, 12, 24].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h === 0 ? "ללא" : `${h} שעות`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">חלון ביטול לקוח</label>
                <Select value={String(cancelNoticeHours)} onValueChange={(v) => setCancelNoticeHours(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 4, 12, 24].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h} שעות</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span className="text-sm">
                <span className="font-medium">אישור תורים אוטומטי</span>
                <span className="block text-xs text-muted-foreground">
                  הלקוח קובע תור והוא מאושר מיד — בלי צורך באישור ידני שלך. מומלץ לעסקים עם יומן פתוח.
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">שעות פעילות (עם הפסקה אופציונלית)</label>
              {DAY_NAMES.map((name, i) => {
                const key = String(i);
                const day = hours[key];
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setHours((h) => ({
                          ...h,
                          [key]: h[key] ? null : { open: "09:00", close: "18:00" },
                        }))
                      }
                      className={`w-16 shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
                        day ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {name}
                    </button>
                    {day ? (
                      <>
                        <Input type="time" value={day.open} className="h-8 w-26 text-xs"
                          onChange={(e) => setHours((h) => ({ ...h, [key]: { ...day, open: e.target.value } }))} />
                        <span className="text-muted-foreground">עד</span>
                        <Input type="time" value={day.close} className="h-8 w-26 text-xs"
                          onChange={(e) => setHours((h) => ({ ...h, [key]: { ...day, close: e.target.value } }))} />
                        <span className="mx-1 text-muted-foreground">|</span>
                        <span className="text-[11px] text-muted-foreground">הפסקה:</span>
                        <Input type="time" value={day.breakFrom ?? ""} placeholder="--:--" className="h-8 w-24 text-xs"
                          onChange={(e) => setHours((h) => ({ ...h, [key]: { ...day, breakFrom: e.target.value || undefined } }))} />
                        <span className="text-muted-foreground">עד</span>
                        <Input type="time" value={day.breakTo ?? ""} placeholder="--:--" className="h-8 w-24 text-xs"
                          onChange={(e) => setHours((h) => ({ ...h, [key]: { ...day, breakTo: e.target.value || undefined } }))} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">סגור</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save()} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                שמור
              </Button>
              {enabled ? (
                <Button variant="destructive" onClick={() => save(false)} disabled={isPending}>
                  כבה באתר
                </Button>
              ) : (
                <Button onClick={() => save(true)} disabled={isPending} className="gap-1.5">
                  <CalendarCheck className="size-4" />
                  הפעל באתר
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <BookingServicesManager
          businessId={businessId}
          initialServices={services}
          hasLegacyServices={hasLegacyServices}
        />

        <StaffPersonalLinksCard businessId={businessId} token={icsToken} onToken={setIcsToken} />

        <CalendarFeedCard businessId={businessId} token={icsToken} onToken={setIcsToken} />

        <WaitlistPanel businessId={businessId} services={services} />
      </div>

      {/* Bookings list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">תורים קרובים ({bookings.length})</div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/businesses/${businessId}/bookings/ics`}
              download="bookings.ics"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <CalendarPlus className="size-3.5" />
              ייצוא ליומן (ICS)
            </a>
            <Button size="sm" className="gap-1.5" onClick={() => setShowManualForm((v) => !v)}>
              <Plus className="size-3.5" />
              הוספת תור ידני
            </Button>
          </div>
        </div>

        {showManualForm && (
          <ManualBookingForm
            businessId={businessId}
            services={services}
            defaultSlotMinutes={slotMinutes}
            onClose={() => setShowManualForm(false)}
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {bookings.length === 0
                ? "עדיין אין תורים — ברגע שלקוח יקבע באתר, התור יופיע כאן"
                : "אין תורים בסינון הנוכחי"}
            </CardContent>
          </Card>
        ) : (
          filteredBookings.map((b) => {
            const isPast = dateFmt.format(new Date(b.starts_at)) < todayStr
              || new Date(b.starts_at).getTime() < nowMs;
            return (
              <Card key={b.id} className={b.status === "cancelled" ? "opacity-50" : ""}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.customer_name}</span>
                      <Badge
                        variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "outline" : "secondary"}
                        className={`text-[10px] ${b.status === "confirmed" ? "bg-green-600" : ""}`}
                      >
                        {STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                      {b.recurrence && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Repeat className="size-2.5" /> סדרה
                        </Badge>
                      )}
                      {b.no_show && (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                          <UserX className="size-2.5" /> לא הגיע
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {new Date(b.starts_at).toLocaleString("he-IL", {
                        timeZone: "Asia/Jerusalem",
                        weekday: "short", day: "numeric", month: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {b.duration_minutes && ` · ${b.duration_minutes} דק'`}
                      {b.service && ` · ${b.service}`}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3">
                      <a href={`tel:${b.customer_phone}`} dir="ltr"
                        className="inline-flex items-center gap-1 text-xs text-primary">
                        <Phone className="size-3" />
                        {b.customer_phone}
                      </a>
                      {b.customer_email && (
                        <span dir="ltr" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="size-3" />
                          {b.customer_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      {b.status === "pending" && (
                        <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => setStatus(b.id, "confirmed")} disabled={busyId === b.id}>
                          <Check className="size-3.5" /> אשר
                        </Button>
                      )}
                      {b.status !== "cancelled" && (
                        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-destructive"
                          onClick={() => setStatus(b.id, "cancelled")} disabled={busyId === b.id}>
                          <X className="size-3.5" /> בטל
                        </Button>
                      )}
                    </div>
                    {isPast && b.status !== "cancelled" && (
                      <Button
                        variant={b.no_show ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        onClick={() => toggleNoShow(b)}
                        disabled={busyId === b.id}
                      >
                        <UserX className="size-3" />
                        {b.no_show ? "בוטל סימון" : "לא הגיע"}
                      </Button>
                    )}
                    {b.recurrence && b.recurrence_group && b.status !== "cancelled" && (
                      <Button
                        variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => cancelSeries(b.recurrence_group!)}
                        disabled={busyId === b.recurrence_group}
                      >
                        <Repeat className="size-3" />
                        ביטול הסדרה
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function ManualBookingForm({
  businessId,
  services,
  defaultSlotMinutes,
  onClose,
}: {
  businessId: string;
  services: BookingService[];
  defaultSlotMinutes: number;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>("none");
  const [staffId, setStaffId] = useState<string>("none");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Staff list — client-fetch-then-set on mount, mirroring the established
  // pattern (async call kicked off from the effect; state lands in .then()).
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  useEffect(() => {
    let active = true;
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) return; // silent — staff select just stays hidden
      setStaff(res.staff ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  function fetchSlots(nextDate: string, nextServiceId: string) {
    setTime(null);
    setSlots(null);
    if (!nextDate) return;
    setLoadingSlots(true);
    startTransition(async () => {
      const res = await getOwnerAvailableSlotsAction(
        businessId, nextDate, nextServiceId === "none" ? null : nextServiceId,
      );
      if (res.error) toast.error(res.error);
      setSlots(res.slots ?? []);
      setLoadingSlots(false);
    });
  }

  function submit() {
    if (!date || !time || name.trim().length < 2 || phone.replace(/\D/g, "").length < 9) {
      toast.error("נא למלא תאריך, שעה, שם וטלפון תקינים");
      return;
    }
    startTransition(async () => {
      const res = await createOwnerBookingAction(businessId, {
        date,
        time,
        serviceId: serviceId === "none" ? null : serviceId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        staffId: staffId === "none" ? null : staffId,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("התור נוסף ואושר");
      setDate(""); setTime(null); setName(""); setPhone(""); setEmail(""); setServiceId("none"); setStaffId("none"); setSlots(null);
      onClose();
    });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">הוספת תור ידני (הגעה/טלפון)</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">תאריך</Label>
            <Input
              type="date" value={date} className="h-9"
              onChange={(e) => { setDate(e.target.value); fetchSlots(e.target.value, serviceId); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">שירות</Label>
            <Select value={serviceId} onValueChange={(v) => { const next = v ?? "none"; setServiceId(next); fetchSlots(date, next); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">כללי ({defaultSlotMinutes} דק&apos;)</SelectItem>
                {services.filter((s) => s.active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes} דק&apos;)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {staff.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">איש/אשת צוות</Label>
            <Select value={staffId} onValueChange={(v) => setStaffId(v ?? "none")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {staff.filter((s) => s.active).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {date && (
          <div className="space-y-1.5">
            <Label className="text-xs">שעה</Label>
            {loadingSlots ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> טוען זמנים פנויים…
              </p>
            ) : slots && slots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      time === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">אין זמנים פנויים בתאריך זה</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Input placeholder="שם מלא *" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          <Input placeholder="טלפון *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9" dir="ltr" />
          <Input placeholder="אימייל (אופציונלי)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" dir="ltr" />
        </div>
        <Button size="sm" className="gap-1.5" onClick={submit} disabled={isPending || !time}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          הוספה ואישור התור
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Recommended calendar option: a per-staff read-only web page
 * (/staff-cal/[token]?staff=<id>) — no Google/Outlook account or working ICS
 * subscription needed. Reuses the same ics_feed_token as CalendarFeedCard
 * below, just under a different, simpler URL shape.
 */
function StaffPersonalLinksCard({
  businessId,
  token,
  onToken,
}: {
  businessId: string;
  /** Shared with CalendarFeedCard — both cards show the same underlying token. */
  token: string | null;
  onToken: (token: string | null) => void;
}) {
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [origin, setOrigin] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    let active = true;
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (!res.error) setStaff(res.staff ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  function copy(url: string) {
    void navigator.clipboard.writeText(url).then(() => toast.success("הקישור הועתק"));
  }

  function regenerate() {
    if (token && !confirm("קישורי היומן האישיים הקיימים יפסיקו לעבוד לאחר יצירת קישור חדש. להמשיך?")) return;
    setRegenerating(true);
    startTransition(async () => {
      const res = await regenerateIcsFeedTokenAction(businessId);
      setRegenerating(false);
      if (res.error) toast.error(res.error);
      else {
        onToken(res.token ?? null);
        toast.success("נוצר קישור חדש ✓");
      }
    });
  }

  const activeStaff = staff.filter((s) => s.active);
  const personalUrl = (staffId: string) => `${origin}/staff-cal/${token}?staff=${staffId}`;

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
          <Smartphone className="size-4 text-primary" />
          יומן אישי לכל עובד
          <Badge className="border-primary/30 bg-primary/10 text-[10px] text-primary" variant="outline">מומלץ</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          קישור אישי לצפייה בלבד — נפתח בנייד/בדפדפן, בלי צורך בחיבור ל-Google. כל איש/אשת צוות רואה רק את התורים שלו/ה
          ל-14 הימים הקרובים. זו האלטרנטיבה האמינה במקום מנוי ICS שלא הצליח להתחבר.
        </p>

        {!token ? (
          <Button size="sm" className="gap-1.5" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
            יצירת קישורים
          </Button>
        ) : activeStaff.length === 0 ? (
          <p className="text-xs text-muted-foreground">הוסיפו אנשי צוות פעילים (בכרטיסיית הצוות) כדי לקבל קישור אישי לכל אחד.</p>
        ) : (
          <div className="space-y-1.5">
            {activeStaff.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-2.5 text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="inline-block size-2 rounded-full" style={{ background: s.color || "#a1a1aa" }} />
                  {s.name}
                </span>
                <div className="flex gap-1">
                  <a
                    href={personalUrl(s.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 gap-1 px-2 text-[11px]")}
                  >
                    <ExternalLink className="size-3" /> פתיחה
                  </a>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => copy(personalUrl(s.id))}>
                    <Copy className="size-3" /> העתקה
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Copyable webcal:// + https live-calendar subscription links (business-wide + per-staff). */
function CalendarFeedCard({
  businessId,
  token,
  onToken,
}: {
  businessId: string;
  /** Shared with StaffPersonalLinksCard — both cards show the same underlying token. */
  token: string | null;
  onToken: (token: string | null) => void;
}) {
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [origin, setOrigin] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    let active = true;
     
    listBookingStaffAction(businessId).then((res) => {
      if (!active) return;
      if (!res.error) setStaff(res.staff ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  function copy(url: string) {
    void navigator.clipboard.writeText(url).then(() => toast.success("הקישור הועתק"));
  }

  function regenerate() {
    // Confirm only when replacing an existing link — first-time creation is harmless.
    if (token && !confirm("קישורי היומן הקיימים יפסיקו לעבוד לאחר יצירת קישור חדש. להמשיך?")) return;
    setRegenerating(true);
    startTransition(async () => {
      const res = await regenerateIcsFeedTokenAction(businessId);
      setRegenerating(false);
      if (res.error) toast.error(res.error);
      else {
        onToken(res.token ?? null);
        toast.success("נוצר קישור חדש ✓");
      }
    });
  }

  function feedUrls(staffId?: string): { https: string; webcal: string } {
    const path = `/api/businesses/${businessId}/bookings/feed/${token}${staffId ? `?staff=${staffId}` : ""}`;
    return { https: `${origin}${path}`, webcal: `${origin.replace(/^https?:/, "webcal:")}${path}` };
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-1.5 font-semibold">
          <Link2 className="size-4 text-primary" />
          חיבור ליומן חיצוני (Google/Outlook)
        </div>
        {!token ? (
          <>
            <p className="text-xs text-muted-foreground">
              צרו קישור מנוי אישי — מוסיפים אותו כ&quot;יומן מנוי&quot; ב-Google Calendar / Outlook,
              והתורים והאירועים יופיעו שם ויתעדכנו אוטומטית. אם החיבור לא מצליח, השתמשו בקישור האישי למעלה — הוא לא דורש חשבון Google.
            </p>
            <Button size="sm" className="gap-1.5" onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
              צור קישור חיבור
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              הוסיפו את הקישור כ&quot;יומן מנוי&quot; ב-Google Calendar / Outlook — התורים והאירועים יופיעו שם ויתעדכנו אוטומטית.
              לא הצליח להתחבר? השתמשו בקישור האישי למעלה במקום.
            </p>
            <div className="space-y-1.5">
              <FeedRow label="כל היומן" urls={feedUrls()} onCopy={copy} />
              {staff.filter((s) => s.active).map((s) => (
                <FeedRow key={s.id} label={s.name} urls={feedUrls(s.id)} onCopy={copy} />
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={regenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              יצירת קישור חדש
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FeedRow({
  label,
  urls,
  onCopy,
}: {
  label: string;
  urls: { https: string; webcal: string };
  onCopy: (url: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
      <span className="font-medium">{label}</span>
      <div className="flex gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onCopy(urls.webcal)}>
          <Copy className="size-3" /> webcal
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onCopy(urls.https)}>
          <Copy className="size-3" /> https
        </Button>
      </div>
    </div>
  );
}

function WaitlistPanel({
  businessId,
  services,
}: {
  businessId: string;
  services: BookingService[];
}) {
  const [entries, setEntries] = useState<BookingWaitlistEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Client-fetch-then-set on mount — mirrors the established pattern (async
  // call kicked off from the effect; state lands in its own .then()).
  useEffect(() => {
    let active = true;
     
    listWaitlistAction(businessId).then((res) => {
      if (!active) return;
      if (res.error) { toast.error(res.error); return; }
      setEntries(res.entries ?? []);
    });
    return () => { active = false; };
  }, [businessId]);

  function remove(entryId: string) {
    setBusyId(entryId);
    startTransition(async () => {
      const res = await removeWaitlistEntryAction(businessId, entryId);
      if (res.error) toast.error(res.error);
      else setEntries((prev) => (prev ?? []).filter((e) => e.id !== entryId));
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-1.5 font-semibold">
          <Clock3 className="size-4 text-primary" />
          רשימת המתנה
        </div>

        {entries === null ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> טוען…
          </p>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            אין ממתינים כרגע
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => {
              const serviceName = entry.service_id
                ? services.find((s) => s.id === entry.service_id)?.name ?? "שירות"
                : "כל שירות";
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{entry.customer_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {WAITLIST_STATUS_LABEL[entry.status] ?? entry.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {entry.date} · {serviceName}
                    </div>
                    <a href={`tel:${entry.customer_phone}`} dir="ltr" className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary">
                      <Phone className="size-3" />
                      {entry.customer_phone}
                    </a>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(entry.id)} disabled={busyId === entry.id}
                  >
                    {busyId === entry.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
