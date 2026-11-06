"use client";

import { useMemo, useState, useTransition } from "react";
import { BedDouble, Users, CalendarDays, Loader2 } from "lucide-react";

import { isRangeAvailable, nightsBetween, rentalTotal } from "@/lib/rentals";
import { startRentalCheckoutAction } from "@/lib/actions/rentals";
import type { PublicUnit } from "@/lib/services/rentals.service";
import { inkOn } from "@/lib/storefront-brand";

export function RentalBooking({
  slug,
  unit,
  brand,
}: {
  slug: string;
  unit: PublicUnit;
  brand: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  // Units saved before the gallery column existed only carry image_url.
  const photos = useMemo(
    () => (unit.images?.length ? unit.images : unit.image_url ? [unit.image_url] : []),
    [unit.images, unit.image_url],
  );
  const [shown, setShown] = useState(0);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState(1);
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nights = nightsBetween(checkIn, checkOut);
  const available = useMemo(
    () => (nights >= 1 ? isRangeAvailable(checkIn, checkOut, unit.bookedRanges) : true),
    [checkIn, checkOut, nights, unit.bookedRanges],
  );
  const total = rentalTotal(Number(unit.nightly_price), nights);
  const canBook =
    nights >= 1 && available && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 9;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await startRentalCheckoutAction(slug, {
        unitId: unit.id,
        checkIn,
        checkOut,
        name,
        phone,
        email: email || undefined,
        guests,
        company_website: hp,
      });
      if (!res.ok || !res.url) setError(res.error ?? "ההזמנה נכשלה");
      else window.location.href = res.url;
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      {photos.length > 0 ? (
        <div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[Math.min(shown, photos.length - 1)]}
              alt={unit.name}
              className="h-44 w-full object-cover"
            />
            {photos.length > 1 && (
              <span className="absolute end-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                {Math.min(shown, photos.length - 1) + 1}/{photos.length}
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto px-2 pt-2">
              {photos.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setShown(i)}
                  aria-label={`תמונה ${i + 1} מתוך ${photos.length}`}
                  aria-current={i === shown}
                  className="shrink-0 rounded-md ring-offset-1 transition-opacity hover:opacity-100"
                  style={{
                    opacity: i === shown ? 1 : 0.55,
                    boxShadow: i === shown ? `0 0 0 2px ${brand}` : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="size-12 rounded-md object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-44 w-full items-center justify-center" style={{ background: `${brand}12` }}>
          <BedDouble className="size-10" style={{ color: brand }} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold">{unit.name}</h3>
          <div className="shrink-0 text-end">
            <span className="text-lg font-extrabold" style={{ color: brand }}>
              ₪{Number(unit.nightly_price).toLocaleString()}
            </span>
            <span className="text-xs text-zinc-500"> / לילה</span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          <Users className="size-3.5" /> עד {unit.max_guests} אורחים
        </div>
        {unit.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
            {unit.description}
          </p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-2.5 border-t pt-4">
          <input
            type="text" tabIndex={-1} autoComplete="off" value={hp}
            onChange={(e) => setHp(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 }}
            aria-hidden
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">
              תאריך כניסה
              <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm" required />
            </label>
            <label className="text-xs text-zinc-500">
              תאריך יציאה
              <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm" required />
            </label>
          </div>

          {nights >= 1 && !available && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <CalendarDays className="me-1 inline size-3.5" />
              התאריכים האלה כבר תפוסים — נסו תאריכים אחרים
            </p>
          )}
          {nights >= 1 && available && (
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <span className="text-zinc-600">{nights} לילות × ₪{Number(unit.nightly_price).toLocaleString()}</span>
              <span className="font-bold" style={{ color: brand }}>₪{total.toLocaleString()}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="שם מלא *" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="טלפון *" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="אימייל לאישור (מומלץ)" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="flex items-center justify-between text-sm text-zinc-600">
            מספר אורחים
            <input type="number" min={1} max={unit.max_guests} value={guests}
              onChange={(e) => setGuests(Math.max(1, Math.min(unit.max_guests, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm" />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending || !canBook}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brand, color: inkOn(brand) }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />}
            {nights >= 1 && available ? `הזמנה ותשלום · ₪${total.toLocaleString()}` : "הזמנה ותשלום"}
          </button>
        </form>
      </div>
    </div>
  );
}
