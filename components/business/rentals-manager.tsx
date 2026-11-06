"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, Plus, Trash2, Pencil, Check, X, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagesField } from "@/components/business/images-field";
import { saveUnitAction, deleteUnitAction, setReservationStatusAction } from "@/lib/actions/rentals";
import { MAX_UNIT_IMAGES } from "@/lib/rentals";
import type { RentalUnit } from "@/types/database";
import type { ReservationRow } from "@/lib/services/rentals.service";

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const PAY_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  refunded: "זוכה",
  failed: "נכשל",
};

/**
 * "תזמון לילות" — the nights the business sells, managed from inside the חנות
 * screen. A night is a product like any other: it has a price, a photo and a
 * gallery, it goes on the public site, and it is paid for at the same
 * checkout. The only thing that makes it special is that its "stock" is a
 * calendar, so it gets its own card next to the product catalog rather than a
 * separate screen the owner has to remember exists.
 */
export function RentalsManager({
  businessId,
  units,
  reservations,
}: {
  businessId: string;
  units: RentalUnit[];
  reservations: ReservationRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<RentalUnit | null>(null);
  const [adding, setAdding] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function openAdd() {
    setEditing(null);
    setImages([]);
    setAdding(true);
  }

  function openEdit(unit: RentalUnit) {
    setAdding(false);
    // Units saved before the gallery existed only have the single image_url.
    setImages(unit.images ?? (unit.image_url ? [unit.image_url] : []));
    setEditing(unit);
  }

  function closeForm() {
    setEditing(null);
    setAdding(false);
    setImages([]);
  }

  function save(form: HTMLFormElement) {
    const fd = new FormData(form);
    start(async () => {
      const res = await saveUnitAction(businessId, {
        id: (fd.get("id") as string) || undefined,
        name: fd.get("name") as string,
        description: (fd.get("description") as string) || undefined,
        images,
        nightly_price: fd.get("nightly_price") as string,
        max_guests: fd.get("max_guests") as string,
        active: fd.get("active") === "on",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("נשמר");
        closeForm();
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteUnitAction(businessId, id);
      if (res.error) toast.error(res.error);
      else { toast.success("נמחק"); router.refresh(); }
    });
  }

  function setStatus(id: string, status: "confirmed" | "cancelled") {
    start(async () => {
      const res = await setReservationStatusAction(businessId, id, status);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <BedDouble className="size-4 text-primary" />
          <span className="text-sm font-semibold">לינה — תזמון לילות</span>
          <span className="text-xs text-muted-foreground">
            יחידות לינה שאתם מוכרים. הלקוח בוחר תאריכים, משלם, והתאריכים נחסמים אוטומטית.
          </span>
          {/* The catalog stays here — a night is one more thing the business
              sells. The CALENDAR, the availability search and the booking desk
              outgrew a card, so they have their own screen and this links to
              it rather than duplicating any of it. */}
          <Link
            href={`/businesses/${businessId}/rentals`}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            <CalendarDays className="size-3.5" />
            פתיחת לוח הלילות
          </Link>
        </div>

        {/* Units */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              יחידות הלינה שלי ({units.length})
            </h3>
            {!adding && !editing && (
              <Button size="sm" variant="outline" onClick={openAdd}>
                <Plus className="size-4" /> יחידה חדשה
              </Button>
            )}
          </div>

          {(adding || editing) && (
            <form
              // Remount per unit so the uncontrolled defaultValues follow the edited row.
              key={editing?.id ?? "new"}
              onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }}
              className="grid gap-2.5 rounded-2xl border bg-card p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
              <input name="name" defaultValue={editing?.name ?? ""} placeholder="שם היחידה *" required
                className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
              <textarea name="description" defaultValue={editing?.description ?? ""} placeholder="תיאור" rows={2}
                className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
              <div className="sm:col-span-2">
                <ImagesField
                  businessId={businessId}
                  value={images}
                  onChange={setImages}
                  max={MAX_UNIT_IMAGES}
                  label="תמונות היחידה (אופציונלי)"
                  hint="הראשונה היא התמונה הראשית"
                />
              </div>
              <label className="text-sm text-muted-foreground">מחיר ללילה (₪)
                <input name="nightly_price" type="number" min={0} step="1" defaultValue={editing?.nightly_price ?? 0}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
              </label>
              <label className="text-sm text-muted-foreground">מקסימום אורחים
                <input name="max_guests" type="number" min={1} max={99} defaultValue={editing?.max_guests ?? 2}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> פעיל (מוצג באתר)
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} שמירה
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
                  ביטול
                </Button>
              </div>
            </form>
          )}

          {units.length === 0 && !adding ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              אין עדיין יחידות לינה. הוסיפו יחידה ראשונה — היא תופיע באתר עם לוח
              תאריכים משלה, בדיוק כמו מוצר.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {units.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {u.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image_url} alt={u.name} className="size-full object-cover" />
                    ) : (
                      <BedDouble className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      {!u.active && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">מוסתר</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ₪{Number(u.nightly_price).toLocaleString()} / לילה · עד {u.max_guests} אורחים
                      {(u.images?.length ?? 0) > 1 && ` · ${u.images!.length} תמונות`}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)} aria-label="עריכה">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(u.id)} aria-label="מחיקה" disabled={pending}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reservations — hidden entirely until there is something to reserve, so
            a business that doesn't sell nights sees one compact card, not two. */}
        {(units.length > 0 || reservations.length > 0) && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="size-4" /> הזמנות לינה ({reservations.length})
            </h3>
            {reservations.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                עדיין אין הזמנות.
              </p>
            ) : (
              <div className="space-y-2">
                {reservations.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card p-3 text-sm">
                    <span className="font-medium">{r.unit_name}</span>
                    <span className="text-muted-foreground" dir="ltr">{r.check_in} → {r.check_out}</span>
                    <span className="text-muted-foreground">{r.nights} לילות · {r.guests} אורחים</span>
                    <span>{r.guest_name} ({r.guest_phone})</span>
                    <span className="font-semibold">₪{Number(r.total).toLocaleString()}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      r.status === "confirmed" ? "bg-emerald-100 text-emerald-700"
                      : r.status === "cancelled" ? "bg-zinc-100 text-zinc-500"
                      : "bg-amber-100 text-amber-700"}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">{PAY_LABEL[r.payment_status]}</span>
                    <div className="ms-auto flex gap-1">
                      {r.status !== "confirmed" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "confirmed")} disabled={pending} aria-label="אישור">
                          <Check className="size-4 text-emerald-600" />
                        </Button>
                      )}
                      {r.status !== "cancelled" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "cancelled")} disabled={pending} aria-label="ביטול">
                          <X className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
