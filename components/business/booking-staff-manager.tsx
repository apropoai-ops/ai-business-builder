"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Plus, Loader2, Pencil, Trash2, X, Check, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  listBookingStaffAction,
  createBookingStaffAction,
  updateBookingStaffAction,
  deleteBookingStaffAction,
  setStaffServicesAction,
} from "@/lib/actions/booking-staff";
import { listBookingServicesAction } from "@/lib/actions/booking-services";
import { DEFAULT_HOURS, type WeeklyHours } from "@/lib/booking-shared";
import type { BookingStaff, BookingService } from "@/types/database";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** Fixed palette of pleasant colors for the color-dot picker. */
const STAFF_COLORS = [
  "#2563EB", "#16A34A", "#DC2626", "#D97706",
  "#7C3AED", "#DB2777", "#0891B2", "#78716C",
];

type Draft = { name: string; roleTitle: string; color: string | null };
const EMPTY_DRAFT: Draft = { name: "", roleTitle: "", color: STAFF_COLORS[0] };

/** Per-staff editor draft: weekly hours + service assignment, opened on demand. */
type EditorDraft = {
  id: string;
  inherit: boolean;
  hours: WeeklyHours;
  serviceIds: string[];
  /**
   * Explicit, not inferred from `serviceIds.length === 0`. The storage layer
   * (lib/services/booking-staff.service.ts) treats zero rows as "offers ALL
   * services" — so inferring the checkbox from length meant unchecking a
   * staff member's last remaining service flipped them to offering every
   * service in the catalog, the opposite of what the click meant. This mode
   * is what actually decides what gets saved; see saveEditor.
   */
  serviceMode: "all" | "specific";
  email: string;
  phone: string;
};

export function BookingStaffManager({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<BookingStaff[]>([]);
  const [staffServices, setStaffServices] = useState<Record<string, string[]>>({});
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    const [staffRes, servicesRes] = await Promise.all([
      listBookingStaffAction(businessId),
      listBookingServicesAction(businessId),
    ]);
    if (staffRes.error) toast.error(staffRes.error);
    setStaff(staffRes.staff);
    setStaffServices(staffRes.staffServices);
    if (servicesRes.services) setServices(servicesRes.services);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    // Loads staff + services once on mount. setState only happens inside the
    // async callback (after the network round-trip), never synchronously
    // during render — mirrors the accepted pattern in generation-watcher.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function submitAdd() {
    const name = draft.name.trim();
    if (name.length < 2) {
      toast.error("שם איש הצוות חייב להיות באורך 2 תווים לפחות");
      return;
    }
    startTransition(async () => {
      const res = await createBookingStaffAction(businessId, {
        name,
        roleTitle: draft.roleTitle.trim() || undefined,
        color: draft.color ?? undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("איש הצוות נוסף");
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      await load();
    });
  }

  function toggleActive(s: BookingStaff) {
    setBusyId(s.id);
    startTransition(async () => {
      const res = await updateBookingStaffAction(businessId, s.id, { active: !s.active });
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
    });
  }

  function remove(s: BookingStaff) {
    if (!confirm(`למחוק את "${s.name}" מאנשי הצוות?`)) return;
    setBusyId(s.id);
    startTransition(async () => {
      const res = await deleteBookingStaffAction(businessId, s.id);
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStaff((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("איש הצוות נמחק");
    });
  }

  function toggleExpand(s: BookingStaff) {
    if (editor?.id === s.id) {
      setEditor(null);
      return;
    }
    const initialServiceIds = staffServices[s.id] ?? [];
    setEditor({
      id: s.id,
      inherit: s.hours == null,
      hours: (s.hours as WeeklyHours | null) ?? DEFAULT_HOURS,
      serviceIds: initialServiceIds,
      serviceMode: initialServiceIds.length === 0 ? "all" : "specific",
      email: s.email ?? "",
      phone: s.phone ?? "",
    });
  }

  function saveEditor() {
    if (!editor) return;
    // A "specific" selection with nothing checked means "offers nothing" — not
    // representable in storage (zero rows there means "all"), so this must
    // block rather than silently save as "all services".
    if (editor.serviceMode === "specific" && editor.serviceIds.length === 0) {
      toast.error("יש לבחור לפחות שירות אחד, או לסמן \"כל השירותים\"");
      return;
    }
    setBusyId(editor.id);
    startTransition(async () => {
      const hoursRes = await updateBookingStaffAction(businessId, editor.id, {
        hours: editor.inherit ? null : editor.hours,
        email: editor.email.trim() || null,
        phone: editor.phone.trim() || null,
      });
      if (hoursRes.error) {
        toast.error(hoursRes.error);
        setBusyId(null);
        return;
      }
      // "all" always saves as [] regardless of what serviceIds happens to hold,
      // so leftover checkbox state from a mode switch can never leak through.
      const idsToSave = editor.serviceMode === "all" ? [] : editor.serviceIds;
      const servicesRes = await setStaffServicesAction(businessId, editor.id, idsToSave);
      setBusyId(null);
      if (servicesRes.error) {
        toast.error(servicesRes.error);
        return;
      }
      toast.success("ההגדרות נשמרו");
      setEditor(null);
      await load();
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          טוען אנשי צוות…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold">
            <Users className="size-4 text-primary" />
            אנשי הצוות שלי
          </div>
          {!adding && (
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />
              הוספת איש צוות
            </Button>
          )}
        </div>

        {adding && (
          <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-36 flex-1 space-y-1">
                <Label className="text-xs">שם</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="לדוגמה: דנה כהן"
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="min-w-36 flex-1 space-y-1">
                <Label className="text-xs">תפקיד (אופציונלי)</Label>
                <Input
                  value={draft.roleTitle}
                  onChange={(e) => setDraft((d) => ({ ...d, roleTitle: e.target.value }))}
                  placeholder="לדוגמה: מעצבת שיער"
                  maxLength={80}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">צבע</Label>
              <div className="flex flex-wrap gap-1.5">
                {STAFF_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, color: hex }))}
                    className={`flex size-7 items-center justify-center rounded-full border-2 ${
                      draft.color === hex ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  >
                    {draft.color === hex && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" className="h-9 gap-1" onClick={submitAdd} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                שמירה
              </Button>
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {staff.length === 0 && !adding ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            עדיין אין אנשי צוות — הוסיפו כדי לאפשר קביעת תורים במקביל אצל כמה נותני שירות
          </div>
        ) : (
          <div className="space-y-1.5">
            {staff.map((s) => {
              const isExpanded = editor?.id === s.id;
              return (
                <div key={s.id} className={`rounded-lg border ${s.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-3 p-3 text-sm">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color ?? "#9CA3AF" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.name}</div>
                      {s.role_title && <div className="text-xs text-muted-foreground">{s.role_title}</div>}
                    </div>
                    <Switch
                      checked={s.active}
                      onCheckedChange={() => toggleActive(s)}
                      disabled={busyId === s.id}
                    />
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => toggleExpand(s)} disabled={busyId === s.id}>
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(s)} disabled={busyId === s.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {isExpanded && editor && (
                    <div className="space-y-4 border-t p-3">
                      {/* Weekly hours */}
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editor.inherit}
                            onChange={(e) =>
                              setEditor((prev) => prev && { ...prev, inherit: e.target.checked })
                            }
                            className="size-4"
                          />
                          <span>
                            <Pencil className="mx-1 inline size-3 text-muted-foreground" />
                            ירושה משעות העסק
                          </span>
                        </label>

                        {editor.inherit ? (
                          <div className="text-xs text-muted-foreground">
                            איש הצוות פועל לפי שעות הפעילות הכלליות של העסק.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">שעות פעילות אישיות (עם הפסקה אופציונלית)</label>
                            {DAY_NAMES.map((name, i) => {
                              const key = String(i);
                              const day = editor.hours[key];
                              return (
                                <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditor((prev) =>
                                        prev && {
                                          ...prev,
                                          hours: {
                                            ...prev.hours,
                                            [key]: prev.hours[key] ? null : { open: "09:00", close: "18:00" },
                                          },
                                        },
                                      )
                                    }
                                    className={`w-16 shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
                                      day ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                                    }`}
                                  >
                                    {name}
                                  </button>
                                  {day ? (
                                    <>
                                      <Input
                                        type="time" value={day.open} className="h-8 w-26 text-xs"
                                        onChange={(e) =>
                                          setEditor((prev) =>
                                            prev && { ...prev, hours: { ...prev.hours, [key]: { ...day, open: e.target.value } } },
                                          )
                                        }
                                      />
                                      <span className="text-muted-foreground">עד</span>
                                      <Input
                                        type="time" value={day.close} className="h-8 w-26 text-xs"
                                        onChange={(e) =>
                                          setEditor((prev) =>
                                            prev && { ...prev, hours: { ...prev.hours, [key]: { ...day, close: e.target.value } } },
                                          )
                                        }
                                      />
                                      <span className="mx-1 text-muted-foreground">|</span>
                                      <span className="text-[11px] text-muted-foreground">הפסקה:</span>
                                      <Input
                                        type="time" value={day.breakFrom ?? ""} placeholder="--:--" className="h-8 w-24 text-xs"
                                        onChange={(e) =>
                                          setEditor((prev) =>
                                            prev && {
                                              ...prev,
                                              hours: { ...prev.hours, [key]: { ...day, breakFrom: e.target.value || undefined } },
                                            },
                                          )
                                        }
                                      />
                                      <span className="text-muted-foreground">עד</span>
                                      <Input
                                        type="time" value={day.breakTo ?? ""} placeholder="--:--" className="h-8 w-24 text-xs"
                                        onChange={(e) =>
                                          setEditor((prev) =>
                                            prev && {
                                              ...prev,
                                              hours: { ...prev.hours, [key]: { ...day, breakTo: e.target.value || undefined } },
                                            },
                                          )
                                        }
                                      />
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">סגור</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Contact — enables SMS/email alerts on new bookings */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">פרטי קשר להתראות</label>
                        <div className="flex flex-wrap gap-2">
                          <div className="min-w-40 flex-1 space-y-1">
                            <Label className="text-xs">אימייל (אופציונלי)</Label>
                            <Input
                              type="email"
                              dir="ltr"
                              value={editor.email}
                              onChange={(e) => setEditor((prev) => prev && { ...prev, email: e.target.value })}
                              placeholder="name@example.com"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="min-w-40 flex-1 space-y-1">
                            <Label className="text-xs">טלפון (אופציונלי)</Label>
                            <Input
                              type="tel"
                              dir="ltr"
                              value={editor.phone}
                              onChange={(e) => setEditor((prev) => prev && { ...prev, phone: e.target.value })}
                              placeholder="050-1234567"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          מילוי השדות מאפשר לאיש הצוות לקבל SMS/אימייל כשלקוח קובע אצלו תור.
                        </div>
                      </div>

                      {/* Service assignment */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">שירותים שאיש הצוות מציע</label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editor.serviceMode === "all"}
                            onChange={(e) =>
                              setEditor((prev) => {
                                if (!prev) return prev;
                                // Switching TO "specific" starts from everything
                                // checked, matching what "כל השירותים" just meant —
                                // never an empty grid the owner has to rebuild
                                // service-by-service.
                                if (e.target.checked) return { ...prev, serviceMode: "all" };
                                return {
                                  ...prev,
                                  serviceMode: "specific",
                                  serviceIds: services.map((sv) => sv.id),
                                };
                              })
                            }
                            className="size-4"
                          />
                          כל השירותים
                        </label>
                        {editor.serviceMode === "all" ? null : (
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {services.map((sv) => (
                              <label key={sv.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editor.serviceIds.includes(sv.id)}
                                  onChange={(e) =>
                                    setEditor((prev) => {
                                      if (!prev) return prev;
                                      const next = e.target.checked
                                        ? [...prev.serviceIds, sv.id]
                                        : prev.serviceIds.filter((id) => id !== sv.id);
                                      return { ...prev, serviceIds: next };
                                    })
                                  }
                                  className="size-4"
                                />
                                {sv.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-9 gap-1" onClick={saveEditor} disabled={busyId === editor.id}>
                          {busyId === editor.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          שמירה
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9" onClick={() => setEditor(null)}>
                          <X className="size-3.5" />
                          ביטול
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
