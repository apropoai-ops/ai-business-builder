"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus, Loader2, Search, Ban, X, CalendarCheck, Users, Phone, Mail,
  BedDouble, Banknote, Clock, History,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  RentalCalendar, type CalendarView,
} from "@/components/business/rentals/rental-calendar";
import {
  BOOKING_STATUS_FLOW, BOOKING_STATUS_LABEL, RENTAL_STATUS_META,
  addDays, nightsBetween, rentalTotal, todayIL,
} from "@/lib/rentals";
import {
  blockUnitAction, cancelBookingAction, checkAvailabilityAction,
  createBookingAction, updateBookingAction,
} from "@/lib/actions/rentals-pms";
import type { PmsBooking, PmsStats, PmsUnit } from "@/lib/services/rentals-pms.service";
import type { RentalBookingStatus, RentalUnitType } from "@/types/database";

type AvailableUnit = {
  id: string; name: string; code: string | null; image: string | null;
  typeName: string | null; maxGuests: number; nightly: number; total: number; amenities: string[];
};

/**
 * "לוח לילות" — the whole management surface in one screen (§21).
 *
 * The screen is deliberately flat: stats, filters, board. An owner opens it,
 * sees what is free tonight, clicks an empty night and is three fields away
 * from a confirmed booking. No wizard to walk, no sub-screen to find.
 *
 * Every mutation here is optimistic about NOTHING. The forms propose, the
 * server actions re-validate, and the database's exclusion constraint decides
 * — so the worst case for a race is an honest "those dates are taken" toast,
 * never a double-sold room.
 */
export function RentalBoard({
  businessId,
  units,
  unitTypes,
  bookings,
  stats,
  initialAnchor,
}: {
  businessId: string;
  units: PmsUnit[];
  unitTypes: RentalUnitType[];
  bookings: PmsBooking[];
  stats: PmsStats;
  initialAnchor: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIL();

  const [anchor, setAnchor] = useState(initialAnchor);
  const [view, setView] = useState<CalendarView>("month");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const [detail, setDetail] = useState<PmsBooking | null>(null);
  const [quick, setQuick] = useState<{ unitId?: string; checkIn: string } | null>(null);

  const visibleUnits = useMemo(
    () =>
      units.filter(
        (u) =>
          (typeFilter === "all" || u.unit_type_id === typeFilter) &&
          (unitFilter === "all" || u.id === unitFilter),
      ),
    [units, typeFilter, unitFilter],
  );

  /**
   * Unit-scoped but NOT search-filtered — this is what occupancy must be
   * built from, so a search never frees up a night that's actually taken.
   */
  const visibleBookings = useMemo(() => {
    const unitIds = new Set(visibleUnits.map((u) => u.id));
    return bookings.filter((b) => unitIds.has(b.unit_id));
  }, [bookings, visibleUnits]);

  /** Search only narrows which bars are highlighted, never what's occupied. */
  const matchedIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      visibleBookings
        .filter(
          (b) =>
            b.guest_name?.toLowerCase().includes(q) ||
            b.guest_phone?.includes(q) ||
            String(b.booking_no) === q,
        )
        .map((b) => b.id),
    );
  }, [visibleBookings, query]);

  /**
   * The server derives its loaded window from `?m=`, so paging the client-side
   * anchor without pushing it into the URL leaves `bookings` stale for any
   * month outside the range fetched on initial load.
   */
  function handleAnchorChange(next: string) {
    setAnchor(next);
    router.replace(`${pathname}?m=${next.slice(0, 7)}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <StatsRow stats={stats} />

      {/* Filters + the one action that matters (§22) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש: שם אורח, טלפון או מספר הזמנה"
            className="pe-9"
          />
        </div>

        {unitTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">כל הסוגים</option>
            {unitTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="h-9 max-w-[180px] rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">כל היחידות</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <Button className="gap-1.5" onClick={() => setQuick({ checkIn: today })}>
          <Plus className="size-4" />
          הזמנה חדשה
        </Button>
      </div>

      <RentalCalendar
        units={visibleUnits}
        bookings={visibleBookings}
        matchedIds={matchedIds}
        anchor={anchor}
        view={view}
        onAnchorChange={handleAnchorChange}
        onViewChange={setView}
        onSelectBooking={setDetail}
        onSelectCell={(unit, date) => setQuick({ unitId: unit.id, checkIn: date })}
      />

      {detail && (
        <BookingDetail
          businessId={businessId}
          booking={detail}
          units={units}
          onClose={() => setDetail(null)}
          onDone={() => { setDetail(null); router.refresh(); }}
        />
      )}

      {quick && (
        <QuickBooking
          businessId={businessId}
          units={units}
          initial={quick}
          onClose={() => setQuick(null)}
          onDone={() => { setQuick(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ── Dashboard tiles (§13) ─────────────────────────────────────────────────── */

function StatsRow({ stats }: { stats: PmsStats }) {
  const tiles = [
    { label: "כניסות היום", value: stats.arrivalsToday, tone: "text-emerald-600" },
    { label: "יציאות היום", value: stats.departuresToday, tone: "text-sky-600" },
    { label: "מאוכלסות הלילה", value: stats.staying, tone: "text-rose-600" },
    { label: "פנויות הלילה", value: stats.freeTonight, tone: "text-emerald-600" },
    { label: "ממתינות לאישור", value: stats.pending, tone: "text-amber-600" },
    { label: "תפוסה 30 ימים", value: `${stats.occupancy30d}%`, tone: "" },
    { label: "הכנסות 30 ימים", value: `₪${stats.revenue30d.toLocaleString("he-IL")}`, tone: "" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card px-3 py-2.5">
          <div className="text-[11px] text-muted-foreground">{t.label}</div>
          <div className={`text-lg font-semibold ${t.tone}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Booking detail (§4, §11, §12) ─────────────────────────────────────────── */

function BookingDetail({
  businessId, booking, units, onClose, onDone,
}: {
  businessId: string;
  booking: PmsBooking;
  units: PmsUnit[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [unitId, setUnitId] = useState(booking.unit_id);
  const [checkIn, setCheckIn] = useState(booking.check_in);
  const [checkOut, setCheckOut] = useState(booking.check_out);
  const [guests, setGuests] = useState(String(booking.guests));
  const [total, setTotal] = useState(String(booking.total));
  const [notes, setNotes] = useState(booking.notes ?? "");

  const isBlock = booking.kind === "block";
  const nights = nightsBetween(checkIn, checkOut);
  const meta = RENTAL_STATUS_META[
    isBlock ? "blocked" : booking.status === "pending" ? "pending"
    : booking.status === "cancelled" ? "cancelled" : "booked"
  ];

  function save() {
    start(async () => {
      const res = await updateBookingAction(businessId, booking.id, {
        unitId, checkIn, checkOut,
        guests: Number(guests) || 1,
        total: Number(total),
        notes,
      });
      if (res.error) toast.error(res.error);
      else { toast.success("ההזמנה עודכנה ✓"); onDone(); }
    });
  }

  function setStatus(status: RentalBookingStatus) {
    start(async () => {
      const res = status === "cancelled"
        ? await cancelBookingAction(businessId, booking.id)
        : await updateBookingAction(businessId, booking.id, { status });
      if (res.error) toast.error(res.error);
      else {
        toast.success(status === "cancelled" ? "ההזמנה בוטלה — התאריכים שוחררו ✓" : "הסטטוס עודכן ✓");
        onDone();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBlock ? <Ban className="size-4" /> : <CalendarCheck className="size-4" />}
            {isBlock ? "חסימת יחידה" : `הזמנה #${booking.booking_no}`}
            <Badge style={{ background: meta.fill, color: meta.ink }} className="border-0">
              {BOOKING_STATUS_LABEL[booking.status] ?? booking.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {!edit ? (
          <div className="space-y-3 text-sm">
            {!isBlock && (
              <>
                <Field icon={Users} label="אורח" value={booking.guest_name ?? "—"} />
                <Field icon={Phone} label="טלפון" value={booking.guest_phone ?? "—"} />
                {booking.guest_email && <Field icon={Mail} label="אימייל" value={booking.guest_email} />}
              </>
            )}
            {isBlock && booking.block_reason && (
              <Field icon={Ban} label="סיבה" value={booking.block_reason} />
            )}
            <Field icon={BedDouble} label="יחידה" value={booking.unit_name} />
            <Field
              icon={Clock}
              label="שהייה"
              value={`${booking.check_in} → ${booking.check_out} · ${booking.nights} לילות`}
            />
            {!isBlock && (
              <>
                <Field icon={Users} label="מספר אורחים" value={String(booking.guests)} />
                <Field
                  icon={Banknote}
                  label="מחיר"
                  value={`₪${Number(booking.total).toLocaleString("he-IL")}${
                    Number(booking.price_per_night) > 0
                      ? ` (₪${Number(booking.price_per_night).toLocaleString("he-IL")} ללילה)`
                      : ""
                  }`}
                />
                <Field
                  icon={Banknote}
                  label="תשלום"
                  value={booking.payment_status === "paid" ? "שולם" : "טרם שולם"}
                />
              </>
            )}
            {booking.notes && <Field icon={History} label="הערות" value={booking.notes} />}
            <Field
              icon={History}
              label="נוצרה"
              value={`${booking.created_at.slice(0, 10)} · ${
                booking.source === "manual" ? "ידנית" : booking.source === "import" ? "יבוא" : "מהאתר"
              }`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">יחידה</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <DateField label="כניסה" value={checkIn} onChange={setCheckIn} />
              <DateField label="יציאה" value={checkOut} onChange={setCheckOut} min={addDays(checkIn, 1)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {nights > 0 ? `${nights} לילות` : "תאריך היציאה חייב להיות אחרי הכניסה"}
            </p>
            {!isBlock && (
              <div className="grid grid-cols-2 gap-2">
                <NumField label="אורחים" value={guests} onChange={setGuests} />
                <NumField label="מחיר כולל (₪)" value={total} onChange={setTotal} />
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">הערות</span>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
          </div>
        )}

        {/* Status flow (§9) — cancel is separate so it never sits mid-row. */}
        {!isBlock && booking.status !== "cancelled" && (
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {BOOKING_STATUS_FLOW.filter((s) => s !== "cancelled" && s !== booking.status).map((s) => (
              <Button
                key={s} variant="outline" size="sm" disabled={pending}
                onClick={() => setStatus(s)}
              >
                {BOOKING_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          {edit ? (
            <>
              <Button onClick={save} disabled={pending || nights < 1} className="gap-1.5">
                {pending && <Loader2 className="size-4 animate-spin" />} שמירה
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>ביטול</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEdit(true)}>עריכה</Button>
              {booking.status !== "cancelled" && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => setStatus("cancelled")}
                >
                  <X className="size-4" />
                  {isBlock ? "שחרור החסימה" : "ביטול הזמנה"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Quick booking (§8, §22) ───────────────────────────────────────────────── */

function QuickBooking({
  businessId, units, initial, onClose, onDone,
}: {
  businessId: string;
  units: PmsUnit[];
  initial: { unitId?: string; checkIn: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(addDays(initial.checkIn, 1));
  const [guests, setGuests] = useState("2");
  const [available, setAvailable] = useState<AvailableUnit[] | null>(null);
  const [picked, setPicked] = useState<AvailableUnit | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const nights = nightsBetween(checkIn, checkOut);
  const total = picked
    ? priceOverride.trim() !== "" ? Number(priceOverride) : rentalTotal(picked.nightly, nights)
    : 0;

  function search() {
    setPicked(null);
    startCheck(async () => {
      const res = await checkAvailabilityAction(businessId, checkIn, checkOut, Number(guests) || 1);
      if (res.error) { toast.error(res.error); setAvailable(null); return; }
      setAvailable(res.units ?? []);
      // Straight from a clicked cell: pre-select that unit if it survived the check.
      const preferred = res.units?.find((u) => u.id === initial.unitId);
      if (preferred) setPicked(preferred);
    });
  }

  function submit() {
    if (!picked) return;
    startSave(async () => {
      const res = blocking
        ? await blockUnitAction(businessId, {
            unitId: picked.id, checkIn, checkOut, reason: blockReason,
          })
        : await createBookingAction(businessId, {
            unitId: picked.id, checkIn, checkOut,
            guestName: name, guestPhone: phone, guestEmail: email,
            guests: Number(guests) || 1,
            pricePerNight: picked.nightly,
            total: priceOverride.trim() !== "" ? Number(priceOverride) : null,
            notes,
            status: "confirmed",
          });
      if (res.error) toast.error(res.error);
      else {
        toast.success(blocking ? "היחידה נחסמה ✓" : "ההזמנה נוצרה ומופיעה בלוח ✓");
        onDone();
      }
    });
  }

  const unitName = initial.unitId ? units.find((u) => u.id === initial.unitId)?.name : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{blocking ? "חסימת יחידה" : "הזמנה חדשה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <DateField label="כניסה" value={checkIn} onChange={(v) => {
              setCheckIn(v);
              if (checkOut <= v) setCheckOut(addDays(v, 1));
            }} />
            <DateField label="יציאה" value={checkOut} onChange={setCheckOut} min={addDays(checkIn, 1)} />
            <NumField label="אורחים" value={guests} onChange={setGuests} />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={search} disabled={checking || nights < 1} className="gap-1.5">
              {checking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              בדוק זמינות
            </Button>
            <span className="text-xs text-muted-foreground">
              {nights > 0 ? `${nights} לילות${unitName ? ` · ${unitName}` : ""}` : "בחרו טווח תקין"}
            </span>
            <button
              type="button"
              onClick={() => setBlocking((b) => !b)}
              className="ms-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {blocking ? "חזרה להזמנה" : "חסימה לתחזוקה"}
            </button>
          </div>

          {available !== null && (
            available.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                אין יחידות פנויות בטווח הזה. נסו תאריכים אחרים או פחות אורחים.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  נמצאו {available.length} יחידות זמינות
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {available.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setPicked(u)}
                      className={`rounded-xl border p-2 text-right transition ${
                        picked?.id === u.id
                          ? "border-primary ring-1 ring-primary"
                          : "hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {u.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <BedDouble className="size-4 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {[u.typeName, `עד ${u.maxGuests}`, `₪${u.nightly.toLocaleString("he-IL")} ללילה`]
                              .filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold">
                        סה״כ ₪{u.total.toLocaleString("he-IL")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {picked && !blocking && (
            <div className="space-y-2 border-t pt-3">
              <div className="grid grid-cols-2 gap-2">
                <TextField label="שם מלא *" value={name} onChange={setName} />
                <TextField label="טלפון *" value={phone} onChange={setPhone} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="אימייל" value={email} onChange={setEmail} />
                <NumField
                  label={`מחיר כולל (ברירת מחדל ₪${rentalTotal(picked.nightly, nights).toLocaleString("he-IL")})`}
                  value={priceOverride}
                  onChange={setPriceOverride}
                />
              </div>
              <Textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} placeholder="הערות (לא חובה)"
              />
              <p className="text-sm font-semibold">
                לתשלום: ₪{Number(total || 0).toLocaleString("he-IL")}
              </p>
            </div>
          )}

          {picked && blocking && (
            <Input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="סיבת החסימה (למשל: תחזוקה)"
            />
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            onClick={submit}
            disabled={saving || !picked || nights < 1 || (!blocking && (!name.trim() || !phone.trim()))}
            className="gap-1.5"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {blocking ? "חסום יחידה" : "צור הזמנה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>סגירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Small field primitives ────────────────────────────────────────────────── */

function Field({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="break-words">{value}</div>
      </div>
    </div>
  );
}

function DateField({
  label, value, onChange, min,
}: { label: string; value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {/* type="date" hands back a plain YYYY-MM-DD string — no Date object, no
          timezone conversion, same shape the database stores. */}
      <Input type="date" dir="ltr" value={value} min={min} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
